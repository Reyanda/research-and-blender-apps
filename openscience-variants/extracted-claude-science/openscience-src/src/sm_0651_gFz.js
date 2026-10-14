var CFz=S(()=>{PxO();S3_()});async function gFz(O,z,w,W,G=[]){let x=W.mode??"precision";if(x==="recall")throw Error("recall mode is not enabled in this build");if(!O.lines.length)return{final:`ANSWER: ${SX}`,turns_used:0};let Y=QFz(O),K=[],y=(j)=>/^\[(invalid|unknown|no )/i.test(j.trim()),q={...Y,search:async(j)=>{let $=await Y.search(j);if(!($.hits??[]).some((H)=>!String(H.hit_id).startsWith("reg:"))){let A=String(j.term??"").split(/\s+/).filter((E)=>E.length>=5&&!/^\d{1,4}$/.test(E)).sort((E,B)=>B.length-E.length)[0];if(A&&A!==j.term){let E=await Y.search({term:A});if((E.hits??[]).some((B)=>!String(B.hit_id).startsWith("reg:")))$={...E,text:`NOTE: no raw hits for "${j.term}" \u2014 showing fallback search "${A}"
${E.text}`}}}for(let H of $.hits??[])K.push(H.hit_id);return $},read:async(j)=>{let $=String(j.hit_id??""),H=$.match(/^h(\d+)$/i);if(H)$=K[Number(H[1])-1]??$;$=$.replace(/^r(?=\d)/i,"");let A=await Y.read({hit_id:$});return y(A.text)?{text:A.text}:A},read_filed:async(j)=>{let $=await Y.read_filed(j);return y($.text)?{text:$.text}:$}};q.search_span=q.search,q.read_unit=q.read;let Z=z.slice(0,2000),X=[...Z.matchAll(/[\w.\/~-]*(?:\/|=|_)[\w.\/~-]+|\b[0-9a-f]{8,}\b|\b\d+\.\d+\b|\b[a-zA-Z]+_[a-zA-Z0-9_]+\b/g)].map((j)=>j[0]).filter((j)=>j.length>=3),Q=(Z.match(/[a-zA-Z][a-zA-Z0-9_-]{5,}/g)??[]).filter((j)=>!/^(what|which|where|value|parameter|directory|question|archived|during|between|before|after|contains?|specified)$/i.test(j)).sort((j,$)=>$.length-j.length),V=[...new Set([...X.slice(0,2),...Q.slice(0,2)])].slice(0,3),N=[],M=(j)=>{try{let $=A3_(Bg_(O,j));return $&&!/\(no matches\)/i.test($)?`SEARCH "${j}":
${$}`:null}catch{return null}};for(let j of V){let $=M(j);if($)N.push($)}if(/\b(first|second|third|fourth|fifth|last|earliest|latest|initial|final)\b/i.test(Z))try{N.push(`LIST:
${Ig_(O)}`)}catch{}let U=N.length?`

Pre-run search results (starting material \u2014 expand hits to their enclosing units before answering; run your own searches for anything missing):

${N.join(`

`).slice(0,9000)}`:"",k={cap_terminal_mixed:!1},J=tvz(z),C=await XFz({llm:w,model:W.driverModel,system:`${znw}

(Span: ${O.raws.length} archived units. Use the tools.)`,question:`Question about the archived span: ${z}${U}`,tools:q,policy:JFz(4,k,z),calibrate:J,maxTurns:4,signal:W.signal,onUsage:W.onUsage}),g,F="",L=[];if(C.reads.length===0)g=/^[ \t]*ANSWER:/m.test(C.final)?`ANSWER: ${SX}`:C.final;else{let $=`${C.reads.map((h,P)=>`\u2500\u2500 excerpt ${P+1} [${h.unit_id??"?"}] \u2500\u2500
${h.text}`).join(`

`)}

---

Question about the archived span:
${z}`,H=lvz(C.final);if(H){let h="is NOT byte-present in the excerpts above";if(C.reads.some((c)=>pvz(H,c.text??"")))h="IS byte-present in the excerpts above";else if(H.includes("/"))for(let c of C.reads){let l=(c.text??"").toLowerCase(),s=l.indexOf(H.toLowerCase());if(s<0)continue;let r=(l.slice(s+H.length).match(/^[^\s"',)\]]+/)??[])[0];if(r){h=`IS byte-present as the leading part of the longer path \`${(H+r).slice(0,120)}\``;break}}$+=`

A first-pass reader drafted this answer from the same excerpts:
${C.final}
Verification status: the drafted value ${h}.`,$+=`
Rival scan: ${evz(C.final,C.reads,z)}.`}let A=AbortSignal.timeout(hxO),E=W.signal?AbortSignal.any([W.signal,A]):A,B=await w.chat([{role:"user",content:[{type:"text",text:$}]}],{model:W.finalModel,system:kFz(),maxTokens:1024,signal:E,noPrefillContinuation:!0,callSite:"summary_query"});try{W.onUsage?.({input:B.totalInputTokens??B.inputTokens??0,output:B.outputTokens??0,cache_read:B.cacheReadInputTokens??0,cache_write:B.cacheCreationInputTokens??0,cost:B.cost??0,credits:q1(W.finalModel,B.totalInputTokens??B.inputTokens??0,B.outputTokens??0,B.cacheReadInputTokens??0)})}catch{}F=(B.text??"").trim(),g=I3_(F,z)??`ANSWER: ${SX}`;let D=HxO(g,C.reads,z);if(D)g=D.message,L=D.offenders}return g=yFz(g,z),W.diag?.({question:z,summary_ids:G,mode:x,turns_used:C.turns_used,reads:C.reads.map((j)=>j.unit_id??"?"),calibration_fired:C.calibration_fired,budget_exhausted:C.budget_exhausted,cap_terminal_mixed:k.cap_terminal_mixed,hook_decisions:J.decisions??null,floor_offenders:L,hook_version:nvz,sp_version:NFz,loop_final:C.final,opus_raw:F,final:g}),{final:g,turns_used:C.turns_used}}var znw;