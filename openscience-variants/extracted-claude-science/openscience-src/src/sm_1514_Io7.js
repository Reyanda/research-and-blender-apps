var Fo7=S(()=>{_6();JK();Vo();uW();vo7();eW()});var Io7={};uO(Io7,{mergeDb:()=>vb_,isDiskFullError:()=>l9,insufficientSpaceMessage:()=>gb_,hasInsufficientSpace:()=>Cb_,freeDiskBytesRaw:()=>Pm,freeDiskBytes:()=>bm,fmtBytes:()=>L8,estimateImportSpace:()=>Yt,copyBlobs:()=>Fb_,cmdImport:()=>ARG,FRAMES_OF_PROJECT:()=>G1,FK_CLOSURE_CLEANUP:()=>Eo7,EXCLUDE_PROJECT_CHILD_FILTERS:()=>yPO,CROSS_ORG_TRANSFORM_COLUMNS:()=>VPO,CROSS_ORG_SCRUB_COLUMNS:()=>QPO,CROSS_ORG_EXCLUDED_TABLES:()=>XPO,AUTOINC_NATURAL_KEY:()=>Ho7,ALWAYS_SCRUB_COLUMNS:()=>So7,ALWAYS_EXCLUDED_TABLES:()=>$o7});import*as LW from"fs";import*as bG from"path";function jRG(){return`${ly_}-${process.pid}`}function $RG(O){try{return process.kill(O,0),!0}catch(z){return z.code==="EPERM"}}function jo7(O){for(let z of ZPO){let w=bG.join(O,z),W;try{W=LW.readdirSync(w,{withFileTypes:!0})}catch{continue}for(let G of W){if(!G.isDirectory()||!G.name.startsWith(ly_))continue;let x=G.name.slice(ly_.length),Y=x.startsWith("-")?Number(x.slice(1)):Number.NaN;if(Number.isInteger(Y)&&Y>0&&Y!==process.pid&&$RG(Y))continue;LW.rmSync(bG.join(w,G.name),{recursive:!0,force:!0})}}}function Bo7(O,z,w={}){if(O.dev!==z.dev)return w.forEstimator?z.size===O.size:!1;if(z.size!==O.size)return!1;if(typeof O.blocks!=="number"||typeof z.blocks!=="number")return!0;return z.blocks>=O.blocks}function SRG(O,z){let w;try{w=LW.lstatSync(O)}catch{return 0}if(!w.isDirectory())return 0;let W=0,G=[""];while(G.length){let x=G.pop(),Y;try{Y=LW.readdirSync(bG.join(O,x),{withFileTypes:!0})}catch{continue}for(let K of Y){if(x===""&&K.name.startsWith(ly_))continue;let y=bG.join(x,K.name);if(K.isDirectory())G.push(y);else if(K.isFile())try{let q=LW.statSync(bG.join(O,y)),Z=!1;try{Z=Bo7(q,LW.statSync(bG.join(z,y)),{forEstimator:!0})}catch{}if(!Z)W+=q.size}catch{}}}return W}function Yt(O,z,w,W={}){let G=0;if(jo7(w),!W.mergeAlreadyCommitted){for(let Y of["","-wal","-shm"])try{G+=LW.statSync(`${z}${Y}`).size}catch{}G*=2}let x=0;if(O)for(let Y of ZPO)x+=SRG(bG.join(O,Y),bG.join(w,Y));return{neededBytes:G+x+qPO,freeBytes:bm(w),freeBytesRaw:Pm(w),dbBytes:G,blobBytesRemaining:x}}function Cb_(O){return O.freeBytes!==null&&O.freeBytes<O.neededBytes}function gb_(O){let z=O.freeBytes??0,w=O.dbBytes>0?`(${L8(O.blobBytesRemaining)} of artifacts/files still to copy + up to ${L8(O.dbBytes+qPO)} of database growth and working space)`:`(${L8(O.blobBytesRemaining)} of artifacts/files still to copy + ${L8(qPO)} of working space)`;return`Not enough disk space to import: about ${L8(O.neededBytes)} is needed ${w}, but only ${L8(z)} is free. Free up at least ${L8(O.neededBytes-z)} and retry \u2014 `+"the import resumes where it left off."}function Lo7(O){let z=Ao7.find((w)=>LW.existsSync(bG.join(O,w)));return z?bG.join(O,z):null}function HRG(O){if(!LW.statSync(O).isDirectory())return[{db:O,blobRoot:null}];let z=[],w=Lo7(O);if(w)z.push({db:w,blobRoot:O});let W=bG.join(O,"orgs");if(LW.existsSync(W))for(let G of LW.readdirSync(W,{withFileTypes:!0})){if(!G.isDirectory())continue;let x=bG.join(W,G.name),Y=Lo7(x);if(Y)z.push({db:Y,blobRoot:x})}return z}function vb_(O,z,w={}){let W=w.log??((Z)=>process.stderr.write(Z)),{excludeTables:G,excludeProjectId:x,scrubColumns:Y,transformColumns:K}=w,{Database:y}=k_("bun:sqlite"),q=new y(z);q.run("PRAGMA busy_timeout = 5000");try{try{q.run(`ATTACH DATABASE '${O.replace(/'/g,"''")}' AS src`)}catch(k){let J=k.message,C=/^\/mnt\/[a-z]\//i.test(bG.resolve(O))?" (SQLite can't lock files on /mnt/* under WSL \u2014 copy the DB into your Linux home first)":"";throw Error(`attach ${O}: ${J}${C}`)}let Z=q.query("SELECT name FROM src.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'").all(),X=(k,J)=>q.query(`PRAGMA ${k}.table_info(${J})`).all(),Q=(k,J)=>X(k,J).map((C)=>C.name),V=0,N=0,M=0,U=[];q.run("BEGIN IMMEDIATE");for(let{name:k}of Z){let J=String(k).toLowerCase();if($o7.has(J)){U.push(J),W(`  ${k}: excluded (always)
`);continue}if(G?.has(J)){U.push(J),W(`  ${k}: excluded
`);continue}let C=`"${String(J).replace(/"/g,'""')}"`;try{let g=X("main",C);if(g.length===0){W(`  ${k}: skip (not in dest schema)
`);continue}let F=new Set(Q("src",C).map((r)=>r.toLowerCase())),L=g.find((r)=>r.pk===1&&r.type.toUpperCase()==="INTEGER")?.name,j=new Set([...So7[String(J).toLowerCase()]??[],...Y?.[J]??[]].map((r)=>r.toLowerCase())),$=g.map((r)=>r.name).filter((r)=>F.has(r)&&r!==L),H=(r)=>`"${r.replace(/"/g,'""')}"`,A=$.map(H).join(", "),E=K?.[String(J).toLowerCase()],B=$.map((r)=>j.has(r.toLowerCase())?"NULL":E?.[r.toLowerCase()]?E[r.toLowerCase()].replaceAll("{col}",H(r)):H(r)).join(", ");if(!A){W(`  ${k}: skip (no overlapping columns)
`);continue}let D=[],h=[];if(J==="queued_user_messages"){if(!F.has("state")){U.push(J),W(`  ${k}: excluded (no state column \u2014 refusing queued default)
`);continue}if(!$.includes("state")){U.push(J),W(`  ${k}: excluded (state not projected \u2014 would default to queued)
`);continue}D.push("state <> 'queued'")}if(x&&J==="projects"&&F.has("id"))D.push("id <> ?"),h.push(x);else if(x&&F.has("project_id")){if(D.push("(project_id <> ? OR project_id IS NULL)"),h.push(x),J==="frames")D.push(`id NOT IN ${G1}`),h.push(x)}else if(x&&yPO[J]){let r=yPO[J],z_=(r.match(/\?/g)??[]).length,x_=Array(z_).fill(x);try{q.query(`SELECT 1 FROM src.${C} WHERE ${r} LIMIT 0`).get(...x_),D.push(`(${r})`),h.push(...x_)}catch{W(`  ${k}: child filter unsupported by src schema \u2014 importing unfiltered
`)}}if(L){let r=Ho7[J];if(r&&r.every((z_)=>F.has(z_))){let z_=r.map((x_)=>`m."${x_}" = src.${C}."${x_}"`).join(" AND ");D.push(`NOT EXISTS (SELECT 1 FROM main.${C} m WHERE ${z_})`)}}let P=D.length?` WHERE ${D.join(" AND ")}`:"",c=`INSERT OR IGNORE INTO main.${C} (${A}) SELECT ${B} FROM src.${C}${P}`;if(h.length)q.run(c,h);else q.run(c);let l=q.query("SELECT changes() c").get().c;V+=l;let s=$.filter((r)=>j.has(r.toLowerCase()));W(`  ${k}: +${l}`+(s.length?` (scrubbed: ${s.join(", ")})`:"")+`
`)}catch(g){if(!q.inTransaction)throw g;M++,W(`  ${k}: FAILED (${g.message}) \u2014 continuing
`)}}for(let[k,J]of Eo7){if(G?.has(k))continue;try{q.run(J);let C=q.query("SELECT changes() c").get().c;if(C>0)N+=C,W(`  ${k}: -${C} orphan(s) (FK-closure cleanup)
`)}catch(C){if(!q.inTransaction)throw C}}return q.run("COMMIT"),ERG(q,W),q.run("DETACH DATABASE src"),{total:V,cleaned:N,failed:M,excluded:U}}finally{q.close()}}function ERG(O,z){let w=(K,y)=>!!O.query(`SELECT 1 FROM ${K}.sqlite_master WHERE type='table' AND name = ? COLLATE NOCASE`).get(y),W=w("main","directory_attachments")&&w("src","directory_attachments"),G=w("main","mcp_tool_grants")&&w("src","mcp_tool_grants");if(!W&&!G){z(`  bio-split fold skipped: no bio tables in src/dest schema
`);return}let x=w("main","user_agents"),Y=(K)=>x?` AND NOT EXISTS (SELECT 1 FROM main.user_agents ua
           WHERE ua.name = d.agent_name AND ua.user_id = d.user_id
             AND EXISTS (SELECT 1 FROM json_each(ua.connector_tombstones) je
                         WHERE je.value = '${K}' OR je.value = 'bundled:bio'))`:"";O.run("BEGIN IMMEDIATE");try{if(W){for(let K of rm_){let y=K.slice(8);O.run(`INSERT OR IGNORE INTO directory_attachments (server_uuid, agent_name, user_id, excluded_tools, created_at)
           SELECT '${K}', agent_name, user_id,
                  CASE WHEN excluded_tools IS NULL THEN NULL
                       ELSE replace(excluded_tools, 'mcp_bio_', 'mcp_${y}_') END,
                  created_at
           FROM directory_attachments d WHERE server_uuid = 'bundled:bio'
             AND EXISTS (SELECT 1 FROM src.directory_attachments s
                         WHERE s.server_uuid = 'bundled:bio'
                           AND s.agent_name = d.agent_name
                           AND s.user_id = d.user_id)${Y(K)}`)}if(x){let K=Uu.map((y)=>`'${y}'`).join(",");O.run(`DELETE FROM directory_attachments
           WHERE server_uuid = 'bundled:bio'
             AND EXISTS (
               SELECT 1 FROM main.user_agents ua
               WHERE ua.name = directory_attachments.agent_name
                 AND ua.user_id = directory_attachments.user_id
                 AND (
                   EXISTS (SELECT 1 FROM json_each(ua.connector_tombstones) jb
                           WHERE jb.value = 'bundled:bio')
                   OR (SELECT COUNT(DISTINCT je.value)
                       FROM json_each(ua.connector_tombstones) je
                       WHERE je.value IN (${K})) = ${Uu.length}
                 ))`)}}if(G){for(let K of sA)O.run(`DELETE FROM mcp_tool_grants
           WHERE server_id = '${K}' AND decision = 'allow'
             AND EXISTS (SELECT 1 FROM src.mcp_tool_grants sa
                         WHERE sa.server_id = '${K}'
                           AND sa.user_id = mcp_tool_grants.user_id
                           AND sa.tool_name = mcp_tool_grants.tool_name
                           AND sa.decision = 'allow')
             AND EXISTS (SELECT 1 FROM src.mcp_tool_grants sd
                         WHERE sd.server_id = 'bundled:bio'
                           AND sd.user_id = mcp_tool_grants.user_id
                           AND sd.tool_name = mcp_tool_grants.tool_name
                           AND sd.decision IN ('deny', 'ask')
                           AND sd.created_at >= mcp_tool_grants.created_at)`),O.run(`DELETE FROM mcp_tool_grants
           WHERE server_id = '${K}' AND decision = 'ask'
             AND EXISTS (SELECT 1 FROM src.mcp_tool_grants sa
                         WHERE sa.server_id = '${K}'
                           AND sa.user_id = mcp_tool_grants.user_id
                           AND sa.tool_name = mcp_tool_grants.tool_name
                           AND sa.decision = 'ask')
             AND EXISTS (SELECT 1 FROM src.mcp_tool_grants sd
                         WHERE sd.server_id = 'bundled:bio'
                           AND sd.user_id = mcp_tool_grants.user_id
                           AND sd.tool_name = mcp_tool_grants.tool_name
                           AND sd.decision = 'deny'
                           AND sd.created_at >= mcp_tool_grants.created_at)`),O.run(`INSERT INTO mcp_tool_grants (id, user_id, server_id, tool_name, decision, created_at)
           SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
                  substr(lower(hex(randomblob(2))), 2) || '-' ||
                  substr('89ab', abs(random()) % 4 + 1, 1) ||
                  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
                  user_id, '${K}', tool_name, decision, created_at
           FROM mcp_tool_grants m
           WHERE server_id = 'bundled:bio' AND decision IN ('deny', 'ask')
             AND EXISTS (SELECT 1 FROM src.mcp_tool_grants s
                         WHERE s.server_id = 'bundled:bio'
                           AND s.user_id = m.user_id
                           AND s.tool_name = m.tool_name
                           AND s.decision IN ('deny', 'ask'))
             AND NOT EXISTS (SELECT 1 FROM mcp_tool_grants e
                         WHERE e.server_id = '${K}'
                           AND e.user_id = m.user_id
                           AND e.tool_name = m.tool_name)`);O.run("DELETE FROM mcp_tool_grants WHERE server_id = 'bundled:bio' AND decision = 'allow'")}O.run("COMMIT")}catch(K){if(O.inTransaction)O.run("ROLLBACK");throw K}}async function ARG(O){let z=O[0],w=J_().org_data_dir,W=bG.join(w,"operon-cli.db");if(!z)return process.stderr.write(`Usage: ${gO} import <path>
  <path> is a ${Lw} data dir (any layout \u2014 merges every DB found and
`+`  copies artifacts/, tool-results/, compaction-history/) or a bare .db
  file (DB-only). Target: ${W}
