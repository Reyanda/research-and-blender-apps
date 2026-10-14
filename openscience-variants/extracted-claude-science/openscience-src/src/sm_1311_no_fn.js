var HB_=S(()=>{Q5();w3();rl();Cz();bx();A6();N3_();Ny();Bv_();T0();tY();xC();Vo();bB();uB();Jm();qM();GQ_();xo_();r0();uGO();twO();WS();Hq();Xg();PJ();Pg();gD();Rv_();HV();Bg();oW();BG_();yY_();JK();gx();i3();XY_();iLO=(Hk(),dw(Sk));jB_=new Map,js=new Map;SB_=new Map;RQ7=["_input_tokens","_output_tokens","_total_cost","_cache_read_tokens","_cache_write_tokens","_aux_input_tokens","_aux_output_tokens","_aux_cost","_aux_cache_read_tokens","_aux_cache_write_tokens","_token_class_usage","_rc_fork_log"],DQ7=["ultra_mode",...uJ.filter((O)=>O!=="goal_text")]});var NP={};uO(NP,{wrapSidecarCell:()=>uQ7,wrapErroredCell:()=>tLO,segmentLog:()=>bQ7,segmentLabel:()=>NY_,readShimTemplate:()=>BB_,groupByFrame:()=>fQ7,generateRunScript:()=>oQ7,freezeToYaml:()=>IB_,exportSessionBundle:()=>CaW,exportScriptBundle:()=>FaW,emitNotebook:()=>lQ7,collectScriptBundleInputs:()=>OjO,collectInputs:()=>pQ7,codeReferencesSdk:()=>iQ7,assembleReplayTape:()=>eLO,SDK_MEMBERS:()=>dQ7,REFUSAL_ERROR_RE:()=>cQ7});import*as T9 from"fs";import*as rLO from"os";import*as y6 from"path";function NY_(O){return O.kernelKind==="operon"?"repl":O.condaEnv}function bQ7(O){let z=[],w=null,W=null,G=null,x=new Map,Y=new Map;for(let K of O){if(K.kernelKind==="host_tool"||K.language==="diff")continue;if(K.kernelId===ju){let X=Y.get(K.language)??[];if(X.push(K),Y.set(K.language,X),w&&w.language===K.language)w.cells.push(K);continue}if(K.kernelKind==="operon"){if(!G)G={index:z.length,kernelId:K.kernelId,kernelKind:"operon",condaEnv:K.condaEnv,language:K.language,cells:[]},z.push(G);G.cells.push(K);continue}if(K.kernelKind&&K.kernelKind.startsWith("byoc:")){let X=x.get(K.kernelKind);if(!X)X={index:z.length,kernelId:K.kernelId,kernelKind:K.kernelKind,condaEnv:K.condaEnv,language:K.language,cells:[]},x.set(K.kernelKind,X),z.push(X);X.cells.push(K);continue}let y=K.language==="bash",q=y?W:K.kernelId;if(!w||w.condaEnv!==K.condaEnv||q!==null&&q!==W)w={index:z.length,kernelId:K.kernelId,kernelKind:K.kernelKind,condaEnv:K.condaEnv,language:K.language,cells:[...Y.get(K.language)??[]]},z.push(w),W=q;if(!y)W=K.kernelId;w.cells.push(K)}return z}function fQ7(O){let z=[],w=[],W=null,G="",x=()=>{if(w.length>0)z.push({frameId:W,agentName:G,segments:bQ7(w)});w=[]};for(let Y of O){if(Y.kernelKind==="host_tool"||Y.language==="diff")continue;if(Y.frameId!==W)x(),W=Y.frameId,G=Y.agentName;w.push(Y)}return x(),z}function tLO(O,z,w){let W=z!=null?`errored at line ${z} in original session`:"errored in original session";if(w==="python"){let G=O.split(`
`).map((x)=>"    "+x).join(`
`);return`try:  # ${W} \u2014 wrapped so replay continues
${G}
except Exception as _e:
    print(f"[replay: cell errored as expected: {type(_e).__name__}: {_e}]")`}if(w==="r")return`tryCatch({  # ${W} \u2014 wrapped so replay continues
${O}
}, error = function(.e) cat("[replay: cell errored as expected:", conditionMessage(.e), "]\\n"))`;return`{  # ${W} \u2014 wrapped so replay continues
${O}
} || echo "[replay: cell errored as expected]"`}function uQ7(O,z){if(z==="python")return`try:  # auto-injected skill helpers; a load failure in this env must not abort the replay
    exec(compile(${JSON.stringify(`from __future__ import annotations
${O}`)}, "<skill-sidecar>", "exec"), globals())
except Exception as _e:
    print(f"[replay: sidecar failed to load in this env: {type(_e).__name__}: {_e}]")`;if(z==="r")return`tryCatch({  # auto-injected skill helpers; a load failure in this env must not abort the replay
  eval(parse(text = ${JSON.stringify(O)}), envir = globalenv())
}, error = function(.e) cat("[replay: sidecar failed to load in this env:", conditionMessage(.e), "]\\n"))`;return tLO(O,null,z)}function NaW(O){if(O.kernelKind==="operon")return{kernelspec:{name:"python3",display_name:"Python 3 (repl control-plane, stdlib-only)",language:"python"},language_info:{name:"python"}};let z={python:{name:"python3",display:`Python 3 (${O.condaEnv})`},r:{name:"ir",display:`R (${O.condaEnv})`},bash:{name:"python3",display:`Python 3 (${O.condaEnv})`}},w=z[O.language]??z.python,W=O.language==="bash"?"python":O.language;return{kernelspec:{name:w.name,display_name:w.display,language:W},language_info:{name:W}}}function MaW(O,z,w){let W=[];if(z)W.push({output_type:"stream",name:"stdout",text:z.split(`
`).map((G,x,Y)=>x<Y.length-1?G+`
`:G)});if(w||O.exitStatus==="error"||O.exitStatus==="kernel_died")W.push({output_type:"stream",name:"stderr",text:(w||"").split(`
`).map((G,x,Y)=>x<Y.length-1?G+`
`:G)});return W}function EB_(O){let z=O.split(`
`);return z.map((w,W)=>W<z.length-1?w+`
`:w)}function mQ7(O,z){if(z.size===0||!O.includes("{{artifact:"))return O;return O.replace(Tq,(w,W)=>z.get(W)??w)}function BB_(O){return O==="r"?laO:caO}function kaW(O){if(!O||typeof O!=="object")return!1;let z=O;return Array.isArray(z.messages)&&z.messages.some((w)=>{if(!w||typeof w!=="object")return!0;let W=w.role;return W!=="user"&&W!=="assistant"})}function PQ7(O){return cQ7.test(O)||O==="aborted"||O.startsWith("aborted:")||O.startsWith("detached:")}function AB_(O,z){if(O.method!=="llm"&&O.method!=="llm_batch")return{};if(O.error!=null&&PQ7(O.error))return{};try{let w=JSON.parse(O.argsJson);if(O.method==="llm")return{};let W=Array.isArray(w[0])?w[0]:[],G=Array.isArray(z)?z:[];for(let x=0;x<W.length;x++){if(!kaW(W[x]))continue;let Y=G[x];if(Y===void 0||Y===null)continue;let K=typeof Y==="object"?Y.error:void 0;if(typeof K==="string"&&PQ7(K))continue;return{legacy_system:!0}}return{}}catch{return{}}}async function eLO(O,z,w,W){let G=[];for(let x of O)for(let Y of z.get(x.cellId)??[])if(Y.error!=null)G.push({method:Y.method,error:Y.error,...AB_(Y,null)});else if(Y.derivable||a2_[Y.method]){let K=a2_[Y.method];if(K){let y=JSON.parse(Y.argsJson);G.push({method:Y.method,...await K(y,{deriveLineage:(q)=>UaW(q,w,W.artifactRepo),deriveArtifactInputPath:async(q)=>{let Z=w.get(q);if(Z)return Z;let X=await W.artifactRepo.getArtifact(q);return X?.latestVersionId?w.get(X.latestVersionId)??null:null}})})}else G.push({method:Y.method,data:null})}else if(Y.dataInline!=null){let K=JSON.parse(Y.dataInline);G.push({method:Y.method,data:K,...AB_(Y,K)})}else if(Y.dataRef!=null){let K=W.resolveDataRef(Y.dataRef),y=JSON.parse(T9.readFileSync(K,"utf8"));G.push({method:Y.method,data:y,...AB_(Y,y)})}else G.push({method:Y.method,data:null,...AB_(Y,null)});return G}async function UaW(O,z,w){let W=await w.getVersion(O);if(!W)return{artifact_id:null,version_id:O,filename:null,code:`# [claude-science] version ${O} not found at export time`,messages:[],env:{},inputs:[]};let G=W.extractedCode??"",x=W.language==="text",Y=G?mQ7(G,z):x?"":`# [claude-science] extractedCode unavailable for ${O} \u2014 run artifact reconstruct first`,y=(W.dependencyMappings?.inputs??[]).map((Z)=>({version_id:Z.version_id??null,filename:Z.filename??null,path:Z.version_id?z.get(Z.version_id)??null:null})),q=await _jO(W.environmentSnapshot,W.envSnapshotHash??null,w);return{artifact_id:W.artifactId,version_id:W.id,filename:W.artifact?.filename??null,code:Y,messages:[],env:q??{},inputs:y}}function lQ7(O,z,w,W=new Map,G="../../..",x){let Y=[],K=O.language==="bash"?"python":O.language;if(x)Y.push({cell_type:"code",source:EB_(x),metadata:{operon:{replay_shim:!0}},outputs:[],execution_count:null});let y=K==="r"?`# [claude-science] cd to bundle root so inputs/ resolve
setwd(file.path(getwd(), "${G}"))
dir.create("handoff", showWarnings = FALSE)`:`# [claude-science] cd to bundle root so inputs/ resolve
import os
os.chdir(os.path.join(os.getcwd(), "${G}"))
try:
    os.makedirs("handoff", exist_ok=True)
except OSError:
    pass`;if(Y.push({cell_type:"code",source:EB_(y),metadata:{operon:{chdir:!0}},outputs:[],execution_count:null}),O.index>0){let q=O.kernelKind==="operon"?`${Lw} control-plane kernel (\`python -I -S\`, stdlib-only). `+"These cells ran in a separate process from the analysis kernel \u2014 "+`they share the workspace cwd (\`./handoff/*.json\`) but not memory. Replaying them standalone requires a live ${Lw} daemon; the host-call tape (\`operon_tape.json\`) backs \`operon.*\` calls.
`:`Kernel restarted or environment switched. State from previous segment is gone.
`;Y.push({cell_type:"markdown",source:[`## Segment ${O.index}: ${NY_(O)}
`,`
`,q],metadata:{}})}for(let q of O.cells){let Z=mQ7(q.source,W);if(q.exitStatus==="cancelled"){Y.push({cell_type:"markdown",source:[`> **Cell cancelled** \u2014 execution was interrupted before completing.
`,`>
`,`> \`\`\`${q.language}
`,...EB_(Z).map((V)=>`> ${V}${V.endsWith(`
`)?"":`
`}`),"> ```\n"],metadata:{operon:{cell_id:q.cellId,exit_status:q.exitStatus}}});continue}let X=q.kernelId===ju,Q=q.exitStatus==="error"||q.exitStatus==="kernel_died"||X;if(X)Z=uQ7(Z,q.language);else if(Q)Z=tLO(Z,q.exitStatus==="error"?q.errorLineno:null,q.language);if(q.language!==K)if(K==="r"&&q.language==="bash")Z=`.operon_tmp <- tempfile(fileext = ".sh")
writeLines(c(${Z.split(`
`).map((N)=>JSON.stringify(N)).join(", ")}), .operon_tmp)
system2("bash", .operon_tmp)
unlink(.operon_tmp)`;else Z=`%%${q.language}
${Z}`;Y.push({cell_type:"code",source:EB_(Z),metadata:{operon:{cell_id:q.cellId,exit_status:q.exitStatus,wrapped:Q}},outputs:MaW(q,z.get(q.cellId)??"",w.get(q.cellId)??""),execution_count:q.cellIndex+1})}return{nbformat:4,nbformat_minor:4,metadata:NaW(O),cells:Y}}async function pQ7(O,z,w,W,G){let x=[],Y=new Set,K=async(q,Z)=>{if(Y.has(q))return;Y.add(q);let X=await W.get_absolute_path(q);if(!X||!T9.existsSync(X))return;let Q=`inputs/${q.slice(0,12)}-${w0(Z??q)}`;x.push({absPath:X,name:Q}),G.set(q,Q)};for(let q of O){let X=q.dependencyMappings?.inputs??[];for(let Q of X){let V=Q.version_id;if(!V)continue;let N=Q.artifact_id,M;if(N)M=(await w.getArtifact(N))?.filename;await K(V,M)}}let y=new Map;for(let q of z)for(let Z of q.source.matchAll(Tq)){let X=y.get(Z[1]);if(!X||q.createdAt<X)y.set(Z[1],q.createdAt)}for(let[q,Z]of y){if(G.has(q))continue;let X=await w.getVersion(q);if(!X){if(X=await w.getNewestVersionAtOrBefore(q,Z),!X){let V=await w.getArtifact(q);if(V?.latestVersionId)X=await w.getVersion(V.latestVersionId)}}if(!X)continue;await K(X.id,X.artifact?.filename);let Q=G.get(X.id);if(Q)G.set(q,Q)}return x}async function _jO(O,z,w){if(O&&typeof O==="object")return O;if(z){let W=await w.getContentSnapshot(z);if(W)return JSON.parse(W)}return null}function IB_(O){let z=new Set,w=new Set,W=new Set,G=new Set,x=new Set;for(let q of O.op_log??[]){if(q.result!=="success")continue;if(/uninstall|remove/i.test(q.operation)){for(let X of q.packages){let Q=X.trim().match(/^[A-Za-z0-9._-]+/)?.[0]??X;for(let V of[...z])if(V.startsWith(Q))z.delete(V);for(let V of[...w])if(V.startsWith(Q))w.delete(V)}continue}if(q.channel==="pip"){for(let X of q.packages)w.add(X.trim());continue}let Z=/pip/i.test(q.operation)?w:/r_bioc/i.test(q.operation)?G:/r_github/i.test(q.operation)?x:/r_cran/i.test(q.operation)||/\b(r|cran)\b/i.test(q.operation)?W:/^(install|create)$/i.test(q.operation)?z:null;if(!Z)continue;for(let X of q.packages){if(O.python_version&&Ed_(X,"python"))continue;if(O.r_version&&Ed_(X,"r-base"))continue;Z.add(X.trim())}}for(let q of O.conda_history?.specs??[])z.add(q);let Y=new Set;for(let q of z)Y.add(q.split(/[<>=!~\s]/)[0].toLowerCase().replace(/[-_]/g,"-"));for(let q of O.packages)if(q.channel==="conda")Y.add(q.name.toLowerCase().replace(/[-_]/g,"-"));for(let q of O.requested_pip??[]){let Z=q.name.toLowerCase().replace(/[-_]/g,"-");if(Y.has(Z))continue;w.add(`${q.name}==${q.version}`)}if(z.size===0&&w.size===0&&W.size===0&&G.size===0){let q=/linux|gcc|gxx|gfortran|binutils|sysroot|alsa|xcb|xorg|libx[a-z]+$|libgl|libegl|libdrm|libglu|libglx|libglvnd|libopengl|systemd|keyutils|libcap|libnsl|libgomp|pulseaudio|xkeyboard|_openmp_mutex|conda-gcc|libsanitizer|libstdcxx|libgcc-ng|dbus|libcups|libpciaccess/i;for(let Z of O.packages)if(Z.channel==="pip")w.add(`${Z.name}==${Z.version}`);else if(Z.channel==="r")W.add(`${Z.name}=${Z.version}`);else if(!q.test(Z.name))z.add(`${Z.name}=${Z.version}`)}let K=new Set(["conda-forge"]);for(let q of O.conda_history?.channels??[])K.add(q);if(G.size>0)K.add("bioconda");for(let q of O.op_log??[]){if(q.result!=="success")continue;let Z=`${q.operation} ${(q.packages??[]).join(" ")}`;for(let X of Z.matchAll(/(?:^|\s)(?:-c|--channel)[=\s]+(\S+)/g))if(X[1]!=="defaults")K.add(X[1])}let y=[`name: ${O.environment_name}`,"channels:"];for(let q of K)y.push(`  - ${q}`);if(y.push("dependencies:"),O.python_version)y.push(`  - python=${O.python_version}`);if(O.r_version)y.push(`  - r-base=${O.r_version}`);if(y.push("  - jupyter","  - nbconvert"),O.python_version||!O.r_version)y.push("  - pip");if(O.r_version)y.push("  - r-irkernel");for(let q of z)y.push(`  - ${q}`);for(let q of W)y.push(`  - ${q.startsWith("r-")?q:`r-${q}`}`);for(let q of G)y.push(`  - bioconductor-${q.toLowerCase()}`);if(w.size>0){y.push("  - pip:");for(let q of w)y.push(`    - ${q}`)}if(x.size>0){y.push(""),y.push("# NOTE: the following were installed from GitHub \u2014 install manually:");for(let q of x)y.push(`#   remotes::install_github("${q}")`)}return y.join(`
`)+`
`}function JaW(O){let z=O.frames.reduce((W,G)=>W+G.segments.reduce((x,Y)=>x+Y.cell_count,0),0),w=O.frames.map((W)=>`  - \`${W.dir}/\` \u2014 ${W.agent_name} (${W.segments.length} segment${W.segments.length===1?"":"s"}, ${W.segments.reduce((G,x)=>G+x.cell_count,0)} cells)`).join(`
`);return`# ${Lw} reproducibility bundle

Root frame: \`${O.frame_id}\`
Generated: ${O.created_at}

## Contents

- \`frames/\` \u2014 ${O.frames.length} agent${O.frames.length===1?"":"s"}, ${z} total cells
${w}
- \`inputs/\` \u2014 ${O.inputs.length} file(s) referenced by the session
- \`outputs/\` \u2014 ${O.outputs.length} artifact(s) produced
${O.excluded_outputs?.length?`- ${O.excluded_outputs.length} artifact(s) not bundled \u2014 saved by frames with no replayable kernel cells (e.g. host-side file edits); see \`excluded_outputs\` in manifest.json
`:""}- \`run.sh\` \u2014 press-play reproduction

## Run

\`\`\`bash
bash run.sh
\`\`\`

Re-runs all cells; downloads and API calls execute live. Inputs are
bundled for reference \u2014 cell sources reference them via rewritten
\`inputs/\u2026\` paths where the original used \`{{artifact:ID}}\` markers.
${O.live_scan_envs?.length?`
> \u26A0\uFE0F **Environment caveat:** \`environment.yml\` for ${O.live_scan_envs.map((W)=>`\`${W}\``).join(", ")} reflects disk state at *export* time, not session time \u2014 no artifact was saved from ${O.live_scan_envs.length===1?"this environment":"these environments"} during the session. Package versions may differ from what the cells actually ran with.
`:""}`}function oQ7(O){let z=O.frame_id.slice(0,8),w=(Y)=>`bundle-${z}-${Y}`,W=new Map;for(let Y of O.frames)for(let K of Y.segments){if(K.kernel_kind==="operon")continue;if(!W.has(K.conda_env))W.set(K.conda_env,`${Y.dir}/${String(K.index).padStart(2,"0")}-${NY_({kernelKind:K.kernel_kind,condaEnv:K.conda_env})}/environment.yml`)}let G=[...W.entries()].map(([Y,K])=>{let y=w(Y);return`if [ -f "${K}" ]; then
  if ! conda env list | grep -q "^${y} "; then
    echo "Creating conda env ${y} from ${K}..."
    conda env create -f "${K}" -n ${y}
  fi
else
  echo "Warning: ${K} not found; skipping env ${y}" >&2
fi`}).join(`

`),x=O.frames.flatMap((Y)=>Y.segments.map((K)=>{let y=`${Y.dir}/${String(K.index).padStart(2,"0")}-${NY_({kernelKind:K.kernel_kind,condaEnv:K.conda_env})}`;if(K.kernel_kind==="operon")return`# \u2500\u2500\u2500 ${Y.agent_name} \xB7 segment ${K.index} (repl control-plane) \u2500\u2500\u2500
`+`# stdlib-only; host.*/operon.* calls replay from operon_tape.json
jupyter nbconvert --to notebook --execute "${y}/notebook.ipynb" --output executed.ipynb`;let q=w(K.conda_env),Z=K.language==="bash"?`# ${Y.agent_name} segment ${K.index}: bash cells replay via %%bash magic under python kernel
`:"";return`# \u2500\u2500\u2500 ${Y.agent_name} \xB7 segment ${K.index} (${K.conda_env}) \u2500\u2500\u2500
`+Z+`conda run -n ${q} jupyter nbconvert --to notebook --execute "${y}/notebook.ipynb" --output executed.ipynb`})).join(`

`);return`#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# \u2500\u2500\u2500 Environment setup \u2500\u2500\u2500
${G}

# \u2500\u2500\u2500 Execute notebooks \u2500\u2500\u2500
${x}

echo "\u2713 bundle reproduced \u2014 compare outputs/ against your re-run"
`}async function CaW(O,z){let w=b_(dMz.extend({user:i_}),z),{frame_id:W,version_id:G,user:x}=w,Y=w.scope??"full",y=await new NO(O.db).getFrame(W);if(!y)throw o_(`Frame ${W} not found`);if(y.projectId&&x){if(!await new Ez(O.db,O.dbRo).getProjectForUser(y.projectId,x.user_id))throw KG("Not authorized to access this frame")}let q=await lpO(O.db,W);if(q.length===0)throw o_(`No execution log for frame tree ${W}`);let Z=(X_)=>X_.kernelKind!=="host_tool"&&X_.language!=="diff";if(!q.some(Z))throw o_(`No replayable execution cells for frame tree ${W} \u2014 the `+"session contained only host-side file edits, not kernel cells.");if(Y==="sliced"){if(!G)throw L_("scope=sliced requires version_id");let[X_]=await O.db.select({cells:V_.cellSources,fid:V_.frameId}).from(V_).where(u(V_.id,G)).limit(1);if(!X_||!q.some((e)=>e.frameId===X_.fid))throw o_(`Version ${G} not found in frame tree ${W}`);let a=new Set((X_.cells??[]).map((e)=>e.cell_index));if(a.size===0)throw L_(`Version ${G} has no cell_sources \u2014 save it after the execution_log capture was enabled, or use scope=full`);if(q=q.filter((e)=>e.frameId===X_.fid&&a.has(e.cellIndex)),!q.some(Z))throw L_(`Version ${G} has no replayable cells \u2014 it was produced by `+"a host-side file edit, not a kernel cell. Use scope=full for the session-wide bundle.")}let X=q.map((X_)=>X_.cellId),Q=X.length>0?await O.db.select({id:PO.id,stdout:PO.stdout,stderr:PO.stderr}).from(PO).where(GO(PO.id,X)):[],V=new Map(Q.map((X_)=>[X_.id,X_.stdout??""])),N=new Map(Q.map((X_)=>[X_.id,X_.stderr??""])),M=new Q7(O.db),U=new Set(q.filter(Z).map((X_)=>X_.frameId)),k=[...U],J=(await Promise.all(k.map((X_)=>M.listVersionsForFrame(X_)))).flat(),C=[...new Set(q.map((X_)=>X_.frameId))].filter((X_)=>!U.has(X_)),g=(await Promise.all(C.map(async(X_)=>{try{return(await M.listVersionsForFrame(X_)).filter((a)=>!a.isIntermediate).map((a)=>({name:a.artifact?.filename??a.id,version_id:a.id,frame_id:X_,reason:"no_replayable_cells"}))}catch(a){return O.log.warn(`[exportBundle] excluded_outputs: listVersionsForFrame(${X_}) failed (${a instanceof Error?a.message:a}); omitting from breadcrumb`),[]}}))).flat(),F=new Map,L=await pQ7(J,q,M,O.services.store,F),j=[];for(let X_ of J){let a=await O.services.store.get_absolute_path(X_.id);if(!a||!T9.existsSync(a))continue;j.push({v:X_,abs:a,name:`outputs/${X_.id.slice(0,12)}-${w0(X_.artifact?.filename??X_.id)}`})}let $=new Map(F);for(let{v:X_,name:a}of j)if(!$.has(X_.id))$.set(X_.id,a);let H=fQ7(q),A;try{A=await z__(O.db,X)}catch(X_){O.log.warn(`[exportBundle] host_call_log unavailable (${X_ instanceof Error?X_.message:X_}); skipping replay shim`),A=new Map}L.push(...await OjO("",A,M,async(X_)=>{let a=await O.services.store.get_absolute_path(X_);return a&&T9.existsSync(a)?a:null},y?.projectId??null,$));let E={artifactRepo:M,resolveDataRef:(X_)=>{let a=y6.join(O.services.store._base_path,i0(y?.projectId??""),X_);return T9.existsSync(a)?a:y6.join(O.services.store._base_path,X_)}},B=T9.mkdtempSync(y6.join(rLO.tmpdir(),"operon-bundle-")),D=[],h=[...new Set(H.flatMap((X_)=>X_.segments.filter((a)=>a.kernelKind!=="operon").map((a)=>a.condaEnv)))],P=new Map,c=new Set,l=[...J].sort((X_,a)=>(a.createdAt?.getTime()??0)-(X_.createdAt?.getTime()??0));for(let X_ of l){let a=await _jO(X_.environmentSnapshot,X_.envSnapshotHash,M);if(!a)continue;let e=a.environment_name;if(!P.has(e))P.set(e,a)}let s=new Map;for(let X_ of H)for(let a of X_.segments){if(a.kernelKind==="operon")continue;s.set(a.condaEnv,X_.frameId)}let r=YW();await Promise.allSettled(h.filter((X_)=>!P.has(X_)).map(async(X_)=>{c.add(X_);try{let a=dO_(s.get(X_),X_),e=await tz.getEnvironmentFreeze(r.getEnvPath(X_),a);P.set(X_,e)}catch(a){O.log.warn(`env freeze (live scan) failed for ${X_}: ${String(a)}`)}}));let z_=[];for(let X_ of H){let a=X_.frameId.slice(0,8),e=`frames/${w0(X_.agentName)}-${a}`,A_=[];for(let I of X_.segments){let f=NY_(I),p=`${e}/${String(I.index).padStart(2,"0")}-${f}`,t=y6.join(B,p);T9.mkdirSync(t,{recursive:!0});let __=await eLO(I.cells,A,$,E),T;if(__.length>0){let w_=I.language==="bash"?"python":I.language;T=BB_(w_);let N_=y6.join(t,"operon_tape.json");T9.writeFileSync(N_,JSON.stringify(__,null,1)),D.push({absPath:N_,name:`${p}/operon_tape.json`})}let o=lQ7(I,V,N,F,void 0,T),n=y6.join(t,"notebook.ipynb");T9.writeFileSync(n,JSON.stringify(o,null,1)),D.push({absPath:n,name:`${p}/notebook.ipynb`});let O_=I.kernelKind==="operon"?void 0:P.get(I.condaEnv);if(O_){let w_=y6.join(t,"environment.yml");T9.writeFileSync(w_,IB_(O_)),D.push({absPath:w_,name:`${p}/environment.yml`})}A_.push({index:I.index,kernel_id:I.kernelId,kernel_kind:I.kernelKind,conda_env:I.condaEnv,language:I.language,cell_count:I.cells.length,notebook:`${p}/notebook.ipynb`})}z_.push({frame_id:X_.frameId,agent_name:X_.agentName,dir:e,segments:A_})}D.push(...L);for(let{abs:X_,name:a}of j)D.push({absPath:X_,name:a});let x_={frame_id:W,created_at:new Date().toISOString(),frames:z_,inputs:L.map((X_)=>({name:y6.basename(X_.name),version_id:X_.name.slice(7,19)})),outputs:J.map((X_)=>({name:X_.artifact?.filename??X_.id,version_id:X_.id})),...g.length>0&&{excluded_outputs:g},...c.size>0&&{live_scan_envs:[...c]}},q_=y6.join(B,"manifest.json");T9.writeFileSync(q_,JSON.stringify(x_,null,2)),D.push({absPath:q_,name:"manifest.json"});let K_=y6.join(B,"README.md");T9.writeFileSync(K_,JaW(x_)),D.push({absPath:K_,name:"README.md"});let R_=y6.join(B,"run.sh");return T9.writeFileSync(R_,oQ7(x_),{mode:493}),D.push({absPath:R_,name:"run.sh",mode:493}),{zipFilename:`bundle-${W.slice(0,8)}-${Y}.zip`,entries:D}}function iQ7(O){return vaW.test(O)}async function OjO(O,z,w,W,G,x){let Y=[],K=async(q,Z)=>{if(!q||x.has(q))return;let X=q.startsWith("art_")?q.slice(4):q,Q=X===q?await w.getVersion(X):null;if(!Q){let k=await w.getArtifact(X);if(k?.latestVersionId)Q=await w.getVersion(k.latestVersionId)}if(!Q)return;if(Z&&Q.artifact?.projectId!==G)return;let V=x.get(Q.id);if(V){x.set(q,V);return}let N=await W(Q.id);if(!N)return;let M=w0(Q.artifact?.filename??Q.id),U=`inputs/${Q.id.slice(0,12)}-${M}`;Y.push({absPath:N,name:U}),x.set(q,U),x.set(Q.id,U)},y=[...new Set([...O.matchAll(Tq)].map((q)=>q[1]))];for(let q of y)await K(q,!1);for(let q of z.values())for(let Z of q){if(Z.method!=="artifact_path"||Z.error!=null)continue;let X;try{let Q=JSON.parse(Z.argsJson);X=typeof Q[0]==="string"?Q[0]:""}catch{continue}await K(X,!0)}return Y}async function FaW(O,z){let{version_id:w,user:W}=b_(iMz.extend({user:i_}),z),[G]=await O.db.select({id:V_.id,frameId:V_.frameId,extractedCode:V_.extractedCode,language:V_.language,producingCellId:V_.producingCellId,cellSources:V_.cellSources,environmentSnapshot:V_.environmentSnapshot,envSnapshotHash:V_.envSnapshotHash}).from(V_).where(u(V_.id,w)).limit(1);if(!G)throw o_(`Version ${w} not found`);if(!G.extractedCode)throw L_(`Version ${w} has no extracted_code \u2014 it may predate code extraction, or extraction is still pending`);if(!G.frameId)throw L_(`Version ${w} has no associated frame`);let Y=await new NO(O.db).getFrame(G.frameId);if(Y?.projectId&&W){if(!await new Ez(O.db,O.dbRo).getProjectForUser(Y.projectId,W.user_id))throw KG("Not authorized to access this artifact")}let K=new Q7(O.db),q=(G.cellSources??[]).filter((l)=>typeof l.execution_log_id==="string").map((l)=>({cellId:l.execution_log_id})),Z;try{Z=await z__(O.db,q.map((l)=>l.cellId))}catch(l){O.log.warn(`[exportScriptBundle] host_call_log unavailable (${l instanceof Error?l.message:l}); skipping replay shim`),Z=new Map}let X=new Map,Q=await OjO(G.extractedCode,Z,K,async(l)=>{let s=await O.services.store.get_absolute_path(l);return s&&T9.existsSync(s)?s:null},Y?.projectId??null,X),V=G.extractedCode.replace(Tq,(l,s)=>X.get(s)??l),N=null,M="base",U=!1,k=await _jO(G.environmentSnapshot,G.envSnapshotHash,K);if(k)M=k.environment_name,N=IB_(k);else if(G.producingCellId){let[l]=await O.db.select({condaEnv:PO.condaEnv}).from(PO).where(u(PO.id,G.producingCellId)).limit(1);if(l){M=l.condaEnv,U=!0;try{let s=YW(),r=dO_(G.frameId,M),z_=await tz.getEnvironmentFreeze(s.getEnvPath(M),r);N=IB_(z_)}catch(s){O.log.warn(`env freeze failed for ${M}: ${String(s)}`)}}}let J=T9.mkdtempSync(y6.join(rLO.tmpdir(),"operon-script-")),C=[],g=(G.language??"python").toLowerCase(),F=gaW[g]??"txt",j=await eLO(q,Z,X,{artifactRepo:K,resolveDataRef:(l)=>{let s=y6.join(O.services.store._base_path,i0(Y?.projectId??""),l);return T9.existsSync(s)?s:y6.join(O.services.store._base_path,l)}}),$=V;if(j.length>0&&(g==="python"||g==="r")){let l=y6.join(J,"operon_tape.json");T9.writeFileSync(l,JSON.stringify(j,null,1)),C.push({absPath:l,name:"operon_tape.json"}),$=BB_(g)+`
`+V}else if(iQ7(V)&&(g==="python"||g==="r")){let l=BB_(g),s=g==="r"?l.replace(/^\.operon_tape <- .*$/m,".operon_tape <- list()  # tape unavailable for script export \u2014 see session bundle"):l.replace(/^_OPERON_TAPE = .*$/m,"_OPERON_TAPE = []  # tape unavailable for script export \u2014 see session bundle");$=(g==="r"?`# NOTE: host$\u2026/operon$\u2026 calls detected but the host-call tape is unavailable
`+`# for script export. These will raise 'tape exhausted'. Use the session
# bundle (.ipynb) for a replayable export.
`:`# NOTE: host.*/operon.* calls detected but the host-call tape is unavailable
# for script export. These will raise 'tape exhausted'. Use the session
# bundle (.ipynb) for a replayable export.
`)+s+`
`+V}let H=y6.join(J,`run.${F}`);if(T9.writeFileSync(H,$),C.push({absPath:H,name:`run.${F}`}),N){let l=y6.join(J,"environment.yml");T9.writeFileSync(l,N),C.push({absPath:l,name:"environment.yml"})}C.push(...Q);let A=g==="r"?`Rscript run.${F}`:g==="bash"?`bash run.${F}`:`python run.${F}`,E=w.slice(0,8),B=`script-${E}`,D=g==="bash"?`#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
${A}
`:N?`#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

ENV=${B}
if ! conda env list | grep -q "^$ENV "; then
  echo "Creating conda env $ENV..."
  conda env create -f environment.yml -n "$ENV"
fi

conda run -n "$ENV" ${A}
`:`#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# No environment.yml captured \u2014 running with system interpreter.
${A}
`,h=y6.join(J,"run.sh");T9.writeFileSync(h,D,{mode:493}),C.push({absPath:h,name:"run.sh",mode:493});let P=`# Script bundle

Reproduces artifact version \`${w}\`.

## Run

\`\`\`bash
./run.sh
\`\`\`

## Contents

- \`run.sh\` \u2014 press-play wrapper (creates conda env if needed, runs the script)
- \`run.${F}\` \u2014 standalone reproduction script
- \`inputs/\` \u2014 ${Q.length} file${Q.length===1?"":"s"} referenced by the script
${N?`- \`environment.yml\` \u2014 frozen conda env (${M})${U?" \u26A0\uFE0F *live scan \u2014 may not match session-time packages*":""}`:""}
`,c=y6.join(J,"README.md");return T9.writeFileSync(c,P),C.push({absPath:c,name:"README.md"}),{zipFilename:`script-${E}.zip`,entries:C}}var cQ7,gaW,dQ7="artifacts|artifact_path|artifact_marker|lineage|lineage_graph|llm|llm_batch|query|frames|children|delegate|delegation_stats|credentials|mcp|app|app_tools_list|agents|skills|compute|current_model|list_models|view_image|logs|goal|exec_peek|exec_interrupt|clear_lineage_cache|capabilities|stop_child|send_message|collect|submit_output|get_user_email|routine|model_endpoints",vaW;