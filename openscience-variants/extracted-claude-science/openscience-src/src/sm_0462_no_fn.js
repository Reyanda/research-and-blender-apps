var Pw_=S(()=>{Dz();le();Q5();u1();Hz();f1z={};E_O=i`
  ${V_.dependencyMappings} IS NOT NULL
  AND json_extract(${V_.dependencyMappings}, '$.mapping_status') IS NULL
  AND json_extract(${V_.dependencyMappings}, '$.provenance_inherited_from') IS NULL
  AND EXISTS (
    SELECT 1 FROM json_each(${V_.dependencyMappings}, '$.inputs') j
    WHERE json_extract(j.value, '$.version_id') IS NOT NULL
      AND json_extract(j.value, '$.version_id') != ${V_.id}
      AND NOT EXISTS (
        SELECT 1 FROM artifact_dependencies d
        WHERE d.artifact_version_id = ${V_.id}
          AND d.depends_on_version_id = json_extract(j.value, '$.version_id')
      )
      AND EXISTS (
        SELECT 1 FROM artifact_versions t
        WHERE t.id = json_extract(j.value, '$.version_id')
      )
      AND NOT EXISTS (
        SELECT 1 FROM json_each(${V_.dependencyMappings}, '$.outputs') o
        WHERE json_extract(o.value, '$.version_id') = json_extract(j.value, '$.version_id')
      )
  )`,A_O=i`
  ${V_.dependencyMappings} IS NOT NULL
  AND json_extract(${V_.dependencyMappings}, '$.mapping_status') IS NULL
  AND EXISTS (
    SELECT 1 FROM artifact_dependencies d
    WHERE d.artifact_version_id = ${V_.id}
      AND NOT EXISTS (
        SELECT 1 FROM json_each(${V_.dependencyMappings}, '$.inputs') j
        WHERE json_extract(j.value, '$.version_id') = d.depends_on_version_id
      )
  )`});function gX(O){let z=O.toLowerCase();return z.includes("prompt is too long")||z.includes("prompt too long")||z.includes("input length")&&z.includes("exceed")&&z.includes("context limit")}function B_O(O){return gX(O instanceof Error?O.message:String(O))}function ll(O){let z=/(\d[\d,]*)\s*\+\s*\d[\d,]*\s*>/.exec(O);if(z)return parseInt(z[1].replace(/,/g,""),10);if(z=/(\d[\d,]*)\s+tokens?/i.exec(O),z)return parseInt(z[1].replace(/,/g,""),10);return null}import{spawn as a2w}from"child_process";async function c1z(O,z,w,W){if(O.length===0||z.length===0)return{reached:new Set,perOutput:new Map(W.map((K)=>[K,new Set])),parseOk:!0,producingAnalyzed:!1};let G=JSON.stringify({cells:z.map((K)=>({id:K.execution_log_id??"",source:K.source??"",language:K.language??"python"})),candidates:O.map((K)=>({id:K.id,read_cell_id:K.read_cell_id})),producing_id:w,outputs:W}),x=await e2w(t2w,G);if(x===null)return null;let Y;try{Y=JSON.parse(x)}catch{return null}return{parseOk:Y.parse_ok,producingAnalyzed:Y.producing_analyzed,reached:new Set(Y.reached),perOutput:new Map(W.map((K)=>[K,new Set(Y.per_output[K]??[])]))}}function e2w(O,z){return new Promise((w)=>{let W=!1,G=(q)=>{if(W)return;W=!0,clearTimeout(Y),w(q)},x;try{x=a2w("python3",["-I","-c",O],{stdio:["pipe","pipe","pipe"],cwd:"/",env:{PATH:process.env.PATH??"/usr/bin:/bin"}})}catch{return w(null)}let Y=setTimeout(()=>{try{x.kill("SIGKILL")}catch{}G(null)},r2w),K="",y="";x.stdout?.on("data",(q)=>K+=q),x.stderr?.on("data",(q)=>y+=q),x.on("error",()=>G(null)),x.on("close",(q)=>{if(q!==0){if(y)console.warn(`[taintFilter] python exited ${q}: ${y.slice(0,400)}`);return G(null)}G(K)}),x.stdin?.on("error",()=>{}),x.stdin?.write(z),x.stdin?.end()})}function zNw(O,z){let w=new Set;for(let W of O.split(/\r?\n/)){if(!W.includes(z))continue;let G=_Nw.exec(W);if(G)for(let x of G[1].split(","))w.add(x.trim())}return w}function l1z(O,z,w){let W=new Map;z.forEach((y,q)=>{if(y.execution_log_id)W.set(y.execution_log_id,q)});let G=W.get(w)??z.length-1,x=Array(z.length+1);x[G+1]=new Set;for(let y=G;y>=0;y--){let q=new Set(x[y+1]);for(let Z of(z[y].source??"").matchAll(ONw))q.add(Z[0]);x[y]=q}let Y=[],K=[];for(let y of O){let q=W.get(y.read_cell_id);if(q===void 0||q>=G){Y.push(y);continue}let Z=zNw(z[q].source??"",y.id),X=x[q+1],Q=!1;for(let V of Z)if(X.has(V)){Q=!0;break}if(Q||Z.size===0)Y.push(y);else K.push(y)}return{kept:Y,dropped:K}}function p1z(O,z){let w=[],W=[];for(let G of O){if(!G.execution_log_id){W.push(G);continue}for(let x of W)w.push({...x,execution_log_id:G.execution_log_id});if(W=[],w.push(G),z!==null&&G.execution_log_id===z)return w}return z===null?w:[]}var jM_,r2w=8000,t2w=`
import ast, json, sys

# 3447258063 pin (M-disc): refuse to run non-isolated. Dropping the -I
# spawn arg makes sys.flags.isolated False here, the assert fires, the
# process exits non-zero, runPython returns null, and every
# taintFilter.test.ts case asserting a non-null result REDs. This is the
# functional mutation pin -- structural asserts on spawn args are not.
assert sys.flags.isolated, "astTaintFilter must run under python3 -I"

inp = json.load(sys.stdin)
cells = inp["cells"]            # [{id, source, language}]
cands = inp["candidates"]       # [{id, read_cell_id}]
producing = inp["producing_id"]
outputs = inp["outputs"]        # [filename]

# candidate id -> read_cell_id (first occurrence wins \u2014 the scanner dedupes)
cand_cell = {c["id"]: c["read_cell_id"] for c in cands}

# name -> set(candidate_id)
taint = {}
# alias groups (rule iv): list of sets of names that share mutation taint
alias_groups = []
# names bound by import \u2014 excluded from the x = y.method() alias rule so
# module hubs (pd/np/plt/sc/sns/host/operon) never collapse every read into
# one group. Seeded with the common module names for sessions whose import
# cell falls outside the prefix or is re-imported implicitly.
imported = {"pd", "np", "plt", "sc", "sns", "host", "operon", "scanpy",
            "pandas", "numpy", "matplotlib", "seaborn", "anndata", "ad"}
# Known-pure callables \u2014 rule (iii) does not cross-taint through these
# (53% of FPs on the SAMAP harness were inspection-only reads).
PURE_INSPECT = {"print", "display", "len", "type", "repr", "str", "int",
                "float", "list", "dict", "set", "tuple", "help", "dir",
                "vars", "id", "hash", "isinstance", "hasattr", "getattr",
                "show", "head", "tail", "info", "describe", "shape",
                "dtypes", "columns", "keys", "value_counts"}
# Builtin/stdlib names that act as cross-cell hubs (appear in ~every cell)
# and must never acquire taint via rules (ii)/(iii) \u2014 otherwise one
# open()/json.dump() poisons every subsequent cell. Module imports add to
# this via the Import arm above.
HUB_NAMES = (imported | PURE_INSPECT |
             {"open", "json", "os", "sys", "Path", "pathlib", "io",
              "pickle", "gzip", "csv", "sorted", "map", "filter", "zip",
              "enumerate", "range", "sum", "min", "max", "abs", "round",
              "any", "all", "iter", "next"})
def alias_of(n):
    for g in alias_groups:
        if n in g:
            return g
    return None

def names_in(node):
    """All Name.id appearing anywhere under node (Load or Store)."""
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}

def base_name(node):
    """Unwrap Subscript/Attribute/Starred to the base Name.id, else None."""
    while isinstance(node, (ast.Subscript, ast.Attribute, ast.Starred)):
        node = node.value
    return node.id if isinstance(node, ast.Name) else None

def target_names(tgt):
    """Flatten an assignment target to the set of base Names it binds."""
    out = set()
    if isinstance(tgt, (ast.Tuple, ast.List)):
        for e in tgt.elts:
            out |= target_names(e)
    else:
        n = base_name(tgt)
        if n:
            out.add(n)
    return out

def add_taint(name, s):
    if not s:
        return
    cur = taint.setdefault(name, set())
    if s - cur:
        cur |= s
        g = alias_of(name)
        if g:
            for a in g:
                taint.setdefault(a, set()).update(s)

def taint_of(node):
    """Union taint of every Name loaded under node."""
    t = set()
    for n in names_in(node):
        t |= taint.get(n, set())
    return t

parse_ok = True
producing_analyzed = False
producing_loads = set()
per_output_names = {o: None for o in outputs}
out_basenames = {o: o.split("/")[-1] for o in outputs}

for cell in cells:
    cid = cell["id"]
    src = cell.get("source") or ""
    if cell.get("language") != "python":
        # Non-python cells (bash/R/diff) don't touch the python namespace,
        # so reaching-defs is sound across them \u2014 skip, don't bail. A
        # python SyntaxError below IS a bail (we can't see what it bound).
        continue
    try:
        tree = ast.parse(src)
    except SyntaxError:
        # ic 4765227282: IPython magics (%time / %matplotlib inline /
        # !pip / %%capture) make ast.parse raise, which would disable
        # the AST lane for the whole group. Retry with %/! lines
        # blanked (preserves line/col for get_source_segment). Only on
        # the SyntaxError path \u2014 blanking a % inside a docstring on a
        # cleanly-parsing cell would be a regression.
        src_p = "\\n".join(
            "" if ln.lstrip()[:1] in ("%", "!") else ln
            for ln in src.splitlines()
        )
        try:
            tree = ast.parse(src_p)
        except SyntaxError:
            parse_ok = False
            continue

    # Seed: any assignment in THIS cell whose RHS source-span contains a
    # candidate uuid read here \u2192 target names gain that candidate's taint.
    # Seed in the candidate's owning read cell (scanDeterministicArtifactRefs'
    # buffered-flush read_cell_id) \u2014 NOT per-occurrence. Per-occurrence
    # seeding (tested: r3f) raises R 0.829->0.971 but drops the
    # Haiku-intersection P 0.852->0.737 because post-write inspection
    # cells (the figS5 'mask = nodes[...]' shape) re-seed candidates the
    # write call never touched.
    seed_ids = [cid_ for cid_, rc in cand_cell.items() if rc == cid]

    for node in ast.iter_child_nodes(tree):
        # \u2500\u2500 imports (for the rule-iv hub gate) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                imported.add((a.asname or a.name).split(".")[0])
            continue
        # \u2500\u2500 assignments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if isinstance(node, (ast.Assign, ast.AugAssign, ast.AnnAssign)):
            tgts = node.targets if isinstance(node, ast.Assign) else [node.target]
            rhs = node.value
            rhs_t = taint_of(rhs) if rhs is not None else set()
            # Seed from literal uuid in the rhs span.
            if seed_ids and rhs is not None:
                seg = ast.get_source_segment(src, rhs) or ""
                for cand in seed_ids:
                    if cand in seg:
                        rhs_t.add(cand)
            # Rule (ii) on the rhs itself: a.b(c) as an expression value.
            # 3447294127: gate on recv-not-in-imported (parity with rule
            # (iv)) so module hubs -- pd.concat([agg,raw]), np.vstack(...)
            # -- do not acquire their args' taint and then leak it into
            # every subsequent module call.
            for sub in ast.walk(rhs) if rhs is not None else ():
                if isinstance(sub, ast.Call):
                    recv = base_name(sub.func)
                    if recv and recv not in HUB_NAMES and recv not in imported:
                        at = set()
                        for a in list(sub.args) + [k.value for k in sub.keywords]:
                            at |= taint_of(a)
                        add_taint(recv, at)
            # Rule (iv): tuple-unpack from a single Call -> alias group.
            # Also x = y.method(...) -> {x, y} alias (the
            # fig = plt.figure(); ax = fig.add_subplot() shape -- 53% of
            # SAMAP png outputs per the prod harness).
            for t in tgts:
                grp = None
                if isinstance(t, (ast.Tuple, ast.List)) and isinstance(rhs, ast.Call):
                    grp = target_names(t)
                elif (
                    isinstance(t, ast.Name)
                    and isinstance(rhs, ast.Call)
                    and isinstance(rhs.func, ast.Attribute)
                ):
                    recv = base_name(rhs.func)
                    if (recv and recv != t.id
                            and recv not in imported
                            and recv not in HUB_NAMES):
                        grp = {t.id, recv}
                if grp and len(grp) > 1:
                    # merge with any existing overlapping group
                    merged = set(grp)
                    keep = []
                    for g in alias_groups:
                        if g & merged:
                            merged |= g
                        else:
                            keep.append(g)
                    keep.append(merged)
                    alias_groups[:] = keep
            for t in tgts:
                for n in target_names(t):
                    if isinstance(node, ast.AugAssign):
                        add_taint(n, rhs_t)
                    else:
                        # Plain rebind: replace \u2014 but rule (i) (Subscript/
                        # Attribute target) is a MUTATION of the base, so
                        # union instead of replace when the target wasn't a
                        # bare Name.
                        bare = isinstance(t, ast.Name) or (
                            isinstance(t, (ast.Tuple, ast.List))
                        )
                        if bare:
                            taint[n] = set(rhs_t)
                            g = alias_of(n)
                            if g:
                                for a in g:
                                    taint.setdefault(a, set()).update(rhs_t)
                        else:
                            add_taint(n, rhs_t)
        # \u2500\u2500 discarded top-level call (rules ii + iii) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        elif isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            call = node.value
            # Gate rule (iii) off for known-pure inspection builtins \u2014
            # the inspection_only class is 53% of FPs on the SAMAP harness
            # (print(ref.head()), display(df), len(x)). These never mutate
            # their args, so cross-tainting them is pure noise. Method
            # calls through a module attribute (plt.show / df.head as a
            # statement) are also inspection-shaped when the base is the
            # only Name.
            fn_name = (call.func.id if isinstance(call.func, ast.Name)
                       else call.func.attr if isinstance(call.func, ast.Attribute)
                       else None)
            if fn_name in PURE_INSPECT:
                continue
            # Rule (iii): every non-hub Name anywhere in the call
            # cross-taints. Hub names (modules/builtins) are excluded from
            # the RECEIVING side \u2014 they never acquire taint (would poison
            # every subsequent cell) but still CONTRIBUTE any taint they
            # hold (normally none).
            ns = names_in(call)
            pool = set()
            for n in ns:
                pool |= taint.get(n, set())
            if seed_ids:
                seg = ast.get_source_segment(src, call) or ""
                for cand in seed_ids:
                    if cand in seg:
                        pool.add(cand)
            for n in ns:
                if n not in HUB_NAMES and n not in imported:
                    add_taint(n, pool)
        # for/with/if etc.: walk their bodies for assignments at any depth
        # \u2014 top-level iter_child_nodes only sees the compound stmt itself.
        elif isinstance(node, (ast.For, ast.While, ast.If, ast.With,
                               ast.Try, ast.FunctionDef, ast.AsyncFunctionDef)):
            # For-loop / with-as target binding: the loop/context variable
            # is a REBIND (replaces any prior taint of that name), carrying
            # the iterable's / context-expr's taint. Without REPLACE, a
            # reused name like 'f' in successive 'with open(...) as f:'
            # blocks accumulates every prior file's taint (the 2a08c3c5
            # cns_reframe_report shape). Seeds too \u2014 the UUID often lives
            # in the with-header, not the body assign.
            def seed_in(expr):
                t = taint_of(expr)
                if seed_ids:
                    seg = ast.get_source_segment(src, expr) or ""
                    for cand in seed_ids:
                        if cand in seg:
                            t.add(cand)
                return t
            for sub in ast.walk(node):
                if isinstance(sub, ast.For):
                    it_t = seed_in(sub.iter)
                    for n in target_names(sub.target):
                        taint[n] = set(it_t)
                elif isinstance(sub, ast.With):
                    for item in sub.items:
                        ce_t = seed_in(item.context_expr)
                        if item.optional_vars is not None:
                            for n in target_names(item.optional_vars):
                                taint[n] = set(ce_t)
            for sub in ast.walk(node):
                if isinstance(sub, (ast.Assign, ast.AugAssign, ast.AnnAssign)):
                    tgts = sub.targets if isinstance(sub, ast.Assign) else [sub.target]
                    rhs = sub.value
                    rhs_t = taint_of(rhs) if rhs is not None else set()
                    if seed_ids and rhs is not None:
                        seg = ast.get_source_segment(src, rhs) or ""
                        for cand in seed_ids:
                            if cand in seg:
                                rhs_t.add(cand)
                    for t in tgts:
                        for n in target_names(t):
                            # Bare-Name rebind REPLACES; Subscript/Attribute
                            # Inside compound (try/if/for/while), any
                            # branch MAY execute -> UNION (may-reach)
                            # for every target shape. The for/with-target
                            # REPLACE in the pre-pass already handles
                            # loop-var / context-var rebinds; assignments
                            # in the body are path-dependent.
                            add_taint(n, rhs_t)
                elif isinstance(sub, ast.Expr) and isinstance(sub.value, ast.Call):
                    call = sub.value
                    fn_name = (call.func.id if isinstance(call.func, ast.Name)
                               else call.func.attr if isinstance(call.func, ast.Attribute)
                               else None)
                    if fn_name in PURE_INSPECT:
                        continue
                    ns = names_in(call)
                    pool = set()
                    for n in ns:
                        pool |= taint.get(n, set())
                    for n in ns:
                        if n not in HUB_NAMES and n not in imported:
                            add_taint(n, pool)

    # Producing cell: capture loads + per-output write-call name sets.
    if cid == producing:
        producing_analyzed = True
        for n in ast.walk(tree):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                producing_loads.add(n.id)
        for call in ast.walk(tree):
            if not isinstance(call, ast.Call):
                continue
            # 3447294120: match the call's string-literal arg values
            # (whole-value or path-suffix), not a substring of the call's
            # source span \u2014 "a.csv" must not match to_csv('data.csv').
            str_args = {a.value for a in ast.walk(call)
                        if isinstance(a, ast.Constant)
                        and isinstance(a.value, str)}
            for o, base in out_basenames.items():
                if per_output_names[o] is not None:
                    continue
                if any(s == o or s == base or s.endswith("/" + base)
                       for s in str_args):
                    per_output_names[o] = names_in(call)

# Per-output fallback: whole producing-cell loads.
for o in outputs:
    if per_output_names[o] is None:
        per_output_names[o] = producing_loads

reached = set()
for n in producing_loads:
    reached |= taint.get(n, set())
per_output = {}
for o, ns in per_output_names.items():
    s = set()
    for n in ns:
        s |= taint.get(n, set())
    per_output[o] = sorted(s)

json.dump({
    "parse_ok": parse_ok,
    "producing_analyzed": producing_analyzed,
    "reached": sorted(reached),
    "per_output": per_output,
}, sys.stdout)
`,_Nw,ONw;