`),4;if(!LW.existsSync(z))return process.stderr.write(`${gO} import: not found: ${z}
`),4;if(!LW.existsSync(W))return process.stderr.write(`Target ${W} does not exist.
Run \`${gO} serve\` and log in once to initialize it, then retry.
`),4;let G;try{let y=LW.realpathSync(W);G=HRG(z).filter((q)=>{if(LW.realpathSync(q.db)===y)return process.stderr.write(`  (skipping self: ${q.db})
`),!1;return!0})}catch(y){return process.stderr.write(`${gO} import: cannot read ${z}: ${y.message}
`),4}if(G.length===0)return process.stderr.write(`${gO} import: no importable DB found at ${z}
  (looked for ${Ao7.join(", ")} at the root and under orgs/*/)
`),4;try{Cw({_frameMessagesBackfillDone:!1,_tornProvenanceBackfillDone:!1,_frameBlobBackfillV2Done:!1,_fatBlobProbeHwm:null,_provenanceTerminalSweepDone:!1,_omnibusAttributionBackfillDone:!1})}catch(y){if(!l9(y))throw y}let x=0,Y=0,K=0;for(let{db:y,blobRoot:q}of G){process.stderr.write(`\u2192 ${y}
`);let Z=Yt(q,y,w);if(Cb_(Z)){process.stderr.write(`  \u2717 ${gb_(Z)}
`),K++;continue}let X=!1;try{let{total:Q,failed:V}=vb_(y,W,{});if(x+=Q,V>0)X=!0}catch(Q){let V;if(l9(Q)){let N=Pm(w),M=N!==null&&N<Z.neededBytes?Z.neededBytes-N:Z.neededBytes;V="disk filled up during the merge. Nothing is lost \u2014 free up "+`${L8(M)} and re-run; the import resumes where it left off.`}else V=Q.message;process.stderr.write(`  \u2717 DB merge failed: ${V}
`),K++;continue}if(q){let Q=await Fb_(q,w);if(Y+=Q.added,Q.failed>0)X=!0}if(X)K++}if(x>0||Y>0)try{Cw({_frameMessagesBackfillDone:!1,_tornProvenanceBackfillDone:!1,_frameBlobBackfillV2Done:!1,_fatBlobProbeHwm:null,_provenanceTerminalSweepDone:!1,_omnibusAttributionBackfillDone:!1})}catch(y){if(!l9(y))throw y;K++;let q=x>0&&Y>0?"Rows were merged and files were copied":x>0?"Rows were merged":"Files were copied";process.stderr.write(`  \u2717 disk full \u2014 could not record import state. ${q}; free up space and re-run to finish.
`)}return process.stderr.write(`Imported ${x} rows from ${G.length} source(s) into ${w}`+(K?` (${K} source(s) failed \u2014 see above).
`:`.
`)),K?4:0}async function Fb_(O,z,w=(G)=>process.stderr.write(G),W={}){let G=0,x=0,Y=!1;jo7(z);let K=W.excludeProjectId?bG.join(O,"artifacts",W.excludeProjectId)+bG.sep:null;for(let y of ZPO){let q=bG.join(O,y),Z=0,X;try{X=LW.lstatSync(q)}catch{continue}if(X.isSymbolicLink()){G++,w(`  \u2717 ${y}/: is a symlink (\u2192 ${BRG(q)}) \u2014 skipped for safety.
`+`    Replace it with the real directory (cp -r) and re-run.
`);continue}try{let Q=bG.join(z,y);LW.mkdirSync(Q,{recursive:!0});let V=bG.join(Q,jRG());LW.rmSync(V,{recursive:!0,force:!0}),LW.mkdirSync(V);let N=0,M=[""];while(M.length){let U=M.pop(),k=LW.readdirSync(bG.join(q,U),{withFileTypes:!0});for(let J of k){if(U===""&&J.name.startsWith(ly_))continue;let C=bG.join(U,J.name),g=bG.join(q,C);if(J.isSymbolicLink())continue;if(K&&(g+bG.sep).startsWith(K))continue;if(J.isDirectory()){M.push(C);continue}if(!J.isFile())continue;let F=bG.join(Q,C),L=LW.statSync(g);try{if(Bo7(L,LW.statSync(F)))continue}catch{}LW.mkdirSync(bG.dirname(F),{recursive:!0});let j=bG.join(V,String(N++));try{await LW.promises.copyFile(g,j),LW.renameSync(j,F)}catch($){throw LW.rmSync(j,{force:!0}),$}Z++,x++}}LW.rmSync(V,{recursive:!0,force:!0}),w(`  ${bG.join(bG.basename(O),y)}/: +${Z} files
`)}catch(Q){if(G++,l9(Q))Y=!0,w(`  \u2717 ${y}/: disk full (ENOSPC) part-way through the copy (${Z} file(s) landed first).
`+`    Already-copied files are kept and skipped on retry \u2014 free up space and re-run.
`);else w(`  \u2717 ${y}/: ${Q.message}
`+`    (DB merge succeeded \u2014 fix and re-run to finish this dir)
`)}}return{failed:G,added:x,diskFull:Y}}function BRG(O){try{return LW.readlinkSync(O)}catch{return"?"}}var ZPO,ly_=".operon-import-tmp",XPO,$o7,So7,QPO,VPO,G1="(WITH RECURSIVE proj_frames(id) AS (SELECT id FROM src.frames WHERE project_id = ? UNION SELECT c.id FROM src.frames c JOIN proj_frames p ON c.root_frame_id = p.id OR c.parent_frame_id = p.id) SELECT id FROM proj_frames)",yPO,Ho7,Eo7,Ao7,qPO=67108864;