var hX_=S(()=>{T0();Dz();HV();w3();Hz();Pww=new Set(["completed","failed","cancelled","success","replaced"])});import{createHash as bww}from"crypto";function HpO(O){return O?oww:pww}async function Bc_(O){return(await O.all(i`SELECT 1 FROM frame_backfill_poison WHERE terminal = 1 LIMIT 1`)).length>0}function nww(O){return O?iww:dww}async function ApO(O,z,w){return Ic_(z??O,nww(await Bc_(z??O)),w)}async function Ic_(O,z,w){let W=await bX_(O);if(w){for(let G=0;G<W;G+=re)if((await O.select({id:b.id}).from(b).where(i`frames.rowid > ${G} AND frames.rowid <= ${G+re} AND ${b.updatedAt} >= ${w.touchedSinceMs} AND ${z}`).limit(1)).length>0)return!0}for(let G=w?.afterRowid??0;G<W;G+=re)if((await O.select({id:b.id}).from(b).where(i`frames.rowid > ${G} AND frames.rowid <= ${G+re} AND ${z}`).limit(1)).length>0)return!0;return!1}async function BpO(O,z){return Ic_(z??O,i`${Hu} AND json_valid(${b.contextData}) AND (
        (
          json_type(${b.contextData}, '$._system') IS NOT NULL
          AND EXISTS (SELECT 1 FROM frame_system_prompts p WHERE p.frame_id = ${b.id})
        )
        OR (
          json_type(${b.contextData}, '$._branch_meta.branches') = 'object'
          AND EXISTS (
            SELECT 1 FROM json_each(${b.contextData}, '$._branch_meta.branches') b
            WHERE b.type = 'object' AND json_type(b.value, '$.messages') = 'array'
          )
          AND EXISTS (SELECT 1 FROM frame_branch_archives a WHERE a.frame_id = ${b.id})
        )
      )`)}async function IpO(O,z,w){return Ic_(z??O,HpO(await Bc_(z??O)),w)}async function bX_(O){let w=(await O.all(i`SELECT COALESCE(MAX(rowid), 0) AS r FROM frames`))[0];if(Array.isArray(w))return Number(w[0]??0);return Number(w?.r??0)}async function Hc_(O,z){let w=await O.select({idx:zz.idx}).from(zz).where(u(zz.frameId,z)).orderBy(zz.idx);for(let W=0;W<w.length;W++){let G=w[W].idx;if(G!==W)await O.update(zz).set({idx:W}).where(i`${zz.frameId} = ${z} AND ${zz.idx} = ${G}`)}return w.length}async function sww(O,z=20,w,W,G){let x=G?.blobAuthoritative===!0,Y=new NO(O),K=G?.afterRowid??0,y=K+(G?.scanWindowRowids??re),q=W&&W.size>0?i` AND ${b.id} NOT IN (${i.join([...W].map((L)=>i`${L}`),i`, `)})`:i``,Z=!1,X=null,Q,V=HpO(await Bc_(G?.dbRo??O));try{Q=await(G?.dbRo??O).select({id:b.id,rowid:i`frames.rowid`,uaMs:i`frames.updated_at`}).from(b).where(i`frames.rowid > ${K} AND frames.rowid <= ${y} AND ${V}${q}`).orderBy(i`frames.rowid`).limit(z)}catch(L){if(!Vy(L))throw L;Z=!0,X=L,(w??console).warn({err:L,afterRowid:K,windowEnd:y},"[frame_messages backfill] driving SELECT aborted corruption-shaped \u2014 re-scanning this window header-only with per-frame predicate evaluation"),Q=await(async()=>{try{return await(G?.dbRo??O).select({id:b.id,rowid:i`frames.rowid`,uaMs:i`frames.updated_at`}).from(b).where(i`frames.rowid > ${K} AND frames.rowid <= ${y} AND ${Hu} AND ${te}${q}`).orderBy(i`frames.rowid`).limit(z)}catch(j){if(!Vy(j))throw j;throw new PX_(null,y,j)}})()}let N=Q,M=N.length===z?N[N.length-1].rowid:y,U=0,k=[],J=[],C=[],g=!0;for(let{id:L,rowid:j,uaMs:$}of N){if(!g&&(G?.interFrameYieldMs??0)>0)await new Promise((B)=>setTimeout(B,G.interFrameYieldMs));g=!1;let H=!1,A=!1,E=!1;try{if(Z){if((await O.all(i`SELECT 1 FROM frames WHERE ${b.id} = ${L} AND ${Ec_} LIMIT 1`)).length===0)continue}if(await O.transaction(async(B)=>{let D=await B.select({ctx:b.contextData,inp:b.inputData,parent:b.parentFrameId}).from(b).where(i`${b.id} = ${L}`).limit(1),h=D[0]?.ctx;if(h==null||typeof h!=="object")return;let P={...h};if(Array.isArray(h._messages)){A=!0;let l=x&&h._messages.length>0&&AJ(L);if(h._messages.length>0&&!l)H=!0;if(x&&h._messages.length>0&&!l)await B.run(i`DELETE FROM frame_messages WHERE frame_id = ${L}`);if(!l)await B.run(i`
              INSERT OR IGNORE INTO frame_messages (frame_id, idx, msg_json)
              SELECT ${L}, j.key, j.value
              FROM json_each(
                (SELECT context_data FROM frames WHERE id = ${L}),
                '$._messages'
              ) j
            `);if(h._messages.length===0)E=!0,P._message_count=await Hc_(B,L);else if(x&&h._messages.length>0)if(l)P._message_count=await Hc_(B,L);else P._message_count=h._messages.length;else{let s=await Hc_(B,L);if(P._message_count===void 0)P._message_count=s}delete P._messages}if("_system"in h){let l=h._system;if(l!=null){let s=JSON.stringify(l),r=bww("sha256").update(s).digest("hex");if(x)await B.run(i`
                INSERT INTO frame_system_prompts
                  (frame_id, payload, hash, updated_at)
                VALUES (${L}, ${s}, ${r}, ${Date.now()})
                ON CONFLICT(frame_id) DO UPDATE SET
                  payload = excluded.payload,
                  hash = excluded.hash,
                  updated_at = excluded.updated_at
                WHERE frame_system_prompts.updated_at < ${Qy()}
              `);else await B.run(i`
                INSERT OR IGNORE INTO frame_system_prompts
                  (frame_id, payload, hash, updated_at)
                VALUES (${L}, ${s}, ${r}, ${Date.now()})
              `)}else if(x)await B.run(i`
              DELETE FROM frame_system_prompts
              WHERE frame_id = ${L}
                AND updated_at < ${Qy()}
            `);delete P._system}let c=P._branch_meta;if(c?.branches&&typeof c.branches==="object"&&!Array.isArray(c.branches)){let l=Object.create(null),s=!1;for(let[r,z_]of Object.entries(c.branches)){if(z_&&Array.isArray(z_.messages)&&r!==c.active_branch_id&&!My.test(r)){s=!0,l[r]={...z_,messages:null};continue}if(z_&&Array.isArray(z_.messages)&&r!==c.active_branch_id){if(s=!0,x&&z_.messages.length>0)await B.run(i`
                  INSERT INTO frame_branch_archives
                    (frame_id, branch_id, payload, updated_at)
                  VALUES (${L}, ${r}, ${JSON.stringify(z_.messages)}, ${Date.now()})
                  ON CONFLICT(frame_id, branch_id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                  WHERE frame_branch_archives.updated_at < ${Qy()}
                `);else await B.run(i`
                  INSERT OR IGNORE INTO frame_branch_archives
                    (frame_id, branch_id, payload, updated_at)
                  VALUES (${L}, ${r}, ${JSON.stringify(z_.messages)}, ${Date.now()})
                `);l[r]={...z_,messages:null}}else if(z_&&Array.isArray(z_.messages)&&r===c.active_branch_id)s=!0,l[r]={...z_,messages:null};else l[r]=z_}if(s)P._branch_meta={...c,branches:l}}if(D[0]?.parent!=null&&Object.hasOwn(P,"_original_input")&&P._oi_divergent===void 0)if(de(P._original_input,EV(D[0]?.inp??null)))delete P._original_input;else P._oi_divergent=1;await B.update(b).set({contextData:P,updatedAt:new Date($)}).where(u(b.id,L)),await B.run(i`DELETE FROM frame_backfill_poison WHERE frame_id = ${L}`)}),H||E)nY(L);if(U++,k.push(L),A)try{await WB(Y,O,L)}catch(B){(w??console).warn({err:B,frameId:L},"[frame_messages backfill] post-migrate splice-era heal failed \u2014 skipping")}}catch(B){if(Vy(B))throw new PX_(L,j,B);if((w??console).warn({err:B,frameId:L},"[frame_messages backfill] per-frame tx failed \u2014 skipping"),tZ_(B))C.push(L);else J.push(L)}}let F=[];if(k.length>0){let L=new Map(N.map(($)=>[$.id,$.uaMs]));F=(await O.select({id:b.id}).from(b).where(i`(${i.join(k.map(($)=>i`(${b.id} = ${$} AND frames.updated_at = ${L.get($)??-1})`),i` OR `)}) AND ${Ec_}`)).map(($)=>$.id)}return{pending:N.length,migrated:U,failed:J,transientFailed:C,livelocked:F,nextCursor:M,corruptionEvidence:X}}function Rc_(O,z,w,W,G=Date.now,x){if(x?.blobAuthoritative)sF(!0);let Y=()=>{if(x?.blobAuthoritative)sF(!1)},K=null,y=0,q=0,Z=!1,X=!1,Q=0,V=null,N=new Set,M=async(g,F,L)=>{for(let j of g)await O.run(i`
        INSERT INTO frame_backfill_poison (frame_id, fail_count, terminal, reason, updated_at)
        VALUES (${j}, 1, ${L?1:0}, ${F}, ${G()})
        ON CONFLICT(frame_id) DO UPDATE SET
          fail_count = frame_backfill_poison.fail_count + 1,
          terminal = CASE
            WHEN ${L?1:0} = 1 THEN 1
            WHEN frame_backfill_poison.fail_count + 1 >= ${$pO} THEN 1
            ELSE frame_backfill_poison.terminal
          END,
          reason = ${F},
          updated_at = ${G()}
      `)},U=x?.bootGraceMs??0,k=G(),J=async()=>{if(Z||X)return;if(G()-k<U)return;if(z.count()>0){if(K=null,y++,y<jpO)return}else if(K??=G(),G()-K<uww){if(y++,y<jpO)return}y=0,Z=!0;try{V??=await bX_(x?.dbRo??O);let g=x?.tickBudgetMs??cww,F=Date.now();while(!0){let{pending:L,migrated:j,failed:$,transientFailed:H,livelocked:A,nextCursor:E,corruptionEvidence:B}=await sww(O,20,W,N,{...x,afterRowid:Q,interFrameYieldMs:x?.interFrameYieldMs??mww});Q=E,q+=j-A.length;for(let D of $)N.add(D);for(let D of H)N.add(D);if($.length>0)await M($,"per-frame tx failed",!1);if(A.length>0){for(let D of A)N.add(D);await M(A,"committed without thinning (predicate/body disagreement)",!0),W.warn({frameIds:A},"[frame_messages backfill] frame(s) committed without thinning \u2014 marked terminal in frame_backfill_poison; they remain readable via blob fallback")}if(B!=null&&x?.onBatchError&&await x.onBatchError(B).catch(()=>!1)){X=!0,clearInterval(C),W.warn({afterRowid:Q},"[frame_messages backfill] corruption verdict from a degraded driving SELECT \u2014 backfill loop halted permanently (no sentinel; probes re-decide next boot)");return}if(Q>=V){X=!0,clearInterval(C);let D=N.size;if(D===0){Y();let h=await Dc_(O);W.info(`[frame_messages backfill] complete \u2014 ${q} frames migrated`+(h>0?`; ${h} frame(s) remain terminally poisoned (see frame_backfill_poison)`:"")),await w()}else{let h=await aww(O,[...N]),P=D-h;if(P===0)W.warn({skipped:[...N]},`[frame_messages backfill] done with residue \u2014 ${q} migrated; ${D} frame(s) terminally poisoned and excluded from future sweeps/probes (delete from frame_backfill_poison to re-attempt)`),await w();else W.warn({skipped:[...N]},`[frame_messages backfill] stopped this boot \u2014 ${q} migrated; ${P} frame(s) failed and will be re-attempted next boot (terminal after ${$pO} failed boots)`)}return}if(j>0)W.info(`[frame_messages backfill] migrated ${j} frames (${q} total)`);if(L>0||Date.now()-F>=g)break}}catch(g){if(g instanceof PX_){if(Q=g.nextCursor,g.frameId!=null){N.add(g.frameId);try{await M([g.frameId],"corruption-shaped per-frame error",!1)}catch{}}}if(x?.onBatchError&&await x.onBatchError(g).catch(()=>!1)){X=!0,clearInterval(C),W.warn({err:g},"[frame_messages backfill] halted permanently by the batch-error circuit breaker (no sentinel written)");return}W.warn({err:g},"[frame_messages backfill] batch failed")}finally{Z=!1}},C=setInterval(()=>void J(),fww);return C.unref(),{stop:()=>{X=!0,clearInterval(C)},_tick:J}}async function Dc_(O){let w=(await O.all(i`SELECT COUNT(*) AS n FROM frame_backfill_poison p
        WHERE p.terminal = 1
          AND EXISTS (SELECT 1 FROM frames f WHERE f.id = p.frame_id)`))[0];if(Array.isArray(w))return Number(w[0]??0);return Number(w?.n??0)}async function aww(O,z){if(z.length===0)return 0;let W=(await O.all(i`SELECT COUNT(*) AS n FROM frame_backfill_poison
        WHERE terminal = 1 AND frame_id IN (${i.join(z.map((G)=>i`${G}`),i`, `)})`))[0];if(Array.isArray(W))return Number(W[0]??0);return Number(W?.n??0)}var fww=5000,uww=1e4,jpO=12,Ac_=120000,mww=100,cww=250,$pO=3,lww=13,Hu,te,SpO,Ec_,pww,oww,EpO,dww,iww,re=20000,PX_;