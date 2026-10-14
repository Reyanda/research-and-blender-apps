#!/usr/bin/env node
// Parse inert source and return original byte ranges; never evaluate bundles.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

let parser;
try { parser = await import('@babel/parser'); }
catch {
  const require = createRequire(import.meta.url);
  const paths = ['/opt/homebrew/lib/node_modules', '/usr/local/lib/node_modules'];
  const rea = require.resolve('rea-agents/package.json', { paths });
  const resolve = createRequire(rea);
  parser = await import(pathToFileURL(resolve.resolve('@babel/parser')).href);
}
const options = { sourceType: 'module', allowUndeclaredExports: true, attachComment: false };
const hashlessParse = source => parser.parse(source, options);
const input = process.argv[2];
if (!input) throw new Error('Usage: javascript-extract.mjs INPUT [--validate]');
if (process.argv.includes('--frontend-repair')) {
  const original = fs.readdirSync(input).filter(name => name.endsWith('.js'));
  const assets = new Map();
  for (const container of original) {
    const bytes = fs.readFileSync(path.join(input, container));
    const text = bytes.toString('latin1');
    const marker = /\/assets\/([A-Za-z0-9_-]+\.js)(?!\.map)/g;
    for (const match of text.matchAll(marker)) {
      const begin = match.index + match[0].length;
      if (bytes[begin] !== 10) continue;
      const tail = /\n\/\/# debugId=[0-9a-f-]+\r?\n/g;
      tail.lastIndex = begin;
      const finish = tail.exec(text);
      if (!finish) continue;
      const end = finish.index + finish[0].length;
      const source = bytes.subarray(begin, end);
      const name = match[1];
      if (assets.has(name)) {
        if (!source.equals(assets.get(name).source)) throw new Error(`Conflicting embedded asset: ${name}`);
        continue;
      }
      hashlessParse(new TextDecoder('utf-8', { fatal: true }).decode(source));
      assets.set(name, { source, container, offset: begin, end, container_sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
  }
  for (const name of original) if (!assets.has(name)) throw new Error(`Original asset was not recovered: ${name}`);
  const selected = process.argv.includes('--existing-only') ? original : [...assets.keys()];
  const records = [];
  for (const name of selected) {
    const item = assets.get(name);
    const target = path.join(input, name);
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('Symlink output rejected');
    fs.writeFileSync(target, item.source);
    records.push({ name, source_container: item.container, container_sha256: item.container_sha256,
      start_offset: item.offset, end_offset: item.end, bytes: item.source.length,
      sha256: crypto.createHash('sha256').update(item.source).digest('hex') });
  }
  fs.writeFileSync(path.join(input, '.asset-index.json'), JSON.stringify({ schema: 'byte-boundary-asset-recovery-v1',
    source_commit: process.env.SOURCE_INPUT_COMMIT ?? null, parser: '@babel/parser 8.0.4',
    original_files: original.length, recovered_files: records.length, recoverable_files: assets.size,
    method: 'exact embedded asset path through its terminal debugId line; complete source parsed before writes', files: records }, null, 2) + '\n');
  console.log(JSON.stringify({ original_files: original.length, recovered_files: records.length,
    total_bytes: records.reduce((sum,item) => sum + item.bytes,0) }));
  process.exit(0);
}
let data = fs.readFileSync(input);
if (input.endsWith('.gz')) data = zlib.gunzipSync(data, { maxOutputLength: 256 * 1024 * 1024 });
if (process.argv.includes('--validate')) {
  const ast = hashlessParse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  console.log(JSON.stringify({ bytes: data.length, statements: ast.program.body.length }));
  process.exit(0);
}
const marker = Buffer.from('#!/usr/bin/env bun\n// @bun\n');
let start = data.indexOf(marker);
if (start < 0) {
  if (data.includes(0)) throw new Error('No supported compiled Bun source member found; binary layout cannot be guessed');
  start = 0;
}
let end = data.indexOf(0, start);
if (end < 0) end = data.length;
const bytes = data.subarray(start, end);
const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const ast = hashlessParse(source);
const boundaries = [0];
function hasLazyCall(node) {
  const stack = [node];
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'CallExpression' && item.callee?.type === 'Identifier' && item.callee.name === 'S' && item.arguments?.[0]?.type === 'ArrowFunctionExpression') return true;
    // Only top-level initializers define bundle partitions; nested callbacks do not.
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(item.type)) continue;
    for (const [key, value] of Object.entries(item)) {
      if (key === 'loc' || key === 'extra') continue;
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === 'object') stack.push(value);
    }
  }
  return false;
}
for (const statement of ast.program.body) {
  if (hasLazyCall(statement) && statement.start > 0) boundaries.push(statement.start);
}
const unique = [...new Set(boundaries)].sort((a,b) => a-b);
// Keep the program prelude together with the first lazy initializer.
if (unique.length > 1) unique.splice(1, 1);
unique.push(source.length);
const modules = [];
const internal = [];
const headerPattern = /\(function\s*\(\)\s*\{\s*"use strict";\/\/\s*([^\r\n]+)/g;
// Latin-1 keeps character and byte offsets identical while locating ASCII headers.
const binaryText = data.subarray(0, start).toString('latin1');
for (const match of binaryText.matchAll(headerPattern)) {
  const finish = data.indexOf(0, match.index);
  if (finish < 0 || finish > start) throw new Error('Unterminated builtin source member');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(match.index, finish));
  let parseStatus = 'standard-javascript';
  try { hashlessParse(text); }
  catch { parseStatus = 'bun-runtime-host-syntax'; }
  // Bun's own builtins can contain @host intrinsics. Preserve their exact bytes,
  // without changing them or claiming they are standard JavaScript modules.
  internal.push({ start_offset: match.index, end_offset: finish, type: 'function',
    parse_status: parseStatus, path: match[1].trim().replace(/^build\/release\//, '') });
}
let previousChars = 0, previousBytes = start;
for (let i = 0; i < unique.length - 1; i++) {
  const begin = unique[i], finish = unique[i+1];
  const text = source.slice(begin, finish);
  hashlessParse(text);
  const beginByte = previousBytes + Buffer.byteLength(source.slice(previousChars, begin));
  const finishByte = beginByte + Buffer.byteLength(text);
  modules.push({ start_offset: beginByte, end_offset: finishByte, type: 'smodule' });
  previousChars = finish; previousBytes = finishByte;
}
if (modules.at(-1)?.end_offset !== end) throw new Error('Source byte coverage mismatch');
console.log(JSON.stringify({ source_start: start, source_end: end, source_bytes: bytes.length, modules, internal, parser_version: '8.0.4' }));
