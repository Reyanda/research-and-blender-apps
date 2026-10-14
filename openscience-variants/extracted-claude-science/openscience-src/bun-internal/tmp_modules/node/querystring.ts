(function (){"use strict";// build/release/tmp_modules/node/querystring.ts
var $, ArrayIsArray = @Array.isArray, MathAbs = Math.abs, NumberIsFinite = Number.isFinite, ObjectKeys = Object.keys, StringPrototypeCharCodeAt = @String.prototype.charCodeAt, StringPrototypeSlice = @String.prototype.slice, StringPrototypeToUpperCase = @String.prototype.toUpperCase, NumberPrototypeToString = Number.prototype.toString, __commonJS = (cb, mod = @undefined) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports), require_src = __commonJS((exports, module) => {
  function encodeStr(str, noEscapeTable, hexTable2) {
    let len = str.length;
    if (len === 0)
      return "";
    let out = "", lastPos = 0, i = 0;
    outer:
      for (;i < len; i++) {
        let c = StringPrototypeCharCodeAt.@call(str, i);
        while (c < 128) {
          if (noEscapeTable[c] !== 1) {
            if (lastPos < i)
              out += StringPrototypeSlice.@call(str, lastPos, i);
            lastPos = i + 1, out += hexTable2[c];
          }
          if (++i === len)
            break outer;
          c = StringPrototypeCharCodeAt.@call(str, i);
        }
        if (lastPos < i)
          out += StringPrototypeSlice.@call(str, lastPos, i);
        if (c < 2048) {
          lastPos = i + 1, out += hexTable2[192 | c >> 6] + hexTable2[128 | c & 63];
          continue;
        }
        if (c < 55296 || c >= 57344) {
          lastPos = i + 1, out += hexTable2[224 | c >> 12] + hexTable2[128 | c >> 6 & 63] + hexTable2[128 | c & 63];
          continue;
        }
        if (++i, i >= len)
          throw @makeErrorWithCode(139);
        let c2 = StringPrototypeCharCodeAt.@call(str, i) & 1023;
        lastPos = i + 1, c = 65536 + ((c & 1023) << 10 | c2), out += hexTable2[240 | c >> 18] + hexTable2[128 | c >> 12 & 63] + hexTable2[128 | c >> 6 & 63] + hexTable2[128 | c & 63];
      }
    if (lastPos === 0)
      return str;
    if (lastPos < len)
      return out + StringPrototypeSlice.@call(str, lastPos);
    return out;
  }
  let hexTable = new @Array(256);
  for (let i = 0;i < 256; ++i)
    hexTable[i] = "%" + StringPrototypeToUpperCase.@call((i < 16 ? "0" : "") + NumberPrototypeToString.@call(i, 16));
  let isHexTable = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ]), QueryString = module.exports = {
    unescapeBuffer,
    unescape: qsUnescape,
    escape: qsEscape,
    stringify,
    encode: stringify,
    parse,
    decode: parse
  }, unhexTable = new Int8Array([
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    10,
    11,
    12,
    13,
    14,
    15,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    10,
    11,
    12,
    13,
    14,
    15,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ]);
  function unescapeBuffer(s, decodeSpaces) {
    let out = @Buffer.allocUnsafe(s.length), index = 0, outIndex = 0, currentChar, nextChar, hexHigh, hexLow, maxLength = s.length - 2, hasHex = !1;
    while (index < s.length) {
      if (currentChar = StringPrototypeCharCodeAt.@call(s, index), currentChar === 43 && decodeSpaces) {
        out[outIndex++] = 32, index++;
        continue;
      }
      if (currentChar === 37 && index < maxLength)
        if (currentChar = StringPrototypeCharCodeAt.@call(s, ++index), hexHigh = unhexTable[currentChar], !(hexHigh >= 0)) {
          out[outIndex++] = 37;
          continue;
        } else if (nextChar = StringPrototypeCharCodeAt.@call(s, ++index), hexLow = unhexTable[nextChar], !(hexLow >= 0))
          out[outIndex++] = 37, index--;
        else
          hasHex = !0, currentChar = hexHigh * 16 + hexLow;
      out[outIndex++] = currentChar, index++;
    }
    return hasHex ? out.slice(0, outIndex) : out;
  }
  function qsUnescape(s, decodeSpaces) {
    try {
      return decodeURIComponent(s);
    } catch {
      return QueryString.unescapeBuffer(s, decodeSpaces).toString();
    }
  }
  let noEscape = new Int8Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    0
  ]);
  function qsEscape(str) {
    if (typeof str !== "string")
      if (typeof str === "object")
        str = @String(str);
      else
        str += "";
    return encodeStr(str, noEscape, hexTable);
  }
  function stringifyPrimitive(v) {
    if (typeof v === "string")
      return v;
    if (typeof v === "number" && NumberIsFinite(v))
      return "" + v;
    if (typeof v === "bigint")
      return "" + v;
    if (typeof v === "boolean")
      return v ? "true" : "false";
    return "";
  }
  function encodeStringified(v, encode) {
    if (typeof v === "string")
      return v.length ? encode(v) : "";
    if (typeof v === "number" && NumberIsFinite(v))
      return MathAbs(v) < 1000000000000000000000 ? "" + v : encode("" + v);
    if (typeof v === "bigint")
      return "" + v;
    if (typeof v === "boolean")
      return v ? "true" : "false";
    return "";
  }
  function encodeStringifiedCustom(v, encode) {
    return encode(stringifyPrimitive(v));
  }
  function stringify(obj, sep, eq, options) {
    sep ||= "&", eq ||= "=";
    let encode = QueryString.escape;
    if (options && typeof options.encodeURIComponent === "function")
      encode = options.encodeURIComponent;
    let convert = encode === qsEscape ? encodeStringified : encodeStringifiedCustom;
    if (obj !== null && typeof obj === "object") {
      let keys = ObjectKeys(obj), len = keys.length, fields = "";
      for (let i = 0;i < len; ++i) {
        let k = keys[i], v = obj[k], ks = convert(k, encode);
        if (ks += eq, ArrayIsArray(v)) {
          let vlen = v.length;
          if (vlen === 0)
            continue;
          if (fields)
            fields += sep;
          for (let j = 0;j < vlen; ++j) {
            if (j)
              fields += sep;
            fields += ks, fields += convert(v[j], encode);
          }
        } else {
          if (fields)
            fields += sep;
          fields += ks, fields += convert(v, encode);
        }
      }
      return fields;
    }
    return "";
  }
  function charCodes(str) {
    if (str.length === 0)
      return [];
    if (str.length === 1)
      return [StringPrototypeCharCodeAt.@call(str, 0)];
    let ret = new @Array(str.length);
    for (let i = 0;i < str.length; ++i)
      ret[i] = StringPrototypeCharCodeAt.@call(str, i);
    return ret;
  }
  let defSepCodes = [38], defEqCodes = [61];
  function addKeyVal(obj, key, value, keyEncoded, valEncoded, decode) {
    if (key.length > 0 && keyEncoded)
      key = decodeStr(key, decode);
    if (value.length > 0 && valEncoded)
      value = decodeStr(value, decode);
    if (obj[key] === @undefined)
      obj[key] = value;
    else {
      let curValue = obj[key];
      if (curValue.pop)
        curValue[curValue.length] = value;
      else
        obj[key] = [curValue, value];
    }
  }
  function parse(qs, sep, eq, options) {
    let obj = Object.create(null);
    if (typeof qs !== "string" || qs.length === 0)
      return obj;
    let sepCodes = !sep ? defSepCodes : charCodes(@String(sep)), eqCodes = !eq ? defEqCodes : charCodes(@String(eq)), sepLen = sepCodes.length, eqLen = eqCodes.length, pairs = 1000;
    if (options && typeof options.maxKeys === "number")
      pairs = options.maxKeys > 0 ? options.maxKeys : -1;
    let decode = QueryString.unescape;
    if (options && typeof options.decodeURIComponent === "function")
      decode = options.decodeURIComponent;
    let customDecode = decode !== qsUnescape, lastPos = 0, sepIdx = 0, eqIdx = 0, key = "", value = "", keyEncoded = customDecode, valEncoded = customDecode, plusChar = customDecode ? "%20" : " ", encodeCheck = 0;
    for (let i = 0;i < qs.length; ++i) {
      let code = StringPrototypeCharCodeAt.@call(qs, i);
      if (code === sepCodes[sepIdx]) {
        if (++sepIdx === sepLen) {
          let end = i - sepIdx + 1;
          if (eqIdx < eqLen) {
            if (lastPos < end)
              key += StringPrototypeSlice.@call(qs, lastPos, end);
            else if (key.length === 0) {
              if (--pairs === 0)
                return obj;
              lastPos = i + 1, sepIdx = eqIdx = 0;
              continue;
            }
          } else if (lastPos < end)
            value += StringPrototypeSlice.@call(qs, lastPos, end);
          if (addKeyVal(obj, key, value, keyEncoded, valEncoded, decode), --pairs === 0)
            return obj;
          keyEncoded = valEncoded = customDecode, key = value = "", encodeCheck = 0, lastPos = i + 1, sepIdx = eqIdx = 0;
        }
      } else {
        if (sepIdx = 0, eqIdx < eqLen) {
          if (code === eqCodes[eqIdx]) {
            if (++eqIdx === eqLen) {
              let end = i - eqIdx + 1;
              if (lastPos < end)
                key += StringPrototypeSlice.@call(qs, lastPos, end);
              encodeCheck = 0, lastPos = i + 1;
            }
            continue;
          } else if (eqIdx = 0, !keyEncoded) {
            if (code === 37) {
              encodeCheck = 1;
              continue;
            } else if (encodeCheck > 0)
              if (isHexTable[code] === 1) {
                if (++encodeCheck === 3)
                  keyEncoded = !0;
                continue;
              } else
                encodeCheck = 0;
          }
          if (code === 43) {
            if (lastPos < i)
              key += StringPrototypeSlice.@call(qs, lastPos, i);
            key += plusChar, lastPos = i + 1;
            continue;
          }
        }
        if (code === 43) {
          if (lastPos < i)
            value += StringPrototypeSlice.@call(qs, lastPos, i);
          value += plusChar, lastPos = i + 1;
        } else if (!valEncoded) {
          if (code === 37)
            encodeCheck = 1;
          else if (encodeCheck > 0)
            if (isHexTable[code] === 1) {
              if (++encodeCheck === 3)
                valEncoded = !0;
            } else
              encodeCheck = 0;
        }
      }
    }
    if (lastPos < qs.length) {
      if (eqIdx < eqLen)
        key += StringPrototypeSlice.@call(qs, lastPos);
      else if (sepIdx < sepLen)
        value += StringPrototypeSlice.@call(qs, lastPos);
    } else if (eqIdx === 0 && key.length === 0)
      return obj;
    return addKeyVal(obj, key, value, keyEncoded, valEncoded, decode), obj;
  }
  function decodeStr(s, decoder) {
    try {
      return decoder(s);
    } catch {
      return QueryString.unescape(s, !0);
    }
  }
});
$ = require_src();
return $})

