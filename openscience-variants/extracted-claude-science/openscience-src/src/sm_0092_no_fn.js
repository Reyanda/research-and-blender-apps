var R7=S(()=>{xlO();_O={CLI_DAEMON_STARTED:"operon.cli.daemon_started",FRAME_COMPLETED:"operon.frame.completed",RUNNER_LOOP_BREAK:"operon.runner.loop_break",DELEGATION_SPAWNED:"operon.delegation.spawned",ARTIFACT_CREATED:"operon.artifact.created",REMOTE_COMPUTE_SUBMITTED:"operon.remote_compute.submitted",REMOTE_COMPUTE_COMPLETED:"operon.remote_compute.completed",REMOTE_COMPUTE_REFUSED:"operon.remote_compute.refused",REMOTE_COMPUTE_CANCELLED:"operon.remote_compute.cancelled",REMOTE_COMPUTE_ORPHANS_ON_STARTUP:"operon.remote_compute.orphans_on_startup",REMOTE_COMPUTE_EXEC:"operon.remote_compute.exec",REMOTE_COMPUTE_SCP:"operon.remote_compute.scp",REMOTE_COMPUTE_APPROVAL:"operon.remote_compute.approval",REMOTE_COMPUTE_TOOL_ERROR:"operon.remote_compute.tool_error",APPROVAL_RESOLVED:"operon.approval.resolved",COMPUTE_DETAILS_EDIT:"operon.compute_details.edit",SSH_CONNECT:"operon.ssh.connect",SSH_OP_ERROR:"operon.ssh.op_error",SSH_UNREACHABLE:"operon.ssh.unreachable",SSH_DISCOVERY:"operon.ssh.discovery",SSH_PROBE:"operon.ssh.probe",SSH_CONSENT_TOGGLE:"operon.ssh.consent_toggle",BYOC_CONSENT_TOGGLE:"operon.byoc.consent_toggle",BIONEMO_CONSENT_TOGGLE:"operon.bionemo.consent_toggle",GPU_CONSENT_TOGGLE:"operon.gpu.consent_toggle",BYOC_EGRESS_GRANTS_REVOKED:"operon.byoc.egress_grants_revoked",BYOC_BOOT_REAP:"operon.byoc.boot_reap",BYOC_ENABLE_REAP:"operon.byoc.enable_reap",BYOC_DISABLE_INCOMPLETE:"operon.byoc.disable_incomplete",BYOC_TERMINATE_RETRY:"operon.byoc.terminate_retry",BYOC_TERMINATE_FAILED_QUEUED:"operon.byoc.terminate_failed_queued",COMPUTE_TERMINATE_ABANDONED:"operon.compute.terminate_abandoned",DAEMON_IDLE_EXIT_BLOCKED:"operon.daemon.idle_exit_blocked",SKILL_SEARCH_RESULT:"operon.skill_search.result",SKILL_SEARCH_SERVED:"operon.skill_search.served",SKILL_INVOKED:"operon.skill.invoked",SKILL_LOADED:"operon.skill.loaded",LINEAGE_EXTRACTED:"operon.lineage.extracted",RC_STALL:"operon.rc.stall",RC_HARD_WALL:"operon.rc.hard_wall",MEMORY_POOL:"operon.memory.pool",MEMORY_WRITE:"operon.memory.write",LINEAGE_DEPS_MAPPED:"operon.lineage.deps_mapped",LINEAGE_DEPS_REMAPPED:"operon.lineage.deps_remapped",PROVENANCE_CENSUS:"operon.provenance.census",ARTIFACT_PREVIEW_NUDGE:"operon.artifact.preview_nudge",LLM_SAMPLED:"operon.llm.sampled",LLM_REQUEST:"operon.llm.request",LLM_RETRY:"operon.llm.retry",COMPACTION_SYNC_FAILED:"operon.compaction.sync_failed",REVIEWER_REFUSAL_FALLBACK:"operon.reviewer.refusal_fallback",LLM_KEEPALIVE:"operon.llm.keepalive",MCP_CALL:"operon.mcp.call",SESSION_STARTED:"operon.session.started",SESSION_INIT_FAILED:"operon.session.init_failed",ERROR_UNHANDLED:"operon.error.unhandled",UPDATE_AVAILABLE:"operon.update.available",UPDATE_CHECK_ERROR:"operon.update.check_error",UPDATE_MANUAL_CHECK:"operon.update.manual_check",UPDATE_APPLY_STARTED:"operon.update.apply_started",UPDATE_APPLY_ERROR:"operon.update.apply_error",UPDATE_RESTARTING:"operon.update.restarting",UPDATE_RESTARTED:"operon.update.restarted",UPDATE_REQUIRED:"operon.update.required",BIOSECURITY_TRAJECTORY_SCREEN:"operon.biosecurity.trajectory_screen",BIOSECURITY_TRAJECTORY_AMBIGUOUS:"operon.biosecurity.trajectory_ambiguous",CODE_CLASSIFIER_SCREEN:"operon.code_classifier.screen",SAFETY_REFUSAL_FEEDBACK:"operon.safety_refusal.feedback",SAFETY_FP_REPORTED:"operon.safety.fp_reported",RUNNER_AUTOWAIT_STALE_BREAK:"operon.runner.autowait_stale_break",RUNNER_TERMINAL_ERROR:"operon.runner.terminal_error",AUTH_ERROR:"operon.auth.error",KERNEL_ENV_DISABLED:"operon.kernel.env_disabled",KERNEL_EXEC_FAILED:"operon.kernel.exec_failed",SANDBOX_STATUS:"operon.sandbox.status",FLAG_POLLER_FAILED:"operon.flags.poller_failed",FLAG_SERVE_CAP_RELEASED:"operon.flags.serve_cap_released",OP_ERROR:"operon.op.error",MCP_SERVER_STATUS:"operon.mcp.server_status",CODE_CLASSIFIER_DISABLED:"operon.code_classifier.disabled",APPROVAL_SURFACE_FAILED:"operon.approval.surface_failed",AUTOMODE_CLASSIFIER_ERROR:"operon.automode.classifier_error",SENTRY_GATE:"operon.sentry.gate"},YlO=new Set(["sniff","lineage","memory","compaction","rc_fold_l1","rc_fold_l2","summary_query","classifier","skill_search"]),g7w=new Set(["auth_failed","permission_denied","ECONNREFUSED","ETIMEDOUT","ENOTFOUND","EHOSTUNREACH","kex_mismatch","proxy_closed","handshake_timeout","keepalive_timeout","spawn_enoent","aborted","conn_closed","kex_exchange","mux_stale","mux_sessions_exhausted","probe_script","unclassified"]),v7w=new Set(["not_found","unauthorized","rate_limited","quota_exhausted","invalid_request","transient","image_build_failed","network_denied","network_bridge_down","ownership_mismatch","provider_degraded","helper_exited","result_rejected","over_cap","bridge_unavailable","timeout_exceeded","input_changed"]),F7w=new Set(["workdir_unreachable","harvest_failed","timeout_ceiling","adapter_unregistered"]);L7w=new Set(["overloaded","rate_limited","usage_limit","context_length","invalid_request","auth","connection","timeout","server","model_not_found","attachment_not_found","aborted","unclassified"]);j7w=new Set(["process","migration","runner","kernel","mcp","compute","llm","db","ws","http","pre_provider","telemetry","daemon_boot","sandbox","unknown"]);$7w=new Set(["auth","rate_limit","connection","server","sse_server","model_not_found","attachment_not_found","prompt_overflow","status_other","unclassified"]);S7w=new Set(["network_error","http_4xx","http_5xx","invalid_grant","unauthenticated","decrypt_failed","write_failed","parse_failed","unclassified"]);qlO=new Set(["bad_gateway","service_unavailable","too_many_requests"]),ZlO=/\/(Users|home|root)\/[^/)\s]+/g,XlO=/[A-Z]:\\Users\\[^\\)\s]+/g;H7w=[[ZlO,"/~"],[/[A-Za-z]:(?:\\[^\\:)\s]+)+\\([^\\:)\s]+):\d+:\d+/g,"$1:L:C"],[XlO,"/~"],[/(?:\/[^:)/\s]+)+\/([^/:)\s]+):\d+:\d+/g,"$1:L:C"],[/:\d+:\d+\)/g,":L:C)"],[/\b0x[0-9a-fA-F]+\b/g,"0xADDR"]];NlO=C7w(16).toString("hex");klO=new Set;E7w=new Set(["alphafold2","bindcraft","boltz","borzoi","chai1","de-novo-antibody-design","diffdock","esmfold2","esmfold2-binder-design","esmfold2-binder-filtering","esmfold2-internal-ops","evo2","fair-esm2","ligandmpnn","openfold3","proteinmpnn","rfdiffusion","scgpt","solublempnn"]);A7w=new Set(["directory","custom","bundled","local-stdio","antmcp"]);B7w=new Set(["python","r","operon-mcp"]);OX_={logEvent(){},logError(){}}});import{spawn as ClO}from"child_process";import{once as glO}from"events";import*as Mu from"fs/promises";import{StringDecoder as I7w}from"string_decoder";function nA(O,z){if(O.pid!==void 0)try{process.kill(-O.pid,z);return}catch{}try{O.kill(z)}catch{}}function vlO(O){if(O.pid===void 0)return()=>{};let z=O.pid;zX_.add(z);let w=()=>zX_.delete(z);return O.once("close",w),O.once("error",w),()=>{O.off("close",w),O.off("error",w)}}function Ie(O){for(let z of zX_)try{process.kill(-z,O)}catch{}}class FlO{stdin;stdout;stderr;extraStdio;exited;procExit;pid;alive;hasExited=!1;_child;constructor(O){this._child=O;let z=O.stdin;if(z.on("error",()=>{}),this.stdin={write:(w)=>z.write(w),end:()=>z.end(),drained:()=>new Promise((w)=>{if(z.destroyed)return w();let W=()=>{z.off("drain",W),z.off("close",W),w()};z.once("drain",W),z.once("close",W)})},this.stdout=O.stdout,this.stderr=O.stderr,O.stdio.length>3){this.extraStdio=O.stdio.slice(3).filter((w)=>w!==null);for(let w of this.extraStdio)w.on("error",()=>{})}this.pid=O.pid,this.alive=!0,this.procExit=new Promise((w)=>{O.once("exit",(W,G)=>{this.hasExited=!0,w(G!==null?{kind:"signal",signal:G}:{kind:"code",code:W??0})})}),this.exited=new Promise((w)=>{O.once("close",(W,G)=>{this.alive=!1,w(G!==null?{kind:"signal",signal:G}:{kind:"code",code:W??0})}),O.once("error",()=>{this.alive=!1,this.hasExited=!0,w({kind:"signal"})})})}kill(O){nA(this._child,R7w[O])}}function lm_(O,z,w){if(!O.alive)return Promise.resolve(!0);return Promise.race([O.exited.then(()=>!0),new Promise((W)=>{let G=setTimeout(()=>W(!1),z);if(w?.unrefTimer)G.unref()})])}async function wX_(O,z){let w=z?.stepMs??5000,W=()=>lm_(O,w,{unrefTimer:z?.unrefTimers});if(z?.closeStdinFirst){try{O.stdin.end()}catch{}if(await W())return}if(O.alive){try{O.kill("terminate")}catch{}if(await W())return}if(O.alive){try{O.kill("force")}catch{}if(z?.waitAfterForce!==!1)await W()}}function WX_(O,z){let w=(G)=>O.execKernel(G,{condaWrite:!0}),W=(G,x)=>{if(G.exitCode!==0)throw Error(`${x}: ${G.stderr.trim()||`exit ${G.exitCode}`}`);return G.stdout};return{condaRoot:()=>z,platform:()=>O.platform(),arch:()=>O.arch(),async scanPackagesBatched(G){let x=`
import sys, glob, json, os.path as op

env = sys.argv[1]

for f in glob.glob(op.join(env, "conda-meta", "*.json")):
    if op.basename(f) == "history":
        continue
    try:
        with open(f) as h:
            d = json.load(h)
        n, v = d.get("name", ""), d.get("version", "")
        if n:
            print(f"conda\\t{n}\\t{v}")
    except Exception:
        pass

def kv(path):
    n, v = "", ""
    try:
        with open(path, encoding="utf-8", errors="replace") as h:
            for line in h:
                if line.startswith("Name:"):
                    n = line[5:].strip()
                elif line.startswith("Version:"):
                    v = line[8:].strip()
                if n and v:
                    break
    except Exception:
        pass
    return n, v

for sp in glob.glob(op.join(env, "lib", "python*", "site-packages")):
    for meta in glob.glob(op.join(sp, "*.dist-info", "METADATA")):
        n, v = kv(meta)
        if n:
            print(f"pip\\t{n}\\t{v}")
    for pkginfo in glob.glob(op.join(sp, "*.egg-info", "PKG-INFO")):
        n, v = kv(pkginfo)
        if n:
            print(f"pip\\t{n}\\t{v}")

for desc in glob.glob(op.join(env, "lib", "R", "library", "*", "DESCRIPTION")):
    p, v = "", ""
    try:
        with open(desc, encoding="utf-8", errors="replace") as h:
            for line in h:
                if line.startswith("Package:"):
                    p = line[8:].strip()
                elif line.startswith("Version:"):
                    v = line[8:].strip()
                if p and v:
                    break
    except Exception:
        pass
    if p:
        print(f"r\\t{p}\\t{v}")
`.trim(),Y=await w(`python3 - ${rY(G)} <<'__SCAN_EOF__'
${x}
__SCAN_EOF__`);if(Y.exitCode!==0)return console.warn(`[conda] scanPackagesBatched nonzero (${Y.exitCode}): ${Y.stderr}`),null;return Y.stdout},async scanEnvsBatched(G,x,Y){let K=`
import sys, os, os.path as op, json, subprocess, re, glob

envs_dir, skip = sys.argv[1], sys.argv[2]
required = json.loads(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else []

def norm(n):
    return re.sub(r"[-_.]+", "-", n).lower()

def installed_names(entry):
    # Names-only mirror of scanPackagesBatched's collection (conda-meta,
    # dist-info/egg-info, R DESCRIPTION) \u2014 same walk, inside THIS spawn.
    names = set()
    for f in glob.glob(op.join(entry, "conda-meta", "*.json")):
        if op.basename(f) == "history":
            continue
        try:
            with open(f) as h:
                n = json.load(h).get("name", "")
            if n:
                names.add(norm(n))
        except Exception:
            pass
    for sp_dir in glob.glob(op.join(entry, "lib", "python*", "site-packages")):
        for meta in (glob.glob(op.join(sp_dir, "*.dist-info", "METADATA"))
                     + glob.glob(op.join(sp_dir, "*.egg-info", "PKG-INFO"))):
            try:
                with open(meta, encoding="utf-8", errors="replace") as h:
                    for line in h:
                        if line.startswith("Name:"):
                            names.add(norm(line[5:].strip()))
                            break
            except Exception:
                pass
    for desc in glob.glob(op.join(entry, "lib", "R", "library", "*", "DESCRIPTION")):
        try:
            with open(desc, encoding="utf-8", errors="replace") as h:
                for line in h:
                    if line.startswith("Package:"):
                        names.add(norm(line[8:].strip()))
                        break
        except Exception:
            pass
    return names

def ver(argv, rx=None):
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=10)
        s = r.stdout + r.stderr
        if rx:
            m = re.search(rx, s)
            return m.group(1) if m else "unknown"
        return r.stdout.strip().replace("Python ", "") or "unknown"
    except Exception:
        return "unknown"

for name in sorted(os.listdir(envs_dir)):
    if name == skip:
        continue
    entry = op.join(envs_dir, name)
    if not op.isdir(entry):
        continue
    meta = {}
    try:
        with open(op.join(entry, ".operon_metadata.json")) as f:
            meta = json.load(f)
    except Exception:
        pass
    if meta.get("kind") == "path-venv":
        print(json.dumps({"name": name, "language": meta.get("language") or "python",
                          "kind": "path-venv", "venv_path": meta.get("venv_path"),
                          "source_path": meta.get("source_path"),
                          "op_log": meta.get("op_log")}))
        continue
    py, rs = op.join(entry, "bin", "python"), op.join(entry, "bin", "Rscript")
    has_py, has_r = op.exists(py), op.exists(rs)
    if not (has_py or has_r):
        continue
    lang, oplog = meta.get("language"), meta.get("op_log")
    if not lang:
        lang = "r" if (has_r and not has_py) else "python"
    out = {"name": name, "language": lang}
    if oplog:
        out["op_log"] = oplog
    if lang == "r":
        out["r_version"] = ver([rs, "--version"], r"(\\d+\\.\\d+\\.\\d+)")
    else:
        out["python_version"] = ver([py, "--version"])
    if required:
        # has/missing computed HERE \u2014 the alternative was one
        # scanPackagesBatched spawn per env from the host loop (O(N) full
        # oneShot VM processes; 237 envs = minutes for a dependency search).
        inst = installed_names(entry)
        out["has"] = [n for n in required if n in inst]
        out["missing"] = [n for n in required if n not in inst]
    print(json.dumps(out))
`.trim(),y=Y?.length?` ${rY(JSON.stringify(Y))}`:"",q=await w(`python3 - ${rY(G)} ${rY(x)}${y} <<'__ENVS_EOF__'
${K}
__ENVS_EOF__`);if(q.exitCode!==0)return console.warn(`[conda] scanEnvsBatched nonzero (${q.exitCode}): ${q.stderr}`),null;return q.stdout},async exec(G,x){let Y=x?.cwd?`cd ${rY(x.cwd)} && ${G}`:G;return O.execKernel(Y,{condaWrite:!0,rSharedLibsWrite:x?.rSharedLibsWrite})},async exists(G){return(await w(`test -e ${rY(G)}`)).exitCode===0},async isDirectory(G){return(await w(`test -d ${rY(G)}`)).exitCode===0},async readdir(G){let x=await w(`ls -1A ${rY(G)}`);return W(x,`readdir ${G}`),x.stdout.split(`
`).filter(Boolean).sort()},async readdirEntries(G){let x=await w(`ls -1Ap ${rY(G)}`);return W(x,`readdir ${G}`),x.stdout.split(`
`).filter(Boolean).map((Y)=>{let K=Y.endsWith("/");return{name:K?Y.slice(0,-1):Y,isDirectory:K,isFile:!K}})},async readFile(G){return W(await w(`cat ${rY(G)}`),`readFile ${G}`)},async writeFile(G,x){W(await w(`printf %s ${rY(x)} > ${rY(G)}`),`writeFile ${G}`)},async mkdir(G,x){let Y=x?.recursive?"-p ":"";W(await w(`mkdir ${Y}${rY(G)}`),`mkdir ${G}`)},async rm(G,x){let Y=[x?.recursive?"-r":"",x?.force?"-f":""].filter(Boolean).join(" "),K=await w(`rm ${Y} ${rY(G)}`);if(!x?.force)W(K,`rm ${G}`)},async cp(G,x){W(await w(`cp -r ${rY(G)} ${rY(x)}`),`cp ${G}`)},async chmod(G,x){W(await w(`chmod ${x.toString(8)} ${rY(G)}`),`chmod ${G}`)}}}function LlO(O){if(!O)throw Error("Environment name cannot be empty");if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(O))throw Error(`Invalid environment name: ${JSON.stringify(O)} (must start with a letter or digit; only letters, digits, dots, dashes, underscores allowed)`)}function jlO(){return J_().conda_home}var R7w,zX_,D7w=2000,T7w,Jq,rY=(O)=>`'${O.replace(/'/g,"'\\''")}'`,pm_,Be,om_,GX_,xX_,YX_,KX_;