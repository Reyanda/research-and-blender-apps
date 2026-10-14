var Tm=S(()=>{iO();Cz();rB={linux:{rel:(O)=>OK.join("seccomp",O==="arm64"?"aarch64":"x86_64","writetrace.so"),envVar:"LD_PRELOAD",uname:"Linux",tracesBash:!0,watchGiantRoots:!1},darwin:{rel:()=>OK.join("writetrace","darwin","writetrace.dylib"),envVar:"DYLD_INSERT_LIBRARIES",uname:"Darwin",tracesBash:!1,watchGiantRoots:!0}}});function aQ_(O){let z=[];for(let w=0;w<O.length;w+=76)z.push(O.slice(w,w+76));return z.join(`
`)}function kG(O){return`'${O.replace(/'/g,"'\\''")}'`}function PO_(O){return`mkdir -p ${kG(O)}
cd ${kG(O)}`}function tB(O){return`export UV_CACHE_DIR="$PWD/.cache/uv"
export TMPDIR="$PWD/.tmp"
export PIP_CACHE_DIR="$PWD/.cache/pip"
# Redirect $HOME-relative caches into the (sandbox-writable) workspace.
# matplotlib/fontconfig/numba/HF default to ~/.cache and ~/.config, which the
# macOS seatbelt denies; bwrap's tmpfs-$HOME masks this on Linux.
export XDG_CACHE_HOME="$PWD/.cache"
export MPLCONFIGDIR="$PWD/.cache/matplotlib"
# Headless: no DISPLAY in the sandbox, so any non-headless backend either
# errors or (on macOS) hits CoreGraphics and seatbelt-denies. Forced \u2014 a
# host-set MPLBACKEND=MacOSX must not survive into the sandbox.
export MPLBACKEND=Agg
# Don't prepend CWD/script-dir to sys.path[0] \u2014 agents run scripts from /tmp
# (host-shared, can hold a stale inspect.py etc.) and stdlib gets shadowed.
export PYTHONSAFEPATH=1
${O?.sandboxed??Gxw()?`# Disable user site-packages: $HOME is per-spawn tmpfs in the sandbox, so
# user-site installs are phantoms \u2014 fail loudly instead (#2278).
export PYTHONNOUSERSITE=1
`:""}mkdir -p "$UV_CACHE_DIR" "$TMPDIR" "$PIP_CACHE_DIR" "$MPLCONFIGDIR"
`}function Gxw(){try{return!J_().sandbox.disabled}catch{return!0}}function Gd_(){return`# --no-config: uv discovers uv.toml/pyproject.toml from cwd (the frame
# workspace \u2014 operon-kernel RW). A planted [tool.uv] find-links=./wheels +
# malicious pip wheel \u2192 \`uv pip install pip\` installs it \u2192 its .pth exec
# fires on every venv boot (pen-test #808). --no-config makes uv ignore all
# discovered config; UV_CACHE_DIR/TMPDIR/PIP_CACHE_DIR are the only knobs and
# those dirs are operon-denyWrite. uv INTO the condition so its failure falls
# through to stdlib venv (set -e would otherwise kill the script on uv exit 2).
if command -v uv >/dev/null 2>&1 && \\
   uv venv --no-config "$FRAME_VENV" --system-site-packages --python "$CONDA_PYTHON" >&2; then
  uv pip install --no-config pip --python "$VENV_PYTHON" >&2 || true
else
  "$CONDA_PYTHON" -m venv "$FRAME_VENV" --system-site-packages --without-pip >&2
  "$VENV_PYTHON" -m ensurepip --upgrade --default-pip >&2 || true
fi
# Both installers above are \`|| true\`; if neither landed a pip entrypoint,
# bare \`pip\`/\`pip3\` resolves via PATH to the HOST pip (Homebrew on macOS),
# which defaults to --user \u2192 ~/Library/Python/... \u2192 seatbelt EPERM. The venv is
# --system-site-packages so the host pip *module* is importable; python -m pip
# with sys.prefix==venv installs into the venv. Shim both names.
for _p in pip pip3; do
  if [ ! -x "$FRAME_VENV/bin/$_p" ]; then
    printf '#!/bin/sh\\nexec "%s" -m pip "$@"\\n' "$VENV_PYTHON" > "$FRAME_VENV/bin/$_p"
    chmod +x "$FRAME_VENV/bin/$_p"
  fi
done
unset _p
# Completion marker \u2014 written LAST, only when the interpreter landed. The
# bash-path ensure guards on THIS (not bin/python): the recipe is non-atomic
# (uv venv materializes bin/python before the pip install + shim phases), so
# a kill mid-recipe leaves a half-built venv that a bin/python guard would
# latch forever (#2605 r2 3360053787). Marker absent \u21D2 rm -rf + recreate:
# every partial state self-heals, wherever the kill landed.
if [ -x "$VENV_PYTHON" ]; then : > "$FRAME_VENV/${rQ_}"; fi`}function tQ_(O){if(O.pathVenv)return xxw(O,O.pathVenv);let z=`${O.condaRoot}/envs/${O.envName}`,w=`${z}/bin/python`,W=`${z}/bin`;return`#!/bin/bash
set -euo pipefail

# mkdir+cd: coworkd ignores SpawnOpts.cwd. mkdir here (not via condaExecutor) --
# condaExecutor runs as operon-conda which has no workspace bindfs mount; this
# script runs as the frame's own user in the right namespace.
${PO_(O.workspaceDir)}

# Mount guard (Desktop VM only): $PWD is a bindfs mount onto the host workspace.
# If the FUSE daemon dies mid-run, st_dev reverts to the /sessions ext4 device
# and all writes silently fall through to the 10GB session disk \u2192 ENOSPC wedge.
# Snapshot the device now; a background poll SIGTERMs this PID if it changes.
# /sessions only exists in the VM \u2014 on CLI/cloud this whole block is a no-op.
# The subshell survives 'exec python' (same PID via $$), self-exits if parent
# PID vanishes (kill -0 fails), and is otherwise reaped by coworkd's cgroup
# KillAll on process teardown.
if [ -d /sessions ]; then
  _WS_DEV=$(stat -c %d "$PWD")
  if [ "$_WS_DEV" = "$(stat -c %d /sessions)" ]; then
    echo "operon: workspace mount did not take (st_dev matches /sessions)" >&2
    exit 73
  fi
  ( while sleep 10; do
      kill -0 $$ 2>/dev/null || exit
      [ "$(stat -c %d "$PWD" 2>/dev/null)" = "$_WS_DEV" ] || { kill -TERM $$; exit; }
    done ) &
fi
${bO_}

# \u2500\u2500 ALL ephemeral state under $PWD (host-backed workspace) \u2014 zero /sessions writes \u2500\u2500
FRAME_VENV="$PWD"/${kG(O.frameVenvRel)}
VENV_PYTHON="$FRAME_VENV/bin/python"
${tB()}
# conda env check -- fall back to system python3 if not provisioned (CLI
# headless / eval-harness containers may have no conda but a usable python3;
# uv venv / stdlib venv below work with any interpreter)
ENV_PATH=${kG(z)}
CONDA_PYTHON=${kG(w)}
if [ ! -x "$CONDA_PYTHON" ]; then
  CONDA_PYTHON=$(command -v python3 || command -v python || true)
  if [ -z "$CONDA_PYTHON" ]; then
    echo "ERROR: Conda env "${kG(O.envName)}" not found at $ENV_PATH and no system python3 on PATH." >&2
    exit 1
  fi
  ENV_PATH=$(dirname "$(dirname "$CONDA_PYTHON")")
  echo "operon: conda env "${kG(O.envName)}" not provisioned; using system $CONDA_PYTHON" >&2
  _NO_CONDA=1
fi

# frame venv: ALWAYS recreate. A prior kernel's venv may survive on the host
# (workspace is host-backed), but its shebangs bake the OLD kernel's $HOME nonce
# (/sessions/operon-k-<old-nonce>/mnt/...) -- unusable by this process. Cheap:
# --system-site-packages inherits conda pkgs read-only; venv itself is ~5-20MB.
rm -rf "$FRAME_VENV"
mkdir -p "$(dirname "$FRAME_VENV")"
${Gd_()}

# macOS: collapse vendored OpenMP runtimes (torch, faiss, xgboost, ...) in the
# frame venv to the conda env's libomp. dyld dedupes by inode, not name, so a
# vendored copy + conda's copy both load and libomp aborts (OMP Error #15).
# Agent-driven \`pip install torch\` lands here, not in the conda env, so
# CondaManager._dedupeDarwinOpenMP doesn't see it. Runs at every kernel boot;
# no-op when no vendored copies exist. Mid-session installs need a kernel
# restart to pick up. Ref pytorch#78490.
if [ "$(uname)" = "Darwin" ] && [ -f "$ENV_PATH/lib/libomp.dylib" ]; then
  find "$FRAME_VENV/lib" -type f \\
    \\( -name libomp.dylib -o -name libiomp5.dylib \\) \\
    -path '*/site-packages/*' \\
    -exec ln -sf "$ENV_PATH/lib/libomp.dylib" {} \\; 2>/dev/null || true
fi

# env: PATH/VIRTUAL_ENV/CONDA_PREFIX layered on inherited env.
# Inherited: sanitizeEnv() + OPERON_SECRET_VARS (set by base.ts before spawn).
# exec preserves everything through to python.
export PATH="$FRAME_VENV/bin":${kG(W)}:"$PATH"
export VIRTUAL_ENV="$FRAME_VENV"
# Don't advertise a conda env when we fell back to system python ($ENV_PATH
# would be /usr, which conda-aware libs/tools would misinterpret).
[ -z "\${_NO_CONDA:-}" ] && export CONDA_PREFIX="$ENV_PATH"

# libstdc++/libgcc_s forward-shim (Linux). conda-built extensions find these
# via RPATH=$ORIGIN/../lib, but pip-installed manylinux wheels (into the
# overlay venv) don't \u2014 their dlopen resolves against whatever libstdc++ the
# process already loaded. When $CONDA_PYTHON fell back to system python3
# above, that's the system lib \u2192 CXXABI/GLIBCXX-not-found on modern wheels
# (5d1f641e/P-018). Also harmless under real conda: preloading the same lib
# the RPATH would have found is a no-op. LD_PRELOAD keeps the blast radius
# to these two forward-compatible libs.
if [ "$(uname)" = "Linux" ] && [ -f "$ENV_PATH/lib/libstdc++.so.6" ]; then
  _PRE="$ENV_PATH/lib/libstdc++.so.6"
  [ -f "$ENV_PATH/lib/libgcc_s.so.1" ] && _PRE="$_PRE:$ENV_PATH/lib/libgcc_s.so.1"
  export LD_PRELOAD="$_PRE\${LD_PRELOAD:+:$LD_PRELOAD}"
fi
${Dm(O.writeTrace)}

# rlimit \u2014 cap open file descriptors to prevent fd-leak DoS. No memory or
# file-size limits: the kernel is the primary compute workload and needs the
# machine's full resources. The bash tool applies the same opt-out.
${YC({maxVirtualMemoryMb:0,maxFileSizeBlocks:0})}

# -- exec: replace bash with python. stdin/stdout go DIRECT to kernel worker. --
# /dev/fd/3 trick: script via fd3, stdin stays free for the JSON protocol.
# Base64-armored: transport layer (Swift/vsock/Go) can't mangle pure ASCII.
exec "$VENV_PYTHON" /dev/fd/3 3< <(base64 -d <<'${hL}'
${aQ_(Wd_)}
${hL}
)
`}function xxw(O,z){return`#!/bin/bash
set -euo pipefail

${PO_(O.workspaceDir)}

# Mount guard \u2014 see the identical block in renderPythonBootstrap above.
if [ -d /sessions ]; then
  _WS_DEV=$(stat -c %d "$PWD")
  if [ "$_WS_DEV" = "$(stat -c %d /sessions)" ]; then
    echo "operon: workspace mount did not take (st_dev matches /sessions)" >&2
    exit 73
  fi
  ( while sleep 10; do
      kill -0 $$ 2>/dev/null || exit
      [ "$(stat -c %d "$PWD" 2>/dev/null)" = "$_WS_DEV" ] || { kill -TERM $$; exit; }
    done ) &
fi
${bO_}

# \u2500\u2500 ALL ephemeral state under $PWD (host-backed workspace) \u2500\u2500
${tB()}
# FRAME_VENV is the user's venv (absolute, under a granted host path). No
# rm-rf/recreate: this is a persistent, user-managed env \u2014 the whole point of
# F-register. ABI coherence is the user's responsibility (same as their
# terminal).
FRAME_VENV=${kG(z.venvPath)}
VENV_PYTHON="$FRAME_VENV/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
  echo "ERROR: registered path-venv "${kG(O.envName)}" \u2192 $FRAME_VENV has no bin/python." >&2
  echo "       (Is "${kG(z.sourcePath)}" still granted and the venv still there?)" >&2
  exit 1
fi
# min-python: kernel_worker.py requires \u22653.11 (PEP-657 tracebacks, tomllib).
if ! "$VENV_PYTHON" -c 'import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)'; then
  echo "ERROR: path-venv "${kG(O.envName)}" \u2192 $VENV_PYTHON is python $("$VENV_PYTHON" -c 'import sys;print("%d.%d"%sys.version_info[:2])'); need >=3.11." >&2
  exit 1
fi

export PATH="$FRAME_VENV/bin":"$PATH"
export VIRTUAL_ENV="$FRAME_VENV"

# libstdc++/libgcc_s forward-shim (Linux). A path-venv's python is a symlink
# to its base interpreter; packages reached via system-site-packages (or
# pip-installed manylinux wheels) need THAT prefix's libstdc++/CXXABI. In
# 5d1f641e/P-018 this surfaced as \`CXXABI_1.3.15 not found\` from
# scipy.spatial \u2014 agents worked around via \`export LD_PRELOAD=\u2026 && python\`
# heredocs in bash. Follow the symlink to find the real prefix's lib/; fall
# back to Operon's bundled \`python\` env (guaranteed modern). LD_PRELOAD not
# LD_LIBRARY_PATH: only these two forward-compatible libs are forced, so a
# system-python venv doesn't accidentally pick up conda's libssl/libz.
if [ "$(uname)" = "Linux" ]; then
  _BASE_PY=$(readlink -f "$VENV_PYTHON" 2>/dev/null || true)
  _CONDA_LIB="\${_BASE_PY%/bin/*}/lib"
  [ -f "$_CONDA_LIB/libstdc++.so.6" ] || _CONDA_LIB=${kG(`${O.condaRoot}/envs/python/lib`)}
  if [ -f "$_CONDA_LIB/libstdc++.so.6" ]; then
    _PRE="$_CONDA_LIB/libstdc++.so.6"
    [ -f "$_CONDA_LIB/libgcc_s.so.1" ] && _PRE="$_PRE:$_CONDA_LIB/libgcc_s.so.1"
    export LD_PRELOAD="$_PRE\${LD_PRELOAD:+:$LD_PRELOAD}"
  fi
fi
${Dm(O.writeTrace)}

${YC({maxVirtualMemoryMb:0,maxFileSizeBlocks:0})}

exec "$VENV_PYTHON" /dev/fd/3 3< <(base64 -d <<'${hL}'
${aQ_(Wd_)}
${hL}
)
`}function Yxw(O){if(!O)return"";return`
# Shared default_r_packages overlay (per-R-minor slice, kernel-RO).
# || true: the bootstrap runs under \`set -euo pipefail\`, and a present-but-
# broken Rscript (CXXABI drift, truncated libs) crashing on --version must
# degrade to "overlay not applied", never abort kernel start \u2014 the real
# Rscript error surfaces at the worker exec below.
# The version pattern anchors on a DATE-SHAPED release paren ("version
# 4.5.3 (2026-\u2026", with R's own CLOSED status-token set tolerated in between
# \u2014 "4.2.2 Patched (", "4.6.0 Under development (unstable) (", alpha/beta/
# RC) so degraded-Rscript noise can never mis-key the slice: "compiled by
# GCC version 11.2.0" (no paren), "version 3.4.29 not found (required
# by\u2026)" (open-token-set evasion), and the real gcc -v trailer
# "gcc version 10.2.0 (GCC)" (paren present but not a date) are all
# rejected \u2014 MUST stay semantically in sync with R_VERSION_RE in
# rSharedLibs.ts (builder and reader key the same slice; a divergent key on
# a multi-R-minor machine would point R_LIBS_SITE at another ABI's
# binaries).
_R_MM=$("$RSCRIPT" --version 2>&1 | grep -oE 'version [0-9]+\\.[0-9]+\\.[0-9]+( (Patched|alpha|beta|RC|Under development \\(unstable\\)))? \\([0-9]{4}-[0-9]{2}-[0-9]{2}' | head -n1 | sed -E 's/^version ([0-9]+\\.[0-9]+).*/\\1/' || true)
_R_BASE=${kG(O)}
_R_SHARED="$_R_BASE"/"$_R_MM"
# Dir-existence is a safe readiness check: the slice is only ever grown by
# the daemon-side installer, and R CMD INSTALL stages each package under a
# 00LOCK dir before renaming into place \u2014 a kernel racing a live install
# sees whole packages or nothing, never a half-written one.
if [ -n "$_R_MM" ] && [ -d "$_R_SHARED" ]; then
  export R_LIBS_SITE="$_R_SHARED"
elif [ -z "$_R_MM" ]; then
  # Silent-skip would leave "why isn't my package loading?" with zero
  # breadcrumbs (degraded Rscript, or an R build shape both extractors miss).
  echo "operon: could not parse the R version from $RSCRIPT --version; shared default_r_packages overlay not applied." >&2
elif [ ! -d "$_R_BASE" ]; then
  # Root absent CAN mean two things this script can't tell apart: the daemon
  # hasn't built it yet (install pending/deferred/failed \u2014 the common case on
  # a cold data dir), or the sandbox isn't binding it through. Say both.
  echo "operon: shared default_r_packages library root $_R_BASE not visible \u2014 either the daemon has not built it yet (install pending or deferred; see daemon logs) or it is missing from the sandbox bind set (check r_shared_libs_base and sandbox mounts)." >&2
else
  echo "operon: no shared default_r_packages library for R $_R_MM (expected $_R_SHARED). Shared packages are built for the skeleton 'r' env's R version; to inherit them here, recreate this environment with a matching r-base version." >&2
fi`}function xd_(O){let z=`${O.condaRoot}/envs/${O.envName}`,w=`${z}/bin/Rscript`,W=`${z}/bin`;return`#!/bin/bash
set -euo pipefail

${PO_(O.workspaceDir)}

# Mount guard \u2014 see the identical block in renderPythonBootstrap above.
if [ -d /sessions ]; then
  _WS_DEV=$(stat -c %d "$PWD")
  if [ "$_WS_DEV" = "$(stat -c %d /sessions)" ]; then
    echo "operon: workspace mount did not take (st_dev matches /sessions)" >&2
    exit 73
  fi
  ( while sleep 10; do
      kill -0 $$ 2>/dev/null || exit
      [ "$(stat -c %d "$PWD" 2>/dev/null)" = "$_WS_DEV" ] || { kill -TERM $$; exit; }
    done ) &
fi
${bO_}

# R's tempdir() + install.packages() build dirs \u2014 keep off /sessions.
# UV/PIP cache: reticulate::py_install() or system("pip install ...") from R.
${tB()}
ENV_PATH=${kG(z)}
RSCRIPT=${kG(w)}
if [ ! -x "$RSCRIPT" ]; then
  echo "ERROR: Rscript not found in conda env "${kG(O.envName)}" at $RSCRIPT." >&2
  echo "Ensure r-base is installed in this environment." >&2
  exit 1
fi

# Lives under workspaceDir (host-backed via bindfs on Desktop \u2014 keeps session
# disk free). Always recreate: a prior kernel's R_LIBS may survive on host but
# installed .so paths can reference the old kernel's $HOME nonce. No venv layer
# for R \u2014 install.packages() writes here directly.
R_LIBS="$PWD"/${kG(O.rLibsUserRel)}
rm -rf "$R_LIBS"
mkdir -p "$R_LIBS"

export PATH=${kG(W)}:"$PATH"
export CONDA_PREFIX="$ENV_PATH"
export R_LIBS_USER="$R_LIBS"
export OPERON_R_OPLOG_PATH=${kG(O.rOpLogPath)}
${Yxw(O.rSharedLibsBase)}
${Dm(O.writeTrace)}

# rlimit \u2014 cap open file descriptors to prevent fd-leak DoS. No memory or
# file-size limits: the kernel is the primary compute workload and needs the
# machine's full resources.
${YC({maxVirtualMemoryMb:0,maxFileSizeBlocks:0})}

# --no-init-file --no-environ --no-site-file: Rscript's default startup
# sources ./.Rprofile and reads ./.Renviron from cwd BEFORE the worker script
# runs. cwd is the frame workspace (L264), which the operon kernel has RW on
# (shared Python\u2194R handoff root). An ungated \`operon\` cell writing
# ./.Rprofile \u2192 next \`r\` call spawns \u2192 sources it \u2192 arbitrary exec, fires
# before r_kernel_worker.R's secret-strip (pen-test #808 round 2). .Renviron
# \u2192 R_PROFILE_USER indirection is equivalent. --no-site-file is
# belt-and-suspenders (conda r env ships no Rprofile.site); $R_HOME/etc/Renviron
# (base, always read) is unaffected by --no-environ. R_LIBS_USER is set via
# \`export\` above so --no-environ dropping user Renviron doesn't lose it.
exec "$RSCRIPT" --no-init-file --no-environ --no-site-file /dev/fd/3 3< <(base64 -d <<'${hL}'
${aQ_(Wxw)}
${hL}
)
`}function paO(O){let z=O.assets??_K()[O.providerId];if(!z)throw Error(`unknown byoc provider: ${O.providerId}`);let w=z.env_spec.name,W=`${O.condaRoot}/envs/${w}`,G=`${W}/bin/python`,x=O.byocSockDir?`export OPERON_BYOC_SOCK_DIR=${kG(O.byocSockDir)}
`:"",Y=`export OPERON_BYOC_ENVS_DIR=${kG(z.envs_dir)}
`,y=[["OPERON_BYOC_INSTALL_ID",O.sandboxTagEnv?.installId],["OPERON_BYOC_ORG_ID",O.sandboxTagEnv?.orgId],["OPERON_BYOC_FRAME_ID",O.sandboxTagEnv?.frameId]].filter((X)=>!!X[1]).map(([X,Q])=>`export ${X}=${kG(Q)}
`).join(""),q="modalEnvironment"in O?O.modalEnvironment??null:Bq(O.providerId),Z=q?`export MODAL_ENVIRONMENT=${kG(q)}
export OPERON_BYOC_ENVIRONMENT=${kG(q)}
`:"";return`#!/bin/bash
set -euo pipefail
${PO_(O.workspaceDir)}
${bO_}

CONDA_PYTHON=${kG(G)}
if [ ! -x "$CONDA_PYTHON" ]; then
  CONDA_PYTHON=$(command -v python3 || true)
  [ -n "$CONDA_PYTHON" ] || { echo "byoc: env ${kG(w)} not provisioned and no system python3" >&2; exit 1; }
fi
export PATH=${kG(`${W}/bin`)}:"$PATH"
export CONDA_PREFIX=${kG(W)}
${x}${Y}${y}${Z}
${YC({maxVirtualMemoryMb:0,maxFileSizeBlocks:0})}
# fd 3 is the host's auth socket \u2014 inherited through bash \u2192 exec \u2192 python.
exec "$CONDA_PYTHON" -I ${kG(qm())} repl ${kG(z.provider_py_path)}
`}function oaO(O){return`#!/bin/bash
set -euo pipefail

# mkdir+cd: same coworkd-ignores-cwd workaround as renderPythonBootstrap.
${PO_(O.workspaceDir)}
${bO_}

if [ ! -x ${kG(O.pythonBin)} ]; then
  echo "operon-kernel: interpreter "${kG(O.pythonBin)}" not found or not executable (set [conda].operon_python_bin)" >&2
  exit 72
fi

# Scrub PATH so subprocess.run(["python",\u2026]) from operon-kernel code can't
# reach a host pyenv/conda interpreter in --no-sandbox mode.
export PATH=/usr/bin:/bin
${YC({maxVirtualMemoryMb:0,maxFileSizeBlocks:0})}
# -I -S: isolated + no site.py \u2014 the load-bearing flags for the operon-kernel
# trust boundary. -I alone is NOT stdlib-only (site.py still adds
# dist-packages); -S is what actually strips site-packages/sitecustomize.
exec ${kG(O.pythonBin)} -I -S /dev/fd/3 3< <(base64 -d <<'${hL}'
${aQ_(Wd_)}
${hL}
)
`}var hL="OPERON_KERNEL_WORKER_EOF",Wd_,Wxw,bO_="mkdir -p handoff 2>/dev/null || true",rQ_=".operon-venv-complete";