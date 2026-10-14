var ro_=S(()=>{BV();qY();xC();B0_();tA();OO_();JL()});var AaO=`#!/usr/bin/env python3
"""
Kernel worker subprocess for persistent Python execution.

This script runs as a long-lived subprocess, maintaining a persistent
namespace across multiple code executions. Communication is via JSON
over stdin/stdout.

Protocol:
- Reads JSON requests from stdin (one per line)
- Writes JSON responses to stdout (one per line)
- Maintains namespace across executions

Request format:
    {"id": "uuid", "code": "python code here"}

Response format:
    {"id": "uuid", "stdout": "...", "stderr": "...", "error": null|"traceback",
     "trace": {"error_lineno": int|null, "error_call": str|null},
     "usage": {"wall_s": float, "cpu_s": float, "peak_rss_kb": int}}
"""

import builtins
import errno
import io
import json
import os
import resource
import signal
import sys
import threading
import time
import traceback
from io import StringIO

# All writers to the kernel\u2194host JSON-per-line protocol fd (the module-level
# \`_protocol_stdout\`, published as \`sys._operon_protocol_stdout\`) must hold
# this \u2014 _StreamingStdout.write (any user thread), the SDK's RPC
# writer, and the final-response write. CPython's print() is two non-atomic
# write() calls with GIL-release points; without the lock, a background-
# thread print() can fuse with a main-thread SDK-RPC / response line and the
# host's JSON.parse fails (\u2192 spurious RPC error, or a discarded response
# line \u2192 execute() timeout \u2192 kernel killed). Published on \`sys\` so
# sdk/base.py can find it without importing __main__.
_PROTOCOL_WRITE_LOCK = threading.Lock()
sys._operon_protocol_lock = _PROTOCOL_WRITE_LOCK  # noqa: SLF001

# Protocol OUTPUT stream. main() moves the result pipe to a non-inheritable
# high fd and rebinds this (plus publishes it as sys._operon_protocol_stdout
# for the SDK / byoc preload); until then it's the ordinary stdout wrapper so
# a direct-import test that never calls main() still has a sane write target.
_protocol_stdout = sys.stdout


MAX_OUTPUT_SIZE = 1024 * 1024  # truncate_output head cap; BUFFER_CAP derives from it


class _CappedStringIO(StringIO):
    """StringIO with a hard per-cell buffer cap (5d1f641e/0ab88025 \u2014 a runaway
    print / logging / tqdm loop otherwise grows unbounded and can OOM the
    worker). Cap is in UTF-8 bytes (what goes on the wire); \`getvalue()\`
    appends a marker reporting the REAL dropped count so the agent sees the
    signal (truncate_output is head-only; appending the marker at write()-time
    at byte-4MB would truncate it away). Cap is MAX_OUTPUT_SIZE minus headroom
    so marker + content stay under truncate_output's threshold \u2014 the agent sees
    our accurate "(N bytes dropped)" instead of a misleading generic suffix."""

    BUFFER_CAP = MAX_OUTPUT_SIZE - 256  # marker headroom

    def __init__(self):
        super().__init__()
        self._buffered = 0
        self._dropped = 0

    def write(self, s):
        if self._buffered >= self.BUFFER_CAP:
            self._dropped += len(s.encode("utf-8", "surrogatepass"))
            return len(s)
        n = len(s.encode("utf-8", "surrogatepass"))
        remaining = self.BUFFER_CAP - self._buffered
        if n <= remaining:
            self._buffered += n
            return super().write(s)
        # Trim on a UTF-8 boundary (#1539 r11 3237416703 \u2014 single-write
        # bypass): encode, slice bytes, decode.
        head = s.encode("utf-8", "surrogatepass")[:remaining].decode(
            "utf-8", "ignore"
        )
        self._buffered = self.BUFFER_CAP
        self._dropped = n - remaining
        super().write(head)
        return len(s)  # honour io.write contract (code-points written-or-consumed)

    def getvalue(self):
        v = super().getvalue()
        if self._dropped:
            return v + (
                f"\\n\u2026(buffer capped at {self.BUFFER_CAP // 1024} KB; "
                f"{self._dropped} further bytes dropped)\\n"
            )
        return v


class _StreamingStdout(_CappedStringIO):
    """Write-through stdout: captures to internal buffer AND streams each write
    as a {"type":"stdout_chunk","data":...} JSON line on the protocol-out pipe
    (\`_protocol_stdout\` \u2014 a non-inheritable high fd; fd 1 itself aliases
    stderr after main()'s dup2 dance).
    The host's _readProtocolResponse loop picks these up and forwards them live.
    Buffer capture still returns full output at end \u2014 streaming is additive."""

    # Generous per-cell WS stream budget (10\xD7 the 1 MB tool_result cap). The
    # buffered tool_result is truncated to MAX_OUTPUT_SIZE; without a cap here
    # a runaway print loop would flood the WebSocket with unbounded
    # tool_stdout_chunk frames even though the persisted/agent-visible stdout
    # is \u22641 MB. Counted in UTF-8 bytes (what actually goes on the wire).
    # See #3175832329.
    STREAM_CAP = 10 * 1024 * 1024

    def __init__(self):
        super().__init__()
        self._streamed = 0
        # Cleared in main()'s per-request \`finally\`. write() emits directly to
        # the protocol-out pipe, so a background thread holding a reference to
        # THIS instance (logging.StreamHandler(stream=sys.stdout), tqdm,
        # captured out=sys.stdout) would otherwise keep emitting stdout_chunk
        # after the cell ends \u2014 which the host then dispatches under the NEXT
        # cell's tool_use_id (#3175983465). Per-instance (not module-level) so
        # a stale P1 stays muted while the live P2 emits.
        self._active = True

    def write(self, s):
        if s and self._active and self._streamed < self.STREAM_CAP:
            try:
                n = len(s.encode("utf-8", "surrogatepass"))
                remaining = self.STREAM_CAP - self._streamed
                if n <= remaining:
                    payload = s
                    self._streamed += n
                else:
                    # Trim on a UTF-8 boundary: encode, slice bytes, decode.
                    payload = s.encode("utf-8", "surrogatepass")[:remaining].decode(
                        "utf-8", "ignore"
                    )
                    self._streamed = self.STREAM_CAP
                line = json.dumps({"type": "stdout_chunk", "data": payload}) + "\\n"
                with _PROTOCOL_WRITE_LOCK:
                    _protocol_stdout.write(line)
                    _protocol_stdout.flush()
                if self._streamed >= self.STREAM_CAP:
                    marker = (
                        json.dumps(
                            {
                                "type": "stdout_chunk",
                                "data": "\\n\u2026(live stream truncated at "
                                f"{self.STREAM_CAP // (1024*1024)} MB; "
                                "full output in tool_result)\\n",
                            }
                        )
                        + "\\n"
                    )
                    with _PROTOCOL_WRITE_LOCK:
                        _protocol_stdout.write(marker)
                        _protocol_stdout.flush()
            except Exception:
                pass  # streaming is best-effort; buffer capture below still works
        return super().write(s)


# Secrets are stripped from environment before any user code runs. Even if
# env sanitization ran before subprocess launch, that is not relied upon.
# The canonical secret list is passed via OPERON_SECRET_VARS by the parent process
# (sourced from gateway.sandbox.env_security.KERNEL_SECRET_VARS).
for _k in os.environ.pop("OPERON_SECRET_VARS", "").split(","):
    if _k:
        os.environ.pop(_k, None)
del _k

# Runtime guard against loading attacker-written shared libraries. The host
# passes the list of writable bind mounts via OPERON_WRITABLE_ROOTS; any
# ctypes.dlopen of a path under one of those roots is refused. Bare sonames
# (no "/") and None pass through \u2014 ld.so only resolves those from RO-overlay
# system lib dirs. OPERON_DLOPEN_EXEMPT carves out the frame venv/R-libs:
# pip-installed wheels legitimately dlopen bundled .so files from
# site-packages, and an attacker who can write there already has arbitrary
# code execution at import time. When OPERON_WRITABLE_ROOTS is absent (e.g.
# VM-backed hosts), no hook is installed: the VM/OS boundary is load-bearing.
_writable_roots = tuple(
    p.rstrip("/") for p in os.environ.pop("OPERON_WRITABLE_ROOTS", "").split(":") if p
)
_dlopen_exempt = tuple(
    p.rstrip("/") for p in os.environ.pop("OPERON_DLOPEN_EXEMPT", "").split(":") if p
)
if _writable_roots:
    # Add the running interpreter's own prefix to the exempt list. This is the
    # authoritative venv root regardless of how the host computed the path, so
    # pip-installed wheels that ctypes-load a bundled .so from site-packages
    # (python-magic, some shapely/llvmlite builds) work even if the host-side
    # path math drifts.
    _dlopen_exempt = _dlopen_exempt + tuple(
        p.rstrip("/") for p in {sys.prefix, sys.exec_prefix, sys.base_prefix} if p
    )

    # Capture everything the hook needs as keyword-default args. Defaults are
    # evaluated once at def time and stored on the function object \u2014 NOT
    # looked up from the module namespace at call time. After sys.addaudithook
    # + del, the function object is only reachable via CPython's internal
    # audit-hook list, which has no Python-level accessor.
    #
    # NOTE: posixpath.realpath is pure Python and looks up os.lstat/readlink/
    # getcwd at CALL time, so capturing _realpath alone is insufficient \u2014 a
    # user who monkeypatches os.readlink can still make realpath lie. Belt-
    # and-suspenders: also check the *literal* arg (normalized with the C-level
    # posix.getcwd + pure-string normpath, both captured). The attacker must
    # pass a real path string to CDLL(); if either the literal OR the realpath
    # lands under a writable root (and not under exempt), deny.
    import posix as _posix
    import posixpath as _posixpath

    def _operon_audit(
        event,
        args,
        *,
        _realpath=os.path.realpath,
        _normpath=_posixpath.normpath,
        _getcwd=_posix.getcwd,
        _str=str,
        _roots=_writable_roots,
        _exempt=_dlopen_exempt,
        _PermissionError=PermissionError,
    ):
        if event != "ctypes.dlopen":
            return
        name = args[0]
        if not name or "/" not in _str(name):
            return
        name = _str(name)
        # Literal check: normalize without touching the (monkeypatchable) fs.
        # posix.getcwd is a C builtin; normpath is pure string ops.
        try:
            literal = _normpath(
                name if name.startswith("/") else _getcwd() + "/" + name
            )
        except (OSError, ValueError):
            literal = name
        try:
            real = _realpath(name)
        except (OSError, ValueError):
            real = name
        for candidate in (literal, real):
            is_exempt = False
            for root in _exempt:
                if candidate == root or candidate.startswith(root + "/"):
                    is_exempt = True
                    break
            if is_exempt:
                continue
            for root in _roots:
                if candidate == root or candidate.startswith(root + "/"):
                    raise _PermissionError(
                        f"Refusing to dlopen shared library from writable path: {candidate}"
                    )

    sys.addaudithook(_operon_audit)
    del _operon_audit, _posix, _posixpath
del _writable_roots, _dlopen_exempt


def truncate_output(text: str, max_size: int = MAX_OUTPUT_SIZE) -> str:
    """Truncate output if it exceeds max size."""
    if len(text) > max_size:
        return (
            text[:max_size] + f"\\n... (truncated, {len(text) - max_size} bytes omitted)"
        )
    return text


def _cpu_seconds():
    """Total CPU time (user+sys) consumed by this process and its reaped
    children so far. RUSAGE_CHILDREN only accounts for children that have
    been wait()ed \u2014 subprocess.run/check_output do this, so CPU burned in a
    cell's subprocesses is captured. Still-running background children are
    not (can't be, without polling /proc)."""
    s = resource.getrusage(resource.RUSAGE_SELF)
    c = resource.getrusage(resource.RUSAGE_CHILDREN)
    return s.ru_utime + s.ru_stime + c.ru_utime + c.ru_stime


def _reset_peak_rss():
    """On Linux, writing '5' to /proc/self/clear_refs resets the VmHWM
    high-water mark to the current RSS, so a subsequent VmHWM read gives the
    peak over just the next cell rather than the process lifetime. No-op on
    non-Linux or if procfs isn't writable (falls back to a cumulative peak,
    which is still informative)."""
    try:
        with open("/proc/self/clear_refs", "w") as f:
            f.write("5\\n")
    except OSError:
        pass


def _read_peak_rss_kb():
    """Peak RSS in KB since the last _reset_peak_rss() (Linux), or the
    process-lifetime peak via getrusage elsewhere. On Linux ru_maxrss is KB;
    on macOS it's bytes \u2014 normalize to KB."""
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmHWM:"):
                    return int(line.split()[1])
    except OSError:
        pass
    maxrss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform == "darwin":
        maxrss //= 1024
    return maxrss


def _configure_pandas_display(pd_module):
    """Configure pandas display options to prevent column/row truncation."""
    pd_module.set_option("display.max_columns", None)  # Show all columns
    pd_module.set_option("display.max_rows", 500)  # Reasonable limit for large DFs
    pd_module.set_option("display.max_colwidth", None)  # No cell content truncation
    pd_module.set_option("display.width", None)  # Auto-detect terminal width
    pd_module.set_option(
        "display.expand_frame_repr", False
    )  # Don't wrap to multiple pages


def _open_fignums():
    """Fignums currently open, or empty set if matplotlib isn't loaded.
    Never imports matplotlib itself."""
    try:
        if "matplotlib" not in sys.modules:
            return set()
        import matplotlib.pyplot as plt

        return set(plt.get_fignums())
    except BaseException:
        # BaseException, not Exception: a SIGINT-raised KeyboardInterrupt
        # during get_fignums() must degrade to "no snapshot" instead of
        # propagating and skipping the assignment (bughunter 3354587543).
        return set()


def _auto_capture_figures(cell_counter, pre_fignums, workspace_dir):
    """User-terminal cells only (request origin == "user"): save figures
    CREATED during this cell to the workspace so the notebook side view can
    show them \u2014 rich output is filesystem-diff based, so an unsaved figure
    is invisible. Pre-existing figures (e.g. one the agent left open) are
    deliberately skipped: capturing them would attach stale plots to
    unrelated user cells. Figures are NOT closed \u2014 jupyter-style iterative
    plotting (tweaking \`ax\` in a follow-up cell) must keep working; the
    pre_fignums snapshot already prevents re-capture. Filenames carry the
    worker pid so a respawned worker (cell_counter resets) can't silently
    overwrite an earlier cell's figure. Saves land under workspace_dir
    (host-threaded absolute path), never the kernel's persistent cwd \u2014
    the agent may have chdir'd into a user repo. Agent cells are untouched
    (agents savefig explicitly). Best-effort: never raises, never imports
    matplotlib. Per-figure try (bughunter 3356207733): one backend/FS
    failure must not abandon the remaining figures in the burst."""
    try:
        if "matplotlib" not in sys.modules:
            return
        import matplotlib.pyplot as plt

        new_nums = [n for n in plt.get_fignums() if n not in pre_fignums]
        for num in new_nums:
            try:
                name = "figure_%d_%d_%d.png" % (cell_counter, num, os.getpid())
                path = (
                    os.path.join(workspace_dir, name) if workspace_dir else name
                )
                plt.figure(num).savefig(path, bbox_inches="tight")
                print("[saved %s]" % name)
            except Exception:
                pass
    except Exception:
        pass


def _create_import_wrapper(original_import):
    """Create an import wrapper that configures pandas when first imported."""
    _pandas_configured = {"value": False}

    def import_wrapper(name, *args, **kwargs):
        module = original_import(name, *args, **kwargs)
        # Configure pandas on first import (handles 'import pandas' and 'import pandas as pd')
        if name == "pandas" and not _pandas_configured["value"]:
            _pandas_configured["value"] = True
            try:
                _configure_pandas_display(module)
            except Exception:
                # Pandas not fully initialized yet (C extensions re-import pandas
                # before options are registered). Reset flag to retry on next import.
                _pandas_configured["value"] = False
        return module

    return import_wrapper


def _format_exc_safe(exc=None):
    """traceback.format_exc() that survives hostile exception objects.

    r8 3363512871, second vector (found by the pin): stdlib traceback
    rendering walks __cause__/__context__ too \u2014 a raising data-descriptor
    kills format_exc() itself, escaping the except arms exactly like the
    unguarded _ki_in_chain walk did. Rendering must classify, never die.
    \`exc\` is the arm's bound exception, so the fallback renders the
    CELL's error (not the rendering failure raised inside the walk).
    """
    try:
        return traceback.format_exc()
    except BaseException:
        try:
            return "%s: %s (traceback unavailable \u2014 exception raised while rendering its own chain)" % (
                type(exc).__name__,
                exc,
            )
        except BaseException:
            return "(unprintable exception \u2014 raised while rendering its own chain)"


def _error_lineno(exc, cell_tag):
    """Walk traceback, return lineno of the deepest frame matching cell_tag.

    Each compile() gets a unique filename like "<kernel:42>" so we can
    distinguish THIS cell's frames from functions defined in prior cells
    (which would have "<kernel:7>" etc). Without this, a function defined
    in cell 0 that raises when called in cell 2 would return the line
    number inside the function body (relative to cell 0's source), not
    cell 2's call-site line.

    Returns None if no matching frame (error entirely inside library code).
    """
    tb = getattr(exc, "__traceback__", None)
    lineno = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == cell_tag:
            lineno = tb.tb_lineno
        tb = tb.tb_next
    return lineno


def _error_call(exc, cell_tag, code):
    """Failing-expression text of the deepest cell frame, or None.

    Python 3.11+ fine-grained locations (PEP 657): the deepest frame whose
    co_filename matches cell_tag carries byte-precise column offsets for
    the failing sub-expression \u2014 slice it from the cell source. This is
    the Python analogue of the R worker's deparse(conditionCall(e)):
    \`host.llm(config.llm)\` attributes to \`config.llm\`, a rebound
    \`host.llm(1)\` to \`host.llm\` (scanner 3392882454 \u2014 exact-call coupling
    instead of stderr text heuristics). Capped 200 chars; None when
    positions are unavailable. Hardened like _error_lineno: any hostile
    descriptor classifies as "no attributable call", never escapes.
    """
    try:
        tb = getattr(exc, "__traceback__", None)
        hit = None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == cell_tag:
                hit = tb
            tb = tb.tb_next
        if hit is None:
            return None
        import itertools
        pos = next(
            itertools.islice(
                hit.tb_frame.f_code.co_positions(), hit.tb_lasti // 2, None
            ),
            None,
        )
        if pos is None:
            return None
        lineno, end_lineno, col, end_col = pos
        if lineno is None or col is None or end_col is None:
            return None
        lines = code.split("\\n")
        # PEP 657 col offsets are UTF-8 BYTE offsets, not character
        # indices (CPython's traceback.py converts via
        # _byte_offset_to_character_offset before slicing) \u2014 slice the
        # encoded line or any non-ASCII text earlier on the line shifts
        # the window (scanner 3393814496).
        raw = lines[lineno - 1].encode("utf-8")
        if end_lineno is not None and end_lineno != lineno:
            seg = raw[col:].decode("utf-8", "replace")
        else:
            seg = raw[col:end_col].decode("utf-8", "replace")
        seg = seg.strip()
        return seg[:200] if seg else None
    except BaseException:
        return None


def _ki_in_chain(exc):
    """True iff the DELIVERED (handler-raised) SIGINT KeyboardInterrupt is
    in exc's causal chain.

    Causal gate for the delivered-SIGINT latch (bughunter 3359747076): a
    conversion during unwind (\`except KeyboardInterrupt: sys.exit(130)\` /
    \`raise RuntimeError("Aborted!")\`) carries the KI in __context__, while
    an unrelated error raised AFTER user code caught the KI and recovered
    does not \u2014 that one must persist as "error", not "cancelled", or a
    real failure (disk full, KeyError) renders as a quiet cancellation.

    Two refinements (#2599 r2):
    - Matches the _operon_delivered_sigint marker set by _sigint_handler,
      NOT isinstance(KeyboardInterrupt) \u2014 a fresh user-written
      \`raise KeyboardInterrupt\` after a recovered SIGINT carries no marker
      and stays an error (3359942421).
    - Honors __suppress_context__, mirroring Python's own traceback rule:
      \`raise X from None\` explicitly severs the chain, so the cell is the
      user's declared fresh error (3359942430). __cause__ always wins over
      __context__ (\`raise X from Y\` sets suppress too).
    """
    seen = set()
    depth = 0
    while exc is not None and id(exc) not in seen and depth < 100:
        seen.add(id(exc))
        depth += 1
        try:
            if getattr(exc, "_operon_delivered_sigint", False):
                return True
            if exc.__cause__ is not None:
                exc = exc.__cause__
            elif getattr(exc, "__suppress_context__", False):
                return False
            else:
                exc = exc.__context__
        except BaseException:
            # r8 3363512871: hostile exception objects \u2014 a raising
            # __getattr__ (getattr's default only swallows
            # AttributeError) or a raising data-descriptor shadowing
            # __cause__/__context__ \u2014 are USER DATA. The classifier must
            # classify them, never die on them: an escape here exits
            # through the _cell_attribution callsites in the except arms
            # and kills the worker (silent wipe \u2014 the never-silent-wipe
            # contract above). An unknowable chain is not a delivered
            # interrupt. The depth cap is the same hostility class as
            # the id()-seen cycle guard: real chains are human-scale.
            return False
    return False


def _cell_attribution(exc, cell_tag, sigint_delivered, code=""):
    """(interrupted, error_lineno, error_call) \u2014 the ONE predicate all arms share.

    interrupted \u21D4 a SIGINT was delivered this cell AND exc is causally
    linked to the handler-raised KeyboardInterrupt (see _ki_in_chain).

    When interrupted, error_lineno is None REGARDLESS of which arm caught
    the exception (bughunter 3359942410): codeSynthesis.ts:151-154 keys
    its "cancelled, no signal" filter on null lineno \u2014 a cancelled rewrap
    (click's sys.exit(130) / RuntimeError('Aborted!')) shipping a lineno
    would leak Ctrl-C'd partial work into the artifact extraction prompts
    exactly like the un-gated KI arm did (3359747060). Otherwise the
    deepest cell frame, like any ordinary error.
    """
    interrupted = sigint_delivered and _ki_in_chain(exc)
    try:
        if interrupted:
            return interrupted, None, None
        return (
            interrupted,
            _error_lineno(exc, cell_tag),
            _error_call(exc, cell_tag, code),
        )
    except BaseException:
        # r8 3363512871 choke point: _error_lineno does getattr on
        # __traceback__ / walks tb frames \u2014 a hostile descriptor there
        # (same class as the _ki_in_chain hardening) must classify as
        # "no attributable line", never escape through the except arms.
        return interrupted, None, None


def main():
    """Main loop: read requests from stdin, execute, write responses to stdout."""
    # Version marker for VM diagnostics \u2014 if this doesn't appear in stderr on
    # startup, the heredoc content was mangled in transit (Swift addon / vsock).
    print("[kernel_worker] v2 tracer+error_lineno", file=sys.stderr, flush=True)

    cell_counter = 0

    # \u2500\u2500\u2500 SIGINT discipline (#1539) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    # host.exec_interrupt \u2192 host sends SIGINT to this process. It must ONLY
    # interrupt user code; anywhere else (readline, response-build, protocol
    # write, json.loads, inside this handler itself) it must be a no-op so the
    # worker process and \`namespace\` survive unconditionally. Gap-patching
    # individual statements with \`except KeyboardInterrupt\` is whack-a-mole
    # (r3\u2192r5\u2192r6\u2192r7 each found another window). Structural fix: install a
    # conditional SIGINT handler. Outside the eval/exec bracket \u2192 swallow.
    # Inside \u2192 raise KeyboardInterrupt (default behavior). \`_in_user_code\`
    # is a list so the closure can mutate it.
    _in_user_code = [False]
    # Was a SIGINT actually DELIVERED (vs a user-written
    # \`raise KeyboardInterrupt\`)? Only delivered signals count as
    # "cancelled" \u2014 a deliberate raise is an ordinary error
    # (bughunter 3354587476). Reset per cell after the except arms read it.
    _sigint_delivered = [False]

    def _sigint_handler(signum, frame):
        if _in_user_code[0]:
            # One-shot: clear before raising so a second SIGINT anywhere
            # (including inside the except handler or the 1-bytecode gap at
            # flag-clear) is swallowed. The next cell's bracket re-arms.
            _in_user_code[0] = False
            _sigint_delivered[0] = True
            # Marker ties downstream attribution to THIS delivery \u2014
            # _ki_in_chain matches it, not isinstance, so a fresh
            # user-written \`raise KeyboardInterrupt\` later in the same
            # cell stays an error (#2599 r2 3359942421).
            ki = KeyboardInterrupt()
            ki._operon_delivered_sigint = True
            raise ki
        # Outside user code \u2014 swallow. Worker loop continues; host's
        # awaitExecStreamDone will time out (5s) and the agent sees
        # {interrupted:true} with the cell's actual result arriving via
        # exec_completion shortly after (the cell already finished if we're
        # here). Namespace intact.

    signal.signal(signal.SIGINT, _sigint_handler)

    # The subprocess is started with cwd set to the frame-specific workspace
    # directory by kernel.py. The worker simply uses whatever cwd it was started with.
    # No validation is needed - the parent process ensures the directory exists.

    # Install import hook to configure pandas when imported
    original_import = builtins.__import__
    builtins.__import__ = _create_import_wrapper(original_import)

    # help(): the repl control-plane kernel boots with \`-I -S\`
    # (renderOperonBootstrap) \u2014 \`-S\` skips site.py, which is what normally
    # installs builtins.help. Restore it from pydoc so \`help(host.foo)\` works
    # for SDK introspection. No-op for the regular compute kernel (site.py ran).
    if not hasattr(builtins, "help"):
        import pydoc

        builtins.help = pydoc.help

    # Initialize namespace with builtins.
    # The host SDK (host.lineage/query/llm) is installed via the first
    # execute() after kernel start \u2014 see base.ts postStartCode mechanism.
    namespace = {
        "__name__": "__main__",
        "__builtins__": __builtins__,
    }

    # \u2500\u2500 Move protocol pipes off fd 0/1 and sanitize 0/1 for subprocesses \u2500\u2500\u2500\u2500
    # Port of codon 187054f2 (frame 45dfa434's 10h wedge \u2014 task 50368d9e).
    # User cells frequently \`subprocess.run("rg PATTERN", shell=True,
    # capture_output=True)\` WITHOUT \`stdin=DEVNULL\`. The child inherits fd 0,
    # which here is the host\u2192kernel COMMAND PIPE \u2014 pathless rg/grep/cat with
    # stdin=pipe read stdin and block forever on it. After the dup2 below,
    # fd 0 is /dev/null: inherited subprocesses see EOF immediately and
    # pathless rg falls back to cwd-recurse. Protocol reads move to a
    # non-inheritable high fd (\`_protocol_stdin\`).
    #
    # Symmetrically, a subprocess WITHOUT capture writes raw bytes to
    # inherited fd 1 \u2014 the RESULT PIPE \u2014 where a line that happens to be
    # valid JSON (\`jq\`, \`curl|cat\`) misparses as a protocol frame. After
    # \`os.dup2(2, 1)\`, fd 1 aliases fd 2 (kernel stderr, drained into
    # base.ts _stderrRing and surfaced as diagnostic tail on death) \u2014
    # subprocess stdout lands there harmlessly. Protocol writes move to
    # \`_protocol_stdout\` on a non-inheritable high fd.
    #
    # \`sys.stdin\`/\`sys.__stdout__\` still wrap fd 0/1, so after the dup2s user
    # code reading \`sys.stdin\` gets EOF (not the command pipe) and writing to
    # \`sys.__stdout__\` goes to the stderr ring (not the result stream).
    #
    # Robustness notes retained from the pre-port dup (#2565 ride-along
    # 4627168599 / #2550): \`exit()\` / \`quit()\` (site.Quitter) close sys.stdin
    # before raising SystemExit, and user code can close/reassign sys.stdin
    # too. The protocol dup is published on \`sys\` so the SDK's RPC reply
    # reader shares it (sys.__stdin__ IS sys.stdin at startup \u2014 one wrapper,
    # one buffer, no read interleave). Explicit utf-8 (#2599 r2 3359942434):
    # a bare POSIX/C locale must not let a stray byte UnicodeDecodeError the
    # read loop.
    global _protocol_stdout
    _protocol_stdin = os.fdopen(os.dup(0), "r", encoding="utf-8", errors="replace")
    os.set_inheritable(_protocol_stdin.fileno(), False)
    sys._operon_protocol_stdin = _protocol_stdin  # noqa: SLF001
    # Bare reserve fd for the recovery re-dup below (was \`os.dup(0)\` at the
    # re-dup site pre-port; fd 0 is /dev/null now, so the recovery path needs
    # a held-open copy of the real pipe to re-open from). All three protocol
    # fds are \u22653 \u2014 an in-cell \`os.closerange(3, N)\` is now unrecoverable by
    # design (reserve gone \u2192 recovery EBADFs \u2192 loud shutdown, not silent).
    _proto_in_reserve = os.dup(_protocol_stdin.fileno())
    os.set_inheritable(_proto_in_reserve, False)
    _protocol_stdout = os.fdopen(
        os.dup(1), "w", encoding="utf-8", errors="replace", buffering=1
    )
    os.set_inheritable(_protocol_stdout.fileno(), False)
    # BYOC token-scrub hook: the compute-provider repl shim pre-publishes a
    # wrap callable (\`run_repl\` \u2192 \`_ScrubWriter\`) so the response JSON \u2014
    # stdout_chunk lines, final stderr/error, SDK RPC writes \u2014 passes
    # through the courtesy token-scrub regex on its way to the result pipe.
    # Covers the pre-port porous stdout_chunk path too (that went via
    # sys.__stdout__, which the shim never wrapped). No-op outside byoc.
    _wrap = getattr(sys, "_operon_protocol_stdout_wrap", None)
    if _wrap is not None:
        _protocol_stdout = _wrap(_protocol_stdout)
    sys._operon_protocol_stdout = _protocol_stdout  # noqa: SLF001
    _devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(_devnull, 0)
    os.close(_devnull)
    os.dup2(2, 1)
    # Startup-captured IDENTITY of the protocol pipe (#2599 r5
    # 3362037825/3362037831): an open fd NUMBER proves nothing \u2014 user
    # code can close our number and reclaim it (daemonize closerange +
    # open app.log; or open a readable file whose lines would then be
    # dispatched as garbage requests). dev/ino is the pipe itself;
    # every trust decision below compares against it.
    _st0 = os.fstat(_protocol_stdin.fileno())
    _protocol_ident = (_st0.st_dev, _st0.st_ino)

    def _is_protocol_stream(stream):
        try:
            st = os.fstat(stream.fileno())
            return (st.st_dev, st.st_ino) == _protocol_ident
        except (SystemExit, GeneratorExit):
            # r7 3363117727: a delegate fileno() raising BaseException
            # must never take down the worker loop \u2014 a protocol probe is
            # not a legitimate exit path. Not-protocol \u2192 park/recover.
            # NOT shadowed by _identity_suspect's arm (r7b disposition):
            # the EOF gate below calls THIS classifier as fileno call #3
            # \u2014 after the pre-read (#1) and post-read (#2) checks \u2014 so a
            # STATEFUL delegate that returns the real fd twice and then
            # raises SystemExit here, while returning "", reaches this
            # arm directly; without it the SE would escape the loop's
            # \`except Exception\` guard and kill the worker.
            return False
        except Exception:
            return False

    def _identity_suspect(stream):
        # Lenient variant for the pre-trust read check: a synthetic
        # delegate (no fileno \u2014 e.g. a test spy wrapping the real
        # stream) can't be verified and isn't the recycle pattern the
        # check exists for; the daemonize/recycle attack object is the
        # genuine stale TextIOWrapper, which always has a real-but-
        # wrong fileno. Raise-class discrimination (r6 3362707613):
        # io.UnsupportedOperation is io.IOBase's NATURAL "not backed by
        # a real fd" signal \u2014 same trust tier as no attribute at all;
        # any other raise (EBADF, closed-file ValueError) means a dead
        # fd, which IS suspect.
        fn = getattr(stream, "fileno", None)
        if fn is None:
            return False
        try:
            fd = fn()
        except io.UnsupportedOperation:
            return False
        except (SystemExit, GeneratorExit):
            # r7 3363117727: the recovery guard is \`except Exception\`, but
            # this classifier runs INSIDE it \u2014 a delegate fileno() raising
            # SystemExit/GeneratorExit would escape the guard and kill the
            # loop. A protocol probe must never be an exit path: classify
            # as suspect so recovery parks the delegate instead.
            return True
        except Exception:
            return True
        try:
            st = os.fstat(fd)
        except Exception:
            return True
        return (st.st_dev, st.st_ino) != _protocol_ident

    # Wrappers whose fd number was recycled to a USER file are parked
    # here instead of closed (3362037825): closing would destroy the
    # user's handle, and letting the wrapper be GC'd would do the same
    # via its destructor. A strong ref makes the destructor unreachable.
    # One entry per recovery (at most one recovery per read) \u2014 bounded
    # in practice by sabotage frequency, and each entry is a dead
    # ~KB-scale object.
    _parked_wrappers = []
    # The BYOC resident drives its idle-timer by wrapping the blocking
    # read; it publishes the wrapper as sys._operon_protocol_readline
    # before exec'ing this worker. When present, use it so the idle
    # cancel/re-arm still fires between cells.
    _byoc_readline = getattr(sys, "_operon_protocol_readline", None)

    def _readline():
        # Every read resolves sys._operon_protocol_stdin AT CALL TIME
        # (#2599 r3 3361596379/3361596392): the recovery path below
        # republishes that attribute, and because no consumer holds a
        # bound-method snapshot \u2014 this loop resolves per call, the BYOC
        # idle wrapper does its own lazy getattr, and the SDK's reply
        # reader re-resolves per RPC \u2014 ONE republish reaches all
        # three. The BYOC wrapper chain is preserved by construction:
        # recovery never rebinds _readline, so the idle timer keeps
        # arming even after a re-dup.
        if _byoc_readline is not None:
            return _byoc_readline()
        return sys._operon_protocol_stdin.readline()  # noqa: SLF001

    # Shadow site.Quitter: the real exit()/quit() CLOSE sys.stdin before
    # raising SystemExit, so even with the except-SystemExit arm below the
    # protocol channel would be dead and the next readline() kills the
    # worker anyway (bughunter 3358904699). This quitter raises without
    # touching stdin; the except arm turns it into an ordinary cell error.
    # The marker subclass lets the arm gate its "(exit()/quit() is disabled
    # here)" hint on the shadow actually being invoked \u2014 a library
    # \`sys.exit()\` or an explicit \`raise SystemExit(3)\` must not be blamed
    # on REPL muscle memory (bughunter 3359240345).
    class _OperonQuitterExit(SystemExit):
        pass

    # Present as plain "SystemExit" in tracebacks \u2014 users know that name;
    # the marker is an implementation detail (isinstance still
    # distinguishes it for the hint gate below).
    _OperonQuitterExit.__name__ = "SystemExit"
    _OperonQuitterExit.__qualname__ = "SystemExit"

    class _OperonQuitter:
        def __repr__(self):
            return (
                "exit()/quit() is disabled here \u2014 this terminal shares the "
                "agent's live kernel. Kernels are stopped from the UI."
            )

        def __call__(self, code=None):
            raise _OperonQuitterExit(code)

    _quitter = _OperonQuitter()
    namespace["exit"] = namespace["quit"] = _quitter
    # Also overwrite the builtins pair: \`del exit; exit()\` or
    # \`import builtins; builtins.exit()\` fall through to the real
    # site.Quitter, which closes stdin \u2014 the except arm survives the raise
    # but the next readline() dies on the closed pipe (bughunter
    # 3359240346). No-op under \`-S\` (site never installed them).
    builtins.exit = builtins.quit = _quitter

    # Ensure stdout is line-buffered for responsive communication
    # (stdout might be block-buffered when piped to another process)

    # Explicit readline() (not \`for line in stdin\`) \u2014 equivalent behavior,
    # slightly more explicit about EOF handling. Guarded (#2599 r2
    # 3359942434, hardened r4 3361801276): user sabotage of the published
    # stream (os.close(N), fd sweep, \`sys._operon_protocol_stdin =
    # garbage\`, a delegate that raises or returns non-str) gets ONE
    # recovery attempt before a clean stderr-logged shutdown, never an
    # unhandled crash and never a SILENT wipe.
    while True:
        try:
            # Identity check BEFORE the blocking read (r6 3362707660):
            # the third fd-recycle shape \u2014 a readable occupant that never
            # returns data (empty pipe, FIFO, idle socket) \u2014 would block
            # _readline() FOREVER, so a post-read check alone fires one
            # read too late. Verify the published source is (still) the
            # protocol pipe before committing to a blocking read on it.
            _src = getattr(sys, "_operon_protocol_stdin", None)
            if _src is None or _identity_suspect(_src):
                raise OSError(
                    "protocol stream identity lost before read "
                    "(fd recycled/reassigned)"
                )
            line = _readline()
            if not isinstance(line, str):
                # r4 3361801276: a user-installed delegate returning
                # non-str must be a RECOVERY TRIGGER, not data \u2014 truthy
                # non-str would AttributeError at .strip() below (outside
                # any guard); falsy non-str (None/0) would read as EOF and
                # silently wipe the namespace via clean shutdown.
                raise TypeError(
                    "protocol readline returned non-str %r"
                    % (type(line).__name__,)
                )
            # Post-read identity check (#2599 r5 3362037831): a recycle
            # that happens DURING the blocking wait makes the stale
            # wrapper return the occupant file's content as perfectly
            # valid strings; without this check those lines dispatch as
            # garbage requests and the file's EOF reads as a clean
            # shutdown (silent namespace wipe while fd 0 is healthy).
            # Only lines read from the actual protocol pipe are data.
            _src = getattr(sys, "_operon_protocol_stdin", None)
            if _src is None or _identity_suspect(_src):
                raise OSError(
                    "protocol stream identity lost (fd recycled/reassigned)"
                )
            if not line and not _is_protocol_stream(_src):
                # Clean EOF is only truthful from the VERIFIED protocol
                # pipe (r6 3362707629): a fileno-less delegate returning
                # "" walks the str-check and the lenient identity arm,
                # and \`if not line: break\` below would silently exit the
                # worker with zero diagnostics. Unverifiable EOF is a
                # recovery trigger, not a shutdown.
                raise OSError(
                    "EOF from unverifiable protocol source \u2014 refusing "
                    "silent shutdown"
                )
        except Exception:
            # Broad on purpose (r4 3361801276): a sabotaging delegate can
            # raise anything (RecursionError, custom Exception) \u2014 only
            # BaseException escapees (KeyboardInterrupt is swallowed by
            # the SIGINT discipline, SystemExit can't arise here) skip
            # recovery.
            try:
                # Try-republish-FIRST (#2599 r4 3361801286): for
                # reassignment-type sabotage the LOCAL wrapper is still
                # healthy \u2014 closing it would discard BufferedReader
                # read-ahead, and when the reserve fd is ALSO gone at the OS
                # level, os.dup would EBADF a perfectly recoverable session
                # into a namespace wipe. Destructive close+re-dup is the
                # LAST resort, only when the local wrapper is actually
                # dead (or the failure happened while it WAS published \u2014
                # then the wrapper itself is the problem).
                _healthy = False
                try:
                    if (
                        getattr(sys, "_operon_protocol_stdin", None)
                        is not _protocol_stdin
                        and not _protocol_stdin.closed
                        # r5 3362037825: OPEN is not enough \u2014 the number
                        # may have been recycled to a user file; only the
                        # startup dev/ino identity proves it's still the
                        # protocol pipe.
                        and _is_protocol_stream(_protocol_stdin)
                    ):
                        _healthy = True
                except Exception:
                    _healthy = False
                if not _healthy:
                    # Destructive path \u2014 the old wrapper must never be
                    # able to close the fd number later via its
                    # destructor (#2599 r3 3361596367: os.dup hands back
                    # the lowest free fd, often the very number just
                    # closed; CPython refcounting fires destructors
                    # synchronously at the republish). Disposition by
                    # raise-class (r5 3362037825, refined r6 3362707653):
                    # - number still IS our pipe, or wrapper already
                    #   closed (ValueError), or fd DEAD (EBADF): close()
                    #   deterministically \u2014 swallowed where moot, either
                    #   way the destructor becomes a no-op. The
                    #   ValueError arm IS cell-drivable (close the
                    #   published wrapper), but close-vs-park is
                    #   behaviorally indistinguishable there \u2014 both
                    #   leave a closed wrapper harmless \u2014 so the arm is
                    #   pinned for survival, not discriminated.
                    # - number RECYCLED to a user file (ino mismatch), or
                    #   unclassifiable: PARK \u2014 never destroy a handle we
                    #   can't prove is ours.
                    _close_it = False
                    try:
                        _ds = os.fstat(_protocol_stdin.fileno())
                        _close_it = (
                            _ds.st_dev,
                            _ds.st_ino,
                        ) == _protocol_ident
                    except ValueError:
                        _close_it = True
                    except OSError as _fe:
                        _close_it = (
                            getattr(_fe, "errno", None) == errno.EBADF
                        )
                    except Exception:
                        _close_it = False
                    if _close_it:
                        try:
                            _protocol_stdin.close()
                        except Exception:
                            pass
                    else:
                        _parked_wrappers.append(_protocol_stdin)
                    _protocol_stdin = os.fdopen(
                        os.dup(_proto_in_reserve),
                        "r",
                        encoding="utf-8",
                        errors="replace",
                    )
                    os.set_inheritable(_protocol_stdin.fileno(), False)
                # Capture-before-republish (r6 3362707643): if the
                # previously-published object is a foreign fd-backed
                # wrapper held ONLY by the sys attr (e.g. a user
                # os.fdopen over fd 0 itself), rebinding the attr drops
                # its last reference and its destructor closes that fd \u2014
                # the destructor race re-entered one level up. Park it
                # so the destructor never runs.
                _old_pub = getattr(sys, "_operon_protocol_stdin", None)
                if _old_pub is not None and _old_pub is not _protocol_stdin:
                    _parked_wrappers.append(_old_pub)
                # Republish \u2014 the ONLY step consumers need: the loop, the
                # BYOC idle wrapper, and the SDK all resolve this
                # attribute at call time (3361596379/3361596392).
                sys._operon_protocol_stdin = _protocol_stdin  # noqa: SLF001
                # Identity check BEFORE the blocking retry read (CAST
                # 3362971784): if the reserve itself was recycled \u2014 a user
                # file makes the re-dup'd stream garbage, an idle
                # socket/FIFO occupant makes the retry block FOREVER \u2014
                # fail loudly here instead. Same pre-read placement as
                # the main loop (r6 3362707660); the recovery branch must
                # not keep the post-read-only anti-pattern that fix
                # eliminated.
                if _identity_suspect(_protocol_stdin):
                    raise OSError(
                        "protocol stream identity lost after recovery "
                        "(reserve fd recycled)"
                    )
                line = _readline()
                if not isinstance(line, str):
                    raise TypeError(
                        "protocol readline returned non-str %r after recovery"
                        % (type(line).__name__,)
                    )
                # FULL post-read discipline for the retry (r8 3363512861)
                # \u2014 mirror of the main loop's r5 post-read identity and
                # r6 verified-EOF layers. The pre-retry check above can't
                # see a recycle that lands DURING the blocking wait: a
                # user signal handler (or a thread hitting the syscall-
                # entry window) can dup2 a decoy over the fd number while
                # the read is blocked, and the PEP 475 EINTR retry
                # re-enters by fd NUMBER \u2014 returning decoy bytes (would
                # dispatch) or a foreign EOF (would silently exit via
                # \`if not line: break\`). One recovery per read: a second
                # failure here is the loud shutdown, by design.
                _rsrc = getattr(sys, "_operon_protocol_stdin", None)
                if _rsrc is None or _identity_suspect(_rsrc):
                    raise OSError(
                        "protocol stream identity lost during recovery read"
                    )
                if not line and not _is_protocol_stream(_rsrc):
                    raise OSError(
                        "EOF from unverifiable protocol source after "
                        "recovery \u2014 refusing silent shutdown"
                    )
            except Exception as exc:
                print(
                    "[kernel_worker] protocol stdin unreadable (%r) \u2014 "
                    "shutting down cleanly" % (exc,),
                    file=sys.stderr,
                    flush=True,
                )
                break
        if not line:
            break
        line = line.strip()
        if not line:
            continue

        # Parse request
        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            # Invalid JSON - write error response and continue
            error_response = {
                "id": "unknown",
                "stdout": "",
                "stderr": "",
                "error": f"Invalid JSON request: {e}",
            }
            print(json.dumps(error_response), file=_protocol_stdout, flush=True)
            continue

        # Valid JSON but not an object (r7 3363117756): '[1,2,3]' / '"x"'
        # / '42' parse fine, then .get() would AttributeError OUTSIDE the
        # read guard and kill the loop. Same path as malformed JSON:
        # error response, keep serving.
        if not isinstance(request, dict):
            error_response = {
                "id": "unknown",
                "stdout": "",
                "stderr": "",
                "error": "Invalid request: expected a JSON object, got %s"
                % type(request).__name__,
            }
            print(json.dumps(error_response), file=_protocol_stdout, flush=True)
            continue

        # Orphan RPC frame (#2599 r5 3362037815): a cell whose reply read
        # was severed mid-RPC leaves the host's host_response queued in
        # the pipe; post-recovery this loop would otherwise consume it as
        # a REQUEST \u2014 \`code\` defaults to "" \u2014 executing a spurious empty
        # cell and emitting a response under the RPC's id. Any host_*-
        # typed frame is RPC plumbing, never a request: drop it. (Prefix
        # match, not a literal tuple \u2014 the SDK-free staleness guard
        # forbids SDK identifiers in this blob.)
        if isinstance(request, dict) and str(
            request.get("type", "")
        ).startswith("host_"):
            continue

        request_id = request.get("id", "unknown")
        code = request.get("code", "")
        # "user" = typed into the kernel terminal; anything else (including
        # absence \u2014 older hosts) is an agent cell. Gates the figure
        # auto-capture below; nothing else branches on it.
        origin = request.get("origin", "agent")
        # Absolute figure-capture target (user cells) \u2014 host-threaded.
        workspace_dir = request.get("workspace_dir")

        # Capture stdout and stderr
        stdout_capture = _StreamingStdout()
        stderr_capture = _CappedStringIO()
        error = None
        error_lineno = None
        error_call = None
        interrupted = False
        _sigint_delivered[0] = False
        # Safe default: the belt arm reads cell_tag, and a SIGINT can land
        # in the window before the per-cell tag is minted below. No cell
        # frame ever matches this sentinel, so _error_lineno \u2192 None.
        cell_tag = "<kernel:pre>"

        # Per-cell resource accounting. Reset the VmHWM high-water mark so
        # peak_rss_kb reflects THIS cell, not the process lifetime.
        _reset_peak_rss()
        wall0 = time.perf_counter()
        cpu0 = _cpu_seconds()

        # Save original stdout/stderr
        old_stdout = sys.stdout
        old_stderr = sys.stderr

        try:
            # Redirect stdout/stderr to our captures
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture

            # Per-cell filename so _error_lineno can distinguish THIS cell's
            # frames from functions defined in prior cells. All cells sharing
            # "<kernel>" would mean a function defined in cell 0 raising in
            # cell 2 returns cell 0's line numbers (inside the function body).
            cell_counter += 1
            cell_tag = f"<kernel:{cell_counter}>"

            # Detect expression vs statements FIRST, then run outside the
            # except handler. Running exec() inside \`except SyntaxError:\`
            # chains the (handled) compile SyntaxError onto every user-code
            # exception via __context__; clearing one level doesn't help when
            # user code re-raises. Two compile() calls are cheap and keep the
            # traceback clean.
            compiled = None
            is_expr = True
            try:
                compiled = compile(code, cell_tag, "eval")
            except SyntaxError:
                is_expr = False
                try:
                    compiled = compile(code, cell_tag, "exec")
                except SyntaxError as e:
                    error = f"SyntaxError: {e}"
                    error_lineno = getattr(e, "lineno", None)

            if compiled is not None:
                # Register the cell source with linecache so cell-defined
                # callables are introspectable: inspect.getsource() walks
                # the linecache, and tracebacks for functions defined here
                # show source lines instead of bare file:line. The 4-tuple
                # (size, mtime=None, lines, name) is the linecache entry
                # shape; mtime=None tells checkcache() never to invalidate
                # it (there's no on-disk file to stat). One assignment
                # covers both eval/exec \u2014 whichever compile succeeded.
                import linecache as _linecache
                _linecache.cache[cell_tag] = (
                    len(code), None, code.splitlines(True), cell_tag,
                )
                # Bound the cache: evict the cell tag exactly 128 behind
                # (counter-based, NOT a lexicographic sort \u2014 \`<kernel:9>\`
                # would beat \`<kernel:100>\` \u2014 review 3469738890). mtime=None
                # \u21D2 checkcache() never evicts (review 3468729765).
                _linecache.cache.pop(f"<kernel:{cell_counter - 128}>", None)
                # Bracket: SIGINT inside this block raises KeyboardInterrupt
                # (once \u2014 handler is one-shot and self-clears); anywhere else
                # it's swallowed by _sigint_handler. Flag set INSIDE the try
                # (#1539 r9 3233690976) so a SIGINT in the 1-bytecode gap
                # between STORE_SUBSCR and the next instruction is covered by
                # \`except KeyboardInterrupt\`. No \`finally\` \u2014 each arm clears
                # explicitly; the one-shot handler guarantees a second SIGINT
                # during clear is swallowed.
                # pre_figs snapshot BEFORE the SIGINT-armed bracket: the
                # helper is inert (no user code), and taking it after
                # \`_in_user_code[0] = True\` left a window where a SIGINT
                # aborts the assignment and the fall-through capture sees
                # pre_figs=() \u2014 saving every open figure, including stale
                # agent ones (bughunter 3354587543).
                pre_figs = _open_fignums() if origin == "user" else ()
                try:
                    _in_user_code[0] = True
                    if is_expr:
                        result = eval(compiled, namespace)
                        if result is not None:
                            print(repr(result))
                    else:
                        exec(compiled, namespace)
                    _in_user_code[0] = False
                except KeyboardInterrupt as e:
                    # host.exec_interrupt(exec_id) \u2192 SIGINT the cell. Catch
                    # here so the worker LOOP survives (provider_params,
                    # DataFrames, Modal handles in \`namespace\` stay intact)
                    # and returns a normal response with partial stdout + the
                    # KeyboardInterrupt traceback. Handler already cleared
                    # _in_user_code (one-shot) \u2014 but a USER-raised
                    # \`raise KeyboardInterrupt\` bypasses the handler, so
                    # clear here too (#1539 r10 3233962127 case 3).
                    _in_user_code[0] = False
                    # Unified attribution (#2599 r2 3359942410/3359942421):
                    # delivered SIGINT \u2192 interrupted + NULL lineno (the
                    # codeSynthesis.ts:151-154 contract \u2014 see
                    # _cell_attribution); user-RAISED KeyboardInterrupt
                    # (no delivery marker) \u2192 ordinary error with its
                    # deterministic raise-site lineno (3359485767).
                    interrupted, error_lineno, error_call = _cell_attribution(
                        e, cell_tag, _sigint_delivered[0], code
                    )
                    error = _format_exc_safe(e)
                except (SystemExit, GeneratorExit) as e:
                    # \`exit()\` / \`quit()\` (site.Quitter) raise SystemExit \u2014
                    # REPL muscle memory in the kernel terminal. Both derive
                    # from BaseException, NOT Exception, so without this arm
                    # they escape the worker loop, kill the process, and
                    # silently destroy the agent's entire in-memory namespace
                    # (post-merge bughunter 3358904699). Record as a normal
                    # cell error so the loop survives.
                    _in_user_code[0] = False
                    # A delivered SIGINT that user code converted to
                    # SystemExit (\`except KeyboardInterrupt: sys.exit(130)\` \u2014
                    # the click/typer standalone pattern) is still a
                    # cancellation, not an exit() attempt (bughunter
                    # 3359240328), and like every cancellation ships a NULL
                    # lineno (3359942410) \u2014 see _cell_attribution.
                    interrupted, error_lineno, error_call = _cell_attribution(
                        e, cell_tag, _sigint_delivered[0], code
                    )
                    error = _format_exc_safe(e)
                    if isinstance(e, _OperonQuitterExit) and not interrupted:
                        # Hint gated on the shadow actually firing: a library
                        # sys.exit() / explicit \`raise SystemExit(n)\` /
                        # GeneratorExit has nothing to do with exit()/quit()
                        # (bughunter 3359240345).
                        error += (
                            "\\n(exit()/quit() is disabled here \u2014 this "
                            "terminal shares the agent's live kernel. "
                            "Kernels are stopped from the UI, not from code.)"
                        )
                except Exception as e:
                    _in_user_code[0] = False
                    # Delivered-SIGINT attribution parity with the other
                    # arms (bughunter 3359485774): user code that catches
                    # the KeyboardInterrupt and re-raises an ordinary
                    # Exception (click's standalone_mode=False Abort
                    # pattern) is still a cancellation, not a crash.
                    # Causally gated (3359747076) with a NULL lineno when
                    # cancelled (3359942410) \u2014 see _cell_attribution.
                    interrupted, error_lineno, error_call = _cell_attribution(
                        e, cell_tag, _sigint_delivered[0], code
                    )
                    error = _format_exc_safe(e)
                except BaseException as e:
                    # Catch-all for the remaining BaseException family \u2014
                    # most realistically asyncio.CancelledError re-raised
                    # out of asyncio.run() (BaseException since 3.8). The
                    # worker-survival invariant is unconditional: no user
                    # exception may kill the loop and wipe the namespace
                    # (bughunter 3359240353). KeyboardInterrupt/SystemExit/
                    # GeneratorExit already matched above; same attribution
                    # discipline as those arms.
                    _in_user_code[0] = False
                    interrupted, error_lineno, error_call = _cell_attribution(
                        e, cell_tag, _sigint_delivered[0], code
                    )
                    error = _format_exc_safe(e)
                # Capture runs on success AND error paths \u2014 a plotting cell
                # that raises AFTER creating its figure must still save it,
                # or the orphan figure latches into the next cell's
                # pre_fignums snapshot and is never capturable again.
                if origin == "user":
                    _auto_capture_figures(cell_counter, pre_figs, workspace_dir)

        except KeyboardInterrupt as e:
            # Belt (#1539 r10 3233962127 case 1): a SIGINT landing in the
            # 1-3 bytecode window between \`except Exception:\` entry and its
            # \`_in_user_code[0]=False\` store raises KI inside a sibling
            # except \u2014 Python doesn't re-match, so it escapes the inner try.
            # One-shot guarantees the flag is already False here (handler
            # cleared before raising), so a further SIGINT in THIS block is
            # swallowed. Record as error; response written normally below.
            _in_user_code[0] = False
            error = _format_exc_safe(e)
            # Same unified attribution as the inner arms (#2599 r2): belt
            # KIs are handler-raised (marked), so this resolves to
            # interrupted + null lineno.
            interrupted, error_lineno, error_call = _cell_attribution(
                e, cell_tag, _sigint_delivered[0], code
            )
            # Belt path bypasses the inner capture call \u2014 without this, the
            # interrupted cell's figure latches into every future cell's
            # pre_figs and auto-capture is silently off for the session
            # (bughunter 3356207733). pre_figs/origin are in scope; the
            # helper is SIGINT-inert (flag already consumed above).
            if origin == "user":
                _auto_capture_figures(cell_counter, pre_figs, workspace_dir)

        finally:
            # Mute this instance's live-stream emit BEFORE restoring stdout \u2014
            # a background thread holding a reference to \`stdout_capture\`
            # (logging/tqdm) would otherwise keep emitting chunks attributed
            # to the next cell. Buffer writes (super().write) still land.
            stdout_capture._active = False
            # Restore stdout/stderr
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        usage = {
            "wall_s": round(time.perf_counter() - wall0, 3),
            "cpu_s": round(_cpu_seconds() - cpu0, 3),
            "peak_rss_kb": _read_peak_rss_kb(),
        }

        # Build response
        response = {
            "id": request_id,
            "stdout": truncate_output(stdout_capture.getvalue()),
            "stderr": truncate_output(stderr_capture.getvalue()),
            "error": error,
            "interrupted": interrupted,
            "trace": {
                "error_lineno": error_lineno,
                "error_call": error_call,
            },
            "usage": usage,
        }

        # Write response to the protocol-out pipe (non-inheritable high fd;
        # fd 1 itself now aliases stderr \u2014 see the dup2 dance at the top of
        # main()). Single write()+flush() under the protocol lock \u2014 a
        # background thread still holding a reference to stdout_capture can
        # otherwise interleave a stdout_chunk line with this one.
        with _PROTOCOL_WRITE_LOCK:
            _protocol_stdout.write(json.dumps(response) + "\\n")
            _protocol_stdout.flush()


if __name__ == "__main__":
    main()
`,to_=`"""
Claude Science kernel SDK (base fragment) \u2014 installed via the first execute() after
kernel start.

Runs inside the kernel's namespace via exec(code, namespace). That namespace
only has __builtins__ \u2014 hence the explicit imports here.

FRAGMENT MODEL: this base fragment is ALWAYS sent. Gated fragments
(sdk/artifacts.py, sdk/compute.py, sdk/frames.py, sdk/mcp.py,
sdk/supervision.py) are concatenated after it by agentConfigurator.ts based
on the agent's profile gates. Each later fragment assigns onto the
already-instantiated \`host\` object \u2014 \`host.children = _op_children\` \u2014
so ungated agents get a clean AttributeError instead of a host round-trip
for methods they shouldn't have.

Host-callback protocol (mid-execution RPC to the host):
    kernel -> host: {"type": "host_call", "id": "uuid", "method": "...", "args": [...]}
    host -> kernel: {"type": "host_response", "id": "uuid", "data": ...}
                  | {"type": "host_response", "id": "uuid", "error": "..."}

Host calls use the published protocol stdout/stdin (bypassing StringIO
capture) so user code can synchronously query the host during an execute().
"""

import json as _json
import os as _os
import select as _select
import sys as _sys
import threading as _threading
import uuid as _uuid

# Shared with kernel_worker._StreamingStdout.write and the final-response
# write so protocol lines can't interleave. Falls back to a private lock when
# running outside the kernel (tests / direct import).
_PROTOCOL_WRITE_LOCK = getattr(_sys, "_operon_protocol_lock", None) or _threading.Lock()
# Serializes the whole _host_call send\u2192ack\u2192reply sequence so concurrent
# callers (ThreadPoolExecutor fan-out) can't cross-consume each other's
# stdin replies. Distinct from _PROTOCOL_WRITE_LOCK: that one is held only
# per-line (shared with user print() via _StreamingStdout) and must not be
# held across the reply read, which may legitimately park for minutes.
# Published on sys so per-cell SDK re-exec (compute.ts postStartCode) keeps
# the SAME object \u2014 a fresh lock each cell would let a background thread
# parked in a prior cell's _host_call race a new cell's caller on stdin.
_HOST_CALL_LOCK = getattr(_sys, "_operon_host_call_lock", None) or _threading.Lock()
_sys._operon_host_call_lock = _HOST_CALL_LOCK
# kernel_worker.main() publishes the result pipe on a non-inheritable high fd
# as sys._operon_protocol_stdout (codon 187054f2 port \u2014 fd 1 itself now aliases
# stderr so subprocess stdout can't inject into / hold open the JSON stream).
# Fall back to __stdout__ only when no publisher exists (tests / direct import).
_PROTOCOL_STDOUT = getattr(_sys, "_operon_protocol_stdout", None) or _sys.__stdout__
# Same pattern for the reply read (#2599 r2 3359942418): kernel_worker
# publishes a private dup of fd 0 so \`exit()\`/\`quit()\`/user
# \`sys.stdin.close()\` (which close sys.stdin \u2014 and sys.__stdin__ is the
# same TextIOWrapper at startup) can't break the host-call reply read.
# Sharing the WORKER's dup (one wrapper, one buffer) also means the loop
# and the SDK can never interleave buffered reads; outside the kernel
# (tests / direct import) falls back to __stdin__.
# Resolved AT READ TIME, not snapshotted at install (#2599 r3
# 3361596379): the worker's readline-recovery path republishes
# sys._operon_protocol_stdin after re-dup'ing from the reserve fd (post
# #3360 fd 0 is /dev/null) \u2014 a module-level object ref captured here
# would keep reading the DEAD wrapper forever.
# Missing-only fallback (#2599 r5 3362037820): __stdin__ is used solely
# when NO publisher exists (outside the kernel \u2014 tests / direct import).
# A published-but-falsy value (None/0) must NOT route to __stdin__: that
# would spin up a SECOND BufferedReader over fd 0 and recreate exactly
# the two-buffer interleave the shared dup eliminates. Returning the
# falsy value instead fails the next read loudly (AttributeError), which
# the worker's recovery then heals.
_STDIN_MISSING = object()
# Whether a publisher existed when the SDK installed (#2599 r6
# 3362707637): inside the kernel the worker publishes before the SDK
# ever runs, so a MISSING attr later means it was DELETED \u2014 that must
# behave like the falsy arm (fail loudly, worker recovery heals), never
# fall back to __stdin__. Only a process where no publisher ever
# existed (tests / direct import) may use __stdin__.
_HAD_PUBLISHER = hasattr(_sys, "_operon_protocol_stdin")


def _protocol_stdin():
    s = getattr(_sys, "_operon_protocol_stdin", _STDIN_MISSING)
    if s is _STDIN_MISSING:
        if _HAD_PUBLISHER:
            return None  # deleted \u2014 next read fails loudly (AttributeError)
        return _sys.__stdin__
    return s


# Identity of the protocol stream at SDK install (#2599 r7 3363117743 \u2014
# the worker loop's pre-read theme extended to the SDK's in-cell RPC
# reply read; the SDK cannot import the worker's machinery, so it
# carries the same minimal shape itself). None outside the kernel or
# when the published stream has no real fd.
def _capture_protocol_ident():
    s = getattr(_sys, "_operon_protocol_stdin", None)
    fn = getattr(s, "fileno", None)
    if fn is None:
        return None
    try:
        st = _os.fstat(fn())
        return (st.st_dev, st.st_ino)
    except Exception:
        return None


_PROTOCOL_IDENT = _capture_protocol_ident()
_HOST_REPLY_DEADLINE_DEFAULT_S = 120.0


def _reply_deadline_s():
    # Seam on the existing bound, not new machinery (r7b): the deadline
    # is env-tunable via OPERON_SDK_REPLY_DEADLINE_S (default 120). Read
    # at CALL time, not install time, so a cell-scoped override (test
    # pins; an operator debugging a wedged channel) takes effect without
    # a kernel respawn \u2014 cost is one dict lookup per reply read.
    # Invalid or non-positive values fall back to the default.
    raw = _os.environ.get("OPERON_SDK_REPLY_DEADLINE_S")
    if raw:
        try:
            v = float(raw)
            if v > 0:
                return v
        except ValueError:
            pass
    return _HOST_REPLY_DEADLINE_DEFAULT_S


def _read_reply_line(bounded=True):
    # SCOPE (r7 3363117743): in-cell code can already do anything this
    # process can \u2014 this defends against ACCIDENTAL fd recycle
    # (daemonize close+reopen patterns, fd sweeps), not malice.
    # Identity compared PRE-read so a recycled number surfaces as a
    # clean error instead of reading a user file as the RPC reply.
    # DEADLINE SCOPE (PR #2753 finding 3368989979, closing #2599 thread
    # 3363405105): the bound applies only until the host ACKNOWLEDGES
    # receipt (host_ack, or the reply itself) \u2014 "the host always replies
    # promptly" is true for the ACK, not the reply: handlers legitimately
    # park for minutes-to-hours (delegate fan-outs, live approvals, long
    # llm_batch). After the ack the read is UNBOUNDED: host death closes
    # our stdin (readline -> ""), a severed/recycled fd trips the
    # identity pre-check. Both legs skipped for fd-less streams
    # (tests / synthetic delegates).
    stream = _protocol_stdin()
    fd = None
    fn = getattr(stream, "fileno", None)
    if fn is not None:
        try:
            fd = fn()
        except Exception:
            fd = None
    if fd is not None and _PROTOCOL_IDENT is not None:
        try:
            st = _os.fstat(fd)
        except OSError:
            raise RuntimeError(
                "host_call: reply stream fd is dead (closed/recycled)"
            )
        if (st.st_dev, st.st_ino) != _PROTOCOL_IDENT:
            raise RuntimeError(
                "host_call: reply stream identity lost (fd recycled)"
            )
        # Lockstep means at most one reply line is in flight per read, so
        # buffered-but-unread data (invisible to select on the raw fd)
        # can't false-trigger the deadline in the single-reader protocol;
        # in an already-desynced burst this degrades to loud-and-bounded
        # instead of fast resync, which is the right trade.
        if bounded:
            ready, _, _ = _select.select([fd], [], [], _reply_deadline_s())
            if not ready:
                raise RuntimeError(
                    "host_call: no reply within %ss (protocol channel lost)"
                    % _reply_deadline_s()
                )
    return stream.readline()


def _host_call(method: str, args: list):
    """Synchronous RPC to the host process, usable mid-execution.

    Writes a host_call message to the published protocol stdout
    (sys._operon_protocol_stdout \u2014 bypassing StringIO capture) and blocks
    reading the published protocol stdin for a host_response. The host's
    _readProtocolResponse() loop dispatches the call and writes back before
    continuing to wait for this execution's final result.
    """
    call_id = str(_uuid.uuid4())
    req = {"type": "host_call", "id": call_id, "method": method, "args": args}
    try:
        line = _json.dumps(req, allow_nan=False)
    except (ValueError, TypeError) as e:
        # Non-finite floats (inf/nan) \u2192 ValueError; non-JSON-native objects
        # (numpy scalars/arrays, datetime, set, bytes\u2026) \u2192 TypeError. Either
        # produces invalid JSON that the host can't parse \u2014 which deadlocks
        # the kernel (it blocks on stdin for a reply that never comes).
        # Fail here with a clear message instead.
        raise ValueError(
            f"host_call '{method}': args contain a non-JSON-serializable "
            f"value (inf/nan, or types like numpy/datetime/set \u2014 convert to "
            f"native Python first): {e}"
        ) from None
    # The host's stdout line splitter hard-fails at 16MB (MAX_LINE_BYTES,
    # base.ts) \u2014 exceeding it kills the kernel and loses all in-memory
    # state, with an error that blames stdout corruption. Inline base64
    # image blocks (\`\`{"type":"image","pil":...}\`\` tiles) are the realistic
    # way to get there. Reject before writing, while the kernel is still
    # alive to report it. Cheap char-length pre-filter; exact byte count
    # only when close to the cap.
    if len(line) > 8 * 1024 * 1024:
        _nbytes = len(line.encode("utf-8", errors="surrogatepass"))
        if _nbytes > 15 * 1024 * 1024:
            raise ValueError(
                f"host_call {method!r}: serialized request is "
                f"{_nbytes} bytes, exceeding the 15MB wire cap (the host "
                f"kills the kernel at 16MB). For LLM requests, pass "
                f"images=[workspace paths] instead of inline base64/PIL "
                f"content blocks \u2014 the host reads and downsamples paths "
                f"without the payload crossing the kernel wire."
            )
    with _HOST_CALL_LOCK:
        with _PROTOCOL_WRITE_LOCK:
            _PROTOCOL_STDOUT.write(line + "\\n")
            _PROTOCOL_STDOUT.flush()
        # Discard id-mismatched replies \u2014 a SIGINT during the readline of a
        # prior host_call can leave that call's reply on stdin, which this
        # call would otherwise consume (silent wrong data, off-by-one for the
        # rest of the cell). The host-side write-suppression on soft-interrupt
        # handles the common case; this loop is the general guard. Bounded so
        # a host bug (missing id) surfaces as an error rather than a hang.
        acked = False
        discards = 0
        while True:
            line = _read_reply_line(bounded=not acked)
            if not line:
                raise RuntimeError("host_call: stdin closed (host terminated?)")
            # Every non-matching frame shape counts toward the SAME bounded
            # discard budget (recovered build-1212375 family merged_bug_002;
            # parse failures too \u2014 finding 3369738624): an exempt class
            # (stale acks, non-dict JSON values, non-JSON bytes) would defeat
            # the "a host bug surfaces as an error rather than a hang"
            # contract \u2014 unbounded consumption of whatever keeps arriving,
            # or a raw JSONDecodeError escaping into user code.
            try:
                resp = _json.loads(line)
            except ValueError:
                resp = None  # falls through to the discard budget below
            if isinstance(resp, dict):
                if resp.get("type") == "host_ack":
                    # Receipt ack (no \`id\` on purpose \u2014 see _read_reply_line).
                    # Only OUR first ack lifts the deadline; a stale ack for a
                    # prior SIGINT-abandoned call, or a duplicate, is a host
                    # bug and falls through to the discard budget.
                    if resp.get("for") == call_id and not acked:
                        acked = True
                        continue
                elif resp.get("id") == call_id:
                    break
            discards += 1
            if discards >= 8:
                raise RuntimeError(
                    f"host_call {method!r}: no matching reply id after 8 reads "
                    f"(protocol desync \u2014 restart the kernel)"
                )
        if resp.get("error") is not None:
            raise RuntimeError(f"host_call {method!r} failed: {resp['error']}")
        return resp.get("data")


def _llm_encode_pil(r):
    """Encode \`\`{"type":"image","pil":Image}\`\` content blocks to inline
    base64 PNG so callers can fan out in-memory tiles without writing them
    to the workspace (where auto-view would attach up to 20 as vision
    blocks and skip the rest). Non-dict message entries never reach this
    function on the dispatch paths \u2014 \`\`_llm_req_guard\`\` refuses them
    client-side, whole-call, before encoding (#2957); the isinstance
    pass-throughs below are defensive only."""
    if not isinstance(r, dict):
        return r
    ms = r.get("messages")
    if not isinstance(ms, list):
        return r
    out = []
    changed = False
    for m in ms:
        if not isinstance(m, dict):
            out.append(m)
            continue
        c = m.get("content")
        if not isinstance(c, list):
            out.append(m)
            continue
        blocks = []
        for b in c:
            if isinstance(b, dict) and b.get("type") == "image" and "pil" in b:
                try:
                    import base64 as _b64
                    import io as _bio
                    img = b["pil"]
                    if img.mode not in ("RGB", "RGBA", "L"):
                        img = img.convert("RGB")
                    buf = _bio.BytesIO()
                    img.save(buf, "PNG")
                    # Preserve sibling keys the caller set on the block
                    # (cache_control etc.) \u2014 only "pil" is replaced by
                    # "source". Mirrors the except-path below.
                    new_b = {k: v for k, v in b.items() if k != "pil"}
                    new_b["source"] = {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": _b64.b64encode(buf.getvalue()).decode(),
                    }
                    blocks.append(new_b)
                    changed = True
                except Exception:
                    # Non-PIL value (None from a failed .crop(), a path
                    # str, bytes, ndarray). Strip the "pil" key so the
                    # block stays JSON-serializable \u2014 _host_call's
                    # json.dumps would otherwise raise on bytes/ndarray
                    # and kill the whole batch pre-dispatch. The host
                    # rejects the now-sourceless image block per-request
                    # with {error} (per-request isolation).
                    blocks.append(
                        {k: v for k, v in b.items() if k != "pil"}
                    )
                    changed = True
            else:
                blocks.append(b)
        out.append({**m, "content": blocks} if changed else m)
    return {**r, "messages": out} if changed else r



def _llm_req_guard(req, label=""):
    # M4/M15: model='' silently coerces to the default host-side,
    # masking a typo-to-empty bug; max_tokens<1 / non-int
    # silently rides LLM_DEFAULT_MAX_TOKENS. Require valid or None \u2014
    # equally loud in BOTH lanes (\uD83D\uDD34 3378028316: the batch loop had
    # hand-mirrored only the model half; one predicate, both lanes
    # derive \u2014 label is "" for the single lane, f"requests[{i}]." for
    # the batch lane, producing byte-identical single-lane messages).
    # .strip() (\uD83D\uDFE1 3375199109): the resolution-site .trim() means a
    # whitespace-only model (f-string of an empty var) ALSO coerces to
    # the client default silently \u2014 same class, must be equally loud.
    # \\ufeff (\uD83D\uDFE1 3377128267): JS .trim() strips BOM, Python .strip()
    # does not \u2014 a BOM-only model (utf-8-sig file read without the
    # codec) would pass here and coerce host-side.
    if req.get("model") is not None and (
        not isinstance(req["model"], str)
        or not req["model"].replace("\\ufeff", "").strip()
    ):
        raise TypeError(
            f"host.llm: {label}model must be a non-empty str or None, "
            f"got {req['model']!r}"
        )
    # System prompts are host-controlled and rejected host-side (both
    # wires); a system-role message is the same thing by another name.
    # Fail fast client-side with a clearer, pre-dispatch error.
    # DELIBERATELY whole-call in the batch lane (not per-request {error}):
    # client-side guards are fail-fast-loud BY DESIGN \u2014 the model/
    # max_tokens halves of this predicate have raised whole-call since
    # \uD83D\uDD34 3378028316, and a pre-dispatch raise costs nothing (zero requests
    # sent) vs. silently burning N-1 dispatches around a typo. Per-request
    # isolation is the HOST's contract (the forgeable wire), unchanged.
    msgs = req.get("messages")
    if isinstance(msgs, (list, tuple)):
        for j, m in enumerate(msgs):
            if not isinstance(m, dict):
                # Shape error, not the system-override one \u2014 a typo'd
                # message must not read as a policy violation.
                raise TypeError(
                    f"host.llm: {label}messages[{j}] must be a "
                    f"{{'role', 'content'}} dict, got {type(m).__name__}"
                )
            role = m.get("role")
            if not isinstance(role, str):
                # Missing or non-string role (None, 5, True, ["user"]) is
                # a shape mistake, not an override attempt \u2014 keep the
                # policy wording off it (mirrors the host's
                # typeof-role-is-string branch).
                raise TypeError(
                    f"host.llm: {label}messages[{j}] has no string "
                    f"'role' (got {role!r}) \u2014 each message must be a "
                    f"{{'role', 'content'}} dict with role 'user' or "
                    f"'assistant'"
                )
            if role not in ("user", "assistant"):
                raise TypeError(
                    f"host.llm: {label}messages[{j}].role must be 'user' "
                    f"or 'assistant', got {role!r} \u2014 use the "
                    f"top-level \`system\` field instead"
                )
    if req.get("max_tokens") is not None and (
        not isinstance(req["max_tokens"], int)
        or isinstance(req["max_tokens"], bool)
        or req["max_tokens"] < 1
    ):
        raise TypeError(
            f"host.llm: {label}max_tokens must be a positive int or "
            f"None, got {req['max_tokens']!r}"
        )

class _LineageAccessor:
    """Lazy dict-like: host.lineage[version_id] -> {code, messages, env, inputs,
    artifact_id, version_id, filename, frame_id, project_id,
    producing_cell_id, checksum, extraction_pending}.

    \`inputs\` is a list of {version_id, filename, path} dicts \u2014 \`path\` is the
    resolved filesystem path that appears in \`code\`. May be empty if the
    artifact has no dependencies. Recurse host.lineage[inp["version_id"]]
    to walk upstream to source data \u2014 don't parse paths for ids.
    \`env["environment_name"]\` is the conda env. \`messages\` can be large
    (dozens of messages) \u2014 slice, don't print.
    \`frame_id\` / \`producing_cell_id\` bridge to the producing session:
    query \`frames\` / \`execution_log\` via host.query() for the transcript.
    \`checksum\` is the sha256 of the stored bytes (None = never hashed).
    \`extraction_pending\` True means lineage extraction/mapping hasn't
    settled for this version yet \u2014 inputs may still be incomplete. Pending
    responses are NOT cached: re-reading host.lineage[vid] retries.

    Edit in-place, don't re-emit:
        lin = host.lineage[vid]
        old = lin["inputs"][0]["path"]
        assert old in lin["code"]  # .replace() is literal; whitespace matters
        exec(lin["code"].replace(old, new_path))

    When batching across inputs, also swap the OUTPUT filename or each
    iteration overwrites the last. To replay without clobbering your
    locals: exec(lin["code"], {}, {}).

    WALKING A DAG? Use host.lineage.graph(vid) FIRST \u2014 it returns the
    whole ancestry topology (nodes + edges) in ONE cheap call with zero
    LLM extraction. host.lineage[vid] per node does a full host-side
    extraction each call (code + conversation slice + env) \u2014 minutes on a
    deep graph. Fetch per-node [vid] payloads only for the few nodes you
    actually need code/messages from.
    """

    def __init__(self):
        self._cache = {}

    def __getitem__(self, version_id):
        # Client-side guard \u2014 an int \`host.lineage[42]\` would otherwise be
        # coerced str() on the host side, then fail with a misleading
        # "version 42 not found" that sounds like the record doesn't exist.
        if not isinstance(version_id, str):
            raise TypeError(
                f"host.lineage[...]: version_id must be a non-empty str (UUID), "
                f"got {type(version_id).__name__}"
            )
        if not version_id:
            raise ValueError(
                "host.lineage[...]: version_id must be a non-empty str "
                "(got empty str)"
            )
        # UUIDs are case-insensitive (RFC 4122); the host stores lowercase.
        # Uppercase \u2192 "not found" was a real audit finding.
        version_id = version_id.lower()
        cached = self._cache.get(version_id)
        if cached is not None:
            return cached
        res = _host_call("get_lineage", [version_id])
        # Don't lock in a mid-extraction read (bughunter 3384969343): a
        # response with extraction_pending=True has incomplete \`inputs\`;
        # caching it would pin the stale snapshot for the whole session and
        # make the documented paced re-read (poll periodically \u2014 retries
        # are ~30s apart and bounded, 3386767475) a silent no-op.
        # Pending responses stay uncached, so re-reading [vid] retries the
        # host (and the host-side read itself re-triggers pending re-maps).
        if not (isinstance(res, dict) and res.get("extraction_pending")):
            self._cache[version_id] = res
        return res

    def __contains__(self, version_id: str):
        """True if version_id has already been fetched into the local cache.

        NOT an existence probe against the host \u2014 a version_id that exists
        but hasn't been fetched yet returns False.
        """
        return version_id in self._cache

    def graph(self, version_id, direction="up", max_depth=None, max_nodes=None):
        """Lineage DAG topology in one call \u2014 NO extraction, NO LLM cost.

        Returns {root_version_id, direction, truncated, extraction_pending,
        nodes, edges}:
          nodes: [{version_id, artifact_id, filename, version_number,
                   frame_id, producing_cell_id, created_at, content_type,
                   size_bytes, language, checksum, has_extracted_code}, ...]
          edges: [{version_id, depends_on_version_id, reference_name}, ...]
                 (version_id DEPENDS ON depends_on_version_id)

        direction="up" walks ancestors (what this was made from);
        "down" walks descendants (what was made from it).
        truncated=True means max_nodes cut the frontier \u2014 re-query from a
        frontier node or raise max_nodes.

        extraction_pending (about the ROOT version): dependency edges are
        written ASYNCHRONOUSLY after save_artifacts (a background LLM
        extraction pass, seconds). True = extraction/mapping is still in
        flight for the root. **0 edges + extraction_pending=True means
        "not extracted YET"; it does NOT mean the artifact has no
        dependencies.** graph() itself is a pure read and never drives
        the extraction \u2014 to make a stuck-pending mapping converge, read
        host.lineage[vid] (that call retries the mapping; retries are
        paced ~30s apart and bounded, so poll it periodically \u2014 not in a
        tight loop \u2014 until extraction_pending clears), then graph() again. False does not guarantee
        edges exist (an extraction interrupted by a daemon restart leaves
        the flag False with no edges recorded). direction="down" caveat:
        the flag still describes only the ROOT's own extraction \u2014 a
        descendant saved moments ago writes its edge asynchronously too,
        so a down-walk can show 0 edges with extraction_pending=False;
        re-read when recent saves may be in flight.

        Per-node checksum is the sha256 of the stored bytes (None = never
        hashed: pre-checksum rows or oversized/degraded registrations).

        Never cached (topology changes as new versions land). Fetch
        host.lineage[vid] afterwards ONLY for nodes whose code/messages
        you need \u2014 that call is expensive per node.
        """
        if not isinstance(version_id, str) or not version_id:
            raise TypeError(
                "host.lineage.graph(...): version_id must be a non-empty "
                f"str (UUID), got {type(version_id).__name__}"
            )
        if direction not in ("up", "down"):
            raise ValueError(
                f"host.lineage.graph(...): direction must be 'up' or 'down', got {direction!r}"
            )
        opts = {"direction": direction}
        if max_depth is not None:
            opts["max_depth"] = int(max_depth)
        if max_nodes is not None:
            opts["max_nodes"] = int(max_nodes)
        return _host_call("get_lineage_topology", [version_id.lower(), opts])

    def clear(self):
        """Drop all cached lineage entries (next access re-fetches from host)."""
        self._cache.clear()


class _QueryAccessor:
    """Callable query object \u2014 \`\`host.query(sql)\`\` runs a query,
    \`\`host.query.schema()\`\` returns the queryable-table schema."""

    def __repr__(self):
        return "<host.query \u2014 call with SQL or use .schema() for table info>"

    def __call__(self, sql, params=None, limit=None, df=False, scope="project"):
        """Run read-only SQL against the Claude Science metadata DB.

        Available via the \`repl\` tool only \u2014 from the \`python\`/\`r\` tools
        this raises; run the query there and write results to a file in
        your workspace to hand off.

        Engine-level readonly connection; denylist blocks secrets/credentials
        tables; row/cell/total caps keep output bounded; 5s timeout.

        Dialect: SQLite with epoch-ms timestamps (compare with
        strftime('%s','now')*1000), 0/1 booleans, recursive CTEs OK.

        scope="project" (default) shadows project-owned tables (artifacts,
        frames, notes, \u2026) with the current project only \u2014 unchanged behavior.
        scope="global" drops that shadow so the query sees every project's
        rows; join on \`project_id\` to see where each row came from. Reads
        only \u2014 the connection is opened readonly. Memories and secrets
        tables are scoped/blocked in both modes.

        df=True returns a pandas.DataFrame; if pandas isn't importable,
        falls back to the raw dict with a note on stderr.
        """
        if not isinstance(sql, str):
            raise TypeError(
                f"host.query: sql must be a str, got {type(sql).__name__}"
            )
        if not sql.strip():
            raise ValueError("host.query: sql must be a non-empty str")
        if params is not None and not isinstance(params, (list, tuple)):
            raise TypeError(
                f"host.query: params must be a list or tuple, got "
                f"{type(params).__name__}. (dicts iterate keys, strings "
                f"iterate chars \u2014 both produce silent wrong results.)"
            )
        if limit is not None and (
            not isinstance(limit, int) or isinstance(limit, bool) or limit < 1
        ):
            raise TypeError(
                f"host.query: limit must be a positive int or None, got {limit!r}"
            )
        if not isinstance(df, bool):
            raise TypeError(
                f"host.query: df must be a bool, got {type(df).__name__}"
            )
        if scope not in ("project", "global"):
            raise ValueError(
                f"host.query: scope must be 'project' or 'global', "
                f"got {scope!r}"
            )
        result = _host_call("query_db", [sql, list(params or []), limit, scope])  # noqa: F821
        if not df:
            return result
        try:
            import pandas as pd
        except ImportError:
            print(
                "host.query: pandas not available, returning raw dict",
                file=_sys.stderr,
            )
            return result
        return pd.DataFrame(result["rows"], columns=result["columns"])

    def schema(self):
        """Return the queryable-table schema: {table_name: [col, ...], ...}.

        Use this to discover which tables and columns are available before
        writing SQL \u2014 e.g. \`\`host.query.schema()["artifact_versions"]\`\`
        shows that \`\`content_type\`\` lives there, not on \`\`artifacts\`\`.
        """
        return _host_call("query_schema", [])  # noqa: F821


# \u2500\u2500 Contact-email exceptions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# The \`get_user_email\` host call NEVER throws for a missing address \u2014 the
# host's deny-on-failure posture returns a soft \`{email, status, message?}\`
# dict (status "allowed" / "declined" / "unavailable"). The SDK normalizes
# that into a typed raise (same idiom as the other soft-dict\u2192raise wrappers:
# host.compute / host.agents / host.artifacts) so user code gets the address
# as a plain \`str\` or a catchable exception, never a dict to inspect.
#
# Defined at module level so the names land in the kernel namespace, AND
# re-exposed as class attributes on \`_OperonSDK\` below so the documented
# spelling \`except operon.ContactEmailUnavailable:\` works (the singleton is
# also registered as the \`operon\`/\`host\` modules in sys.modules).
class ContactEmailUnavailable(RuntimeError):
    """\`\`host.get_user_email()\`\` could not return an address.

    \`\`status\`\` is \`\`"unavailable"\`\`: no consent decision could be obtained
    (or the payload was unusable). The subclass
    :class:\`ContactEmailDeclined\` (\`\`status == "declined"\`\`) means the user
    explicitly said no \u2014 it IS-A \`\`ContactEmailUnavailable\`\`, so a single
    \`\`except operon.ContactEmailUnavailable:\`\` handles both. \`\`str(e)\`\` is
    the host's guidance verbatim; the recovery is always the same: omit the
    email parameter \u2014 most services work without it. Never ask the user for
    an address and never fabricate one.
    """

    status = "unavailable"
    # Mirrors the host's \`message\` for this status \u2014 used only when the
    # host omitted the field.
    _DEFAULT_MESSAGE = (
        "No contact-email decision could be obtained. Omit the parameter "
        "\u2014 most services work without it."
    )

    def __init__(self, message=None):
        super().__init__(message or self._DEFAULT_MESSAGE)


class ContactEmailDeclined(ContactEmailUnavailable):
    """The user explicitly declined to share a contact email.

    Do NOT ask the user for an address. Subclass of
    :class:\`ContactEmailUnavailable\` on purpose: the recovery is identical
    (omit the parameter), so one \`\`except\`\` clause covers both.
    """

    status = "declined"
    _DEFAULT_MESSAGE = (
        "The user declined to share a contact email. Do not ask the "
        "user; omit the parameter \u2014 most services work without it."
    )


# Re-exec identity. The repl kernel re-executes this bundle before EVERY
# cell (executeKernelCode in the daemon\u2019s compute tool \u2014 anti-monkey-patch),
# and \`except\` matches by CLASS IDENTITY: a fresh pair of class objects per
# exec would make \`except h.ContactEmailUnavailable:\` silently miss on any
# handle minted by an earlier exec \u2014 exactly what the documented
# \`import host\` / \`import operon\` recovery hands out, since sys.modules
# keeps the FIRST singleton (setdefault below). Same one-object-per-process
# discipline as _HOST_CALL_LOCK at the top of this file: the first exec
# publishes the pair on \`sys\`; every later exec adopts it, so the kernel
# only ever sees ONE class object per name.
_CE_EXC_PRIOR = getattr(_sys, "_operon_contact_email_excs", None)
if _CE_EXC_PRIOR is None:
    _sys._operon_contact_email_excs = (
        ContactEmailUnavailable,
        ContactEmailDeclined,
    )
else:
    ContactEmailUnavailable, ContactEmailDeclined = _CE_EXC_PRIOR


# Extension pattern (developer-facing \u2014 not part of help(host)): add a
# method delegating to _host_call("name", [args]) in the appropriate gated
# fragment (sdk/artifacts.py, sdk/supervision.py, etc.), register a matching
# handler in hostCalls.ts, and add a doc section to the matching
# RULES_OPERON_SDK_* prompt key.
class _OperonSDK:
    """Singleton exposed to user code as \`host\` (legacy alias: \`operon\`).

    Host-backed accessors that fetch data from the Claude Science process on demand
    via the host-callback protocol. All I/O is synchronous \u2014 a __getitem__
    or method call blocks until the host responds.

    Currently exposes:
        host.lineage[version_id] -> {"code": str, "messages": list,
                                       "env": dict, "inputs": list}
        host.llm(prompt_or_request_or_list, model=None,
                   max_tokens=None, max_concurrency=None, **options)
                                    -> {"text", "tool_use", "content",
                                        "model", "usage", "stop_reason"}
                                       for a single request, or a list of
                                       those (| {"error"}) for a list of
                                       requests (parallel fan-out)
        host.current_model()      -> str  (model id)
        host.list_models()        -> list[str]  (model ids)

    Via the \`repl\` tool only (not \`python\`/\`r\`):
        host.query(sql, params=None, limit=None, df=False, scope="project")
                                    -> {"columns": [...], "rows": [[...]],
                                        "row_count": int, "truncated": bool}
                                       or a pandas.DataFrame if df=True
        host.query.schema()       -> {table_name: [col, ...], ...}
        host.frames(...)          -> browse/search/detail frames; see
                                       help(host.frames)

    Plus host.artifacts(...), host.artifact_path(vid), and
    host.artifact_marker(vid) \u2014 see help(host.artifacts).
    When a remote compute provider is configured you also get host.compute
    (submit/wait/ssh/scp). Agents with subtask delegation also get
    host.children().
    """

    # Exception surface for get_user_email() (defined at module level
    # above). Class attributes so the documented agent spelling
    # \`except operon.ContactEmailUnavailable:\` resolves through the
    # singleton (and through \`import operon\`, which binds the same object
    # via sys.modules below) without relying on the kernel-namespace
    # globals.
    ContactEmailUnavailable = ContactEmailUnavailable
    ContactEmailDeclined = ContactEmailDeclined

    def __init__(self):
        self.lineage = _LineageAccessor()

    def llm(self, request=None, system=None, model=None, max_tokens=None,
            max_concurrency=None, **options):
        """Sample from the Anthropic API via the host's LLM client.

        Omitting \`\`model=\`\` uses the kernel utility default (Haiku-class,
        via \`\`[llm] kernel_default_model\`\`) \u2014 the right choice for
        extraction, classification, and per-chunk fan-out. For harder
        reasoning pass \`\`model=host.current_model()\`\` to run at your own
        model's level (roughly 10-30\xD7 the Haiku-class cost). Never hardcode
        a literal model-id string \u2014 model ids change across releases and a
        stale id routes to an older or retired model; resolve at runtime
        via \`\`host.current_model()\`\` or \`\`host.list_models()\`\`.

        One surface, three input shapes \u2014 the return type mirrors the
        input (single request in \u2192 single result dict out, list in \u2192
        list out, positionally matched):

        1. **Prompt string** (the classic form)::

               host.llm("Summarize this abstract: ...")["text"]
               host.llm("Be terse. Summarize: ...", max_tokens=200)

        2. **Single request dict / kwargs** \u2014 same fields as a batch
           entry, so a single call can use tools / images / messages::

               host.llm(prompt="...", tools=[tool],
                          tool_choice={"type": "tool", "name": "classify"})
               host.llm({"prompt": "what is in this image?",
                           "images": ["plot.png"]})

        3. **List of request dicts** (or bare prompt strings) \u2014 parallel
           fan-out. The host-call protocol is serial (one blocking
           readline per call), so a Python loop over \`\`host.llm()\`\`
           runs one-at-a-time; passing a list ships the whole batch to
           the host, which runs them concurrently (worker pool,
           \`\`max_concurrency\`\` at a time, cap 32) and returns results
           in order::

               host.llm([{"prompt": p} for p in page_texts],
                        max_concurrency=16)

        Each request (dict form) accepts any of:
            prompt       \u2014 str; single-turn user text (simplest form)
            messages     \u2014 list of {"role","content"}; role must be "user"
                           or "assistant"; content may be a str or a list
                           of content blocks (e.g. image blocks)
            images       \u2014 list of workspace-relative paths (max 20 per
                           request); host reads each file (capped at 32MB),
                           downsamples to API limits, and prepends as
                           image blocks to the user message. Prefer this
                           over base64-in-messages for large batches \u2014 paths
                           keep the kernel\u2192host wire small. For in-memory
                           tiles you don't want on disk (where auto-view
                           would attach them), pass a PIL.Image directly in
                           a content block as \`\`{"type":"image","pil":img}\`\`
                           \u2014 the wrapper base64-encodes it inline with no
                           downsample, so keep each image \u2264~1500px/side (or
                           use \`\`images=[path]\`\` for host-side resizing).
                           The whole call is rejected if the serialized
                           request exceeds 15MB \u2014 batch many tiles via
                           \`\`images=[path]\`\`, not inline PIL.
            model        \u2014 model id (default: the kernel utility
                           default \u2014 Haiku-class via
                           \`\`[llm] kernel_default_model\`\` \u2014 NOT the
                           session model). For session-level reasoning
                           pass \`\`host.current_model()\`\`; never a
                           hardcoded literal id (they go stale)
            max_tokens   \u2014 per-request output cap (default 4096, max
                           32768). Hard cap for list-form requests and any
                           single request using tools/images/messages/
                           temperature (truncation \u2192 \`\`stop_reason ==
                           "max_tokens"\`\`). A plain text-only single
                           request keeps the legacy serial behavior where
                           the host transparently continues past
                           max_tokens \u2014 see the dispatch note below.
            tools        \u2014 list of tool schemas for structured output
            tool_choice  \u2014 e.g. {"type":"tool","name":"classify_page"} to
                           force a specific tool
            temperature  \u2014 float

        A single request returns
        \`\`{"text", "tool_use", "content", "model", "usage", "stop_reason"}\`\`
        (\`\`tool_use\`\` is the first tool_use block's \`\`{"name","input"}\`\` or
        None; plain-prompt calls return the same shape without
        \`\`tool_use\`\`/\`\`content\`\`) and raises \`\`RuntimeError\`\` on failure.
        A list returns one such dict per request \u2014 or \`\`{"error": str}\`\`
        for the requests that failed. One bad request does not fail the
        batch. External builds enforce a per-frame token ceiling
        (\`\`[llm] kernel_sdk_token_ceiling\`\`, default 2M) \u2014 the call
        that crosses completes; the next raises \`\`RuntimeError\`\`.
        Per-call bounds still apply (e.g. at most 512
        requests per batched call \u2014 chunk bigger inputs).

        \`\`stop_reason == "max_tokens"\`\` means output was truncated \u2014
        re-issue with a larger \`\`max_tokens\`\` or chunk the input.

        \`\`system\`\` (str, optional, \u226464 KB) is accepted and forwarded to
        the host, which wraps it in a safeguards envelope and appends it
        AFTER the host's own system floor \u2014 it never speaks with harness
        authority. \`\`<\`\`/\`\`>\`\` in \`\`system\`\` are mapped to \`\`\u2039\`\`/\`\`\u203A\`\`
        by the host, so use non-angle-bracket delimiters for
        structured-output instructions. Pass \`\`model\`\`/\`\`max_tokens\`\` by
        keyword, never positionally.

        Dispatch note: a single request that uses only
        \`\`prompt\`\`/\`\`model\`\`/\`\`max_tokens\`\` goes over the
        legacy serial wire, which auto-continues past \`\`max_tokens\`\` (so
        truncation is rare and \`\`stop_reason\`\` is usually \`\`"end_turn"\`\`).
        Adding any of \`\`tools\`\`/\`\`tool_choice\`\`/\`\`images\`\`/\`\`messages\`\`/
        \`\`temperature\`\` \u2014 or passing a list \u2014 routes through the batch
        wire where \`\`max_tokens\`\` is a hard cap.

        Example \u2014 classify every page of a PDF in parallel::

            tool = {"name": "classify", "input_schema": {"type": "object",
                    "properties": {"relevant": {"type": "boolean"},
                                   "score": {"type": "number"}},
                    "required": ["relevant", "score"]}}
            reqs = [{"prompt": f"Page {i}:\\\\n{txt}\\\\nRelevant to: {query}?",
                     "tools": [tool],
                     "tool_choice": {"type": "tool", "name": "classify"},
                     "max_tokens": 256}
                    for i, txt in enumerate(page_texts)]
            for r in host.llm(reqs, max_concurrency=16):
                if "error" not in r:
                    print(r["tool_use"]["input"]["score"])
        """
        # \`system\` is accepted (host wraps it in the safeguards envelope
        # and appends after its own floor). Non-string values are refused
        # pre-dispatch so the shape error is Python-native. \`None\` stays a
        # no-op (legacy wire shape).
        if system is not None and not isinstance(system, str):
            raise TypeError(
                f"host.llm: system must be a str or None, got "
                f"{type(system).__name__}"
            )
        # \u2500\u2500 list \u2192 parallel fan-out, returns a list \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        # **options / free-form dicts silently absorb misspelled fields
        # (max_token=, tool=[...], temprature=) \u2014 the typo'd option is
        # dropped and the call "succeeds" without it. Reject unknown
        # fields up front, on both the list and single-request paths.
        _known = {"prompt", "messages", "images", "model", "system",
                  "max_tokens", "tools", "tool_choice", "temperature"}
        if isinstance(request, (list, tuple)):
            if (system is not None or model is not None
                    or max_tokens is not None or options):
                raise TypeError(
                    "host.llm: when passing a list of requests, put "
                    "per-request options (system/model/max_tokens/"
                    "tools/...) inside each request dict"
                )
            if max_concurrency is not None and (
                not isinstance(max_concurrency, int)
                or isinstance(max_concurrency, bool)
                or max_concurrency < 1
            ):
                raise TypeError(
                    f"host.llm: max_concurrency must be a positive int "
                    f"or None, got {max_concurrency!r}"
                )
            reqs = []
            for i, r in enumerate(request):
                if isinstance(r, str):
                    reqs.append({"prompt": r})
                elif isinstance(r, dict):
                    # A None \`system\` placeholder (legacy kwargs-with-
                    # defaults helpers) is dropped silently, matching the
                    # host's null tolerance. Non-string values get a shape
                    # error pre-dispatch.
                    if r.get("system") is None:
                        r = {k: v for k, v in r.items() if k != "system"}
                    elif not isinstance(r["system"], str):
                        raise TypeError(
                            f"host.llm: requests[{i}].system must be a "
                            f"str or None, got "
                            f"{type(r['system']).__name__}"
                        )
                    _unknown = set(r) - _known
                    if _unknown:
                        raise TypeError(
                            f"host.llm: requests[{i}] has unknown "
                            f"field(s) {sorted(_unknown)!r}; valid fields "
                            f"are {sorted(_known)!r}"
                        )
                    if (r.get("prompt") is not None
                            and r.get("messages") is not None):
                        raise TypeError(
                            f"host.llm: requests[{i}] has both 'prompt' "
                            f"and 'messages' \u2014 the host uses messages and "
                            f"silently ignores the prompt; pass one or "
                            f"the other"
                        )
                    # M4/M15 parity for the batch lane (\uD83D\uDD34 3376841752,
                    # completed by \uD83D\uDD34 3378028316): the single-request guard
                    # below never runs for list-form \u2014 without this, a
                    # whitespace-only per-request model, a smuggled
                    # system-role message, or a bad max_tokens (silently
                    # coerced to the default) ride a \u2264512-request
                    # fan-out without a sound. Shared predicate with the
                    # single lane \u2014 see _llm_req_guard.
                    _llm_req_guard(r, label=f"requests[{i}].")
                    reqs.append(r)
                else:
                    raise TypeError(
                        f"host.llm: requests[{i}] must be a dict or a "
                        f"prompt str, got {type(r).__name__}"
                    )
            if not reqs:
                return []
            return _host_call(
                "llm_batch", [[_llm_encode_pil(r) for r in reqs], max_concurrency]
            )

        if max_concurrency is not None:
            raise TypeError(
                "host.llm: max_concurrency only applies when passing a "
                "list of requests"
            )

        # \u2500\u2500 normalize the single-request forms to one dict \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if isinstance(request, dict):
            if (system is not None or model is not None
                    or max_tokens is not None or options):
                raise TypeError(
                    "host.llm: pass options inside the request dict OR "
                    "as keyword arguments, not both"
                )
            req = dict(request)
            # Same policy as the list lane: silent drop for a legacy None
            # placeholder; non-string values get a shape error.
            if req.get("system") is None:
                req.pop("system", None)
            elif not isinstance(req["system"], str):
                raise TypeError(
                    f"host.llm: system must be a str or None, got "
                    f"{type(req['system']).__name__}"
                )
        elif isinstance(request, str) or request is None:
            req = dict(options)
            if isinstance(request, str):
                if "prompt" in req:
                    raise TypeError(
                        "host.llm: prompt given both positionally and as "
                        "a keyword"
                    )
                req["prompt"] = request
            if system is not None:
                req["system"] = system
            if model is not None:
                req["model"] = model
            if max_tokens is not None:
                req["max_tokens"] = max_tokens
        else:
            # F-05: llm(None)/llm(123) reached host and said "got object"
            # (JS typeof). Fail with the Python type name instead.
            raise TypeError(
                f"host.llm: expected a prompt str, a request dict, or a "
                f"list of request dicts; got {type(request).__name__}"
            )

        # \u2500\u2500 validate the single request \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        _unknown = set(req) - _known
        if _unknown:
            raise TypeError(
                f"host.llm: unknown request field(s) "
                f"{sorted(_unknown)!r}; valid fields are {sorted(_known)!r}"
            )
        # Applies to all three single-request shapes (positional str +
        # kwargs, pure kwargs, request dict) \u2014 the host prefers messages
        # and would silently drop the prompt. Value check, not key
        # presence: messages=None from a kwargs-with-defaults helper is
        # not ambiguous (the host gates on a non-empty array).
        if (req.get("prompt") is not None
                and req.get("messages") is not None):
            raise TypeError(
                "host.llm: both 'prompt' and 'messages' given \u2014 the "
                "host uses messages and silently ignores the prompt; "
                "pass one or the other"
            )
        prompt = req.get("prompt")
        messages = req.get("messages")
        if messages is None:
            if not isinstance(prompt, str):
                raise TypeError(
                    f"host.llm: prompt must be a str, got "
                    f"{type(prompt).__name__}"
                )
            if not prompt.strip():
                raise ValueError("host.llm: prompt must be a non-empty str")
        # M4/M15 guards (model/max_tokens) + messages-role check \u2014 shared
        # predicate with the batch-lane loop above; rationale + finding
        # citations live on _llm_req_guard (\uD83D\uDD34 3378028316: one predicate,
        # both lanes).
        _llm_req_guard(req)

        # \u2500\u2500 dispatch \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        # Plain text requests keep the serial "llm" host-call (documented
        # behavior: the host transparently stitches past max_tokens).
        # Requests using the newer capabilities go through the batch
        # handler as a 1-element list \u2014 full request-shape support, and
        # max_tokens is treated as a hard per-request budget there.
        extended = ("tools", "tool_choice", "images", "messages",
                    "temperature")
        if any(req.get(k) is not None for k in extended):
            out = _host_call("llm_batch", [[_llm_encode_pil(req)], 1])
            r = out[0] if isinstance(out, list) and out else {}
            if isinstance(r, dict) and "error" in r and "text" not in r:
                raise RuntimeError(f"host.llm: {r['error']}")
            return r
        return _host_call(
            "llm",
            [{"prompt": prompt, "system": req.get("system"),
              "model": req.get("model"),
              "max_tokens": req.get("max_tokens")}],
        )

    def current_model(self):
        """Return the session's active chat model id as a string.

        This is what the AGENT is running as \u2014 NOT what \`\`host.llm()\`\`
        defaults to (that is the Haiku-class kernel utility default via
        \`\`[llm] kernel_default_model\`\`). Pass this value as
        \`\`host.llm(model=...)\`\` when you want session-level reasoning.
        On public builds, internal/unreleased model ids are redacted to
        \`\`"internal"\`\`.
        """
        return _host_call("current_model", [])

    def list_models(self):
        """Return the list of model ids visible to the host's credentials.

        Pass an id from this list as \`\`host.llm(model=...)\`\` to override
        the kernel default (Haiku, unless the deployment overrides
        \`\`[llm] kernel_default_model\`\`). On public builds, internal/unreleased entries
        are dropped; on internal builds they surface as \`\`"internal"\`\`
        (not a usable \`\`model=\`\` value). Hits the Anthropic API \u2014 call
        once and cache the result rather than per-iteration.
        """
        return _host_call("list_models", [])

    def get_user_email(self):
        """Return the user's consented contact email as a plain \`\`str\`\`.

        Only available via the \`\`repl\`\` tool (the analysis kernel gets a
        refusal). May block while the user answers a consent prompt.

        Raises when there is no address to use:

        - \`\`operon.ContactEmailDeclined\`\` \u2014 the user said no. Do NOT ask
          them for an address.
        - \`\`operon.ContactEmailUnavailable\`\` \u2014 no decision could be
          obtained. This is also the BASE class of \`\`ContactEmailDeclined\`\`,
          so one \`\`except\`\` clause covers both.

        Either way the recovery is the same \u2014 omit the email parameter
        (most services work without it)::

            try:
                email = operon.get_user_email()
            except operon.ContactEmailUnavailable as e:
                print(e)      # the host's guidance, verbatim
                email = None

        This is the ONLY legitimate source of a contact email \u2014 never
        fabricate one or read addresses from environment variables.
        """
        r = _host_call("get_user_email", [])
        # Forward-compat: a host that returns the bare address directly.
        if isinstance(r, str):
            return r
        if isinstance(r, dict):
            status = r.get("status")
            email = r.get("email")
            if status == "allowed" and isinstance(email, str) and email:
                return email
            # The host's \`message\` field carries the recovery instruction
            # verbatim; the exception defaults cover hosts that omit it.
            message = r.get("message")
            if not (isinstance(message, str) and message):
                message = None
            if status == "declined":
                raise ContactEmailDeclined(message)
            # "unavailable", an unrecognized status, or an "allowed" row
            # with no usable address \u2014 same recovery, base class.
            raise ContactEmailUnavailable(message)
        # Malformed payload (None, list, \u2026): never hand it back as if it
        # were an address. Note: a HANDLER failure never reaches here \u2014
        # \`_host_call\` already raised RuntimeError("host_call ... failed:")
        # for \`{error}\` replies (permit refusal, replay shim, channel loss),
        # and that mapping is deliberately not wrapped.
        raise ContactEmailUnavailable()


    def capabilities(self):
        """Return which SDK capabilities are available in the current kernel.

        Returns a dict like {"query": True, "agents": False, ...}. Use this
        to check what's available before calling \u2014 avoids RuntimeError from
        host-call refusal in the wrong kernel.
        """
        # \`query\` is an instance attr set by the repl-only frames.py
        # fragment (query_db/query_schema are in OPERON_PERMIT, not
        # ANALYSIS_PERMIT) \u2014 getattr\u2192__getattr__\u2192AttributeError\u2192None in the
        # analysis kernel. Other gated attrs follow the same pattern.
        return {
            "query": callable(getattr(self, "query", None)),
            "llm": callable(getattr(type(self), "llm", None)),
            "current_model": callable(getattr(type(self), "current_model", None)),
            "list_models": callable(getattr(type(self), "list_models", None)),
            "agents": hasattr(self, "agents"),
            "skills": hasattr(self, "skills"),
            "goal": hasattr(self, "goal"),
            "frames": callable(getattr(self, "frames", None)),
            "compute": hasattr(self, "compute"),
            "mcp": hasattr(self, "mcp"),
            "children": callable(getattr(self, "children", None)),
            "delegate": callable(getattr(self, "delegate", None)),
            "delegation_stats": callable(
                getattr(self, "delegation_stats", None)
            ),
            "lineage": hasattr(self, "lineage"),
            "artifacts": callable(getattr(self, "artifacts", None)),
            "credentials": hasattr(self, "credentials"),
            "app": callable(getattr(self, "app", None)),
            "exec_peek": callable(getattr(self, "exec_peek", None)),
            "exec_interrupt": callable(getattr(self, "exec_interrupt", None)),
            "submit_output": callable(getattr(self, "submit_output", None)),
        }

    def _avail(self):
        # Public surface = class-defined callables/properties + instance attrs
        # set by fragment injection (agents/skills/compute/children/mcp). This
        # is the source of truth \u2014 no hardcoded list that goes stale or lies
        # about gated methods in the analysis kernel.
        names = set(self.__dict__)
        for klass in type(self).__mro__:
            if klass is object:
                break
            names.update(klass.__dict__)
        return sorted(n for n in names if not n.startswith("_"))

    def __getattr__(self, name):
        # Only called when normal lookup fails. Give a helpful error for
        # gated methods (sub-agents without enable_subtask_delegation don't
        # get SDK_SUPERVISION_PY, so host.children is a plain
        # AttributeError indistinguishable from a typo). Check __dict__
        # directly so we don't re-enter __getattr__.
        if name == "llm_batch":
            # Removed back-compat alias (undocumented, from #1879): the
            # unified list-form is the one surface. Errors-that-teach per
            # the #2905 pattern \u2014 name the one-line migration.
            raise AttributeError(
                "host.llm_batch was removed \u2014 use "
                "host.llm([...], max_concurrency=N) instead "
                "(same wire, same semantics: list in \u2192 ordered list out)."
            )
        if (name in ("delegate", "delegation_stats")
                and self.__dict__.get("_leaf_frame_scrubbed")):
            # Leaf repl kernel (#2659): the agent IS in the repl tool \u2014
            # the generic redirect below would send it in a retry loop.
            raise AttributeError(
                f"host.{name}() is root-only and this frame is a "
                f"sub-agent (leaf) \u2014 delegation is not available here. "
                f"Complete the task yourself and return results to your "
                f"parent."
            )
        # "delegate"/"delegation_stats" need KERNEL-AWARE wording (#2672
        # follow-up 1 found the naive redirect circular): when the symbols
        # are absent, the reason differs by kernel. In the OPERON kernel
        # (detectable: control-plane methods like \`frames\` are installed)
        # absence means delegation is disabled for this session; in the
        # analysis kernel they never exist, and the honest advice is the
        # repl tool IF the session has delegation at all. Neither message
        # promises the method exists anywhere it might not.
        if name in ("delegate", "delegation_stats"):
            if self.__dict__.get("frames") is not None:
                raise AttributeError(
                    f"host.{name}() is not available: delegation is not "
                    f"enabled for this session (or this is a sub-agent "
                    f"frame). Complete the task directly."
                )
            raise AttributeError(
                f"host.{name}() has no surface in the \`python\` kernel. "
                f"If this session has delegation enabled, re-run in the "
                f"\`repl\` tool; otherwise delegation is off \u2014 complete "
                f"the task directly."
            )
        if name == "children":
            raise AttributeError(
                f"host.{name}() is only available via the \`repl\` tool "
                f"(control-plane kernel). Re-run this cell with the "
                f"\`repl\` tool instead of \`python\`."
            )
        if name == "mcp":
            # MCP is repl-kernel-only (hostCalls.ts OPERON_PERMIT): this
            # kernel runs third-party pip/conda packages, so it has no MCP
            # surface at all \u2014 the method doesn't exist here, and the host
            # refuses the raw host call too. Mirror the host-side wording so
            # the redirect is consistent however the call was attempted.
            raise AttributeError(
                "host.mcp() is only available via the \`repl\` tool \u2014 "
                "MCP/connector tools have no surface in this kernel. Fetch "
                "the data in a \`repl\` cell, write it to "
                "./handoff/<name>.json, and read that file from this kernel."
            )
        if name in (
            "agents",
            "skills",
            "compute",
            "query",
            "frames",
            "exec_peek",
            "exec_interrupt",
            "submit_output",
        ):
            raise AttributeError(
                f"host.{name} is only available via the \`repl\` tool. "
                f"Re-run this cell with the \`repl\` tool instead of "
                f"\`python\` \u2014 the \`python\` tool is for data work and "
                f"doesn't carry control-plane methods. The two share your "
                f"workspace cwd (so prepare input files in \`python\` first) "
                f"but not memory; the \`repl\` tool is stdlib-only."
            )
        raise AttributeError(
            f"host has no method '{name}'. "
            f"Available: {', '.join(self._avail())}."
        )

    def __repr__(self):
        return f"<host SDK \u2014 {', '.join('host.' + a for a in self._avail())}>"


host = _OperonSDK()
# Legacy alias: pre-rename transcripts, \`host.lineage[vid]["code"]\` replay
# of old cells, and user muscle memory all say \`operon\`. Same object \u2014
# dropping the alias later is a two-line change (here + sys.modules below).
operon = host

# Make \`import host\` (and legacy \`import operon\`) no-ops that bind the same
# singleton. The SDK is a kernel global, not a real module \u2014 but users
# reflexively import it and burn a turn on ModuleNotFoundError. sys.modules
# accepts any object; after this, \`import host\` resolves to the instance
# above. \`from host import query\` even works (getattr on the singleton);
# \`from host import <unknown>\` raises a plain ImportError.
#
# DECLARED TRADE-OFF (review 3398748857): this shadows a user-authored
# local \`host.py\` in the analysis kernel \u2014 \`import host\` returns the SDK
# even after sys.path surgery, because sys.modules wins before the path
# scan. Accepted: PYTHONSAFEPATH=1 means a local module already needs
# explicit path setup, and the failure mode is loud ("AttributeError:
# host has no method 'x'. Available: \u2026" names the SDK surface, which
# signals the shadow). Scoping the registration to the repl kernel was
# considered and rejected \u2014 the rebound-host advisory's \`import host\`
# recovery and the dual-import alias contract (hostCalls pin) hold in
# BOTH kernels.
_sys.modules.setdefault("host", host)
_sys.modules.setdefault("operon", host)
`,BaO=`# Claude Science SDK fragment: agents (repl-kernel only \u2014 see skills/customize).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER base
# in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are already
# bound in that namespace.
#
# Host-call handlers: hostCalls.ts cases "agent_*" / "connector_list"
#
# Executes via the \`repl\` tool (control-plane kernel). Shares cwd with the
# python/R kernels but not memory \u2014 persist to ./handoff/*.json to cross.


def _op_agents_require_str(method, pname, val):
    if not isinstance(val, str) or not val:
        raise TypeError(
            f"host.agents.{method}: {pname} must be a non-empty str, "
            f"got {val!r}"
        )


def _op_agents_call(method, host_method, payload):
    # Drop None values \u2014 Python None \u2192 JSON null, which zod
    # \`z.string().optional()\` on the host REJECTS (it wants absent, not null).
    # See frame 642436b0 cell 8: attach_connector(..., includeToolsPattern=None)
    # \u2192 "Expected string, received null". Same pattern as sdk/compute.py's
    # _compute_call.
    payload = {k: v for k, v in payload.items() if v is not None}
    r = _host_call(host_method, [payload])  # noqa: F821 (defined in base.py)
    # Handlers return {error: "..."} for soft failures (name collision, not
    # found, bundled-profile protection). Surface as an exception unless the
    # dict also carries a success key the caller is expected to inspect.
    if isinstance(r, dict) and "error" in r and len(r) == 1:
        raise RuntimeError(f"host.agents.{method}: {r['error']}")
    return r


def _op_agents_create_or_update(method, host_method, payload):
    """Like _op_agents_call but warns when the server normalized the name."""
    r = _op_agents_call(method, host_method, payload)
    if isinstance(r, dict) and r.get("nameNormalized"):
        import warnings
        warnings.warn(
            f"host.agents.{method}: name was normalized to "
            f"UPPER_SNAKE_CASE \u2192 '{r['name']}'. "
            f"Pass the uppercase name directly to silence this warning.",
            UserWarning, stacklevel=3,
        )
    return r


def _op_agents_compat(compat, method, mapping):
    """Coalesce legacy camelCase kwargs (pre-snake_case-rename). Silent
    fallback \u2014 no DeprecationWarning spam in the agent loop."""
    out = {}
    for legacy, canonical in mapping.items():
        if legacy in compat:
            out[canonical] = compat.pop(legacy)
    if compat:
        raise TypeError(
            f"host.agents.{method}: unexpected keyword argument(s) "
            f"{sorted(compat)!r}"
        )
    return out


# update() patch-dict keys \u2014 accept snake_case, send camelCase on the wire.
# (Wire schema is zod z.object(...).strict() \u2192 unknown keys rejected.)
_OP_AGENTS_PATCH_KEY_MAP = {
    "display_name": "displayName",
    "system_prompt": "systemPrompt",
    "skill_names": "skillNames",
    "icon_key": "iconKey",
    "color_key": "colorKey",
}


class _AgentsAccessor:
    """Agent-profile CRUD + connector introspection. Load skill 'customize'
    for usage."""

    def __repr__(self):
        return "<host.agents \u2014 load skill 'customize' for API docs>"

    def list(self):
        """Return all agent profiles (bundled + custom) as a list of dicts.

        Each entry: {name, displayName, description, source, enabled,
        systemPrompt, iconKey, colorKey, unrestricted, skillNames: [...],
        connectors: [...], excludedTools: [...], excludedToolsDetail: [...]}.
        (Return-dict keys are camelCase \u2014 wire shape.) Directly iterable \u2014
        \`for p in host.agents.list(): print(p["name"])\`.
        """
        r = _op_agents_call("list", "agent_list", {})
        # Handler returns {"agents": [...]}. Unwrap so \`for p in .list()\`
        # yields dicts, not the single key string "agents" (frame 642436b0
        # cells 0/1 \u2014 TypeError: string indices must be integers).
        return r["agents"] if isinstance(r, dict) and "agents" in r else r

    def get(self, name):
        """Return a single agent profile by name, or raise if not found.

        Equivalent to filtering \`list()\` by name, but cheaper \u2014 single
        lookup. Raises RuntimeError if the agent doesn't exist.

        \`name\` is case-insensitive (resolved to UPPER_SNAKE internally).
        """
        _op_agents_require_str("get", "name", name)
        return _op_agents_call("get", "agent_get", {"name": name})

    def switch(self, name):
        """Ask to continue this conversation as \`name\` (shows the user an
        approval card).

        On Allow, the switch takes effect on their next message \u2014 the
        current turn finishes as the current profile. On decline, tell the
        user they can select the profile from the session config popover on
        any new conversation.

        Returns \`\`{switched, name, displayName}\`\`.
        """
        _op_agents_require_str("switch", "name", name)
        return _op_agents_call("switch", "agent_switch", {"name": name})

    def create(self, name, display_name=None, description=None, *,
               system_prompt="", skill_names=None, **_compat):
        """Create a new custom profile.

        \`name\` is the profile identifier \u2014 **2\u201332 chars, UPPERCASE
        letters / digits / underscores only** (e.g. "MY_AGENT"). Lowercase
        or dashes are rejected by the host. \`display_name\` is the
        human-friendly label shown in the agent picker; \`description\` is
        the one-line summary.

        Skill allowlist semantics: leave \`skill_names\` UNSET (None) and the
        new profile is **unrestricted** \u2014 it sees the full live skill catalog
        and every connector, same as the main agent (the profile's
        \`unrestricted\` flag is true; \`skillNames\` is inert). Pass an EXPLICIT
        list and the profile gets exactly those skills (\`unrestricted\` false) \u2014
        including \`skill_names=[]\` for a profile with no skills at all. A curated
        profile starts with ZERO connectors \u2014 call attach_connector for each
        one you want after create. Built-ins are detachable from custom
        profiles later via detach_skill/update.

        Returns the stored profile record (camelCase keys)."""
        c = _op_agents_compat(_compat, "create", {
            "displayName": "display_name", "systemPrompt": "system_prompt",
            "skillNames": "skill_names",
        })
        display_name = display_name if display_name is not None \\
            else c.get("display_name")
        description = description  # positional only
        system_prompt = system_prompt or c.get("system_prompt") or ""
        skill_names = skill_names if skill_names is not None \\
            else c.get("skill_names")
        _op_agents_require_str("create", "name", name)
        _op_agents_require_str("create", "display_name", display_name)
        _op_agents_require_str("create", "description", description)
        if system_prompt is not None and not isinstance(system_prompt, str):
            raise TypeError(
                f"host.agents.create: system_prompt must be a str, got "
                f"{type(system_prompt).__name__}"
            )
        if skill_names is not None and not isinstance(skill_names,
                                                      (list, tuple)):
            raise TypeError(
                f"host.agents.create: skill_names must be a list of str or "
                f"None, got {type(skill_names).__name__}"
            )
        return _op_agents_create_or_update(
            "create", "agent_create",
            # skill_names=None is OMITTED from the wire (dropped by
            # _op_agents_call) so the host marks the profile \`unrestricted\`
            # (full live catalog + all connectors); an explicit list \u2014
            # including [] \u2014 is persisted exactly with unrestricted=false.
            {"name": name, "displayName": display_name,
             "description": description, "systemPrompt": system_prompt or "",
             "skillNames": list(skill_names) if skill_names is not None
             else None},
        )

    def update(self, name, patch):
        """Patch an existing profile. \`patch\` is a dict of fields to change \u2014
        any of: display_name, description, system_prompt, skill_names,
        unrestricted, icon_key, color_key (camelCase spellings also
        accepted). Unspecified fields are left as-is. \`skill_names\` REPLACES
        the full skill allowlist exactly as given (built-ins included \u2014 omit
        one to detach it; [] empties the list) and implicitly flips the
        profile's \`unrestricted\` flag false. \`{"unrestricted": True}\` flips
        it back to the full live catalog + connector view (see create()).
        The main agent's profile is the exception: its built-in set is
        locked and silently re-unioned. excludedTools is NOT a patch field \u2014
        it's per-connector; use attach_connector's include_tools_pattern /
        exclude_tools_pattern instead."""
        _op_agents_require_str("update", "name", name)
        if not isinstance(patch, dict):
            raise TypeError(
                f"host.agents.update: patch must be a dict, got "
                f"{type(patch).__name__}"
            )
        # Map snake_case \u2192 wire camelCase. Unmapped keys pass through as-is
        # (description, camelCase originals, etc.).
        patch = {_OP_AGENTS_PATCH_KEY_MAP.get(k, k): v
                 for k, v in patch.items()}
        return _op_agents_create_or_update(
            "update", "agent_update", {"name": name, "patch": patch},
        )

    def delete(self, name):
        """Delete a custom profile. Bundled profiles are protected."""
        _op_agents_require_str("delete", "name", name)
        return _op_agents_call("delete", "agent_delete", {"name": name})

    def attach_skill(self, name, skill):
        """Add \`skill\` to the profile's skill allowlist."""
        _op_agents_require_str("attach_skill", "name", name)
        _op_agents_require_str("attach_skill", "skill", skill)
        return _op_agents_call(
            "attach_skill", "agent_attach_skill",
            {"agentName": name, "skillName": skill},
        )

    def detach_skill(self, name, skill):
        """Remove \`skill\` from the profile's skill allowlist. Built-in
        (anthropic) skills are detachable from custom profiles; the main
        agent's built-in set is locked (raises)."""
        _op_agents_require_str("detach_skill", "name", name)
        _op_agents_require_str("detach_skill", "skill", skill)
        return _op_agents_call(
            "detach_skill", "agent_detach_skill",
            {"agentName": name, "skillName": skill},
        )

    def attach_connector(self, name, connector, *,
                         include_tools_pattern=None,
                         exclude_tools_pattern=None, **_compat):
        """Attach an MCP connector to the profile. Optional include/exclude
        regex patterns scope which of the connector's tools the profile
        sees. Patterns match the connector's BARE tool names (as returned
        by list_connectors(connector)['tools'], e.g. '^list_marts$'); the
        resulting excludedTools entries are stored fully-qualified as
        mcp_<connector>_<tool> since the list aggregates across all
        attached connectors. Re-attaching an already-attached connector
        without include_tools_pattern/exclude_tools_pattern preserves the
        existing exclusion list; pass include_tools_pattern='.*' to clear
        it."""
        c = _op_agents_compat(_compat, "attach_connector", {
            "includeToolsPattern": "include_tools_pattern",
            "excludeToolsPattern": "exclude_tools_pattern",
        })
        include_tools_pattern = include_tools_pattern \\
            if include_tools_pattern is not None \\
            else c.get("include_tools_pattern")
        exclude_tools_pattern = exclude_tools_pattern \\
            if exclude_tools_pattern is not None \\
            else c.get("exclude_tools_pattern")
        _op_agents_require_str("attach_connector", "name", name)
        _op_agents_require_str("attach_connector", "connector", connector)
        for _pname, _val in (("include_tools_pattern", include_tools_pattern),
                             ("exclude_tools_pattern", exclude_tools_pattern)):
            if _val is not None and (not isinstance(_val, str) or not _val):
                raise TypeError(
                    f"host.agents.attach_connector: {_pname} must be a "
                    f"non-empty str or None, got {_val!r}"
                )
        return _op_agents_call(
            "attach_connector", "agent_attach_connector",
            {"agentName": name, "connectorName": connector,
             "includeToolsPattern": include_tools_pattern,
             "excludeToolsPattern": exclude_tools_pattern},
        )

    def detach_connector(self, name, connector):
        """Remove an MCP connector from the profile."""
        _op_agents_require_str("detach_connector", "name", name)
        _op_agents_require_str("detach_connector", "connector", connector)
        return _op_agents_call(
            "detach_connector", "agent_detach_connector",
            {"agentName": name, "connectorName": connector},
        )

    def list_connectors(self, connector_name=None, **_compat):
        """List all connectors (bundled + directory + user-added MCP) with
        auth state and which profiles use each. Pass connector_name to get
        one connector with its full tool list.

        No arg \u2192 list of dicts: [{name, displayName, source, description,
        authState, attachedAgents: [...]}, ...]. (Return-dict keys are
        camelCase \u2014 wire shape.) Directly iterable.
        With connector_name \u2192 single dict with an extra \`tools\` key.
        """
        c = _op_agents_compat(_compat, "list_connectors",
                              {"connectorName": "connector_name"})
        connector_name = connector_name if connector_name is not None \\
            else c.get("connector_name")
        if connector_name is not None:
            _op_agents_require_str("list_connectors", "connector_name",
                                   connector_name)
        r = _op_agents_call(
            "list_connectors", "connector_list",
            {"connectorName": connector_name},
        )
        # No-arg: handler returns {"connectors": [...]} \u2014 unwrap to a bare
        # list so \`for c in .list_connectors()\` yields dicts (frame 642436b0
        # cell 3). Single-name mode returns the connector dict directly.
        if connector_name is None and isinstance(r, dict) and "connectors" in r:
            return r["connectors"]
        return r


host.agents = _AgentsAccessor()  # noqa: F821 (host defined in base.py)
`,eo_=`# Claude Science SDK fragment: app (MCP-app tiles \u2014 drive live iframe widgets).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER
# base in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are
# already bound.
#
# Host-call handlers: hostCalls.ts cases "app_tool" / "app_tools_list"
# \u2192 appToolsBroker via KernelBinding.onAppToolCall / .onAppToolsList.
#
# Unlike host.mcp() (stdio server), host.app() relays into a LIVE
# browser iframe over ws \u2014 the tile must be open. The return value of the
# app's open_* tool names the artifact_id to target; handler names come from
# .tools() or the next-turn \`<live_interactive_app>\` block.


class _OperonAppProxy:
    """One MCP-app viewer. host.app(server).<tool>(artifact_id=, **kw)
    relays into the live iframe; .tools() lists registered handlers."""

    def __init__(self, server):
        self._server = server

    def __repr__(self):
        return f"<host.app({self._server!r}) \u2014 .tools() for live handlers>"

    def tools(self):
        """List handlers the open tile(s) have registered. Returns
        [{name, description, inputSchema, artifact_id}, ...]; empty if no
        tile is open yet."""
        return _host_call(
            "app_tools_list", [{"server": self._server}]
        )

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        _server = self._server

        def _call(artifact_id=None, **kw):
            if artifact_id is not None and (
                not isinstance(artifact_id, str) or not artifact_id
            ):
                raise TypeError(
                    f"host.app({_server!r}).{name}: artifact_id must be "
                    f"a non-empty str or None, got {artifact_id!r}"
                )
            try:
                return _host_call(
                    "app_tool",
                    [
                        {
                            "server": _server,
                            "tool": name,
                            "artifact_id": artifact_id,
                            "args": kw,
                        }
                    ],
                )
            except RuntimeError as e:
                # Broker-side arg validation (appToolsBroker.ts
                # validateAppToolArgs) rejects unknown kwargs / tool names
                # BEFORE the iframe relay. Re-raise those as the Python
                # exception a signature mismatch would produce, so a typo'd
                # kwarg reads like a normal TypeError instead of a host-call
                # RuntimeError. Anchored to the start of the message \u2014
                # base.py wraps every host error as
                # "host_call 'app_tool' failed: <text>", and an iframe
                # handler's own error text rides the same wrapper, so a
                # substring match could miscategorize an iframe error that
                # merely mentions the marker. The broker message prefixes
                # AND base.py's wrapper are a contract with this block \u2014
                # change them in all places together.
                msg = str(e)
                prefix = "host_call 'app_tool' failed: "
                arg_marker = f"{prefix}{name}: unexpected argument"
                tool_marker = f"{prefix}{name}: unknown tool"
                if msg.startswith(arg_marker):
                    raise TypeError(
                        f"host.app({_server!r}).{msg[len(prefix):]}"
                    ) from None
                if msg.startswith(tool_marker):
                    raise AttributeError(
                        f"host.app({_server!r}).{msg[len(prefix):]}"
                    ) from None
                raise

        _call.__name__ = name
        _call.__qualname__ = f"host.app({_server!r}).{name}"
        return _call


def _op_app(server):
    """Drive a live MCP-app tile (Ketcher etc). \`server\` is the same name
    you'd pass to host.mcp(). Attribute access relays into the iframe.

    Opening a tile is an MCP call, so it happens in the \`repl\` tool
    (host.mcp() is repl-kernel-only); driving the already-open tile
    works from either kernel. The two kernels share no memory \u2014 hand the
    artifact_id across via a ./handoff/ file:

        # \`repl\` cell \u2014 open the tile, write the id to handoff:
        import json
        r = host.mcp("ketcher-chemistry", "open_sketcher",
                       smiles="c1ccccc1", filename="benzene.ket")
        with open("./handoff/tile.json", "w") as f:
            json.dump({"artifact_id": r["artifact_id"]}, f)

        # \`python\` cell \u2014 read the id from handoff, drive the tile:
        import json
        aid = json.load(open("./handoff/tile.json"))["artifact_id"]
        host.app("ketcher-chemistry").highlight_atoms(
            artifact_id=aid, atoms=[0, 2, 4])

    .tools() lists registered handlers. Calls error cleanly if no tile is
    open or artifact_id doesn't match a live one. From the analysis
    (python) kernel, only bundled viewers are reachable \u2014 custom-server
    tiles require the \`repl\` tool.
    """
    if not isinstance(server, str) or not server:
        raise TypeError(f"host.app: server must be a non-empty str, got {server!r}")
    return _OperonAppProxy(server)


host.app = _op_app
`,_d_=`# Claude Science SDK fragment: artifacts (universal \u2014 any agent with a kernel).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER
# base in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are
# already bound in that namespace.
#
# Migrated tools: list_artifacts \u2192 host.artifacts(**filters)
# Host-call handlers: hostCalls.ts case "list_artifacts" \u2192 conciergeTools.listArtifacts
#
# read_file stays a tool \u2014 image/PDF paths queue vision content blocks
# onto ctx.pending_files (protocol-level, not expressible via host-call),
# and file_path text mode is just open(). One unified tool is cleaner
# than splitting by content-type.


# F-01: IANA top-level MIME types (RFC 6838). content_type is prefix-matched
# on the host against lowercase stored values, so 'png/' or 'csv' silently
# return empty. Whitelist the top-level.
_OP_ARTIFACTS_VALID_MIME_TOPLEVEL = (
    "text", "image", "audio", "video", "application",
    "font", "multipart", "model", "message", "example",
)


def _op_artifacts(
    version_id=None,
    frame_id=None,
    project_id=None,
    filename=None,
    exact=False,
    content=None,
    content_type=None,
    after=None,
    before=None,
    include_intermediate=False,
    limit=200,
    offset=0,
    search=None,
):
    """Query the artifact store \u2014 THE way to find prior work.

    Artifacts are store records (versioned, cross-session), not workspace
    files: ls/find/glob cannot discover them, and an empty filesystem
    search proves nothing. Before concluding a data product doesn't exist
    or recomputing it, query here.

    Returns {count, scope, provenance, artifacts: [{id, filename,
    content_type, size_bytes, latest_version_id, checksum,
    root_frame_id, project_id, is_user_upload, priority, created_at},
    ...]}. Results are **newest-first** (most recently created artifacts
    first) \u2014 except under \`search=\`, which returns results in **rank
    order** (best match first) \u2014 and \`count\` is the TOTAL number of
    matches. When there are
    more matches than \`limit\`, the response also carries
    \`truncated: True\` and a \`hint\` explaining how to page (offset) or
    narrow (filters) \u2014 check it before concluding something doesn't
    exist. The top-level \`provenance\` block is {root_frame_id,
    project_id, agent_name} \u2014 the calling kernel's session identity,
    for stamping published outputs. \`checksum\` is the sha256 of the
    latest version's stored bytes (None = never hashed: legacy rows or
    oversized/degraded registrations).

    Direct lookup:
      version_id      \u2014 fetch one version by id; ignores all other filters.

    Filters, all optional:
      search          \u2014 ranked fuzzy search, SAME engine as the app's
                        @-mention / \u2318K palette. Tokenizes the query
                        ("umap coords" \u2192 ["umap","coords"]) and matches each
                        token against filename + parent-session title with
                        word-order, separator, and typo tolerance plus
                        domain synonyms and extension aliases. Results come
                        back in rank order (best first), each with \`_score\`
                        and \`_weak\`. Use this when you know WHAT you want
                        but not the exact filename. Mutually exclusive with
                        filename/content; composes with
                        project_id/frame_id/content_type/after/before.
                        Applies the palette's discovery visibility rules
                        (intermediates, plan files, and priority-hidden
                        artifacts are excluded regardless of
                        include_intermediate) \u2014 use filename= for those.
      frame_id        \u2014 scope to one session (root frame ID)
      project_id      \u2014 query a specific project. Defaults to the current
                        project. Pass another project's id to list its
                        artifacts cross-project, or "all" to list every
                        project at once (reads cross projects; saves are
                        always local). Every returned artifact carries its
                        own \`project_id\` so you can see where it came from.
      filename        \u2014 filename substring, case-insensitive
      exact           \u2014 with filename: require a whole-basename match
                        instead of substring. Use this when the user names a
                        specific file ("open foo.csv") so foo.csv.bak and
                        old_foo.csv don't match.
      content         \u2014 grep raw file bytes (text/JSON only; reads disk,
                        runs after other filters narrow the set)
      content_type    \u2014 MIME prefix: 'text/', 'image/', 'application/json'
      after/before    \u2014 ISO 8601 date/datetime bounds. Compared against UTC;
                        a bare date means midnight UTC at the start of that
                        day, so before='2026-04-02' excludes April 2nd \u2014 use
                        the day after your cutoff or a full datetime.
      include_intermediate \u2014 include auto-promoted intermediate files
      limit           \u2014 max results per page (default 200, clamped to
                        [1,1000])
      offset          \u2014 skip N results (pair with limit to page; without
                        search= results are newest-first so offset=200 is
                        the NEXT-OLDER page; with search= offset pages
                        WEAKER matches)

    Each artifact dict carries latest_version_id \u2014 pass that to read_file,
    host.artifact_path(vid), or a literal {{artifact:VID}} marker in code.
    Two independent widening axes: project_id widens across PROJECTS
    (omit = current project, "proj_X" = that project, "all" = every
    project); frame_id narrows to one SESSION (omit = all sessions in the
    project scope). A frame_id from any project resolves directly \u2014 no
    project_id needed, the response reports that frame's project. To find
    where a cross-project artifact came from, check its \`project_id\` field.

    Compose freely: host.artifacts(content_type='text/csv', after='2026-03-01')
    or [a for a in host.artifacts()['artifacts'] if a['size_bytes'] > 1e6]
    """
    # Direct lookup \u2014 bypasses includeIntermediate filter, returns 1 row.
    if version_id is not None:
        if not isinstance(version_id, str) or not version_id:
            raise TypeError(
                f"host.artifacts: version_id must be a non-empty str, "
                f"got {version_id!r}"
            )
        return _host_call("list_artifacts", [{"version_id": version_id}])  # noqa: F821
    # Client-side guards \u2014 fail fast before the host round-trip.
    # C6/C9/F-01: content_type is matched as a prefix on the host against
    # lowercase stored values \u2014 'CSV' or 'Image/' or 'png/' silently return
    # empty. Normalise to lowercase (MIME is case-insensitive per RFC 2045)
    # and whitelist the top-level type.
    if content_type is not None:
        if not isinstance(content_type, str) or not content_type:
            raise TypeError(
                f"host.artifacts: content_type must be a non-empty str, "
                f"got {content_type!r}"
            )
        content_type = content_type.lower()
        toplevel = content_type.split("/", 1)[0]
        if toplevel not in _OP_ARTIFACTS_VALID_MIME_TOPLEVEL:
            raise ValueError(
                f"host.artifacts: content_type={content_type!r} is not a "
                f"valid MIME type prefix. Top-level type must be one of: "
                f"{', '.join(_OP_ARTIFACTS_VALID_MIME_TOPLEVEL)}. "
                f"Use e.g. 'image/', 'text/csv'."
            )
    # M1/M9: limit/offset default host-side but a non-int (or bool, which is
    # a subclass of int) silently coerces to a bogus clamp. offset=0 is the
    # default so allow 0; limit<1 is always a bug.
    if limit is not None and (
        not isinstance(limit, int) or isinstance(limit, bool) or limit < 1
    ):
        raise TypeError(
            f"host.artifacts: limit must be a positive int or None, got {limit!r}"
        )
    if offset is not None and (
        not isinstance(offset, int) or isinstance(offset, bool) or offset < 0
    ):
        raise TypeError(
            f"host.artifacts: offset must be a non-negative int or None, got {offset!r}"
        )
    # I3: include_intermediate=1 truthy-coerces on the host (same as frames'
    # roots_only). Require actual bool.
    if not isinstance(include_intermediate, bool):
        raise TypeError(
            f"host.artifacts: include_intermediate must be a bool, got "
            f"{type(include_intermediate).__name__}"
        )
    if not isinstance(exact, bool):
        raise TypeError(
            f"host.artifacts: exact must be a bool, got "
            f"{type(exact).__name__}"
        )
    if exact and filename is None:
        raise ValueError(
            "host.artifacts: exact=True requires a filename to match against"
        )
    if search is not None:
        if not isinstance(search, str) or search.strip() == "":
            raise ValueError(
                "host.artifacts: search= must be a non-blank str \u2014 pass "
                "None to skip the filter"
            )
        if filename is not None or content is not None:
            raise ValueError(
                "host.artifacts: search= is mutually exclusive with "
                "filename=/content= \u2014 use search= for ranked fuzzy "
                "discovery, or the literal filters for exact lookup"
            )
    # C2/M3: string filters \u2014 filename=42 etc. leaked a raw JS
    # '.trim is not a function' from the host; '' matched everything via
    # LIKE '%%'. Require str or None; '' is ambiguous (pass None to skip).
    for _name, _val in (
        ("filename", filename),
        ("content", content),
        ("after", after),
        ("before", before),
        ("frame_id", frame_id),
        ("project_id", project_id),
    ):
        if _val is None:
            continue
        if not isinstance(_val, str):
            raise TypeError(
                f"host.artifacts: {_name} must be a str or None, got "
                f"{type(_val).__name__}"
            )
        if _val == "":
            raise ValueError(
                f"host.artifacts: {_name}='' is ambiguous \u2014 pass None to "
                f"skip the filter"
            )
    # None values are passed through \u2014 the handler's arg extraction
    # (conciergeTools.ts listArtifacts) treats missing-and-None identically.
    r = _host_call(
        "list_artifacts",
        [
            {
                "frame_id": frame_id,
                "project_id": project_id,
                "search": search,
                "filename": filename,
                "filename_exact": exact,
                "content": content,
                "content_type": content_type,
                "after": after,
                "before": before,
                "include_intermediate": include_intermediate,
                "limit": limit,
                "offset": offset,
            }
        ],
    )
    # C7/C10: the host returned {'error': 'Frame X not found'} as a dict
    # (not a raise) for a bad frame_id \u2014 the only {error} dict left in the
    # SDK. Surface it as an exception. blue-river is also making the host
    # throw, so this is defense-in-depth going forward.
    if isinstance(r, dict) and "error" in r and "artifacts" not in r:
        raise RuntimeError(f"host.artifacts: {r['error']}")
    return r


host.artifacts = _op_artifacts


def _op_artifact_path(version_id):
    """Resolve an artifact version_id (or artifact_id) to a local filesystem path.

    {{artifact:UUID}} markers are rewritten to paths BEFORE your code runs, so
    the UUID must be a literal in source. If you only learn the id at runtime
    (e.g. from host.artifacts()), use this instead:

        arts = host.artifacts(filename="fleet_dashboard.csv")
        vid = arts["artifacts"][0]["latest_version_id"]
        df = pd.read_csv(host.artifact_path(vid))

    Tries version_id first, then artifact_id \u2192 latest version. Works for
    artifacts in any of the user's projects \u2014 list cross-project ids via
    host.artifacts(project_id=X). Raises if the artifact can't be found
    or is a reference-only entry whose host file is no longer accessible.
    """
    if not isinstance(version_id, str) or not version_id:
        raise TypeError(
            "host.artifact_path: version_id must be a non-empty str, got "
            f"{type(version_id).__name__}"
        )
    return _host_call("artifact_path", [version_id])  # noqa: F821


host.artifact_path = _op_artifact_path


def _op_artifact_marker(version_id):
    """Return the literal artifact-marker string for embedding in generated
    HTML/markdown/LaTeX, for the renderer to resolve LATER when the output
    is viewed.

    The kernel's pre-exec resolver substring-scans your code source for the
    marker prefix and hard-fails on any non-UUID match \u2014 so writing the
    marker inline (f-string, .format, concat) to build a report gets
    intercepted before your code runs. This helper constructs the string at
    runtime without tripping that scan:

        html = f'<img src="{host.artifact_marker(vid)}">'

    For a local filesystem path to open/read the artifact yourself, use
    host.artifact_path(vid) instead.
    """
    if not isinstance(version_id, str) or not version_id:
        raise TypeError(
            "host.artifact_marker: version_id must be a non-empty str, "
            f"got {type(version_id).__name__}"
        )
    # Split so this source file itself carries no literal marker prefix.
    return "{" + "{" + "artifact:" + version_id + "}" + "}"


host.artifact_marker = _op_artifact_marker


# \u2500\u2500\u2500 Image attach helper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Pure-Python (PIL) \u2014 no new host-call. Writes a PNG to cwd so the existing
# auto-view pipeline (scanWorkspace \u2192 buildAutoViewImages \u2192 pending_files)
# attaches it as a vision block on the NEXT turn.
#
# Hill-climb result (core/scripts/bench-zoom-crop): the docstring and SP
# guidance intentionally LEAD with the compute-first PIL recipe. Framing this
# as a "zoom tool" ("call, look, guess coords, crop again") measurably hurts \u2014
# the model's visual coord estimates are ~5-10% off and it loops. "PIL" in the
# prompt primes np.asarray \u2192 pixel-mask \u2192 exact crop on turn 1.

_op_view_image_n = [0]  # list so the closure can mutate it without \`global\`


def _op_view_image(source, crop=None, *, max_size=1568, out=None):
    """Attach an image (or a cropped region of one) to your visual context.

    Open the original with PIL, crop the region of interest, and pass it
    here (or just \`.save('region.png')\` \u2014 same effect). The PNG is written
    to the workspace and auto-attached on the NEXT message.

        from PIL import Image
        img = Image.open("figure.png")            # W, H = img.size
        host.view_image(img.crop((x0, y0, x1, y1)))

    Always crop from the **original file**, not from a previously-saved
    crop (saved views are downsampled). Before cropping tight, note any
    units, scale bars, legends, or "\xD7N" qualifiers in the full view \u2014 a
    tight crop hides them.

    **For grid/table/dense-text images where you need the value at a
    specific row/col** \u2014 don't guess margins. Tile the image with PIL,
    pass the tiles as a request list to \`host.llm\` to transcribe them
    in parallel, then answer from the assembled text map. Tile at roughly
    the visible cell granularity and cap at ~100 tiles (cost scales
    linearly)::

        from PIL import Image
        img = Image.open("heatmap.png"); W, H = img.size
        N, M = 10, 10  # \u2248 visible cols, rows; keep N*M \u2272 100
        tiles = [img.crop((c*W//N, r*H//M, (c+1)*W//N, (r+1)*H//M))
                 for r in range(M) for c in range(N)]
        res = host.llm(
            [{"messages": [{"role": "user", "content": [
                {"type": "image", "pil": t},
                {"type": "text", "text": "Transcribe all visible text/numbers."}]}],
              "max_tokens": 100} for t in tiles])
        text_map = {(r, c): res[r*N+c].get("text", "") for r in range(M) for c in range(N)}

    Args:
      source    \u2014 a PIL.Image.Image, OR a workspace/absolute file path, OR a
                  bare artifact version_id (resolved via
                  host.artifact_path()).
      crop      \u2014 optional (x0, y0, x1, y1) in original-image pixels (PIL box
                  order: left, upper, right, lower). If every value is \u2264 1.0
                  they're treated as fractions of width/height.
      max_size  \u2014 cap the longer output side (default 1568 = the API vision
                  limit, so crops reach the model at full resolution).
      out       \u2014 output filename; defaults to \`_view_<NNN>_<basename>.png\`.

    Returns {source, original_size, crop, output_size, saved_to}.
    Requires Pillow (in the default \`python\` conda env).
    """
    import os as _os
    import re as _re
    # Fail fast, before the artifact_path host call / file open / full
    # decode \u2014 sibling source/crop validations in this function all pay
    # I/O first only when they need the image dimensions; this one doesn't.
    if max_size is not None and (
        not isinstance(max_size, int)
        or isinstance(max_size, bool)
        or max_size < 1
    ):
        raise TypeError(
            f"host.view_image: max_size must be a positive int or None, "
            f"got {max_size!r}"
        )
    try:
        from PIL import Image as _Image
    except ImportError:
        raise RuntimeError(
            "host.view_image requires Pillow. It's in the default \`python\` "
            "conda env \u2014 call this from the \`python\` tool, or "
            "manage_packages(mode='install', packages=['pillow'])."
        )

    region = None
    base = "image"
    if isinstance(source, _Image.Image):
        img = source
        W, H = img.size
        base = (getattr(source, "filename", "") or "image")
        base = _os.path.splitext(_os.path.basename(base))[0] or "image"
    else:
        if not isinstance(source, str) or not source:
            raise TypeError(
                "host.view_image: source must be a PIL.Image, a file path, "
                f"or an artifact version_id; got {type(source).__name__}"
            )
        if _re.fullmatch(r"[0-9a-fA-F-]{36}", source):
            path = _host_call("artifact_path", [source])  # noqa: F821
        else:
            path = source
        if not _os.path.exists(path):
            raise FileNotFoundError(
                f"host.view_image: {path!r} not found. Pass a workspace "
                f"path, a PIL.Image, or an artifact version_id."
            )
        # Real microscopy / whole-slide images routinely exceed PIL's 89MP
        # DecompressionBomb threshold. Scope the override to this single
        # open+load so bomb protection stays on for every other PIL open in
        # the (long-lived) kernel process. Header-only dimension check before
        # .load() caps at 500MP (~5.6\xD7 PIL's default) so a crafted bomb
        # can't OOM the kernel via this path while legitimate large scans
        # still pass.
        _prev_max = _Image.MAX_IMAGE_PIXELS
        _Image.MAX_IMAGE_PIXELS = None
        try:
            img = _Image.open(path)
            W, H = img.size
            if W * H > 500_000_000:
                raise ValueError(
                    f"host.view_image: image is {W}x{H} ({W*H/1e6:.0f} MP), "
                    f"exceeding the 500 MP safety cap. For ultra-high-res "
                    f"images, crop with PIL directly (Image.open(path)"
                    f".crop(box)) or use a tiled reader like openslide."
                )
            img.load()
        finally:
            _Image.MAX_IMAGE_PIXELS = _prev_max
        base = _os.path.splitext(_os.path.basename(path))[0]

    if crop is not None:
        if not (hasattr(crop, "__len__") and len(crop) == 4):
            raise TypeError(
                "host.view_image: crop must be (x0, y0, x1, y1) \u2014 "
                "left, upper, right, lower in original-image pixels "
                "(or fractions in [0,1])."
            )
        x0, y0, x1, y1 = (float(v) for v in crop)
        if max(abs(x0), abs(y0), abs(x1), abs(y1)) <= 1.0:
            x0, y0, x1, y1 = x0 * W, y0 * H, x1 * W, y1 * H
        x0 = max(0, min(W, int(round(x0))))
        y0 = max(0, min(H, int(round(y0))))
        x1 = max(0, min(W, int(round(x1))))
        y1 = max(0, min(H, int(round(y1))))
        if x1 <= x0 or y1 <= y0:
            raise ValueError(
                f"host.view_image: crop box has zero/negative area "
                f"after clamping to {W}\\u00d7{H}: ({x0},{y0},{x1},{y1}). "
                f"Check coord order (left, upper, right, lower)."
            )
        img = img.crop((x0, y0, x1, y1))
        region = (x0, y0, x1, y1)

    cw, ch = img.size
    if img.mode not in ("RGB", "RGBA", "L"):
        # Convert before resize: Pillow forces NEAREST on mode "P"/"1"
        # regardless of resample=, which aliases glyph strokes on
        # palette-mode sources (pngquant output, GIFs, etc.).
        img = img.convert("RGB")
    if max_size and max(cw, ch) > max_size:
        s = max_size / max(cw, ch)
        img = img.resize((max(1, int(cw * s)), max(1, int(ch * s))))

    _op_view_image_n[0] += 1
    saved = out or f"_view_{_op_view_image_n[0]:03d}_{base}.png"
    img.save(saved)

    # repr() guards against control chars in filenames leaking into the
    # tool_result stream (bench-zoom-crop adversarial finding).
    tag = f"crop x={region[0]}..{region[2]} y={region[1]}..{region[3]} " if region else ""
    print(
        f"[view_image] {base!r} [{W}\\u00d7{H}px] \\u2192 {tag}"
        f"[{img.size[0]}\\u00d7{img.size[1]}px] \\u2192 {saved!r}"
    )
    return {
        "source": source if isinstance(source, str) else "<PIL.Image>",
        "original_size": (W, H),
        "crop": region,
        "output_size": img.size,
        "saved_to": saved,
    }


host.view_image = _op_view_image

`,IaO=`"""
Claude Science kernel SDK \u2014 compute fragment. Gated on hasRemoteComputeProvider().
Installs host.compute = namespace with one constructor (create).

Runs after sdk/base.py \u2014 relies on _host_call and the \`host\` singleton being
already defined in the namespace.

Executes via the \`repl\` tool (control-plane kernel). Stdlib-only
(no pandas/numpy/third-party packages). Shares cwd with the python/R kernels
but not memory \u2014 persist to ./handoff/*.json to cross.
"""


import itertools as _itertools
import os as _os
import random as _random
import time as _time


class SessionConcurrencyFull(RuntimeError):
    """Raised by submit_job(on_full="raise") when this session's
    set_concurrency_limit is reached. Carries .live and .limit."""

    def __init__(self, live, limit):
        self.live = live
        self.limit = limit
        super().__init__(
            f"session concurrency limit reached (live={live}/{limit})"
        )

# Host-injected colon-separated absolute paths (OPERON_ARTIFACTS_ROOTS) under
# which absolute kernel paths are accepted by _relativize_local. The host
# resolves and streams through these via the same fd-pinned tar pipeline that
# workspace inputs use. Empty/unset \u2192 only the legacy /mnt/artifacts/ exception
# applies.
_ARTIFACT_ROOTS = [
    _os.path.realpath(p)
    for p in (_os.environ.get("OPERON_ARTIFACTS_ROOTS", "").split(":"))
    if p
]


def _relativize_local(p):
    """Agent often passes os.path.abspath(...) which is the VM-side path the
    host can't see. Strip the cwd prefix so the host gets a workspace-relative
    path it can resolve via getWorkspaceDir(frameId)."""
    import os
    if not isinstance(p, str):
        return p
    cwd_prefix = os.getcwd() + "/"
    if p.startswith(cwd_prefix):
        return p[len(cwd_prefix):]
    if p.startswith("/"):
        # Legacy: VM-side bind-mount of the artifact store. Kept so the older
        # code path that passes /mnt/artifacts/... still works while the new
        # OPERON_ARTIFACTS_ROOTS path is rolled out.
        if "/mnt/artifacts/" in p:
            return p
        # Daemon-side: any absolute path under one of the host-allowlisted
        # artifact roots (env: OPERON_ARTIFACTS_ROOTS, colon-separated). Pass
        # through as-is \u2014 the host extracts the artifact_id via regex and
        # resolves it through the artifact-store DB; the agent-supplied path
        # is never opened directly on the host. This check is advisory only
        # (the kernel is adversarial python and can monkeypatch
        # _ARTIFACT_ROOTS); the TS host's regex + DB lookup is the real gate.
        real = os.path.realpath(p)
        for root in _ARTIFACT_ROOTS:
            try:
                if os.path.commonpath([real, root]) == root:
                    return p
            except ValueError:
                continue
        raise ValueError(
            "local path must be workspace-relative, {'version_id': ...}, "
            "{{artifact:ID}}, or under OPERON_ARTIFACTS_ROOTS "
            f"(got absolute path {p!r}; roots={_ARTIFACT_ROOTS or 'unset'})"
        )
    return p


def _normalize_provider_params(provider, pp):
    """None-drop inside the nested family block ({'modal':{'gpu':None}} \u2192
    {'modal':{}}). Anything outside the family key is passed through
    verbatim so the host's checkStrayProviderParams rejects it loudly
    (bh 3469575267). NO flat\u2192nested auto-wrap (alo rv 4566733844) \u2014 a
    flat {'gpu':'A100'} lands as a stray at the host check, which was
    already the clear one-turn error pre-PR; auto-wrapping would silently
    rewrite the agent's input and mis-wrap on non-modal families.
    Idempotent."""
    if not pp:
        return None
    if not isinstance(pp, dict):
        raise TypeError(
            "provider_params must be a dict ({'%s': {'gpu':'A100', ...}}); "
            "got %r" % (provider.split(":", 1)[-1], pp)
        )
    fam = provider.split(":", 1)[-1]
    strays = {k: v for k, v in pp.items() if k != fam and v is not None}
    inner = pp.get(fam)
    if inner is None:
        return strays or None
    if not isinstance(inner, dict):
        raise TypeError(
            "provider_params['%s'] must be a dict; got %r" % (fam, inner)
        )
    inner = {k: v for k, v in inner.items() if v is not None}
    out = ({fam: inner} if inner else {}) | strays
    return out or None


def _compute_call(op, kw):
    # Drop None kwargs \u2014 same shape as a tool call where optional params were
    # omitted, so the existing handler validation paths work.
    kw = {k: v for k, v in kw.items() if v is not None and k != "self"}
    r = _host_call(f"compute_{op}", [kw])  # noqa: F821 (defined in base.py)
    # Handlers return {error: "..."} for soft failures (decline, bad arg).
    # Surface as an exception unless it's a status-carrying result the caller
    # is expected to inspect (.result()'s exit_code != 0).
    if isinstance(r, dict) and r.get("error") and "status" not in r:
        e = RuntimeError(f"host.compute.{op}: {r['error']}")
        e.error_kind = r.get("error_kind")
        e.concurrency = r.get("concurrency")
        raise e
    return r


class _OperonComputeJob:
    """One submitted job. Returned by Instance.submit_job(); recover later via
    host.compute.create(provider).attach_job(job_id)."""

    def __init__(self, provider, job_id, workdir=None):
        self._provider = provider
        self._job_id = job_id
        self._workdir = workdir
        self.result_dict = None
        self.output_files = []
        self.featured_files = []
        # byoc only \u2014 the egress posture the job's sandbox was CREATED with
        # (e.g. "allowlist (2 domains; mirror off; +0 from the env)" or
        # "blocked (no outbound network)"), host-authored at submit time.
        # It describes THIS sandbox for its whole life: changing the
        # provider's Egress setting later affects only sandboxes created
        # afterwards, never this one. None for non-byoc providers and for
        # sandboxes that predate the policy stamp.
        self.egress = None

    def __repr__(self):
        eg = f" egress={self.egress!r}" if self.egress else ""
        return (
            f"<host.compute.Job {self._provider}/{self._job_id} "
            f"state={self.status}{eg} \u2014 recover with "
            f"host.compute.create({self._provider!r})"
            f".attach_job({self._job_id!r})>"
        )

    @property
    def job_id(self):
        return self._job_id

    # Alias \u2014 .id is what callers reach for (friction scan F4).
    id = job_id

    @property
    def exit_code(self):
        """None until the job is terminal. Call .result() after the
        compute_done notification to populate."""
        r = self.result_dict or {}
        ec = r.get("exit_code")
        if ec is None and r.get("status") in (None, "submitted", "running",
                                              "queued", "harvesting",
                                              "pending"):
            if not getattr(self, "_exit_code_warned", False):
                self._exit_code_warned = True
                import sys
                print("[host.compute] .exit_code is None until the job is "
                      "terminal \u2014 call .result() after wait_for_notification",
                      file=sys.stderr)
        return ec

    @property
    def status(self):
        return (self.result_dict or {}).get("status", "submitted")

    @property
    def workdir(self):
        """Absolute job workdir on the remote host (under scratch). Populated
        from the submit/result() response; None for an attached job until
        result() is called."""
        return self._workdir

    def result(self):
        """Non-blocking read of the job's result dict for all provider
        families (\`\`ssh:*\`\` and \`\`byoc:*\`\`). Returns the persisted result if
        the daemon's poller has already harvested it; otherwise
        \`\`{'status': 'running', ...}\`\` with guidance to use the
        \`\`wait_for_notification\`\` brain-tool.

        The daemon's background poller polls the remote (ssh \`\`statusBatch\`\`
        or byoc \`\`probe()\`\`), harvests into \`\`hpc/<job_id>/\`\`, and emits a
        \`\`compute_done\`\` notification when done \u2014 exit this cell and use
        \`\`wait_for_notification\`\`; the payload includes \`\`featured_files\`\` so
        you can \`\`save_artifacts(...)\`\` without re-entering the kernel.

        Returns \`\`{status, exit_code, output_files, featured_files,
        left_on_remote, remote_workdir, stdout_tail?, stderr_tail?,
        job_wall_s?, ...}\`\` once terminal. \`\`output_files\`\` is the full
        list (uncapped) ordered featured-first; the same files are on
        disk under \`\`hpc/<job_id>/\`\`. Does NOT raise on
        \`\`status='failed'\`\` or \`\`status='timed_out'\`\` (deadline-terminated,
        outputs harvested) \u2014 read \`\`exit_code\`\` / \`\`error_kind\`\`.
        """
        if self.result_dict and self.result_dict.get("status") not in (
            "running", "timeout", "harvesting",
        ):
            return self.result_dict
        r = _compute_call("result", {
            "job_id": self._job_id, "provider": self._provider,
        })
        self.result_dict = r
        self.output_files = r.get("output_files", [])
        self.featured_files = r.get("featured_files", [])
        if not self._workdir:
            self._workdir = r.get("remote_workdir")
        # A job recovered with attach_job() never saw a submit reply, so
        # backfill the birth-egress line from the persisted result: None
        # must keep meaning "no fence", never "we lost track of one".
        if self.egress is None and r.get("egress"):
            self.egress = r["egress"]
        # Host-authored egress attribution: present only when this job ran
        # under an egress fence AND its outcome looks like the fence (a
        # terminal failure, or connect-level errors in the tails). Printed
        # once so it lands in the transcript next to the output the agent
        # is about to reason about; the raw error text is never altered.
        hint = r.get("egress_hint")
        if hint and not getattr(self, "_egress_hint_printed", False):
            self._egress_hint_printed = True
            print(hint)
        return r

    def cancel(self):
        """Terminate the running job (scheduler cancel / process-group
        SIGTERM / sandbox terminate). This is the ONLY thing that kills a
        job \u2014 the user's Stop button, a kernel crash, or exiting the
        \`\`repl\`\` cell never auto-cancel; the daemon's poller keeps
        tracking and will harvest the job when it finishes. Call this (or
        \`\`c.close()\`\`) when you actually want to stop the remote work and
        free the allocation."""
        return _compute_call(
            "cancel", {"job_id": self._job_id, "provider": self._provider}
        )


class _OperonComputeInstance:
    """Dispatch to one provider. Bind once with create(); each method's
    approval modal still gates the actual remote exec.

    help(c.submit_job) for params; the remote-compute-ssh skill has the
    worked example. For byoc:* providers, pass provider_params to create()
    \u2014 e.g. create('byoc:modal', provider_params={'modal': {'image': ...,
    'gpu': 'A100'}}). \`timeout\` (container lifetime, seconds) is optional;
    omitted, it fills from the provider's Settings default.
    """

    def __init__(self, provider, provider_params=None):
        self._provider = provider
        self._provider_params = _normalize_provider_params(
            provider, provider_params)
        self._jobs = []
        self._reuse_via = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        try:
            self.close()
        except Exception:
            pass

    def __repr__(self):
        # The handle is stateless until submit_job \u2014 nothing to "recover" here.
        # For byoc, the params (image/gpu) are what you'd re-supply.
        pp = self._provider_params or {}
        pid = self._provider.split(":")[-1]
        bits = []
        for k in ("image", "gpu"):
            v = (pp.get(pid) or {}).get(k)
            if v:
                bits.append(f"{k}={v!r}")
        extra = (" " + " ".join(bits)) if bits else ""
        return f"<host.compute {self._provider}{extra}>"

    def submit_job(
        self,
        *,
        command,
        intent,
        inputs=None,
        outputs=None,
        environment=None,
        harvest=None,
        timeout_seconds=None,
        scheduler=None,
        tier=None,
        credentials=None,
        on_full="wait",
        # \u2014 aliases (friction scan F4) \u2014 normalized here, never sent \u2014
        timeout=None,
        timeout_s=None,
        env=None,
    ):
        """Stage inputs, write the job script, dispatch. Approval-gated.

        Returns immediately after dispatch. When a session
        \`\`set_concurrency_limit\`\` is in effect and the cap is full, the
        host refuses with \`\`error_kind="session_concurrency_full"\`\` and
        this call's \`\`on_full\`\` decides what happens:
        \`\`"wait"\`\` (default) prints one \`\`[concurrency] L/K full \u2014
        waiting\`\` line and retries with jittered exponential backoff
        (capped ~20s) until a slot opens; \`\`"raise"\`\` raises
        \`\`SessionConcurrencyFull(live, limit)\`\` immediately. The wait is a
        plain \`\`time.sleep\`\` \u2014 Stop interrupts it; no daemon-side state.
        Print the returned Job (its repr is the recovery handle),
        end the cell, and use the \`\`wait_for_notification\`\` brain-tool to
        park until the daemon's poller emits the \`\`compute_done\`\`
        notification (its payload carries \`\`featured_files\`\`). Call
        \`\`.result()\`\` for a non-blocking read of the harvested result dict.

        For byoc providers, the FIRST submit_job() on a handle creates the
        container; subsequent calls reuse it (weights/caches stay warm).
        Sequential only \u2014 submit job N+1 AFTER job N's \`\`compute_done\`\`
        notification arrives, since each submit wipes /work. Container
        shape (image/gpu/volume/region/timeout) is fixed at \`\`create()\`\` \u2014
        to change it, call \`\`create()\`\` again for a fresh handle; there is
        no per-\`\`submit_job\`\` override (the warm container can't honor it).

        Returns an _OperonComputeJob.
          intent \u2014 REQUIRED one-line approval-modal headline; name tool,
            target, scale, e.g. \`\`intent='run boltz2 on 3 seqs (A100,
            ~8min)'\`\`.
          command \u2014 job script. Scheduler directives at the top; cwd is a
            fresh per-job workdir; address inputs as './<dst_filename>'.
          inputs \u2014 list of {src, dst_filename} (workspace-relative path or
            {{artifact:ID}}, staged from this machine), {version_id,
            dst_filename} (artifact by version id, staged), or
            {remote_path, dst_filename} (absolute path already on the
            host, symlinked). A bare string entry \`\`'path/to/file'\`\` is
            accepted and coerced to \`\`{'src': 'path/to/file'}\`\`.
            dst_filename is a bare filename (no '/' \u2014 rejected at submit);
            inputs stage flat into the workdir root. For {src}/{remote_path}
            entries it may be omitted (defaults to that path's basename);
            {version_id} entries REQUIRE it (there is no filename to derive
            a default from at submit time).
          outputs \u2014 glob list. Bare string = featured; {glob, visibility:
            'hidden'} = diagnostic; {glob, residency:'remote'} = leave on
            host (SSH providers only; rejected on byoc; ignored by proxy
            providers).
          harvest \u2014 {exclude:['work/**'], max_file_mb, max_total_mb}.
          timeout_seconds \u2014 optional per-job runaway guard (aliases:
            \`\`timeout=\`\`, \`\`timeout_s=\`\`). SSH/proxy: default 1800s. byoc:
            defaults to the container's remaining life minus the harvest
            margin; outputs are staged even when it fires (the job lands
            as status 'timed_out', partial outputs already harvested). A
            warm-reuse submit whose deadline doesn't fit in the
            container's remaining life transparently creates a fresh
            sandbox instead. Set it when you can name the job's budget.
          environment \u2014 remote env name (alias: \`\`env=\`\`).
          credentials \u2014 list of credential NAMES (e.g. ['HF_TOKEN']) to
            forward from the host's credential store into the remote job's
            env. Host-resolved; the agent never sees the values. Names are
            shown on the approval card. byoc providers only.
          on_full \u2014 "wait" (default) | "raise". See above.
        """
        # \u2014 kwarg aliases (friction scan F4) \u2014
        if timeout_seconds is None:
            timeout_seconds = timeout if timeout is not None else timeout_s
        if environment is None:
            environment = env
        if inputs:
            # Bare string \u2192 {'src': str} (friction scan F3); _relativize_local
            # on src as before. Build a new list so the caller's list isn't
            # mutated in place. Container-type guard (bh 3469801828/3470239160):
            # a top-level string/dict would otherwise iterate chars/keys.
            if isinstance(inputs, (str, dict)):
                inputs = [inputs]
            norm = []
            for inp in inputs:
                if isinstance(inp, str):
                    inp = {"src": inp}
                if isinstance(inp, dict) and "src" in inp:
                    inp = {**inp, "src": _relativize_local(inp["src"])}
                norm.append(inp)
            inputs = norm
        for attempt in _itertools.count():
            try:
                r = _compute_call(
                    "submit",
                    {"provider": self._provider, "command": command,
                     "intent": intent, "inputs": inputs, "outputs": outputs,
                     "environment": environment, "harvest": harvest,
                     "timeout_seconds": timeout_seconds,
                     "scheduler": scheduler, "tier": tier,
                     "credentials": credentials,
                     "provider_params": self._provider_params,
                     "reuse_job_id": self._reuse_via},
                )
                break
            except RuntimeError as e:
                ek = getattr(e, "error_kind", None)
                if ek == "session_concurrency_full":
                    c = getattr(e, "concurrency", None) or {}
                    live, limit = c.get("live"), c.get("limit")
                    if on_full == "raise":
                        raise SessionConcurrencyFull(live, limit) from None
                    if attempt == 0:
                        print(
                            f"[concurrency] {live}/{limit} full \u2014 "
                            f"waiting for a slot"
                        )
                    _time.sleep(
                        min(2 * 1.5 ** min(attempt, 20), 20)
                        + _random.uniform(0, 2)
                    )
                    continue
                # Only drop the warm-container anchor if the error suggests
                # the container itself is gone \u2014 pre-create failures
                # (declined approval, at-cap, not-configured, bad params)
                # shouldn't cost the user a cold start on retry. Match on
                # the structured error_kind the host attaches.
                if ek in {
                    "not_found", "ownership_mismatch", "provider_degraded",
                    "result_rejected", "reuse_not_found", "transient",
                    "reuse_window_exhausted",
                    # NOTE: "reuse_timeout_too_large" is deliberately NOT
                    # here \u2014 the sandbox is healthy, only the request was
                    # too big. Keeping the anchor lets a corrected
                    # (smaller) retry reuse the warm sandbox instead of
                    # silently cold-starting.
                }:
                    self._reuse_via = None
                raise
        if "job_id" not in r:
            raise RuntimeError(r.get("message") or "submit cancelled")
        job = _OperonComputeJob(
            self._provider, r["job_id"], r.get("remote_workdir"),
        )
        job._concurrency = r.get("concurrency")
        conc = r.get("concurrency") or {}
        if conc.get("limit") is not None:
            print(
                f"[concurrency] live={conc.get('live')}/{conc.get('limit')}"
            )
        self._jobs.append(job)
        self._reuse_via = r["job_id"]
        # Host-attached info line (container timeout filled from the
        # Settings default, reuse fell back to a fresh sandbox, \u2026) \u2014 print
        # it so the disclosure actually reaches the transcript instead of
        # dying inside the return dict.
        note = r.get("system_note")
        if note:
            print(f"[note] {note}")
        # byoc: echo the sandbox's birth egress posture so the agent knows
        # what this job can reach before any output exists. The job keeps
        # this posture for its whole life \u2014 a Settings change only affects
        # sandboxes created after it.
        job.egress = r.get("egress")
        if job.egress:
            print(f"[egress] sandbox egress at creation: {job.egress}")
        # Print the recovery handle so it survives in the transcript even if a
        # later line in this cell raises before the agent prints it.
        print(job)
        return job

    def call_command(self, command, *, intent, login_shell=False,
                     timeout_seconds=60):
        """One synchronous command on the host (60s, 64KB cap). Approval-gated.

        For introspection \u2014 not job dispatch (use .submit_job()). Set
        login_shell=True when you need module/conda on PATH.
        Returns {stdout, stderr, exit_code}.
        """
        return _compute_call(
            "ssh",
            {"provider": self._provider, "command": command, "intent": intent,
             "login_shell": login_shell, "timeout_seconds": timeout_seconds},
        )

    def download(self, remote, local=None):
        """Copy one file from the host to your workspace. \`\`remote\`\` is ANY
        readable absolute path on the host \u2014 not restricted to job outputs
        or scratch. Paths inside scratch_root/data_roots transfer silently;
        any other path raises an approval card the user clicks Allow/Deny on
        (and may remember for the directory). When asked for a host file,
        call this directly with the path they gave \u2014 the approval card is the
        authorization gate, don't refuse on their behalf and don't \`\`cp\`\`
        into scratch first to dodge it. Dotfiles (\`\`~/.ssh/*\`\`,
        \`\`.gitconfig\`\`, \`\`.env\`\`, \u2026) get a hardened per-file confirmation.
        local=None saves as the basename. The poller already harvests the
        workdir into output_files before the compute_done notification fires
        \u2014 so this is for what the harvest globs missed, a left_on_remote
        file, or a host file outside the workdir. Slow; chain via
        inputs:[{remote_path: uri}] when the next job needs it instead."""
        return _compute_call(
            "scp",
            {"provider": self._provider, "direction": "down",
             "remote": remote, "local": local},
        )

    def upload(self, local, remote):
        """Copy one workspace file to the host's scratch tree (256MB cap).
        Path-jailed at both ends. For job inputs, DON'T upload first \u2014
        submit_job(inputs=[{src: 'file', dst_filename: ...}]) stages for
        you. This is for one-off placement (config you're not submitting,
        seeding a shared dir)."""
        return _compute_call(
            "scp",
            {"provider": self._provider, "direction": "up",
             "local": _relativize_local(local), "remote": remote},
        )

    def close(self):
        """Terminate this handle's container (byoc) and cancel any
        still-running jobs, then remove their workdirs (ssh). Every handle
        ends with close() \u2014 after its last job, not between jobs being
        chained warm (or that the user asked to keep warm), and not while
        a result says the container holds the only copy of the outputs
        (harvest_failed / result_rejected \u2014 recover those first). For byoc
        the container bills until close(), ~30 min of idle (the sandbox's
        idle watchdog), or the container timeout \u2014 whichever comes first,
        even after a failed job. Close once compute_done has arrived, the
        harvest is confirmed, and you've saved anything the globs missed
        (.download() on ssh \u2014 scp is SSH-only; on byoc read it off the
        sandbox from a compute_provider cell: modal.Sandbox.list(
        app_id=app.app_id, tags={'claude-science-job': job_id})
        finds the container \u2014 the tag names the job whose submit
        cold-started it \u2014 then sb.exec('cat', path))."""
        self._reuse_via = None
        return _compute_call(
            "close",
            {"provider": self._provider,
             "job_ids": [j._job_id for j in self._jobs]},
        )

    def attach_job(self, job_id):
        """Recover a job submitted in an earlier cell. Tracked by this
        instance so .close() cleans it up too; subsequent submit_job()
        reuses its container."""
        job = _OperonComputeJob(self._provider, job_id)
        self._jobs.append(job)
        self._reuse_via = job_id
        return job


class _ComputeNamespace:
    """Remote compute dispatch \u2014 host.compute.create(target) -> Compute.

    Runs via the \`repl\` tool only. Lifecycle: prepare input files in a
    \`python\` cell -> switch to the \`repl\` tool -> c =
    host.compute.create("<provider>") (e.g. "ssh:myhost", "byoc:modal";
    discover targets with the \`list_compute\` / \`compute_details\` tools) ->
    c.submit_job(command=..., intent=..., inputs=[{src, dst_filename}, ...])
    or c.call_command(cmd, intent=...). submit_job is keyword-only and
    \`command\` (the job script) is required; \`inputs\` entries are dicts \u2014
    {src: <workspace-relative path or {{artifact:ID}}>, dst_filename},
    {version_id, dst_filename}, or {remote_path, dst_filename}. Jobs run
    remotely; the cell returns immediately and the daemon posts a
    \`compute_done\` notification when outputs are harvested into your
    workspace (wait_for_notification collects it). help(host.compute.create)
    and the provider's remote-compute skill document the full parameter
    surface.
    """

    @staticmethod
    def create(provider, provider_params=None):
        """Create a Compute handle for a registered provider target.

        provider \u2014 target string, e.g. "ssh:<alias>" or "byoc:modal".
        provider_params \u2014 optional provider-specific dict (image, gpu,
        volumes, ...). Returns a Compute instance with submit_job /
        call_command / download / upload / attach_job methods \u2014
        submit_job returns a Job whose \`.status\` property tracks the run;
        help(<instance>.submit_job) for the job-spec fields.
        """
        return _OperonComputeInstance(provider, provider_params)

    @staticmethod
    def set_concurrency_limit(max_concurrent):
        """Cap LIVE compute jobs across this whole session (the frame tree
        rooted at the orchestrator). Any frame may LOWER it; only the
        orchestrator (root frame) may RAISE it. Sub-agents inherit
        automatically. Submits past the cap are refused with
        \`\`error_kind="session_concurrency_full"\`\`; \`\`submit_job\`\` retries
        with jittered backoff by default (\`\`on_full="wait"\`\`). Last call
        wins within those bounds."""
        return _compute_call(
            "set_concurrency", {"max_concurrent": int(max_concurrent)}
        )

    @staticmethod
    def status():
        """{live, limit, daemon_live, provider_caps} for this session's
        root. \`limit\` is None when no cap is set. \`provider_caps\` is each
        enabled provider's own max-concurrent ceiling \u2014 submits past a
        provider's cap refuse with their own error_kind (not retried by
        on_full)."""
        return _compute_call("status", {})

    def __repr__(self):
        return (
            "<host.compute \u2014 create(target) -> Compute; "
            "set_concurrency_limit(n); status(); "
            "help(host.compute) for the lifecycle>"
        )


host.compute = _ComputeNamespace()  # noqa: F821 (host defined in base.py)
`,Od_=`# Claude Science SDK fragment: credentials (universal \u2014 any agent with a kernel).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER
# base in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are
# already bound.
#
# Host-call handlers: hostCalls.ts case "credentials_list" / "credentials_get"
# \u2192 UserSecretRepository. Return values are already covered by the output
# scrubber (getAllDecrypted populates scrubValues for every credential), and
# both methods are in DERIVABLE_HOST_CALLS so data is never persisted to
# host_call_log.


class _CredentialsAccessor:
    """host.credentials \u2014 list and fetch user-configured credentials by name.

    The primary credential for each provider is also exported as environment
    variables (AWS_ACCESS_KEY_ID, GOOGLE_APPLICATION_CREDENTIALS, etc.). This
    accessor reaches non-primary credentials and credential types that don't
    map cleanly onto environment variables \u2014 e.g. a GCS HMAC key alongside a
    GCP service account, or a second AWS profile.

        for c in host.credentials.list():
            print(c["name"], c["provider"], c["credential_type"])

        # GCS HMAC via the S3-compatible XML API. Use virtual-hosted
        # addressing so requests go to <bucket>.storage.googleapis.com \u2014
        # the sandbox egress denylist always blocks the path-style
        # storage.googleapis.com host (any-bucket front door), but the
        # bucket-qualified hostname can be allowed via
        # request_network_access("mybucket.storage.googleapis.com").
        # Bucket-less account-level calls (e.g. s3.list_buckets()) hit the
        # bare host and are always blocked \u2014 get bucket names from the
        # \`buckets\` field in host.credentials.list() instead.
        from botocore.config import Config
        hmac = host.credentials.get("GCS HMAC")
        s3 = boto3.client(
            "s3",
            endpoint_url="https://storage.googleapis.com",
            config=Config(s3={"addressing_style": "virtual"}),
            aws_access_key_id=hmac["access_key_id"],
            aws_secret_access_key=hmac["secret_access_key"],
        )

        # Google Cloud service account \u2014 service_account_json is a dict:
        from google.oauth2 import service_account
        sa = host.credentials.get("Google Cloud")["service_account_json"]
        creds = service_account.Credentials.from_service_account_info(sa)
        # (do not set GOOGLE_APPLICATION_CREDENTIALS \u2014 it's reset to the
        # primary SA before each cell)

        # Azure service principal \u2014 for a non-primary profile:
        from azure.identity import ClientSecretCredential
        az = host.credentials.get("Azure Staging")
        creds = ClientSecretCredential(
            tenant_id=az["tenant_id"],
            client_id=az["client_id"],
            client_secret=az["client_secret"],
        )
    """

    def list(self):
        """Return metadata for every configured credential.

        Each entry is {name, provider, credential_type, is_primary, buckets,
        region}. No secret values \u2014 use .get(name) for those.
        """
        return _host_call("credentials_list", [])  # noqa: F821

    def get(self, name):
        """Return the full decrypted fields for the named credential.

        Field set varies by provider / credential_type \u2014 e.g. AWS and GCS
        HMAC return {access_key_id, secret_access_key}, a GCP service
        account returns {service_account_json} (a dict \u2014 pass it to
        google.oauth2.service_account.Credentials.from_service_account_info),
        github returns {token}, and a generic secret returns {value}. The
        {name, provider, credential_type, buckets, region} metadata is
        always included.

        Raises if the name isn't found. Values are redacted from cell
        output \u2014 pass them directly to client libraries rather than
        printing.
        """
        if not isinstance(name, str):
            raise TypeError(
                f"host.credentials.get: name must be a str, got "
                f"{type(name).__name__}"
            )
        if not name:
            raise ValueError(
                "host.credentials.get: name must be a non-empty str"
            )
        return _host_call("credentials_get", [name])  # noqa: F821

    def __repr__(self):
        try:
            names = [c["name"] for c in self.list()]
        except Exception:
            return "<host.credentials>"
        return f"<host.credentials \u2014 {len(names)} configured: {names!r}>"


host.credentials = _CredentialsAccessor()
`,RaO=`# \u2500\u2500 host.exec_peek / host.exec_interrupt \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Introspect and control a backgrounded local_exec cell (async local_exec
# interrupt path \u2014 a \`python\`/\`bash\`/\`r\` tool call that was interrupted by a
# user/parent message and is finishing in the background). The \`exec_id\` is
# in the \`{status:"running", exec_id}\` placeholder tool_result.


def _op_exec_peek(exec_id):
    """Return accumulated stdout for a backgrounded cell without waiting.

    Returns {status: "running"|"done", stdout, stderr, exit_code, error,
    elapsed_s, tool_name}. When status=="done" the full scrubbed result is
    included (equivalent to what wait_for_notification will deliver);
    \`error\` is the handler's error message if it failed (None otherwise).
    While running, stdout is the live (scrubbed) stream so far;
    stderr/exit_code/error are empty/None.

    If exec_id is unknown (already drained, daemon restarted, or stale),
    returns a bare {error: "No background execution with exec_id ..."}
    with NO \`status\` key \u2014 check for \`status\` presence before indexing.
    """
    return _host_call("exec_peek", [exec_id])  # noqa: F821


def _op_exec_interrupt(exec_id):
    """Stop the backgrounded cell.

    python/r/compute_provider: SIGINT the kernel \u2014 raises KeyboardInterrupt
    in user code. The kernel process survives (DataFrames, provider_params,
    handles in the namespace stay intact). One-shot per cell: if the cell's
    own code catches KeyboardInterrupt and continues, a second call is a
    no-op (the SIGINT is swallowed outside the interrupt bracket).

    bash/manage_*: SIGTERM the subprocess group (SIGKILL after 2s grace).
    The process tree is terminated; partial stdout/stderr captured so far
    is returned with a non-zero exit code.

    Caveat: manage_environments/manage_packages may return
    {interrupted: False, reason: "not interruptible (no signal-observing
    subprocess; will run to completion)"} \u2014 either because the backend is
    conda (CondaExecutor does not yet thread the abort signal) or because
    the interrupt arrived before a signal-observing subprocess was reached
    (pre-dispatch metadata read, or mode=register paths that never spawn
    one). The final result still arrives via wait_for_notification like a
    normal completion.

    Except for the caveat above, the cell's execute() resolves with partial
    output, delivered via wait_for_notification like a normal completion.
    Returns {interrupted: bool, via?: "sigint"|"sigterm", reason?: str}.
    """
    return _host_call("exec_interrupt", [exec_id])  # noqa: F821


host.exec_peek = _op_exec_peek  # noqa: F821
host.exec_interrupt = _op_exec_interrupt  # noqa: F821
`,DaO=`# Claude Science SDK fragment: frames (repl-kernel only \u2014 concatenated by
# buildOperonSdkCode, not buildAnalysisSdkCode; list_frames/query_db are
# in OPERON_PERMIT not ANALYSIS_PERMIT).
#
# Attaches onto the \`host\` object installed by sdk/base.py.
#
# Executes via the \`repl\` tool (control-plane kernel). Stdlib-only
# (no pandas/numpy/third-party packages). Shares cwd with the python/R kernels
# but not memory \u2014 persist to ./handoff/*.json to cross.
#
# Host-call handler: hostCalls.ts case "list_frames" \u2192 hostCallFrames.ts

_OP_FRAMES_VALID_STATUS = frozenset({
    "processing", "completed", "failed", "cancelled",
    "awaiting_user_response", "awaiting_plan_approval",
})


def _op_frames(
    frame_id=None,
    pattern=None,
    project_id=None,
    status=None,
    roots_only=True,
    has_task=False,
    after=None,
    before=None,
    max_results=None,
    offset=0,
    include_tool_results=True,
):
    """Browse, search, or detail frames \u2014 three modes, one call.

    Mode is inferred from args:
        frame_id set  \u2192 detail: full message history for one frame
                        (short-prefix match OK). Pair with pattern to
                        regex-filter the returned messages.
        pattern set   \u2192 search: regex over name/task_summary/message
                        content. Returns matches with context snippets.
        neither       \u2192 browse: metadata list with artifact counts.

    Filters compose across modes \u2014 host.frames(pattern="error",
    status="failed") greps only failed frames.

    Browse return: {"mode": "browse", "count", "scope", "frames": [
        {id, root_frame_id, parent_frame_id, name, status, agent_name,
         task_summary, project_id, artifact_count, created_at, ...}
    ]}

    Search return: {"mode": "search", "pattern", "matches": [
        {frame_id, agent_name, status, project_id, snippets: [...], ...}
    ], "total_matches", "searched_frames"} \u2014 with project_id="all",
        also "projects_searched".

    Detail return: {"mode": "detail", "frame_id", "name", "agent_name",
        "status", "project_id", "input", "created_at", "messages": [...],
        "total_messages"}
        \u2014 set include_tool_results=False to omit tool_result blocks from
        messages for a compact trace. Paginates: on truncated=True, re-call
        with offset += len(messages). max_results default 50, cap 500.
        ALWAYS check truncated \u2014 messages are returned oldest-first, so the
        newest activity (e.g. [delegate] frame_id= dispatch lines you're
        grepping for) lives on the LAST page; a first-page regex that finds
        nothing means "page further", not "not there".

    before/after compare against UTC; a bare date means midnight UTC at the
    start of that day, so before='2026-04-02' excludes April 2nd \u2014 use the
    day after your cutoff or a full datetime.

    Project scope: defaults to the current project. All the user's
    projects are reachable \u2014 pass project_id="proj_X" to browse/search
    one, project_id="all" to span every project, or a frame_id from any
    project (it resolves directly, no flag needed). Every row carries
    project_id so you can see where it came from. "all" mode scans a
    newest-first window, not unbounded history: if the response carries
    candidates_truncated=True, older frames were never enumerated \u2014 narrow
    with before/after or per-project calls instead of trusting an empty
    result as "doesn't exist anywhere". Likewise regex_truncated=True /
    regex_skipped=N means the regex budget fired mid-scan and results are
    partial \u2014 narrow the pattern or scope before trusting "not present".

    Examples:
        host.frames()                             # all sessions (this project)
        host.frames(status="processing")          # what's running
        host.frames(has_task=True)                # delegated benches
        host.frames(pattern="BRCA1")              # grep content
        host.frames(pattern="BRCA1", project_id="all")  # grep every project
        host.frames(frame_id="abc12345")          # full transcript (any project)
        df = pd.DataFrame(host.frames()["frames"])  # straight to pandas
    """
    # Client-side guards \u2014 fail fast before the host round-trip.
    # M8: frame_id="" would fall through to browse mode (neither frame_id
    # nor pattern set \u2192 browse) \u2014 almost certainly a bug at the call site.
    if frame_id is not None and (not isinstance(frame_id, str) or not frame_id):
        raise TypeError(
            f"host.frames: frame_id must be a non-empty str, got {frame_id!r}"
        )
    # I1: pattern must be a regex str.
    if pattern is not None and not isinstance(pattern, str):
        raise TypeError(
            f"host.frames: pattern must be a str or None, got "
            f"{type(pattern).__name__}"
        )
    # C5/I4: the host silently returns empty on a status typo. Validate the
    # enum client-side so "completeed" raises instead of returning [].
    if status is not None:
        if not isinstance(status, str):
            raise TypeError(
                f"host.frames: status must be a str, got {type(status).__name__}"
            )
        if status not in _OP_FRAMES_VALID_STATUS:
            raise ValueError(
                f"host.frames: status={status!r} is not valid. "
                f"Must be one of: {sorted(_OP_FRAMES_VALID_STATUS)}"
            )
    # C2: max_results=-1 \u2192 JS .slice(0,-1) drops the last row; True \u2192 1.
    if max_results is not None and (
        not isinstance(max_results, int) or isinstance(max_results, bool)
        or max_results < 1
    ):
        raise TypeError(
            f"host.frames: max_results must be a positive int or None, "
            f"got {max_results!r}"
        )
    if offset is not None and (
        not isinstance(offset, int) or isinstance(offset, bool) or offset < 0
    ):
        raise TypeError(
            f"host.frames: offset must be a non-negative int or None, "
            f"got {offset!r}"
        )
    # C4: roots_only='no' truthy-coerces to True on the host (opposite of
    # intent). Require actual bool.
    for _name, _val in (("roots_only", roots_only), ("has_task", has_task),
                        ("include_tool_results", include_tool_results)):
        if _val is not None and not isinstance(_val, bool):
            raise TypeError(
                f"host.frames: {_name} must be a bool, got "
                f"{type(_val).__name__}"
            )
    return _host_call(
        "list_frames",
        [{
            "frame_id": frame_id,
            "pattern": pattern,
            "project_id": project_id,
            "status": status,
            "roots_only": roots_only,
            "has_task": has_task,
            "after": after,
            "before": before,
            "max_results": max_results,
            "offset": offset,
            "include_tool_results": include_tool_results,
        }],
    )


host.frames = _op_frames
# query_db/query_schema are in OPERON_PERMIT only \u2014 assign here (not in
# base.py __init__) so capabilities()["query"] is False in the analysis
# kernel. _QueryAccessor is defined in base.py (always loaded first).
host.query = _QueryAccessor()  # noqa: F821 (defined in base.py)
`,TaO=`# Claude Science SDK fragment: mcp (OPERON KERNEL ONLY).
#
# Attaches onto the \`host\` object installed by sdk/base.py.
#
# Host-call handler: hostCalls.ts case "mcp" \u2192 executeMcpTool via MCPPool
#
# Concatenated by buildOperonSdkCode() only \u2014 never buildAnalysisSdkCode().
# The repl kernel runs \`python -I -S\` (stdlib only, agent-authored cells),
# so it is the one kernel where third-party pip/conda code cannot execute;
# that makes it the only kernel with an MCP surface. Analysis kernels reach
# MCP data through workspace files: fetch here, write ./handoff/*.json, read
# it from the python/R kernel. Enforcement is host-side (OPERON_PERMIT) \u2014
# this fragment's absence from the analysis SDK is ergonomics, not security.
#
# REPL-native MCP invocation. The loop happens inside the kernel:
#     genes = ["APC", "CTNNB1", "AXIN1"]
#     hits = [host.mcp("bio", "civic_search_genes", entrez_symbol=g) for g in genes]
# One repl tool_use, N host round-trips inside it, one tool_result. The
# transcript sees the cell's stdout, not N tool_use blocks. A discrete
# per-call tool would put 2N context blocks in history that replay every
# subsequent turn \u2014 quadratic in N over the turn count.


import json as _op_mcp_json


def _op_mcp(server, method, /, **kwargs):
    """Call an MCP server method. Returns parsed JSON if the response is
    JSON, else the raw string.

    \`server\` and \`method\` are positional-only (PEP 570) so they can never
    collide with a tool's own parameters \u2014 e.g. bioRxiv's search_preprints
    takes a kwarg literally named \`server\` (biorxiv|medrxiv):
        host.mcp("bio", "search_preprints", server="medrxiv", recent_days=7)

    Server/method names and schemas are in the mcp-<server> skill docs \u2014
    load the skill first (via the \`skill\` tool) to see what's available.

    Args are validated against the server's schema on the host; a
    mismatch raises RuntimeError with the schema echoed back. Approval
    must be pre-granted \u2014 the kernel can't prompt mid-execution.

    Examples:
        r = host.mcp("bio", "search_trials",
                       condition="colorectal cancer", page_size=10)
        for t in r.get("items", []):
            print(t["nct_id"], t["title"])

        # Batch \u2014 this is why mcp lives in the REPL:
        hits = {g: host.mcp("bio", "clingen_gene_validity",
                              gene=g)
                for g in my_gene_list}
    """
    # Client-side guards \u2014 fail fast before the host round-trip. The host
    # also validates (hostCalls.ts case "mcp"), but a typo in the first
    # iteration of a 50-item loop should fail immediately, not after the
    # round-trip.
    if not isinstance(server, str) or not server:
        raise TypeError(
            f"host.mcp: server must be a non-empty str, got {server!r}"
        )
    if not isinstance(method, str) or not method:
        raise TypeError(
            f"host.mcp: method must be a non-empty str, got {method!r}"
        )
    raw = _host_call("mcp", [server, method, kwargs])
    # executeMcpTool unwraps to the server's raw response text. Most MCP
    # servers emit JSON \u2014 parse opportunistically so the caller gets a
    # dict/list to iterate without a manual json.loads() on every line of
    # a loop. Non-JSON text (rare; some servers return plain prose) passes
    # through unchanged.
    if isinstance(raw, str) and raw and raw[0] in "{[":
        try:
            return _op_mcp_json.loads(raw)
        except _op_mcp_json.JSONDecodeError:
            pass
    return raw


host.mcp = _op_mcp
`,haO=`"""Claude Science kernel SDK \u2014 managed model endpoints fragment.

Installs \`\`host.model_endpoints\`\`: the registration surface for LOCALLY
HOSTED model servers (containers \u2014 e.g. NVIDIA NIMs) whose lifecycle the
DAEMON owns. Register once; afterwards every
\`\`compute_provider\`\` cell against the endpoint just works \u2014 the daemon
probes readiness, swaps the resident model off the GPU when needed, runs
the approved start script, and only dispatches your cell when the model
answers its readiness route.

Runs after sdk/base.py \u2014 relies on _host_call and the \`host\` singleton
being already defined in the namespace. Repl (control-plane) kernel
only. Load the \`\`managed-model-endpoints\`\` skill for the full
mechanics (idempotent-start pattern, cache mounts, worked examples).
"""


class _ModelEndpointsAccessor:
    """host.model_endpoints \u2014 register daemon-managed local model servers.

    Flow (once per model)::

        port = host.model_endpoints.free_port()
        host.model_endpoints.register(
            name="my-model-service",         # container name = endpoint name
            url=f"http://127.0.0.1:{port}",
            credential="NVIDIA_API_KEY",     # NAME of a saved credential
            skill="my-model-runbook",        # the model's runbook skill
            start='''...opaque bash...''',   # idempotent: inspect -> start | run
            stop="docker stop my-model-service",
            live="/health/ready",            # from the model's runbook
        )

    register() ALWAYS raises a permission card showing both scripts
    verbatim plus the port, service dir, and credential NAME \u2014 unless the
    registration is byte-identical to one already approved (same bytes are
    silent forever). The daemon hands the scripts HOST_PORT, SERVICE_DIR,
    and the credential VALUE via process env; your kernel code never sees
    the value, and inference calls to the local endpoint need no auth
    header.
    """

    def free_port(self):
        """Allocate a RANDOM host port from the managed range (20000-29999).

        Draws randomly (not sequentially), skipping ports owned by other
        managed endpoints and ports currently bound on the machine. Use the
        result inside the \`\`url\`\` you pass to :meth:\`register\` \u2014 the port
        lives in the URL and doubles as the endpoint's mutex.

        Errors until the user enables "NVIDIA BioNeMo NIM" under
        Customize \u2192 Compute (Model endpoints section) \u2014 same gate as register().
        """
        r = _host_call("model_endpoints_free_port", [{}])  # noqa: F821
        return r["port"]

    def register(
        self,
        name,
        url,
        skill,
        start=None,
        stop=None,
        live=None,
        credential="NVIDIA_API_KEY",
    ):
        """Register a managed model endpoint (always carded; see class doc).

        Args:
            name: endpoint name, 1-64 chars [a-z0-9-]. Becomes the
                \`\`compute_provider\`\` provider id.
            url: LOCAL \u2014 \`\`http://127.0.0.1:<port>\`\`, the LITERAL IPv4
                loopback (\`\`localhost\`\` is rejected: rootless docker
                resolves it to ::1 while the container publishes on IPv4).
                REMOTE \u2014 \`\`https://<upstream>/<model-path>\`\`; the host must
                equal the configured upstream and the machine must be in
                URL/remote mode. Remote endpoints take NO start/stop/live
                (the daemon owns no lifecycle for them).
            skill: name of the skill documenting the model's native API.
            start: LOCAL ONLY \u2014 opaque bash. Must be IDEMPOTENT \u2014 the
                documented convention is \`\`docker inspect <name> && docker
                start || (docker login \u2026 && docker run -d \u2026)\`\`. Receives
                HOST_PORT, SERVICE_DIR, and the credential value in its env.
            stop: LOCAL ONLY \u2014 opaque bash; must exit 0 only when the
                server is actually stopped (the daemon verifies the port
                frees afterwards).
            live: LOCAL ONLY \u2014 the model's READINESS route (e.g.
                \`\`/v1/health/ready\`\`, from its runbook) \u2014 polled for 200;
                never a TCP ping.
            credential: NAME of a saved credential (Customize \u2192
                Credentials). Never a value. The daemon accepts only the
                family credential \`\`NVIDIA_API_KEY\`\`, which is the default \u2014
                leaving the argument alone just works. Any OTHER name (or an
                explicit \`\`credential=None\`\`) is rejected at registration.

        Returns {registered, changed, name, url, port, service_dir, note}
        for local; {registered, changed, name, url, hosted, note} for
        remote.

        Errors until the user connects "NVIDIA BioNeMo NIM" under
        Customize \u2192 Compute (Model endpoints section); ask them to connect
        it there if this raises the not-connected error.
        """
        for label, v in (("name", name), ("url", url), ("skill", skill)):
            if not isinstance(v, str) or not v.strip():
                raise TypeError(
                    f"host.model_endpoints.register: {label} must be a "
                    "non-empty str"
                )
        hosted = isinstance(url, str) and url.strip().lower().startswith(
            "https://"
        )
        if hosted:
            for label, v in (("start", start), ("stop", stop), ("live", live)):
                if v is not None:
                    raise TypeError(
                        "host.model_endpoints.register: remote endpoints "
                        f"(https url) take no \`{label}\` \u2014 the daemon owns "
                        "no lifecycle for them; omit start/stop/live"
                    )
        else:
            for label, v in (("start", start), ("stop", stop), ("live", live)):
                if not isinstance(v, str) or not v.strip():
                    raise TypeError(
                        f"host.model_endpoints.register: {label} must be a "
                        "non-empty str for a local endpoint"
                    )
        if credential is not None and (
            not isinstance(credential, str) or not credential.strip()
        ):
            raise TypeError(
                "host.model_endpoints.register: credential must be the NAME "
                "of a saved credential (a str), never a key value"
            )
        kw = {
            "name": name,
            "url": url,
            "skill": skill,
        }
        if not hosted:
            kw["start"] = start
            kw["stop"] = stop
            kw["live"] = live
        if credential is not None:
            kw["credential"] = credential
        return _host_call("model_endpoints_register", [kw])  # noqa: F821

    def __repr__(self):
        return "<host.model_endpoints \u2014 free_port() / register(...)>"


host.model_endpoints = _ModelEndpointsAccessor()
`,PaO=`# Claude Science SDK fragment: skills (repl-kernel only \u2014 see skills/customize).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER base
# in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are already
# bound in that namespace.
#
# Host-call handlers: hostCalls.ts cases "skill_list" / "skill_read" /
# "skill_edit" / "skill_publish" / "skill_delete"
#
# Executes via the \`repl\` tool (control-plane kernel). Shares cwd with the
# python/R kernels but not memory \u2014 persist to ./handoff/*.json to cross.


def _op_skills_require_str(method, pname, val):
    if not isinstance(val, str) or not val:
        raise TypeError(
            f"host.skills.{method}: {pname} must be a non-empty str, "
            f"got {val!r}"
        )


def _op_skills_call(method, host_method, payload):
    r = _host_call(host_method, [payload])  # noqa: F821 (defined in base.py)
    # Handlers return {error: "..."} for soft failures (not found, old_string
    # mismatch, publish collision). Surface as an exception unless the dict
    # also carries a success key the caller is expected to inspect.
    if isinstance(r, dict) and "error" in r and len(r) == 1:
        raise RuntimeError(f"host.skills.{method}: {r['error']}")
    return r


class _SkillList(list):
    """list of skill dicts, plus \`.note\` (str | None) from the handler.
    Keeps the bare-list iteration contract while the note rides along."""

    note = None


class _SkillsAccessor:
    """Skill authoring: list/read/edit draft skills, then publish. Load skill
    'customize' for usage."""

    def __repr__(self):
        return "<host.skills \u2014 load skill 'customize' for API docs>"

    def list(self):
        """Return all skills (bundled + custom + drafts) as a list of dicts.

        Each entry: {name, origin, description}. origin is one of
        "anthropic" (bundled, read-only), "organization"/"personal"
        (editable, republish with overwrite), "draft" (local,
        unpublished), or "unknown" (on-disk content whose provenance
        can't be verified \u2014 e.g. a cached copy of a skill no longer in
        your registry, an mcp-* leftover, or the registry is
        unreachable. Stamped cache orphans are editable and editing
        converts them to local drafts; mcp-* leftovers stay "unknown"
        even after editing). Directly iterable.
        """
        r = _op_skills_call("list", "skill_list", {})
        # Handler returns {"skills": [...], "total", "note"} \u2014 unwrap to a
        # list subclass so \`for s in host.skills.list()\` yields dicts
        # while the note rides along as an attribute.
        if isinstance(r, dict) and "skills" in r:
            out = _SkillList(r["skills"])
            out.note = r.get("note")
            return out
        return r

    def read(self, name, path="SKILL.md"):
        """Read a file from a skill's directory. Defaults to SKILL.md.

        Returns {name, origin, path, content, files?}. files (the
        skill's relative file paths) is present on SKILL.md reads (the
        default). origin is one of the list() values; "unknown" means
        provenance can't be verified \u2014 e.g. the registry is unreachable,
        or the content is a catalog miss that isn't a genuine local
        draft (a stamped cache orphan from an unpublished or
        org-switched skill, an mcp-* leftover dir, content not on local
        disk, or no skill cache root configured). Content may still be
        served.
        """
        _op_skills_require_str("read", "name", name)
        _op_skills_require_str("read", "path", path)
        return _op_skills_call(
            "read", "skill_read", {"name": name, "path": path},
        )

    def edit(self, name, path, content, old_string=None):
        """Write or edit a draft-skill file.

        old_string=None  \u2192 create \`path\` (or overwrite it) with \`content\`.
        old_string=str   \u2192 str_replace: swap the first exact match of
                           old_string for \`content\` in the existing file.

        When \`path\` is \`kernel.py\` or \`kernel.R\` and the gate probe can
        judge, the result carries \`sidecar_gate: {ok: bool, error?: str}\`
        \u2014 the SAME structural gate the load path runs. When the probe
        can't judge (interpreter unavailable, or the source doesn't parse
        under the host's interpreter \u2014 possible version drift vs. your
        env), the key is absent and \`note\` says why. Check \`sidecar_gate\`
        instead of loading the skill just to test the sidecar. publish()
        refuses only on a structural reject.
        """
        _op_skills_require_str("edit", "name", name)
        _op_skills_require_str("edit", "path", path)
        if not isinstance(content, str):
            raise TypeError(
                f"host.skills.edit: content must be a str, got "
                f"{type(content).__name__}"
            )
        if old_string is not None and not isinstance(old_string, str):
            raise TypeError(
                f"host.skills.edit: old_string must be a str or None, got "
                f"{type(old_string).__name__}"
            )
        return _op_skills_call(
            "edit", "skill_edit",
            {"name": name, "path": path,
             "old_string": old_string or "",
             "new_string": content},
        )

    def publish(self, name, overwrite=False):
        """Promote a draft skill to the live skill set so agents can load it.

        publish takes NO content args \u2014 write SKILL.md (and any other
        files) via host.skills.edit(name, "SKILL.md", content) FIRST,
        then call publish(name). Set overwrite=True to replace an
        existing published skill of the same name."""
        _op_skills_require_str("publish", "name", name)
        if not isinstance(overwrite, bool):
            raise TypeError(
                f"host.skills.publish: overwrite must be a bool, got "
                f"{type(overwrite).__name__}"
            )
        return _op_skills_call(
            "publish", "skill_publish",
            {"name": name, "overwrite": overwrite},
        )

    def delete(self, name):
        """Delete a skill. Drafts: removes the local {name}/ directory.
        Published org/personal skills: unpublishes from the registry AND
        removes the local cache. Anthropic bundled skills are protected."""
        _op_skills_require_str("delete", "name", name)
        return _op_skills_call("delete", "skill_delete", {"name": name})


host.skills = _SkillsAccessor()  # noqa: F821 (host defined in base.py)
`,baO=`# Claude Science SDK fragment: structured-output submission (repl control-plane kernel).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Always
# defined in the repl kernel \u2014 frames without an output_schema get a
# clear host-side error instead of a missing symbol (same anti-stale-
# kernel rationale as host.children / host.compute).
#
# Host-call handler: hostCalls.ts case "submit_output" \u2192
# ToolRouter.handleSubmitOutputHostCall.


def _op_submit_output(output, completion_bullets):
    """Submit your structured output for this task \u2014 REQUIRED before
    completing when your task carries an OUTPUT SCHEMA section.

    Build \`\`output\`\` as a plain dict in THIS kernel and submit it here \u2014
    the payload goes over the kernel wire, never through your own prose,
    so large values cost nothing to submit or to fix. If validation (or a
    reviewer) bounces it, mutate the dict in memory and call this again \u2014
    resubmitting replaces the recorded output::

        out = {"summary": text, "count": n}
        r = host.submit_output(out, completion_bullets=["Counted N items"])
        if r.get("error"):
            out["count"] = int(out["count"])     # fix in memory
            r = host.submit_output(out, completion_bullets=["Counted N items"])

    \`\`output\`\` must match the JSON schema in the OUTPUT SCHEMA section of
    your task message exactly (fields at top level). Keep payloads
    compact \u2014 save large tables/blobs as artifacts and reference them by
    version id in the schema fields. Data prepared in the \`\`python\`\`
    kernel crosses via a file (the kernels share cwd, not memory):
    \`\`json.dump(out, open("handoff.json", "w"))\`\` there, then
    \`\`json.load(open("handoff.json"))\`\` here.

    \`\`completion_bullets\`\` is a REQUIRED list of 1-4 short past-tense
    action phrases (5-7 words, verb first, no 'and') shown to the human \u2014
    e.g. \`\`["Computed square root of 144"]\`\`. It rides alongside the
    schema fields, not inside them.

    Returns the host's result dict: on success \`\`{"status": "success",
    ...}\`\` with the RECORDED payload echoed back \u2014 verify every value
    (numeric magnitudes, exponents, units) is exactly what you intended;
    on validation failure \`\`{"error": ...}\`\` naming the failing fields.
    A submission may be held for review \u2014 if the reviewer raises blocking
    findings you'll be asked to address them and submit again.
    """
    if not isinstance(output, dict):
        raise TypeError(
            f"host.submit_output: output must be a dict matching your "
            f"task's OUTPUT SCHEMA, got {type(output).__name__}"
        )
    if isinstance(completion_bullets, str):
        completion_bullets = [completion_bullets]
    if (not isinstance(completion_bullets, (list, tuple))
            or not completion_bullets
            or not all(isinstance(b, str) and b.strip()
                       for b in completion_bullets)):
        raise TypeError(
            "host.submit_output: completion_bullets must be a non-empty "
            "list of short past-tense strings (e.g. ['Computed square "
            "root of 144'])"
        )
    r = _host_call(
        "submit_output",
        [{"output": output, "completion_bullets": list(completion_bullets)}],
    )
    return r


host.submit_output = _op_submit_output
`,faO=`# Claude Science SDK fragment: supervision (gated on enable_subtask_delegation).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Only sent to
# agents that can spawn children \u2014 ungated agents get AttributeError on
# host.children() instead of a host round-trip.
#
# Executes via the \`repl\` tool (control-plane kernel). Stdlib-only
# (no pandas/numpy/third-party packages). Shares cwd with the python/R kernels
# but not memory \u2014 persist to ./handoff/*.json to cross.
#
# Host-call handler: hostCalls.ts case "list_running_children".
#
# child_trace() was removed \u2014 it was redundant with host.frames(frame_id=X)
# which returns the full message trace for any frame. Any include_thinking /
# max_messages filtering can be done in-kernel on the returned message list.


def _op_children():
    """List running child frames spawned by this frame.

    Returns {"running_children": [...], "count": N} where each entry is
    {frame_id, name?, agent_name, status, task, started_at} \u2014 "name" is
    the label you passed to delegate(name=...); "agent_name" is the
    child's PROFILE id, so identify children by "name".
    Only children with status in ("processing", "awaiting_user_response")
    \u2014 completed/failed children don't appear. A child in
    "awaiting_user_response" is PARKED on an approval/input card and
    makes no progress until the card is resolved \u2014 blocked, not slow.

    Data stays in-kernel: iterate, filter by agent_name, join against
    host.query results. No JSON dumped into context.

    For the bare list: host.children()["running_children"]

    For the full message trace of a child frame, use
    host.frames(frame_id=child_id) \u2014 it returns the complete conversation.
    """
    return _host_call("list_running_children", [])


# Fields accepted by host.delegate() request dicts \u2014 matches the \`delegate\`
# brain tool's input_schema minus \`track\` (plan-track linkage is an agent-loop
# concept, not a kernel-script one).
_DELEGATE_FIELDS = frozenset(
    ("task", "name", "context_summary", "profile", "output_schema", "model")
)


def _emit_child_frame_ids(results):
    """Echo every spawned child's frame id to cell stdout \u2014 ALWAYS, not
    only when the script prints the handle (owner ruling, #2882 final
    round). The line is machine-greppable and lands at the HEAD of the
    cell's output stream relative to later payload prints (tool-result
    truncation keeps the head \u2014 truncateResultSplit slices [0:max]), so a
    fresh kernel that lost its namespace can recover steerable ids from
    the transcript: host.stop_child / host.send_message / collect.
    """
    try:
        rs = results if isinstance(results, list) else [results]
        for r in rs:
            if isinstance(r, dict) and isinstance(r.get("frame_id"), str):
                nm = r.get("name") or r.get("agent_name")
                label = f" {nm}" if isinstance(nm, str) and nm else ""
                print(
                    f"[delegate] child{label} frame_id={r['frame_id']} "
                    f"(steer: host.send_message/host.stop_child; "
                    f"retrieve: host.collect)",
                    flush=True,
                )
    except Exception:
        pass  # emission must never break the dispatch result path


def _op_delegate(request=None, task=None, name=None, context_summary=None,
                 profile=None, output_schema=None, model=None, timeout=None, wait=True,
                 **_removed_kwargs):
    """Spawn a child agent, wait for it to finish, return its result.

    Blocking by default \u2014 the call returns when the
    child completes, so you can loop over inputs and act on each result
    without a \`\`wait_for_notification\`\` round-trip. Each call spawns a real
    child frame (own context, kernel, workspace); depth increments and is
    bounded host-side.

    The call BLOCKS the cell until the children finish. For long-running
    children, run it in a background cell so you keep control of the
    session while they work. Two different "interrupts" behave differently:
    an incoming USER MESSAGE mid-call backgrounds the call (children keep
    running; the result arrives when they finish), while an explicit
    Stop / cell interrupt CANCELS the children of a BLOCKING call.
    \`\`wait=False\`\` children and children past a \`\`timeout=\`\` deadline are
    decoupled from this cell's interrupt \u2014 they keep running; stop those
    with \`\`host.stop_child()\`\` (batch form).

    One surface, three input shapes \u2014 return type mirrors the input::

        r = host.delegate("Summarize artifact {{artifact:VID}}.")
        print(r.get("response") or r.get("error"))

        r = host.delegate(task="Classify this abstract: ...",
                            output_schema={"type": "object",
                                           "properties": {"label": {"type": "string"}},
                                           "required": ["label"]})
        print(r.get("structured_output", {}).get("label") or r.get("response"))

        schema = {"type": "object",
                  "properties": {"summary": {"type": "string"}},
                  "required": ["summary"]}
        results = host.delegate(
            [{"task": f"Process gene {g}", "name": g,
              "output_schema": schema} for g in genes],
        )
        for r in results:
            if r.get("error"):
                print(r.get("frame_id"), "failed:", r["error"])
            elif r.get("structured_output_unsatisfied"):
                print(r.get("frame_id"), "no structured output:", r.get("response"))
            else:
                print(r["structured_output"]["summary"])

    Each request (dict form) accepts:
        task            \u2014 str; what the child should do (required)
        name            \u2014 short UI label for the child (1-2 words)
        context_summary \u2014 background the child needs (it sees only this +
                          task, never your conversation). Reference artifact
                          version ids for data: \`\`{{artifact:VID}}\`\` markers
                          in the task resolve to readable paths child-side.
        profile         \u2014 run the child as a different agent profile. Omit
                          to inherit your own. Invalid names return an
                          \`\`{"error": ...}\`\` listing valid choices.
        output_schema   \u2014 JSON Schema. When set, the child must call
                          host.submit_output() matching it; you get back
                          \`\`structured_output\`\` instead of prose. Keep
                          payloads compact \u2014 large tables should be saved
                          as artifacts and referenced by id in the schema.
        model           \u2014 model id the child runs on (e.g. a haiku-class
                          id for cheap fan-outs). Free text, forwarded
                          as-is (same stance as host.llm \u2014 no client
                          allowlist); an unknown id fails the child on
                          its first LLM call and that slot returns
                          \`\`{"error": ...}\`\`. Omit to inherit the normal
                          chain (session subagent model \u2192 tier policy \u2192
                          parent's model). Per-request in list form \u2014
                          each child can run a different model.

    Every dispatch also echoes one line per spawned child to the cell's
    stdout \u2014 \`\`[delegate] child <name> frame_id=<uuid> (steer: ...)\`\` \u2014
    so the ids survive in the transcript even if you never print the
    returned handles (a fresh kernel can grep them to steer/collect).

    Returns per request:
        {"frame_id"?, "name"?, "status", "response"?, "structured_output"?,
         "structured_output_unsatisfied"?, "artifacts_created"?, "error"?}
    \`\`name\`\` echoes the label you passed (\`\`agent_name\`\`, where present,
    is the child's PROFILE id \u2014 identify children by \`\`name\`\`).
    \`\`status\`\` is "completed" / "failed" / "cancelled" for settled slots.
    With \`\`wait=False\`\` every slot returns a \`\`{"frame_id", "status":
    "running", "dispatched": True, "child_status"?}\`\` descriptor instead;
    with \`\`timeout=\`\` slots still running at the deadline return the same
    "running" descriptor (no \`\`dispatched\`\` flag) \u2014 both are completed
    later via \`\`host.collect()\`\`, never by this call. \`\`frame_id\`\` is
    absent when the request fails before a child frame is created (invalid
    profile, empty task, unresolvable \`\`{{artifact:VID}}\`\` marker in task,
    or cancelled while queued).
    \`\`structured_output_unsatisfied\`\` is True when the child completed
    without calling host.submit_output() despite an \`\`output_schema\`\` \u2014 \`\`response\`\`
    then carries its prose answer instead of \`\`structured_output\`\`.
    LARGE OUTPUTS: don't ask a child to return big payloads (>~10 KB) as
    prose \u2014 a 50 KB final response is many minutes of raw token
    generation and looks like a hang. Have the child write an artifact
    and return the version_id (or use \`\`output_schema\`\` for compact
    structured results), and put a \`\`timeout=\`\` on the wait.
    Structural validation
    (wrong types, unknown fields) raises; a child that *runs* and then fails
    returns \`\`{"error": ..., "status": "failed"}\`\` for that slot without
    failing the batch. A child that parks on a question or approval
    (ask_user / request_*_access) STAYS PARKED: its card surfaces to the
    user in the session UI, and (in a BLOCKING call) this call resumes
    once the user acts and the child finishes. You cannot see or answer
    the question yourself \u2014 the user does \u2014 and a parked child waits
    indefinitely until they do (for a blocking call,
    an explicit Stop / cell interrupt cancels it; an incoming user
    message merely backgrounds the call \u2014
    \`\`wait=False\`\` / post-deadline children are decoupled and
    park unaffected; they show \`\`child_status: "awaiting_user_response"\`\`
    in descriptors and collect() results). Parked children don't affect
    their siblings in a list call.

    List form spawns ALL requests concurrently, up to a HARD cap of 48
    requests per call (checked upfront \u2014 an oversized list raises before
    any child spawns). For larger fan-outs, batch into waves: delegate 48,
    collect the results, then send the next wave. Below the cap there is
    no concurrency limit; global API backpressure is handled engine-side.
    The host-call wire is serial, so pass a list rather than calling
    \`\`delegate()\`\` in a Python loop when you want parallelism.

    There is also a CUMULATIVE cap for this conversation (default 1000
    spawns, checked upfront \u2014 a violating call spawns nothing) that does
    NOT reset on the user's next message. When you hit it, report results
    and stop. (ROUTINE sessions are the exception: the cap is per-TICK
    via \`\`routines.max_spawns_per_tick\`\` and refreshes each tick.) Before
    a large multi-wave fan-out, check \`\`host.delegation_stats()\`\` for
    remaining headroom and plan the waves to fit.

    \`\`timeout\`\` (seconds, default None = wait indefinitely): at the
    deadline the call RETURNS instead of blocking further \u2014 finished
    slots carry their normal result dicts; unfinished slots carry
    \`\`{"frame_id": ..., "status": "running", ...}\`\` descriptors (a child
    parked on user approval shows \`\`child_status:
    "awaiting_user_response"\`\`). Children are NOT cancelled at the
    deadline \u2014 they keep running host-side. Act on a running descriptor
    with \`\`host.send_message()\`\` / \`\`host.stop_child()\`\`, and retrieve
    its result with \`\`host.collect([frame_id, ...], timeout=...)\`\` \u2014
    collect is the ONLY way to get a timed-out child's result (it will
    not arrive via \`\`wait_for_notification\`\`).

    \`\`wait=False\`\` \u2014 async dispatch: the call returns as soon as every
    child is SPAWNED, with one \`\`{"frame_id": ..., "status": "running",
    "dispatched": True}\`\` descriptor per request. **Return shape mirrors
    the input exactly like the blocking form**: a single request (str or
    dict) returns ONE descriptor dict \u2014 \`\`delegate(req, wait=False)[0]\`\`
    is a \`\`KeyError: 0\`\` and the child is already spawned; pass a
    one-element list when you want a list back. The kernel is free
    immediately: dispatch a wave, keep computing, dispatch more. Results
    are retrieved EXCLUSIVELY with \`\`host.collect(frame_ids)\`\` \u2014 they
    never arrive via \`\`wait_for_notification\`\`. The canonical idle
    pattern: dispatch with \`\`wait=False\`\`, then run \`\`host.collect\`\`
    in a background cell (\`\`background: true\`\`) and end your turn \u2014 the
    collect CELL's completion wakes you with results already in kernel
    variables. collect is deadline-bounded (default 30s, max 1800s;
    \`\`timeout=None\`\` raises) so a backgrounded collect always self-frees
    \u2014 for multi-wave flows loop short collect timeouts; while one runs,
    new persistent repl cells are rejected, but steering stays
    available via \`\`host.stop_child()\`\` / \`\`host.send_message()\`\` in
    a \`\`fresh: true\`\` cell. wait=False
    children are decoupled from this cell's interrupt \u2014 stop a wave with
    \`\`host.stop_child([fid, ...])\`\` (batch form; accepts the
    descriptor dicts directly). Mutually exclusive with \`\`timeout=\`\`.

    Available only while this frame is within the daemon's delegation
    depth cap (a sub-agent may itself delegate one further level when
    the cap allows; at the cap the call raises) and only while the
    session's Delegation toggle (ultra mode) is on.
    """
    # Kwargs removed in #2586 are accepted and ignored so saved/re-executed
    # cells from before the removal keep working; anything else unknown is
    # a real error (typo safety).
    _unknown_kwargs = set(_removed_kwargs) - {"max_concurrency"}
    if _unknown_kwargs:
        raise TypeError(
            f"host.delegate: unknown keyword argument(s) "
            f"{sorted(_unknown_kwargs)!r}"
        )
    if timeout is not None:
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
            raise TypeError(
                f"host.delegate: timeout must be a positive number of "
                f"seconds or None, got {type(timeout).__name__}"
            )
        if timeout <= 0:
            raise ValueError(
                "host.delegate: timeout must be a positive number of seconds"
            )
    if not isinstance(wait, bool):
        raise TypeError(
            f"host.delegate: wait must be a bool, got {type(wait).__name__}"
        )
    if wait is False and timeout is not None:
        raise ValueError(
            "host.delegate: timeout= is meaningless with wait=False \u2014 "
            "use host.collect(frame_ids, timeout=...) to bound the "
            "re-await"
        )
    # Options ride as a second wire element only when set \u2014 older hosts
    # (and the host-side validator) accept the bare [requests] form.
    _opts = {}
    if timeout is not None:
        _opts["timeout"] = float(timeout)
    if wait is False:
        _opts["wait"] = False
    _wire_opts = [_opts] if _opts else []

    def _norm(r, where):
        if isinstance(r, str):
            if not r.strip():
                raise ValueError(
                    f"host.delegate: {where} task must be a non-empty str"
                )
            return {"task": r}
        if not isinstance(r, dict):
            raise TypeError(
                f"host.delegate: {where} must be a task str or a request "
                f"dict, got {type(r).__name__}"
            )
        unknown = set(r) - _DELEGATE_FIELDS
        if unknown:
            raise TypeError(
                f"host.delegate: {where} has unknown field(s) "
                f"{sorted(unknown)!r}; valid fields are "
                f"{sorted(_DELEGATE_FIELDS)!r}"
            )
        task = r.get("task")
        if not isinstance(task, str) or not task.strip():
            raise TypeError(
                f"host.delegate: {where} 'task' must be a non-empty str, "
                f"got {type(task).__name__}"
            )
        if (r.get("output_schema") is not None
                and not isinstance(r["output_schema"], dict)):
            raise TypeError(
                f"host.delegate: {where} 'output_schema' must be a dict "
                f"(JSON Schema) or None"
            )
        for fname in ("name", "context_summary", "profile", "model"):
            v = r.get(fname)
            if v is not None and not isinstance(v, str):
                raise TypeError(
                    f"host.delegate: {where} {fname!r} must be a str or "
                    f"None, got {type(v).__name__}"
                )
        # \uD83D\uDFE1 3375199109 (M4/M15 mirror for the delegation surface): both
        # delegator lanes coerce blank/whitespace model to undefined \u2014 the
        # pin would silently fall through to the inherited session model.
        # Reject loudly here, same posture as host.llm's model guard.
        # \\ufeff (\uD83D\uDFE1 3377128267): JS .trim() strips BOM, Python .strip()
        # does not \u2014 same loudness contract as the llm guards.
        mv = r.get("model")
        if mv is not None and not mv.replace("\\ufeff", "").strip():
            raise ValueError(
                f"host.delegate: {where} 'model' must be a non-empty str "
                f"or None, got {mv!r}"
            )
        return dict(r)

    if isinstance(request, (list, tuple)):
        if (task is not None or name is not None or context_summary is not None
                or profile is not None or output_schema is not None
                or model is not None):
            raise TypeError(
                "host.delegate: when passing a list of requests, put "
                "per-request options (name/context_summary/profile/"
                "output_schema/model) inside each request dict"
            )
        reqs = [_norm(r, f"requests[{i}]") for i, r in enumerate(request)]
        if not reqs:
            return []
        _results = _host_call("delegate", [reqs] + _wire_opts)
        _emit_child_frame_ids(_results)
        return _results

    if isinstance(request, dict):
        if (task is not None or name is not None or context_summary is not None
                or profile is not None or output_schema is not None
                or model is not None):
            raise TypeError(
                "host.delegate: pass options inside the request dict OR "
                "as keyword arguments, not both"
            )
        req = _norm(request, "request")
    elif isinstance(request, str) or request is None:
        req = {}
        if isinstance(request, str):
            if task is not None:
                raise TypeError(
                    "host.delegate: task given both positionally and as "
                    "a keyword"
                )
            req["task"] = request
        elif task is not None:
            req["task"] = task
        if name is not None:
            req["name"] = name
        if context_summary is not None:
            req["context_summary"] = context_summary
        if profile is not None:
            req["profile"] = profile
        if output_schema is not None:
            req["output_schema"] = output_schema
        if model is not None:
            req["model"] = model
        req = _norm(req, "request")
    else:
        raise TypeError(
            f"host.delegate: expected a task str, a request dict, or a "
            f"list of those; got {type(request).__name__}"
        )

    out = _host_call("delegate", [[req]] + _wire_opts)
    if not (isinstance(out, list) and out):
        raise RuntimeError(
            "host.delegate: host returned no result for single request"
        )
    _emit_child_frame_ids(out)
    return out[0]


def _op_delegation_stats():
    """Cumulative delegation budget: how many children this conversation
    has spawned.

    Returns \`\`{"spawned_this_task", "cap", "remaining"}\`\`. The counter
    covers every \`\`host.delegate()\`\` spawn in this conversation's
    lifetime and does NOT reset \u2014 the cap (\`\`remaining == 0\`\`) means:
    report results to the user. (ROUTINE sessions are the exception: the
    cap is per-TICK via \`\`routines.max_spawns_per_tick\`\` and refreshes
    each tick.) Check this BEFORE a large multi-wave fan-out and size the
    waves to fit \`\`remaining\`\`; a call that would exceed the cap raises
    without spawning anything.

    Spawn-count visibility only \u2014 no token/cost quotas are exposed here.
    Available wherever \`\`host.delegate()\`\` is (within the daemon's
    delegation depth cap).
    """
    return _host_call("delegation_stats", [])




def _coerce_child_ids(val, label):
    """str | descriptor/result dict | list of either (mixed) \u2192 list[str].

    Descriptor dicts are the handles \`\`host.delegate(wait=False)\`\` /
    \`\`timeout=\`\` return; plucks \`\`frame_id\`\` (or \`\`child_frame_id\`\`) so the
    natural \`\`collect(handles)\`\` / \`\`stop_child(handles)\`\` pattern works
    without manual id extraction.
    """
    def _one(x):
        if isinstance(x, str) and x:
            return x
        if isinstance(x, dict):
            fid = x.get("frame_id") or x.get("child_frame_id")
            if isinstance(fid, str) and fid:
                return fid
            raise TypeError(
                f"{label}: dict entry has no usable frame_id \u2014 pass the "
                f"descriptor/result dict from host.delegate() (it carries "
                f"frame_id), or the id string itself; got keys "
                f"{sorted(x.keys())!r}"
            )
        raise TypeError(
            f"{label}: each entry must be a frame-id str or a "
            f"descriptor/result dict carrying frame_id, got "
            f"{type(x).__name__}"
        )
    if isinstance(val, (list, tuple)):
        if not val:
            raise TypeError(f"{label}: list must be non-empty")
        return [_one(x) for x in val]
    return [_one(val)]


def _coerce_child_slots(val, label):
    """Lenient sibling of \`\`_coerce_child_ids\`\` \u2014 per-slot isolation.

    Returns \`\`(slots, had_list)\`\` where each slot is \`\`("ok", frame_id)\`\`
    or \`\`("bad", error_message)\`\`. A malformed entry (junk dict, wrong
    type) becomes a failed SLOT instead of aborting the whole batch \u2014 one
    bad handle in a cleanup/collect wave must not cost the other
    children's results (delegation chaos scorecard, 2026-06-09). Empty
    lists still raise: that is argument misuse, not a bad slot.
    """
    def _one(x):
        if isinstance(x, str) and x:
            return ("ok", x)
        if isinstance(x, dict):
            fid = x.get("frame_id") or x.get("child_frame_id")
            if isinstance(fid, str) and fid:
                return ("ok", fid)
            return ("bad", (
                f"{label}: dict entry has no usable frame_id \u2014 pass the "
                f"descriptor/result dict from host.delegate() (it "
                f"carries frame_id), or the id string itself; got keys "
                f"{sorted(x.keys())!r}"
            ))
        return ("bad", (
            f"{label}: each entry must be a frame-id str or a "
            f"descriptor/result dict carrying frame_id, got "
            f"{type(x).__name__}"
        ))
    if isinstance(val, (list, tuple)):
        if not val:
            raise TypeError(f"{label}: list must be non-empty")
        return [_one(x) for x in val], True
    return [_one(val)], False


def _op_stop_child(child_frame_id, reason=None):
    """Stop a running child agent \u2014 or a backgrounded execution.

    \`\`child_frame_id\`\` is a child frame id (from \`\`host.delegate()\`\`
    results, \`\`host.children()\`\`, or an earlier tool-lane delegation) OR
    the \`\`exec_id\`\` of a backgrounded execution (from
    \`\`wait_for_notification\`\`'s \`\`pending_work.executions\`\`).

    Accepts id strings OR the descriptor/result dicts \`\`host.delegate()\`\`
    returns (\`\`frame_id\`\` is plucked), mixed freely in the list form.

    Batch form: pass a LIST to stop a whole wave in one call
    (\`\`host.stop_child([fid1, handle2, ...])\`\`) \u2014 per-id isolation.
    **Return shape mirrors the input** (same rule as \`\`delegate\`\`/
    \`\`collect\`\`): a single id/handle returns ONE result dict; a list
    returns a LIST of result dicts in the same order. The
    remedy surface for \`\`wait=False\`\` dispatches, which are decoupled from
    the cell's interrupt.

    EXPECT NO OUTPUT from a stopped child: a child killed mid-work has
    usually produced nothing durable yet, so \`\`output_data\`\` is absent in
    the common case. Only output the child had ALREADY persisted before
    the stop (submitted structured_output, created artifacts, a finished
    response) comes back under \`\`output_data\`\` \u2014 stop is not a harvest
    mechanism; if partial results matter, have the child checkpoint to
    artifacts as it goes. Calling this on an already-completed/stopped
    CHILD FRAME is idempotent \u2014 you get its final \`\`output_data\`\` back
    instead of an error. EXEC IDS differ: a backgrounded execution that
    already settled returns \`\`{"status": "noop", "outcome":
    "already_finished" | "already_interrupted" | "already_cancelled",
    "message": ...}\`\` with NO \`\`output_data\`\` \u2014 \`\`already_finished\`\`
    means the result was already delivered as a durable \`\`cell_result\`\`
    notification row \u2014 consume it via \`\`wait_for_notification()\`\` (a
    \`\`[System]\`\` tail message appears only when the row write failed);
    don't re-run. \`\`already_interrupted\`\` means only partial output
    was delivered; \`\`already_cancelled\`\` means the exec was lost to a
    restart/force-stop and its results were NOT delivered \u2014 re-run the
    cell if the work still matters. Only your OWN children are
    reachable (parentage-checked host-side); unrelated frames return a
    not-found error. Failures NEVER raise: a bad id or malformed handle
    yields \`\`{"status": "failed", "error": ...}\`\` (per-slot in the list
    form) \u2014 same idiom as \`\`collect\`\` \u2014 so one typo cannot abort a
    cleanup wave.
    """
    if reason is not None and not isinstance(reason, str):
        raise TypeError(
            f"host.stop_child: reason must be a str or None, got "
            f"{type(reason).__name__}"
        )
    slots, was_list = _coerce_child_slots(child_frame_id, "host.stop_child")
    good = [fid for (tag, fid) in slots if tag == "ok"]
    if not was_list:
        # Single form. Operational failures (bad handle, not-found) come
        # back as a failed dict \u2014 collect's per-slot idiom \u2014 so a typo'd
        # id in a cleanup loop can't raise mid-wave.
        if not good:
            return {"status": "failed", "error": slots[0][1]}
        r = _host_call(
            "stop_child",
            [{"child_frame_id": good[0], "reason": reason}],
        )
        if isinstance(r, dict) and "error" in r and len(r) == 1:
            return {
                "child_frame_id": good[0],
                "status": "failed",
                "error": r["error"],
            }
        return r
    if good:
        r = _host_call(
            "stop_child",
            [{"child_frame_id": good, "reason": reason}],
        )
        if isinstance(r, dict) and "error" in r and len(r) == 1:
            # Whole-batch host error (e.g. protocol) \u2014 surface per-slot so
            # the return shape stays a positional list.
            host_results = [
                {"child_frame_id": fid, "status": "failed", "error": r["error"]}
                for fid in good
            ]
        else:
            host_results = r.get("results", []) if isinstance(r, dict) else []
    else:
        host_results = []
    it = iter(host_results)
    merged = []
    for tag, v in slots:
        if tag == "ok":
            try:
                merged.append(next(it))
            except StopIteration:
                merged.append({"status": "failed", "error": "no result"})
        else:
            merged.append({"status": "failed", "error": v})
    # List in -> list out (mirror rule; ergonomics chaos run 2026-06-10:
    # the old {"results": [...]} wrapper made single-vs-batch code paths
    # diverge -- result["results"] raised KeyError on the single form).
    return merged


def _op_collect(frame_ids, timeout=30.0):
    """Retrieve results of dispatched children by frame id \u2014 the sole
    result channel for \`\`host.delegate(wait=False)\`\` dispatches and for
    children that outlived a \`\`delegate(timeout=...)\`\` deadline.

    \`\`frame_ids\`\` is a child frame id (str), a descriptor/result dict from
    \`\`host.delegate()\`\` (\`\`frame_id\`\` is plucked \u2014 pass handles directly),
    or a list mixing either \u2014 from \`\`wait=False\`\` / \`\`timeout=\`\` running
    descriptors, \`\`host.children()\`\`, or an earlier call's results. Returns a list (one dict per id, same
    order): a finished child yields its full delegate-style result dict
    (\`\`status\`\`/\`\`response\`\`/\`\`structured_output\`\`/\`\`artifacts_created\`\`);
    a child still running at the deadline yields \`\`{"frame_id": ...,
    "status": "running", "child_status": ...}\`\` \u2014 \`\`child_status:
    "awaiting_user_response"\`\` means the child is PARKED on an
    approval/input card and will not progress until it is resolved
    (blocked, not slow; the descriptor's \`\`note\`\` says so too). Terminal statuses are
    "completed" / "failed" / "cancelled" (e.g. stopped via
    \`\`stop_child\`\`), and "orphaned" (\`\`restart_casualty: True\`\`) for a
    child lost to a daemon restart. \`\`timeout\`\` is BOUNDED \u2014 default 30s,
    max 1800s; \`\`timeout=None\`\` raises (matches \`\`wait_for_notification\`\`:
    a blocked collect always self-frees at its deadline). Only your OWN children are
    reachable (parentage-checked host-side); a bad id OR a malformed
    entry (e.g. a dict without \`\`frame_id\`\`) yields a per-slot
    \`\`{"status": "failed", "error": ...}\`\` without failing the batch.

    Pass a single id to get a one-element list.

    A backgrounded collect holds the repl kernel only until its deadline
    \u2014 new repl cells are rejected meanwhile, then the kernel self-frees.
    For multi-wave flows, loop short timeouts (e.g. \`\`timeout=60\`\`) so the
    kernel frees between slices and wave-N+1 can dispatch.
    """
    slots, _ = _coerce_child_slots(frame_ids, "host.collect")
    if timeout is None:
        raise ValueError(
            "host.collect: timeout=None (unbounded) is not allowed \u2014 "
            "collect is deadline-bounded like wait_for_notification "
            "(default 30s, max 1800s). Loop short slices for long waits: "
            "still-running slots come back as {'status': 'running'} "
            "descriptors you can pass straight back in."
        )
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
        raise TypeError(
            f"host.collect: timeout must be a positive number of "
            f"seconds (default 30, max 1800), got {type(timeout).__name__}"
        )
    if timeout <= 0:
        raise ValueError(
            "host.collect: timeout must be a positive number of seconds "
            "(default 30, max 1800)"
        )
    if timeout > 1800:
        raise ValueError(
            "host.collect: timeout is capped at 1800s (matches the "
            "wait_for_notification guidance ceiling) \u2014 loop shorter "
            "slices instead of one long wait"
        )
    good = [fid for (tag, fid) in slots if tag == "ok"]
    if good:
        payload = {"frame_ids": good, "timeout": float(timeout)}
        r = _host_call("collect", [payload])
        if isinstance(r, dict) and "error" in r and len(r) == 1:
            raise RuntimeError(f"host.collect: {r['error']}")
    else:
        r = []
    # Re-splice host results into the original slot order; malformed
    # entries come back as per-slot failures (same idiom as a bad
    # id-string) instead of a batch-aborting TypeError.
    it = iter(r)
    out = []
    for tag, v in slots:
        if tag == "ok":
            out.append(next(it))
        else:
            out.append({"status": "failed", "error": v})
    return out


def _op_send_message(target=None, message=None, kind="info", *,
                     child_frame_id=None):
    """Send a message to another agent in your delegation tree.

    **Comms topology: you can message only your direct parent and your
    direct children** (from an aside, also the main session via
    \`\`"main"\`\`). Sends to any other frame \u2014 a sibling, a grandparent, a
    frame-id found elsewhere \u2014 are refused with a topology error; relay
    via your parent instead.

    \`\`target\`\` is a frame-id str, a descriptor/result dict from
    \`\`host.delegate()\`\` / \`\`host.children()\`\`, or the literal
    \`\`"parent"\`\` (resolved host-side to the agent that spawned you). From
    an aside, the literal \`\`"main"\`\` posts a note to the main session.

    **Your direct child** \u2192 existing behavior: a RUNNING child gets the
    message injected into its conversation at its next step
    (\`\`{status: "injected", ...}\`\`); a COMPLETED/CANCELLED child is
    RESUMED with your message as its next input; a child parked on an
    approval has its pending approval(s) denied with the message in the
    deny error. \`\`kind\`\` is advisory (noted in the receipt) \u2014 the
    message goes straight into the child's transcript.

    **Your direct parent** (\`\`target="parent"\`\`) \u2192 the message is pushed
    into its conversation; it consumes it at its next loop iteration
    (\`\`{status: "sent", note: ...}\`\`). Held in-memory only \u2014 not
    persisted across daemon restart. \`\`kind="question"\`\` marks it so
    your parent is prompted to answer you back via
    \`\`host.send_message\`\`. Keep it short (capped at 4000 chars); up to
    32 such posts per task. From the root frame, \`\`target="parent"\`\` is
    refused \u2014 use \`\`ask_user\`\` for the human.

    **From an aside** (side chat), \`\`target="main"\`\` posts a \`\`[From
    side chat] \u2026\`\` note to the main session \u2014 advisory context, not
    user authorization; if main is idle it waits for the user's next
    message there. \`\`kind\`\` is forced to \`\`"info"\`\` (asides cannot
    receive replies). Up to 8 such posts per aside turn. Other
    main-tree frames are topology-refused \u2014 main can forward.

    Returns a delivery RECEIPT \u2014 never the target's answer: the target
    processes your message in the background. For a child, retrieve its
    new result with \`\`host.collect([frame_id])\`\`. For a question to
    your parent, the answer (if any) arrives as a message at your next
    turn boundary \u2014 it does not block this cell.
    A bad id or malformed handle yields \`\`{"status": "failed", "error":
    ...}\`\` instead of raising \u2014 unified with \`\`collect\`\`/\`\`stop_child\`\`.
    """
    # \uD83D\uDFE13456401986: accept the #2882-era kwarg name so a keyword-style
    # call doesn't raise in-kernel before the host-side alias can help.
    if target is None:
        target = child_frame_id
    if isinstance(target, (list, tuple)):
        raise TypeError(
            "host.send_message: one target per call \u2014 pass a single "
            "frame-id str or descriptor dict (loop for a wave)"
        )
    if not isinstance(message, str) or not message.strip():
        raise TypeError(
            "host.send_message: message must be a non-empty str"
        )
    if kind not in ("info", "question"):
        raise ValueError(
            "host.send_message: kind must be 'info' or 'question', "
            f"got {kind!r}"
        )
    if target == "parent":
        fid = "parent"
    elif target == "main":
        fid = "main"
    else:
        slots, _ = _coerce_child_slots(target, "host.send_message")
        if slots[0][0] == "bad":
            return {"status": "failed", "error": slots[0][1]}
        fid = slots[0][1]
    r = _host_call(
        "send_message",
        [{"target": fid, "message": message, "kind": kind}],
    )
    if isinstance(r, dict) and "error" in r and len(r) == 1:
        # Operational failure (not-found etc.) \u2192 failed dict, not a raise
        # \u2014 unified with collect/stop_child so steering loops survive a
        # bad id (argument misuse like a list still raises above).
        return {"target": fid, "status": "failed", "error": r["error"]}
    return r


host.children = _op_children
host.delegate = _op_delegate
host.delegation_stats = _op_delegation_stats
host.stop_child = _op_stop_child
host.collect = _op_collect
host.send_message = _op_send_message
`,uaO=`# Claude Science SDK fragment: runtime provenance instrumentation \u2014 CORE (1/3).
# Split from a single provenance.py so the sec-scanner can review it
# (OOM'd 3\xD7 on the 1400L monolith). inline-workers.mjs concats
# _prov_core.py + _prov_wraps.py + _prov_harvest.py into the single
# SDK_PROVENANCE_PY constant \u2014 runtime layout unchanged.
#
# Loaded by buildAnalysisSdkCode AFTER base.py/artifacts.py. Attaches onto
# the already-instantiated \`host\` singleton. Runs BEFORE any user code.
#
# Design (specs/artifacts-store-lineage.md L16): observe object-level data
# flow at RUNTIME instead of inferring it from code text post-hoc. Mechanism
# is recipy-style wrap-on-import: a small set of reader functions
# (pandas.read_*, numpy.load*, anndata.read_h5ad, ...) are wrapped so their
# return value is tagged with the source version_id; a small set of writer
# functions (DataFrame.to_*, Figure.savefig, numpy.save*, json.dump) are
# wrapped to harvest tags from their argument and record
# {output_path: {vids}} in __operon_prov_written. The host queries that map
# per saved output via __operon_runtime_inputs__(path) at save_artifacts
# time. Tags ride pandas .attrs (propagates through most ops natively) or a
# side-table keyed on id(obj) when the type has no .attrs slot.
#
# Non-goals (v1): full generic dataflow tracing (sys.settrace), numpy
# op-level propagation, R/bash coverage. Where the tag is lost (plain
# dicts, exec'd code, unwrapped readers), the host falls back to the
# Haiku/AST post-hoc lane. Where the tag IS present, the host skips the
# Haiku call entirely for that output.

import builtins as _prov_builtins
import os as _prov_os
import sys as _prov_sys
import weakref as _prov_weakref

_PROV_ATTR = "_operon_src"

# path -> version_id. Seeded by host.artifact_path() (below) and by the
# host's pre-exec {{artifact:}} resolver (compute.ts injects a
# __operon_prov_seed({...}) call before each cell that carried markers).
# Keys are realpath'd so symlinked store layouts match.
_prov_path_to_vid = {}

# id(obj) -> (weakref, frozenset[vid]). Weakref is the liveness guard;
# types that don't support weakref (ndarray, dict, list, bytes) are
# refused entirely (no id-reuse-after-GC risk \u2014 ic 4765227282 nit).
_prov_side = {}

# path -> frozenset[vid]. Populated by wrapped writers; the host reads it
# via __operon_runtime_inputs__(path). Keyed by the as-written path AND
# its realpath (no basename \u2014 see _prov_record_write).
_prov_written = {}

# Modules patched so far (idempotency guard for the __import__ hook).
_prov_patched = set()

# Kill switch -- the whole fragment becomes a no-op (readers/writers call
# straight through; __operon_runtime_inputs__ returns []) when this env
# var is set. Single opt-out for the entire lane.
_PROV_OFF = _prov_os.environ.get("OPERON_PROVENANCE_OFF") == "1"


# Fallback no-op stubs FIRST, before any subclass/type machinery that could
# throw on an unexpected env \u2014 a raise in the defs below must still leave
# the host's query surface intact (\`guardProvenanceShim\` is the outer
# belt; this is the inner suspender). Real implementations overwrite these
# later in this fragment.
def __operon_runtime_inputs__(_p):  # noqa: E501  (overwritten below)
    return {"fired": False, "inputs": []}


def __operon_runtime_inputs_batch__(_ps):
    return {p: {"fired": False, "inputs": []} for p in _ps}


def __operon_prov_seed(mapping):
    """Host-called before each cell that resolved {{artifact:}} markers.
    Also callable from user code / tests."""
    if _PROV_OFF:
        return
    for vid, path in (mapping or {}).items():
        try:
            rp = _prov_os.path.realpath(path)
        except Exception:
            rp = path
        _prov_path_to_vid[rp] = vid
        _prov_path_to_vid[path] = vid


def _prov_vid_of_path(p):
    if not isinstance(p, (str, bytes, _prov_os.PathLike)):
        return None
    try:
        s = _prov_os.fspath(p)
        if isinstance(s, bytes):
            s = s.decode("utf-8", "replace")
    except Exception:
        return None
    v = _prov_path_to_vid.get(s)
    if v:
        return v
    try:
        return _prov_path_to_vid.get(_prov_os.path.realpath(s))
    except Exception:
        return None


# \u2500\u2500 ndarray subclass for numpy-op propagation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Created lazily on first numpy import. \`__array_finalize__\` fires on EVERY
# array created from a _ProvNdarray (views, slices, fancy indexing, ufunc
# results, arithmetic) \u2014 it's the one mechanism that survives \`x[mask]\` and
# \`x * 2\` without sys.settrace. The shim returns this subclass from the
# pandas\u2192numpy transition points (Series.values / .to_numpy / __array__) so
# \`ax.scatter(df['x'].values[mask], ...)\` stays tagged end-to-end. Returning
# a subclass from .values is mildly invasive (\`type(x) is np.ndarray\` would
# fail) but isinstance passes and matplotlib/scipy handle subclasses; only
# applied when the source IS tagged, so untagged data paths are unchanged.
_ProvNdarray = [None]  # mutable cell \u2014 set by _prov_ensure_ndarray_cls()


def _prov_ensure_ndarray_cls():
    if _ProvNdarray[0] is not None:
        return _ProvNdarray[0]
    np = _prov_sys.modules.get("numpy")
    if np is None:
        return None

    class ProvNdarray(np.ndarray):
        __array_priority__ = 1.0

        def __array_finalize__(self, obj):
            if obj is None:
                return
            t = getattr(obj, "_prov_tags", None)
            if t:
                self._prov_tags = t

        def item(self, *a):
            r = np.ndarray.item(self, *a)
            t = getattr(self, "_prov_tags", None)
            return _prov_wrap_scalar(r, t) if t else r

        def tolist(self):
            r = np.ndarray.tolist(self)
            t = getattr(self, "_prov_tags", None)
            if not t:
                return r
            def rec(x):
                if isinstance(x, list):
                    return [rec(e) for e in x]
                return _prov_wrap_scalar(x, t)
            return rec(r)

        def __reduce__(self):
            # Pickle as the base ndarray \u2014 the subclass is a process-local
            # instrumentation detail, never something we want to persist
            # (would poison multiprocessing round-trips with ImportError).
            import numpy as _np
            return _np.ndarray.__reduce__(self.view(_np.ndarray))

        def __repr__(self):
            # Cosmetic (room #prov-shim-stress): print as a plain ndarray
            # so user-visible cell output doesn't leak \`ProvNdarray(\u2026)\`.
            return np.ndarray.__repr__(self.view(np.ndarray))

    _ProvNdarray[0] = ProvNdarray
    return ProvNdarray


def _prov_as_traced_array(arr, vids):
    """Return arr viewed as _ProvNdarray with _prov_tags=vids. Falls back to
    the side table if numpy isn't loaded or the view fails."""
    cls = _prov_ensure_ndarray_cls()
    if cls is None or arr is None:
        return _prov_tag(arr, vids)
    try:
        v = arr.view(cls)
        prev = getattr(v, "_prov_tags", frozenset())
        v._prov_tags = frozenset(prev) | frozenset(vids)
        return v
    except Exception:
        return _prov_tag(arr, vids)


# \u2500\u2500 scalar subclasses (float/int/str/bool) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Closes the df.loc[r,'c'] -> float -> ax.plot([float]) gap. Each carries
# _prov_tags and preserves it through arithmetic via the binop overrides.
# Immutable-base pattern: __new__ constructs from the plain value, __init__
# stamps tags. Pickle/copy degrade to the plain base (process-local only).
# _ProvBool subclasses int (bool can't be subclassed); identity checks
# (\`is True\`) on a _ProvBool will fail -- acceptable, rarely used on
# extracted data values.
def _prov_make_scalar_cls(base, name):
    binops = ("__add__", "__radd__", "__sub__", "__rsub__", "__mul__",
              "__rmul__", "__truediv__", "__rtruediv__", "__floordiv__",
              "__rfloordiv__", "__mod__", "__rmod__", "__pow__", "__rpow__",
              "__neg__", "__pos__", "__abs__")
    # str-returning value ops (iteration-3 gap-2): _ProvStr[:n], s+s,
    # s.replace/strip/upper/format/join all return plain str by default.
    # Re-wrap so \`open(p).read()[:50]\` and \`json.loads(s)\` paths stay tagged.
    if base is str:
        binops = binops + (
            "__getitem__", "replace", "strip", "rstrip", "lstrip",
            "upper", "lower", "title", "capitalize", "format",
            "format_map", "join", "center", "ljust", "rjust", "zfill",
            "encode",
        )

    def __new__(cls, val, _prov=()):
        return base.__new__(cls, val)

    def __init__(self, val, _prov=()):
        try:
            object.__setattr__(self, "_prov_tags", frozenset(_prov))
        except Exception:
            pass

    def __reduce__(self):
        return (base, (base(self),))

    ns = {"__new__": __new__, "__init__": __init__, "__reduce__": __reduce__}
    for op in binops:
        bop = getattr(base, op, None)
        if bop is None:
            continue

        def mk(bop=bop):
            def w(self, *a, **kw):
                r = bop(self, *a, **kw)
                if r is NotImplemented:
                    return r
                try:
                    t = getattr(self, "_prov_tags", frozenset())
                    for x in a:
                        t = t | getattr(x, "_prov_tags", frozenset())
                    for x in kw.values():
                        t = t | getattr(x, "_prov_tags", frozenset())
                    return _prov_wrap_scalar(r, t)
                except Exception:
                    return r
            return w
        ns[op] = mk()
    return type(name, (base,), ns)


_ProvFloat = _prov_make_scalar_cls(float, "_ProvFloat")
_ProvInt = _prov_make_scalar_cls(int, "_ProvInt")
_ProvStr = _prov_make_scalar_cls(str, "_ProvStr")

# numpy-scalar subclasses (3447902387): coercing np.float64/np.int64 to
# Python float/int via .item() strips .item()/.dtype/.astype()/isinstance
# (np.floating) \u2014 user cells that touched those broke only on artifact-
# derived data. Instead subclass the numpy scalar TYPE itself (per-dtype,
# cached), so the full np.generic API survives and isinstance passes.
_prov_np_scalar_cls: "dict[type, type]" = {}

_PROV_SCALAR_BINOPS = (
    "__add__", "__radd__", "__sub__", "__rsub__", "__mul__",
    "__rmul__", "__truediv__", "__rtruediv__", "__floordiv__",
    "__rfloordiv__", "__mod__", "__rmod__", "__pow__", "__rpow__",
    "__neg__", "__pos__", "__abs__",
)


def _prov_np_scalar_subclass(np_type):
    # 3447945279: failure is cached as None \u2014 key-presence check, not
    # \`is not None\`, or a failing dtype re-builds+re-raises every call.
    if np_type in _prov_np_scalar_cls:
        return _prov_np_scalar_cls[np_type]
    try:
        def _mk_binop(op):
            bop = getattr(np_type, op, None)
            if bop is None:
                return None

            def w(self, *a):
                r = bop(self, *a)
                if r is NotImplemented:
                    return r
                try:
                    t = getattr(self, "_prov_tags", frozenset())
                    for x in a:
                        t = t | getattr(x, "_prov_tags", frozenset())
                    return _prov_wrap_scalar(r, t)
                except Exception:
                    return r
            return w
        ns = {
            "__new__": lambda cls, val, _prov=(): np_type.__new__(cls, val),
            "__reduce__": lambda self: (np_type, (np_type(self),)),
        }
        for op in _PROV_SCALAR_BINOPS:
            wop = _mk_binop(op)
            if wop is not None:
                ns[op] = wop
        c = type(f"_Prov_{np_type.__name__}", (np_type,), ns)
        # verify constructible (some np scalar types reject subclass init)
        _ = c(np_type(0))
    except Exception:
        c = None
    _prov_np_scalar_cls[np_type] = c
    return c


# \u2500\u2500 json result tagging (iteration-3 gap-4, re-done per 3447929917) \u2500\u2500\u2500\u2500\u2500\u2500
# The earlier _ProvDict/_ProvList container subclasses broke three
# container contracts for artifact JSON: copy-on-access nested mutation
# (\`d['sec']['k'] = x\` mutated a throwaway), .keys()/.values() returning
# lists not views (set-algebra TypeError), and \`type(obj) is dict\`
# strict-type dispatch (yaml RepresenterError). They also wrapped the
# caller's own default on a .get() miss (3447929919 \u2014 spurious
# consensus:"runtime" edge from a literal the artifact never contained).
#
# Fix: tag LEAVES, not containers. At json.load/loads time, rebuild the
# structure ONCE with plain dict/list containers whose scalar leaves
# (values AND keys) are _Prov*-wrapped. \`type(d) is dict\` passes, views
# are native dict_keys, nested mutation hits the real child, and .get()
# is native dict.get so a miss returns the caller's default untouched.
# t06 (\`list(d.keys())\` \u2192 [_ProvStr,\u2026]) and t14 (\`d.values()\` element
# \u2192 _ProvStr) still fire because the leaves themselves carry the tag.
#
# Tradeoff (3447965497): LEAVES are subclass-typed, so exact-type
# dispatch on artifact-JSON keys/values (\`type(v) is str\`) fails. The
# one concrete consumer cited \u2014 PyYAML safe_dump \u2014 is cured via
# _prov_patch_yaml representer registration. Other strict-type
# dispatchers on artifact-JSON leaves are the documented cost of the
# leaf-wrap recall lane; escape hatch is OPERON_PROVENANCE_OFF=1.
#
# Bounded: bails to side-table-only past _PROV_JSON_LEAF_CAP nodes so a
# multi-MB JSON artifact doesn't pay O(n) wrapper-object overhead.
_PROV_JSON_LEAF_CAP = 10_000


def _prov_wrap_container(v, tags):
    """Recursively wrap scalar LEAF VALUES of a json.load/loads result with
    \`tags\`; containers stay plain dict/list, and dict KEYS stay plain
    (room #prov-shim-stress: wrapped keys break orjson.dumps dict-key
    type check; key-flow to output is synthetic \u2014 t06-only)."""
    if not tags:
        return v
    n = [0]

    def rec(x):
        n[0] += 1
        if n[0] > _PROV_JSON_LEAF_CAP:
            return x
        t = type(x)
        if t is dict:
            return {k: rec(w) for k, w in x.items()}
        if t is list:
            return [rec(e) for e in x]
        return _prov_wrap_scalar(x, tags)
    try:
        return rec(v)
    except Exception:
        return v


def _prov_wrap_scalar(v, tags):
    """Wrap a Python scalar (or numpy scalar) in the tag-carrying subclass.
    Non-scalars pass through unchanged (the caller handles them via
    _prov_tag / _prov_as_traced_array)."""
    if not tags or v is None:
        return v
    # Already wrapped (arithmetic on a _Prov* returns another _Prov* via
    # the binop override which re-calls _prov_wrap_scalar) \u2014 merge tags
    # instead of nesting subclasses.
    prev = getattr(v, "_prov_tags", None)
    if prev is not None:
        try:
            object.__setattr__(v, "_prov_tags", frozenset(prev) | frozenset(tags))
        except Exception:
            pass
        return v
    t = type(v)
    try:
        if t is bool:
            # 3447902387: bool identity MUST be preserved \u2014 wrapping as
            # _ProvInt(1/0) breaks isinstance(v,bool) and json.dumps.
            # Accept the recall loss; bools rarely drive plots directly.
            return v
        if t is float:
            return _ProvFloat(v, tags)
        if t is int:
            return _ProvInt(v, tags)
        if t is str:
            return _ProvStr(v, tags)
        # numpy scalars (np.float64 etc.) \u2014 subclass the numpy type so
        # .item()/.dtype/.astype()/isinstance(np.floating) survive
        # (3447902387). np.bool_ passes through unwrapped for the same
        # identity-preservation reason as python bool.
        np = _prov_sys.modules.get("numpy")
        if np is not None and isinstance(v, np.generic):
            if isinstance(v, np.bool_):
                return v
            sub = _prov_np_scalar_subclass(type(v))
            if sub is not None:
                r = sub(v)
                try:
                    object.__setattr__(r, "_prov_tags", frozenset(tags))
                    return r
                except Exception:
                    pass
            # Fall back to side-table \u2014 keeps original type verbatim.
            _prov_tag(v, tags)
            return v
    except Exception:
        pass
    return v


def _prov_tag(obj, vids):
    """Attach a vid set to obj. Prefers a native .attrs slot (pandas/xarray
    -- propagates through slice/copy/arith and is NOT serialized to disk);
    else the id()-keyed side table. AnnData .uns is deliberately NOT used
    (3447867042): .uns IS serialized by write_h5ad/write_zarr, so writing a
    tag there both contaminates user data and raises IORegistryError (no
    set/frozenset writer). AnnData falls through to the side table."""
    if not vids:
        return obj
    fs = frozenset(vids)
    attrs = getattr(obj, "attrs", None)
    # pandas/xarray .attrs is a plain dict; merge.
    if isinstance(attrs, dict):
        try:
            prev = attrs.get(_PROV_ATTR)
            attrs[_PROV_ATTR] = (prev | fs) if isinstance(prev, frozenset) else fs
            return obj
        except Exception:
            pass
    key = id(obj)
    try:
        ref = _prov_weakref.ref(obj, lambda _r, k=key: _prov_side.pop(k, None))
    except TypeError:
        # room #prov-shim-stress: non-weakref'able builtins (dict/list/
        # tuple/bytes/\u2026) are the EXACTLY id-reuse-risky set \u2014 a GC'd dict
        # leaves a stale side-table entry that a fresh unrelated dict at
        # the same id then matches, producing a spurious consensus:
        # "runtime" edge. Skip side-tabling entirely for these; recall
        # for json dict/list comes from leaf-wrapping instead.
        return obj
    prev = _prov_side.get(key)
    prev_fs = prev[1] if prev else frozenset()
    _prov_side[key] = (ref, prev_fs | fs)
    return obj


# Exact-type fast path set for _prov_tags_of \u2014 plain builtin scalars carry
# no tags (we never side-table them and they have no .attrs/_prov_tags).
# Kills the measured 14.6\xD7 np.array(plain-list) and 3.3\xD7 untagged .iloc
# per-element overhead. Subclass wrappers (_ProvFloat etc.) don't match
# type-is checks.
_PROV_PLAIN_SCALAR = frozenset(
    (int, float, str, bytes, bool, complex, type(None)),
)


def _prov_tags_of(obj, *, _depth=0, _seen=None):
    """Harvest vids from obj. Checks _prov_tags (ndarray subclass / scalar
    subclasses), .attrs, the side table, then recurses one level into
    list/tuple/dict-values (bounded)."""
    if type(obj) in _PROV_PLAIN_SCALAR or _depth > 4:
        return frozenset()
    out = set()
    # ndarray subclass: the primary numpy-op-surviving carrier.
    t = getattr(obj, "_prov_tags", None)
    if t:
        out |= set(t)
    attrs = getattr(obj, "attrs", None)
    if isinstance(attrs, dict):
        v = attrs.get(_PROV_ATTR)
        if v:
            out |= set(v)
    ent = _prov_side.get(id(obj))
    if ent is not None:
        ref, fs = ent
        if ref() is obj:
            out |= fs
    # ndarray: if this array is a view, also check its base.
    base = getattr(obj, "base", None)
    if base is not None and base is not obj:
        out |= _prov_tags_of(base, _depth=_depth + 1)
    if isinstance(obj, (list, tuple)) and len(obj) <= 64:
        if _seen is None:
            _seen = set()
        if id(obj) not in _seen:
            _seen.add(id(obj))
            for x in obj:
                out |= _prov_tags_of(x, _depth=_depth + 1, _seen=_seen)
    elif isinstance(obj, dict) and len(obj) <= 64:
        if _seen is None:
            _seen = set()
        if id(obj) not in _seen:
            _seen.add(id(obj))
            for x in obj.values():
                out |= _prov_tags_of(x, _depth=_depth + 1, _seen=_seen)
    return frozenset(out)


def _prov_record_write(path, vids):
    if not path:
        return
    try:
        s = _prov_os.fspath(path)
        if isinstance(s, bytes):
            s = s.decode("utf-8", "replace")
    except Exception:
        return
    fs = frozenset(vids or ())
    try:
        rp = _prov_os.path.realpath(s)
    except Exception:
        rp = s
    # Last-writer-wins (3447867043): the bytes on disk at \`path\` derive
    # only from the most recent write to that path, so REPLACE -- never
    # union across writes. Unioning would over-attribute after a same-path
    # overwrite from a different source (iterative-regen notebook shape),
    # and since consensus:"runtime" is the highest-trust tier the spurious
    # edge would persist uncorrected. An UNTAGGED overwrite (3447902386)
    # must record an EMPTY set, not leave the stale entry: key-presence
    # is the Haiku-skip \`fired\` signal (a wrapped writer observed the
    # write), so store frozenset() rather than pop \u2014 \`{fired:true,
    # inputs:[]}\` is a positive zero.
    #
    # ic 4765227282: NO basename key \u2014 the host always queries by the
    # absolute source_path (artifacts.ts \`fullPath\`), so basename is
    # never the hit, and it collides across directories (out/{a,b}/
    # result.csv both record "result.csv" last-writer-wins; a host query
    # that missed s/rp would get the wrong file's vids).
    for k in {s, rp}:
        if k:
            _prov_written[k] = fs


def __operon_runtime_inputs__(path):
    """Host-queried per saved output. Tri-state return
    \`{fired: bool, inputs: list[vid]}\`:
      - \`fired=True\`  \u2014 a wrapped writer (savefig/to_csv/json.dump/open-w
        truncate/\u2026) was observed for \`path\`; \`inputs\` is the authoritative
        runtime-tracked input set, and \`inputs==[]\` is a positive zero.
        Host skips Haiku for this output.
      - \`fired=False\` \u2014 no wrapped writer saw this path (subprocess/shutil/
        os.write/unwrapped lib). Host falls back to the Haiku\u222AAST lane.
    """
    if _PROV_OFF:
        return {"fired": False, "inputs": []}
    try:
        s = _prov_os.fspath(path)
        if isinstance(s, bytes):
            s = s.decode("utf-8", "replace")
    except Exception:
        return {"fired": False, "inputs": []}
    try:
        rp = _prov_os.path.realpath(s)
    except Exception:
        rp = s
    for k in (s, rp):
        if k in _prov_written:
            return {"fired": True, "inputs": sorted(_prov_written[k])}
    return {"fired": False, "inputs": []}


def __operon_runtime_inputs_batch__(paths):
    return {p: __operon_runtime_inputs__(p) for p in paths}


# ---- reader/writer wrappers ----------------------------------------------


# Claude Science SDK fragment: runtime provenance instrumentation \u2014 WRAPS (2/3).
# Per-library import-time patchers (pandas, numpy). Concatenated AFTER
# _prov_core.py by inline-workers.mjs \u2014 every _prov_* name referenced
# here is defined there.
#
# ruff: noqa: F821

def _prov_wrap_reader(fn, path_arg=0, path_kw=None):
    """Wrap a reader so its return is tagged with the path-arg's vid."""
    if getattr(fn, "_operon_prov", False):
        return fn

    def w(*a, **kw):
        r = fn(*a, **kw)
        try:
            p = kw.get(path_kw) if path_kw and path_kw in kw else (
                a[path_arg] if len(a) > path_arg else None
            )
            vid = _prov_vid_of_path(p)
            if vid:
                # ndarray readers \u2192 subclass so numpy ops propagate;
                # everything else \u2192 .attrs/.uns/side-table.
                np = _prov_sys.modules.get("numpy")
                if np is not None and isinstance(r, np.ndarray):
                    return _prov_as_traced_array(r, {vid})
                _prov_tag(r, {vid})
        except Exception:
            pass
        return r

    try:
        w.__name__ = getattr(fn, "__name__", "wrapped")
        w.__qualname__ = getattr(fn, "__qualname__", w.__name__)
        w.__doc__ = getattr(fn, "__doc__", None)
        w.__wrapped__ = fn
    except Exception:
        pass
    w._operon_prov = True
    return w


def _prov_wrap_method_writer(cls, name, path_arg=0, path_kw=None):
    """Wrap an unbound method \`cls.name(self, path, ...)\` so it records
    {path: tags_of(self)} after a successful write."""
    fn = getattr(cls, name, None)
    if fn is None or getattr(fn, "_operon_prov", False):
        return

    def w(self, *a, **kw):
        r = fn(self, *a, **kw)
        try:
            p = kw.get(path_kw) if path_kw and path_kw in kw else (
                a[path_arg] if len(a) > path_arg else None
            )
            _prov_record_write(p, _prov_tags_of(self))
        except Exception:
            pass
        return r

    w.__name__ = getattr(fn, "__name__", name)
    w.__doc__ = getattr(fn, "__doc__", None)
    w.__wrapped__ = fn
    w._operon_prov = True
    try:
        setattr(cls, name, w)
    except Exception:
        pass


# Per-module patch registry. Each entry is (module_name, patch_fn(mod)).
def _prov_patch_pandas(pd):
    for r in (
        "read_csv", "read_parquet", "read_json", "read_pickle", "read_hdf",
        "read_excel", "read_feather", "read_table", "read_fwf",
    ):
        if hasattr(pd, r):
            setattr(pd, r, _prov_wrap_reader(getattr(pd, r), 0,
                                             "filepath_or_buffer"))
    # merge/concat: union both sides' attrs into the result.
    for combo in ("merge", "concat"):
        orig = getattr(pd, combo, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig):
            def w(*a, **kw):
                r = orig(*a, **kw)
                try:
                    srcs = set()
                    for x in a:
                        srcs |= _prov_tags_of(x)
                    for x in kw.values():
                        srcs |= _prov_tags_of(x)
                    if srcs:
                        _prov_tag(r, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        setattr(pd, combo, mk())
    # DataFrame writers -- tags_of(self) at write.
    try:
        DF = pd.DataFrame
        S = pd.Series
    except Exception:
        return
    for m in ("to_csv", "to_parquet", "to_json", "to_pickle", "to_hdf",
              "to_excel", "to_feather"):
        _prov_wrap_method_writer(DF, m, 0, "path_or_buf")
        _prov_wrap_method_writer(S, m, 0, "path_or_buf")
    # DataFrame.merge / .join method -> union self+other.
    for m in ("merge", "join"):
        orig = getattr(DF, m, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig):
            def w(self, *a, **kw):
                r = orig(self, *a, **kw)
                try:
                    srcs = _prov_tags_of(self) | _prov_tags_of(a) | \\
                        _prov_tags_of(list(kw.values()))
                    if srcs:
                        _prov_tag(r, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        setattr(DF, m, mk())
    # pandas -> numpy transition (Series.values / .to_numpy() /
    # __array__). These are the points where .attrs is STRIPPED -- the
    # returned ndarray has no attrs slot, so side-table it. Covers
    # \`ax.plot(df['x'].values, ...)\` and matplotlib's internal
    # \`np.asarray(series)\` coercion (which calls __array__). Does NOT
    # cover subsequent numpy ops on the result (fancy indexing /
    # arithmetic produce fresh arrays with new ids) -- that gap is the
    # known recall floor for pure-numpy pipelines; see report.
    for cls in (DF, S):
        for m in ("to_numpy", "__array__"):
            orig = getattr(cls, m, None)
            if orig is None or getattr(orig, "_operon_prov", False):
                continue

            def mk(orig=orig):
                def w(self, *a, **kw):
                    r = orig(self, *a, **kw)
                    try:
                        srcs = _prov_tags_of(self)
                        if srcs:
                            return _prov_as_traced_array(r, srcs)
                    except Exception:
                        pass
                    return r
                w._operon_prov = True
                w.__wrapped__ = orig
                return w
            try:
                setattr(cls, m, mk())
            except Exception:
                pass
        # .values is a property -- wrap the fget.
        try:
            prop = cls.values
            if isinstance(vars(cls).get("values"), property):
                pdesc = vars(cls)["values"]
                if not getattr(pdesc.fget, "_operon_prov", False):
                    ofget = pdesc.fget

                    def vfget(self, _o=ofget):
                        r = _o(self)
                        try:
                            srcs = _prov_tags_of(self)
                            if srcs:
                                return _prov_as_traced_array(r, srcs)
                        except Exception:
                            pass
                        return r
                    vfget._operon_prov = True
                    setattr(cls, "values", property(vfget, pdesc.fset,
                                                    pdesc.fdel, pdesc.__doc__))
        except Exception:
            pass
    # Scalar-extraction accessors: Series.__getitem__ + .loc/.iloc/.at/.iat
    # indexer __getitem__. When the return is a plain scalar, wrap it so
    # \`df.loc[r,'c']\` -> _ProvFloat carrying df's tags. Non-scalar returns
    # (Series/DataFrame slices) already inherit .attrs natively -- leave
    # them alone. This is the scalar-extraction R-gap closer (the 3/10
    # clean-replay misses in runtime_report.md).
    def _wrap_scalar_getter(cls, attr, owner_of):
        orig = getattr(cls, attr, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            return

        def w(self, key, _o=orig, _own=owner_of):
            r = _o(self, key)
            try:
                # Only wrap genuine scalars; slices/Series keep .attrs.
                np = _prov_sys.modules.get("numpy")
                is_scalar = isinstance(r, (int, float, str, bool, bytes)) or (
                    np is not None and isinstance(r, np.generic))
                if is_scalar:
                    srcs = _prov_tags_of(_own(self))
                    if srcs:
                        return _prov_wrap_scalar(r, srcs)
            except Exception:
                pass
            return r
        w._operon_prov = True
        w.__wrapped__ = orig
        try:
            setattr(cls, attr, w)
        except Exception:
            pass

    _wrap_scalar_getter(S, "__getitem__", lambda s: s)
    # Indexer classes live in pd.core.indexing; .obj is the
    # Series/DataFrame being indexed.
    try:
        from pandas.core import indexing as _pdi
        for icls in ("_LocIndexer", "_iLocIndexer",
                     "_AtIndexer", "_iAtIndexer"):
            c = getattr(_pdi, icls, None)
            if c is not None:
                _wrap_scalar_getter(c, "__getitem__", lambda s: s.obj)
    except Exception:
        pass
    # .iterrows() -- row Series should carry the DataFrame's tags (pandas
    # doesn't propagate .attrs through iterrows). Covers
    # \`for _,r in df.iterrows(): ax.scatter(r['x'], r['y'])\`.
    try:
        orig_ir = DF.iterrows
        if not getattr(orig_ir, "_operon_prov", False):
            def _ir(self, _o=orig_ir):
                srcs = _prov_tags_of(self)
                for idx, row in _o(self):
                    if srcs:
                        try:
                            _prov_tag(row, srcs)
                        except Exception:
                            pass
                    yield idx, row
            _ir._operon_prov = True
            DF.iterrows = _ir
    except Exception:
        pass
    # GroupBy reductions that pandas does NOT propagate .attrs through
    # (iteration-3 gap-1: .size()/.count()/.nunique() \u2014 .sum()/.mean() do
    # propagate natively). Copy self.obj's tags onto the result.
    try:
        from pandas.core.groupby.groupby import GroupBy as _GB
        for gm in ("size", "count", "nunique", "ngroup", "cumcount"):
            _go = getattr(_GB, gm, None)
            if _go is None or getattr(_go, "_operon_prov", False):
                continue

            def _gmk(_go=_go):
                def w(self, *a, **kw):
                    r = _go(self, *a, **kw)
                    try:
                        srcs = _prov_tags_of(getattr(self, "obj", None))
                        if srcs:
                            _prov_tag(r, srcs)
                    except Exception:
                        pass
                    return r
                w._operon_prov = True
                w.__wrapped__ = _go
                return w
            try:
                setattr(_GB, gm, _gmk())
            except Exception:
                pass
    except Exception:
        pass


def _prov_patch_numpy(np):
    for r in ("load", "loadtxt", "genfromtxt", "fromfile"):
        if hasattr(np, r):
            setattr(np, r, _prov_wrap_reader(getattr(np, r), 0, "file"))
    for wname, data_pos, ext in (("save", 1, ".npy"), ("savez", None, ".npz"),
                                 ("savez_compressed", None, ".npz"),
                                 ("savetxt", 1, None)):
        orig = getattr(np, wname, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig, data_pos=data_pos, ext=ext):
            def w(*a, **kw):
                r = orig(*a, **kw)
                try:
                    p = a[0] if a else kw.get("file")
                    # numpy.save/savez auto-append the extension; record under
                    # the path that actually landed on disk so the host's
                    # per-saved-file lookup matches.
                    if ext and isinstance(p, (str, _prov_os.PathLike)):
                        ps = _prov_os.fspath(p)
                        if not str(ps).endswith(ext):
                            p = str(ps) + ext
                    if data_pos is not None and len(a) > data_pos:
                        srcs = _prov_tags_of(a[data_pos])
                    else:
                        srcs = _prov_tags_of(a[1:]) | \\
                            _prov_tags_of(list(kw.values()))
                    _prov_record_write(p, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        setattr(np, wname, mk())
    # np.array / np.asarray / np.asanyarray on a list/tuple of tagged
    # scalars (iteration-3 gap-3): these allocate a FRESH base ndarray
    # (\`__array_finalize__\` never fires \u2014 no subclass in the chain), so
    # \`np.mean([_ProvFloat,...])\` drops tags. Scan the input, union
    # element tags, and return a _ProvNdarray view. Only intervenes when
    # the top-level input is a python list/tuple AND carries tags \u2014 the
    # ndarray-input path is left to __array_finalize__.
    for ctor in ("array", "asarray", "asanyarray"):
        orig = getattr(np, ctor, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def amk(orig=orig):
            def w(obj, *a, **kw):
                r = orig(obj, *a, **kw)
                try:
                    # Gate also checks .attrs (room #prov-shim-stress): a
                    # tagged pandas Series has .attrs not _prov_tags, and
                    # seaborn/plotnine marshal via \`np.asarray(series)\` \u2014
                    # missing this arm = {fired:true,inputs:[]} for every
                    # seaborn plot. For list/tuple input, scan only the
                    # first 8 elements (kills the np.array(plain-list)
                    # tax; a homogeneous-type list either has a tagged
                    # head or is all-plain).
                    gate = getattr(obj, "_prov_tags", None) or (
                        isinstance(getattr(obj, "attrs", None), dict)
                        and _PROV_ATTR in obj.attrs
                    )
                    if not gate and isinstance(obj, (list, tuple)):
                        for x in obj[:8]:
                            if type(x) not in _PROV_PLAIN_SCALAR:
                                gate = True
                                break
                    if gate:
                        srcs = _prov_tags_of(obj)
                        if srcs:
                            return _prov_as_traced_array(r, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        try:
            setattr(np, ctor, amk())
        except Exception:
            pass
    # Reductions called on a python list (iteration-3 gap-5, the 9fe169f7
    # FP root): \`np.mean([_ProvFloat,...])\` hits numpy._core._methods which
    # imported \`asanyarray\` at module-load \u2014 the np.asarray wrap above
    # never sees it. Wrap the user-facing reduction itself: harvest tags
    # from the FIRST positional (the data arg), stamp onto the result
    # (scalar \u2192 _prov_wrap_scalar, ndarray \u2192 _prov_as_traced_array).
    REDUCE = ("mean", "sum", "std", "var", "median", "min", "max", "prod",
              "nanmean", "nansum", "nanstd", "nanvar", "nanmedian",
              "nanmin", "nanmax", "nanprod", "percentile", "quantile",
              "average", "ptp", "argmin", "argmax", "nanargmin",
              "nanargmax")
    for rn in REDUCE:
        orig = getattr(np, rn, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def rmk(orig=orig):
            def w(a, *args, **kw):
                r = orig(a, *args, **kw)
                try:
                    srcs = _prov_tags_of(a)
                    if not srcs:
                        return r
                    npmod = _prov_sys.modules.get("numpy")
                    if npmod is not None and isinstance(r, npmod.ndarray):
                        return _prov_as_traced_array(r, srcs)
                    return _prov_wrap_scalar(r, srcs)
                except Exception:
                    return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        try:
            setattr(np, rn, rmk())
        except Exception:
            pass



# Claude Science SDK fragment: runtime provenance instrumentation \u2014 HARVEST (3/3).
# Writer-side patchers (matplotlib, json, pickle, open, \u2026), the
# _PROV_PATCHERS dispatch table, and the __import__ hook install.
# Concatenated AFTER _prov_core.py + _prov_wraps.py by inline-workers.mjs.
#
# ruff: noqa: F821

def _prov_patch_matplotlib(mod):
    # Patched on import of matplotlib.pyplot (that's what user code imports).
    try:
        from matplotlib.axes import Axes
        from matplotlib.figure import Figure
    except Exception:
        return
    # Axes plotting methods: harvest tags from positional/kw data args,
    # accumulate on the Axes itself. Figure.savefig unions across fig.axes.
    PLOTTERS = (
        "plot", "scatter", "bar", "barh", "hist", "imshow", "pcolor",
        "pcolormesh", "contour", "contourf", "fill_between", "errorbar",
        "pie", "stackplot", "hist2d", "hexbin", "boxplot", "violinplot",
        "stem",
    )
    for m in PLOTTERS:
        orig = getattr(Axes, m, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig):
            def w(self, *a, **kw):
                r = orig(self, *a, **kw)
                try:
                    # Harvest positional AND every kwarg (iteration-3 gap:
                    # \`color=_ProvStr(...)\`, \`s=\`, \`label=\` etc. are
                    # data-flow inputs to the figure). _prov_tags_of walks
                    # lists/tuples/dicts \u226464, so \`ax.bar([0],[v])\` is
                    # covered without the np.asarray wrap.
                    srcs = _prov_tags_of(a) | _prov_tags_of(
                        list(kw.values()))
                    if srcs:
                        cur = getattr(self, "_operon_src", None) or set()
                        self._operon_src = set(cur) | set(srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        try:
            setattr(Axes, m, mk())
        except Exception:
            pass

    orig_save = getattr(Figure, "savefig", None)
    if orig_save and not getattr(orig_save, "_operon_prov", False):
        def savefig(self, fname, *a, **kw):
            r = orig_save(self, fname, *a, **kw)
            try:
                srcs = set()
                for ax in getattr(self, "axes", ()) or ():
                    s = getattr(ax, "_operon_src", None)
                    if s:
                        srcs |= set(s)
                _prov_record_write(fname, srcs)
            except Exception:
                pass
            return r
        savefig._operon_prov = True
        savefig.__wrapped__ = orig_save
        Figure.savefig = savefig
    # Axes reuse (3447902390): ax.clear()/cla() reset matplotlib's own
    # artist state but NOT arbitrary instance attrs, so _operon_src
    # monotonically accumulates across a \`for ...: ax.clear(); ax.plot();
    # fig.savefig()\` loop and later saves over-attribute. Wrap clear/cla
    # (and Figure.clf/clear) to drop the tag set.
    for cls, meths in ((Axes, ("clear", "cla")), (Figure, ("clf", "clear"))):
        for m in meths:
            corig = getattr(cls, m, None)
            if corig is None or getattr(corig, "_operon_prov", False):
                continue

            def cmk(corig=corig, is_fig=(cls is Figure)):
                def w(self, *a, **kw):
                    try:
                        if is_fig:
                            for ax in getattr(self, "axes", ()) or ():
                                if hasattr(ax, "_operon_src"):
                                    delattr(ax, "_operon_src")
                        elif hasattr(self, "_operon_src"):
                            delattr(self, "_operon_src")
                    except Exception:
                        pass
                    return corig(self, *a, **kw)
                w._operon_prov = True
                w.__wrapped__ = corig
                return w
            try:
                setattr(cls, m, cmk())
            except Exception:
                pass


def _prov_patch_yaml(ymod):
    # 3447965497: PyYAML's SafeRepresenter dispatches on EXACT type
    # (type(data).__mro__[0]) \u2014 so a _ProvStr leaf from the json.load
    # leaf-wrap lane raises RepresenterError under yaml.safe_dump. Register
    # the base-type representers for the three static _Prov* scalar classes
    # on both SafeDumper and Dumper so artifact-JSON \u2192 yaml round-trips.
    # Other strict \`type(x) is str\` consumers on artifact-JSON leaves
    # remain a documented tradeoff (leaf-wrap is what gives runtime recall
    # through json destructuring); escape hatch is OPERON_PROVENANCE_OFF=1.
    try:
        pairs = (
            (_ProvStr, "represent_str"),
            (_ProvInt, "represent_int"),
            (_ProvFloat, "represent_float"),
        )
        for dumper_name in ("SafeDumper", "Dumper"):
            D = getattr(ymod, dumper_name, None)
            if D is None:
                continue
            for cls, repname in pairs:
                rep = getattr(D, repname, None)
                if rep is not None and cls not in getattr(
                        D, "yaml_representers", {}):
                    D.add_representer(cls, rep)
    except Exception:
        pass


def _prov_patch_json(jmod):
    orig_load = jmod.load
    if not getattr(orig_load, "_operon_prov", False):
        def load(fp, *a, **kw):
            r = orig_load(fp, *a, **kw)
            try:
                vid = _prov_vid_of_path(getattr(fp, "name", None))
                if vid:
                    return _prov_wrap_container(r, {vid})
            except Exception:
                pass
            return r
        load._operon_prov = True
        load.__wrapped__ = orig_load
        jmod.load = load
    orig_loads = jmod.loads
    if not getattr(orig_loads, "_operon_prov", False):
        def loads(s, *a, **kw):
            r = orig_loads(s, *a, **kw)
            try:
                t = getattr(s, "_prov_tags", None)
                if t:
                    return _prov_wrap_container(r, t)
            except Exception:
                pass
            return r
        loads._operon_prov = True
        loads.__wrapped__ = orig_loads
        jmod.loads = loads
    orig_dump = jmod.dump
    if not getattr(orig_dump, "_operon_prov", False):
        def dump(obj, fp, *a, **kw):
            r = orig_dump(obj, fp, *a, **kw)
            try:
                _prov_record_write(getattr(fp, "name", None),
                                   _prov_tags_of(obj))
            except Exception:
                pass
            return r
        dump._operon_prov = True
        dump.__wrapped__ = orig_dump
        jmod.dump = dump


def _prov_patch_pickle(pmod):
    if not getattr(pmod.load, "_operon_prov", False):
        orig = pmod.load

        def load(fp, *a, **kw):
            r = orig(fp, *a, **kw)
            try:
                vid = _prov_vid_of_path(getattr(fp, "name", None))
                if vid:
                    _prov_tag(r, {vid})
            except Exception:
                pass
            return r
        load._operon_prov = True
        load.__wrapped__ = orig
        pmod.load = load
    if not getattr(pmod.dump, "_operon_prov", False):
        orig_d = pmod.dump

        def dump(obj, fp, *a, **kw):
            r = orig_d(obj, fp, *a, **kw)
            try:
                _prov_record_write(getattr(fp, "name", None),
                                   _prov_tags_of(obj))
            except Exception:
                pass
            return r
        dump._operon_prov = True
        dump.__wrapped__ = orig_d
        pmod.dump = dump


def _prov_patch_anndata(ad):
    for r in ("read_h5ad", "read", "read_csv", "read_loom", "read_zarr"):
        if hasattr(ad, r):
            setattr(ad, r, _prov_wrap_reader(getattr(ad, r), 0, "filename"))
    try:
        A = ad.AnnData
    except Exception:
        return
    _prov_wrap_method_writer(A, "write", 0, "filename")
    _prov_wrap_method_writer(A, "write_h5ad", 0, "filename")


def _prov_patch_scanpy(sc):
    for r in ("read", "read_h5ad", "read_10x_h5", "read_10x_mtx"):
        if hasattr(sc, r):
            setattr(sc, r, _prov_wrap_reader(getattr(sc, r), 0, "filename"))


def _prov_patch_PIL(mod):
    # mod is the PIL.Image SUBMODULE; open is module-level. (3447867046:
    # \`mod.Image\` is the Image CLASS, which has no .open -- wrapping it
    # silently no-ops.)
    try:
        if hasattr(mod, "open"):
            mod.open = _prov_wrap_reader(mod.open, 0, "fp")
    except Exception:
        pass


def _prov_patch_builtins_open():
    orig = _prov_builtins.open
    if getattr(orig, "_operon_prov", False):
        return

    class _ProvFile:
        """Thin proxy: .read() \u2192 _ProvStr/_ProvList[bytes] when the path is
        seeded; .write(data) records _prov_record_write(path, tags_of(data)).
        Delegates everything else. Used only when the path is seeded (read)
        or mode is write \u2014 untagged reads and non-write opens are untouched."""
        __slots__ = ("_fh", "_vid", "_wpath", "_wtags")

        def __init__(self, fh, vid=None, wpath=None, truncating=False):
            object.__setattr__(self, "_fh", fh)
            object.__setattr__(self, "_vid", vid)
            object.__setattr__(self, "_wpath", wpath)
            object.__setattr__(self, "_wtags", set())
            # 3447979449: a "w"/"x" open truncates at OPEN time \u2014 that IS
            # the last-writer boundary. Clear any stale _prov_written
            # entry here (once per handle; covers zero-write truncation,
            # writelines-only overwrites, and avoids per-write realpath
            # cost). Append mode ("a") doesn't truncate \u2014 prior bytes
            # remain on disk, so prior attribution must be PRESERVED
            # through this handle's writes (\uD83D\uDFE1 3448009015): seed _wtags
            # from the existing entry so the per-handle record is
            # \`prior \u222A new\`, not a replace.
            if wpath:
                try:
                    if truncating:
                        _prov_record_write(wpath, ())
                    else:
                        # \uD83D\uDFE1 3448765261 / \uD83D\uDFE1 3448796170: seed ONLY from the
                        # absolutized realpath \u2014 never the raw \`wpath\`
                        # (a bare-relative \`wpath\` can alias an
                        # unrelated file's as-written key). realpath
                        # resolves against cwd so it uniquely identifies
                        # the file on disk. Basename keying was dropped
                        # outright (ic 4765227282).
                        rp = _prov_os.path.realpath(wpath)
                        if rp in _prov_written:
                            self._wtags.update(_prov_written[rp])
                except Exception:
                    pass

        def read(self, *a, **kw):
            r = self._fh.read(*a, **kw)
            if self._vid and isinstance(r, str):
                return _ProvStr(r, {self._vid})
            if self._vid:
                _prov_tag(r, {self._vid})
            return r

        def write(self, data):
            try:
                t = _prov_tags_of(data)
                if t:
                    self._wtags |= t
                    # Eager-record only on a TAGGED write (3447979449):
                    # untagged trailing writes (\`json.dump(obj,f);
                    # f.write("\\n")\`) and append-mode writes must not pop
                    # attribution the dump-wrapper or a prior cell already
                    # set. The stale-entry clear for truncating modes
                    # happened once at __init__.
                    _prov_record_write(self._wpath, self._wtags)
            except Exception:
                pass
            return self._fh.write(data)

        def writelines(self, lines):
            # Stream (room #prov-shim-stress): don't list()-materialize a
            # generator. One pass writes + harvests; on error mid-stream
            # re-raise (can't replay a consumed iterator).
            try:
                t = set()
                for ln in lines:
                    self._fh.write(ln)
                    t |= _prov_tags_of(ln)
                if t:
                    self._wtags |= t
                    _prov_record_write(self._wpath, self._wtags)
            except Exception:
                raise
            return None

        def close(self):
            return self._fh.close()

        def __enter__(self):
            self._fh.__enter__()
            return self

        def __exit__(self, *a):
            return self._fh.__exit__(*a)

        def __iter__(self):
            v = self._vid
            for line in self._fh:
                yield _ProvStr(line, {v}) if (v and isinstance(line, str)) \\
                    else line

        def __next__(self):
            # 3447929913: \`next(open(artifact))\` header-skip idiom \u2014
            # dunders are type-looked-up, so __getattr__ doesn't cover it.
            line = next(self._fh)
            v = self._vid
            return _ProvStr(line, {v}) if (v and isinstance(line, str)) \\
                else line

        def __getattr__(self, name):
            return getattr(object.__getattribute__(self, "_fh"), name)

    # room #prov-shim-stress: one-line ABC virtual-subclass registration
    # so \`isinstance(open(p), io.IOBase)\` passes \u2014 several libs gate on
    # that before accepting a file-like.
    try:
        import io as _io
        _io.IOBase.register(_ProvFile)
    except Exception:
        pass

    def open_(file, mode="r", *a, **kw):
        fh = orig(file, mode, *a, **kw)
        try:
            if isinstance(mode, str):
                if any(c in mode for c in "wxa"):
                    return _ProvFile(
                        fh, wpath=file, truncating="a" not in mode)
                vid = _prov_vid_of_path(file)
                if vid:
                    _prov_tag(fh, {vid})
                    return _ProvFile(fh, vid=vid)
        except Exception:
            pass
        return fh
    open_._operon_prov = True
    open_.__wrapped__ = orig
    _prov_builtins.open = open_


def _prov_patch_orjson(mod):
    # orjson.dumps rejects str/int/float subclasses (room #prov-shim-
    # stress \u2014 only serializer break of 12 tested; fastapi/pydantic-v2
    # path). Wrap dumps to thread a default= that unwraps _Prov* to the
    # base type; compose with any user-supplied default.
    orig = getattr(mod, "dumps", None)
    if orig is None or getattr(orig, "_operon_prov", False):
        return
    OPT_NON_STR = getattr(mod, "OPT_NON_STR_KEYS", 0)

    def _unwrap_keys(o, cap):
        # ic 4765227282 \uD83D\uDFE02: _ProvStr from the pandas scalar-getter wrap
        # used as a dict KEY \u2014 orjson's exact-type check rejects it and
        # never calls default= for keys. Coerce ONLY str-subclass keys to
        # plain str (bounded walk); leave int/None/etc. alone so the
        # user's own type errors surface unchanged. Falls back to
        # OPT_NON_STR_KEYS past the cap (widens acceptance, but only on
        # a call that was already failing).
        if cap[0] <= 0:
            return o
        if isinstance(o, dict):
            cap[0] -= len(o)
            return {(str(k) if type(k) is not str and isinstance(k, str)
                     else k): _unwrap_keys(v, cap) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            cap[0] -= len(o)
            # Plain tuple() \u2014 namedtuples reject the single-gen-arg ctor
            # (ic 4770232531); JSON output is identical either way.
            t = list if isinstance(o, list) else tuple
            return t(_unwrap_keys(v, cap) for v in o)
        return o

    def dumps(obj, default=None, option=None):
        def _d(o):
            t = getattr(o, "_prov_tags", None)
            if t is not None:
                for base in (float, int, str):
                    if isinstance(o, base):
                        return base(o)
            if default is not None:
                return default(o)
            raise TypeError
        kw = {"option": option} if option is not None else {}
        try:
            return orig(obj, default=_d, **kw)
        except TypeError as e:
            if "key must be str" not in str(e).lower():
                raise
            cap = [_PROV_JSON_LEAF_CAP]
            o2 = _unwrap_keys(obj, cap)
            if cap[0] <= 0:
                kw["option"] = (option or 0) | OPT_NON_STR
            return orig(o2, default=_d, **kw)
    dumps._operon_prov = True
    dumps.__wrapped__ = orig
    mod.dumps = dumps


_PROV_PATCHERS = {
    "pandas": _prov_patch_pandas,
    "numpy": _prov_patch_numpy,
    "matplotlib.pyplot": _prov_patch_matplotlib,
    "json": _prov_patch_json,
    "yaml": _prov_patch_yaml,
    "orjson": _prov_patch_orjson,
    "pickle": _prov_patch_pickle,
    "anndata": _prov_patch_anndata,
    "scanpy": _prov_patch_scanpy,
    "PIL.Image": _prov_patch_PIL,
    # h5py is deliberately NOT patched (3447867048): h5py.File is a class,
    # and rebinding it to a function breaks isinstance/subclass/class-attr
    # uses in user code and in anndata/scanpy internals. The File object has
    # no dict .attrs so the wrap would be near-zero value anyway; h5ad
    # reads are covered via the anndata/scanpy patchers.
    "scipy.io": lambda m: setattr(
        m, "loadmat", _prov_wrap_reader(m.loadmat, 0, "file_name")
    ) if hasattr(m, "loadmat") else None,
    "torch": lambda m: setattr(
        m, "load", _prov_wrap_reader(m.load, 0, "f")
    ) if hasattr(m, "load") else None,
}


def _prov_apply(name):
    if name in _prov_patched or name not in _PROV_PATCHERS:
        return
    mod = _prov_sys.modules.get(name)
    if mod is None:
        return
    # __import__ fires on INNER recursive imports of a package from inside
    # its own __init__.py (e.g. pandas submodules do \`import pandas\`). At
    # that point sys.modules["pandas"] is partially loaded (no read_csv yet)
    # -- patching would be a no-op and _prov_patched would mark it done. The
    # importlib _initializing flag is True exactly during that window.
    spec = getattr(mod, "__spec__", None)
    if spec is not None and getattr(spec, "_initializing", False):
        return
    _prov_patched.add(name)
    try:
        _PROV_PATCHERS[name](mod)
    except Exception:
        pass


if not _PROV_OFF:
    # Patch anything already imported (json/pickle are stdlib, often loaded).
    for _n in list(_PROV_PATCHERS):
        _prov_apply(_n)
    _prov_patch_builtins_open()

    # __import__ hook: after the real import, apply any pending patcher.
    # Cheaper than a full MetaPathFinder/Loader wrapper and handles \`from X
    # import Y\` (fromlist) and submodule imports uniformly.
    _prov_real_import = _prov_builtins.__import__

    def _prov_import(name, globals=None, locals=None, fromlist=(), level=0):
        m = _prov_real_import(name, globals, locals, fromlist, level)
        try:
            # ic 4765227282: key on the top-level package regardless of
            # dotted form, and pass sys.modules[top] (not \`m\`, which for
            # \`import pandas.testing\` is the submodule). \`_prov_apply\`
            # reads from sys.modules so the second arm below is the same
            # lookup; keep both arms keyed on dotted patcher names
            # (matplotlib.pyplot) too.
            top = name.split(".", 1)[0]
            if top in _PROV_PATCHERS:
                _prov_apply(top)
            if name != top and name in _PROV_PATCHERS:
                _prov_apply(name)
            # \`from matplotlib import pyplot\` -> name="matplotlib",
            #   fromlist=("pyplot",) -> sys.modules has the dotted key.
            if fromlist:
                for f in fromlist:
                    dotted = f"{name}.{f}"
                    if dotted in _PROV_PATCHERS:
                        _prov_apply(dotted)
        except Exception:
            pass
        return m

    _prov_builtins.__import__ = _prov_import


# Attach the query surface onto host for in-kernel introspection; the
# TS side queries via a bare __operon_runtime_inputs__() eval so neither is
# load-bearing for the pipeline.
host._provenance = type("ns", (), {  # noqa: F821
    "path_to_vid": _prov_path_to_vid,
    "written": _prov_written,
    "tags_of": staticmethod(_prov_tags_of),
    "inputs_for": staticmethod(__operon_runtime_inputs__),
    "off": _PROV_OFF,
})()


# ---- host.artifact_path hook ---------------------------------------------
# sdk/artifacts.py assigned host.artifact_path = _op_artifact_path before
# this fragment loads. Wrap it so every runtime-resolved path registers into
# _prov_path_to_vid (the {{artifact:}} pre-exec path is seeded separately by
# the TS side via __operon_prov_seed).
try:
    _prov_orig_ap = host.artifact_path  # noqa: F821

    def _prov_artifact_path(version_id):
        p = _prov_orig_ap(version_id)
        if not _PROV_OFF:
            try:
                __operon_prov_seed({str(version_id): p})
            except Exception:
                pass
        return p

    _prov_artifact_path.__doc__ = _prov_orig_ap.__doc__
    host.artifact_path = _prov_artifact_path  # noqa: F821
except Exception:
    pass
`,zd_=`"""
Claude Science kernel SDK (base fragment) \u2014 installed via the first execute() after
kernel start.

Runs inside the kernel's namespace via exec(code, namespace). That namespace
only has __builtins__ \u2014 hence the explicit imports here.

FRAGMENT MODEL: this base fragment is ALWAYS sent. Gated fragments
(sdk/artifacts.py, sdk/compute.py, sdk/frames.py, sdk/mcp.py,
sdk/supervision.py) are concatenated after it by agentConfigurator.ts based
on the agent's profile gates. Each later fragment assigns onto the
already-instantiated \`host\` object \u2014 \`host.children = _op_children\` \u2014
so ungated agents get a clean AttributeError instead of a host round-trip
for methods they shouldn't have.

Host-callback protocol (mid-execution RPC to the host):
    kernel -> host: {"type": "host_call", "id": "uuid", "method": "...", "args": [...]}
    host -> kernel: {"type": "host_response", "id": "uuid", "data": ...}
                  | {"type": "host_response", "id": "uuid", "error": "..."}

Host calls use the published protocol stdout/stdin (bypassing StringIO
capture) so user code can synchronously query the host during an execute().
"""

import json as _json
import os as _os
import select as _select
import sys as _sys
import threading as _threading
import uuid as _uuid

# Shared with kernel_worker._StreamingStdout.write and the final-response
# write so protocol lines can't interleave. Falls back to a private lock when
# running outside the kernel (tests / direct import).
_PROTOCOL_WRITE_LOCK = getattr(_sys, "_operon_protocol_lock", None) or _threading.Lock()
# Serializes the whole _host_call send\u2192ack\u2192reply sequence so concurrent
# callers (ThreadPoolExecutor fan-out) can't cross-consume each other's
# stdin replies. Distinct from _PROTOCOL_WRITE_LOCK: that one is held only
# per-line (shared with user print() via _StreamingStdout) and must not be
# held across the reply read, which may legitimately park for minutes.
# Published on sys so per-cell SDK re-exec (compute.ts postStartCode) keeps
# the SAME object \u2014 a fresh lock each cell would let a background thread
# parked in a prior cell's _host_call race a new cell's caller on stdin.
_HOST_CALL_LOCK = getattr(_sys, "_operon_host_call_lock", None) or _threading.Lock()
_sys._operon_host_call_lock = _HOST_CALL_LOCK
# kernel_worker.main() publishes the result pipe on a non-inheritable high fd
# as sys._operon_protocol_stdout (codon 187054f2 port \u2014 fd 1 itself now aliases
# stderr so subprocess stdout can't inject into / hold open the JSON stream).
# Fall back to __stdout__ only when no publisher exists (tests / direct import).
_PROTOCOL_STDOUT = getattr(_sys, "_operon_protocol_stdout", None) or _sys.__stdout__
# Same pattern for the reply read (#2599 r2 3359942418): kernel_worker
# publishes a private dup of fd 0 so \`exit()\`/\`quit()\`/user
# \`sys.stdin.close()\` (which close sys.stdin \u2014 and sys.__stdin__ is the
# same TextIOWrapper at startup) can't break the host-call reply read.
# Sharing the WORKER's dup (one wrapper, one buffer) also means the loop
# and the SDK can never interleave buffered reads; outside the kernel
# (tests / direct import) falls back to __stdin__.
# Resolved AT READ TIME, not snapshotted at install (#2599 r3
# 3361596379): the worker's readline-recovery path republishes
# sys._operon_protocol_stdin after re-dup'ing from the reserve fd (post
# #3360 fd 0 is /dev/null) \u2014 a module-level object ref captured here
# would keep reading the DEAD wrapper forever.
# Missing-only fallback (#2599 r5 3362037820): __stdin__ is used solely
# when NO publisher exists (outside the kernel \u2014 tests / direct import).
# A published-but-falsy value (None/0) must NOT route to __stdin__: that
# would spin up a SECOND BufferedReader over fd 0 and recreate exactly
# the two-buffer interleave the shared dup eliminates. Returning the
# falsy value instead fails the next read loudly (AttributeError), which
# the worker's recovery then heals.
_STDIN_MISSING = object()
# Whether a publisher existed when the SDK installed (#2599 r6
# 3362707637): inside the kernel the worker publishes before the SDK
# ever runs, so a MISSING attr later means it was DELETED \u2014 that must
# behave like the falsy arm (fail loudly, worker recovery heals), never
# fall back to __stdin__. Only a process where no publisher ever
# existed (tests / direct import) may use __stdin__.
_HAD_PUBLISHER = hasattr(_sys, "_operon_protocol_stdin")


def _protocol_stdin():
    s = getattr(_sys, "_operon_protocol_stdin", _STDIN_MISSING)
    if s is _STDIN_MISSING:
        if _HAD_PUBLISHER:
            return None  # deleted \u2014 next read fails loudly (AttributeError)
        return _sys.__stdin__
    return s


# Identity of the protocol stream at SDK install (#2599 r7 3363117743 \u2014
# the worker loop's pre-read theme extended to the SDK's in-cell RPC
# reply read; the SDK cannot import the worker's machinery, so it
# carries the same minimal shape itself). None outside the kernel or
# when the published stream has no real fd.
def _capture_protocol_ident():
    s = getattr(_sys, "_operon_protocol_stdin", None)
    fn = getattr(s, "fileno", None)
    if fn is None:
        return None
    try:
        st = _os.fstat(fn())
        return (st.st_dev, st.st_ino)
    except Exception:
        return None


_PROTOCOL_IDENT = _capture_protocol_ident()
_HOST_REPLY_DEADLINE_DEFAULT_S = 120.0


def _reply_deadline_s():
    # Seam on the existing bound, not new machinery (r7b): the deadline
    # is env-tunable via OPERON_SDK_REPLY_DEADLINE_S (default 120). Read
    # at CALL time, not install time, so a cell-scoped override (test
    # pins; an operator debugging a wedged channel) takes effect without
    # a kernel respawn \u2014 cost is one dict lookup per reply read.
    # Invalid or non-positive values fall back to the default.
    raw = _os.environ.get("OPERON_SDK_REPLY_DEADLINE_S")
    if raw:
        try:
            v = float(raw)
            if v > 0:
                return v
        except ValueError:
            pass
    return _HOST_REPLY_DEADLINE_DEFAULT_S


def _read_reply_line(bounded=True):
    # SCOPE (r7 3363117743): in-cell code can already do anything this
    # process can \u2014 this defends against ACCIDENTAL fd recycle
    # (daemonize close+reopen patterns, fd sweeps), not malice.
    # Identity compared PRE-read so a recycled number surfaces as a
    # clean error instead of reading a user file as the RPC reply.
    # DEADLINE SCOPE (PR #2753 finding 3368989979, closing #2599 thread
    # 3363405105): the bound applies only until the host ACKNOWLEDGES
    # receipt (host_ack, or the reply itself) \u2014 "the host always replies
    # promptly" is true for the ACK, not the reply: handlers legitimately
    # park for minutes-to-hours (delegate fan-outs, live approvals, long
    # llm_batch). After the ack the read is UNBOUNDED: host death closes
    # our stdin (readline -> ""), a severed/recycled fd trips the
    # identity pre-check. Both legs skipped for fd-less streams
    # (tests / synthetic delegates).
    stream = _protocol_stdin()
    fd = None
    fn = getattr(stream, "fileno", None)
    if fn is not None:
        try:
            fd = fn()
        except Exception:
            fd = None
    if fd is not None and _PROTOCOL_IDENT is not None:
        try:
            st = _os.fstat(fd)
        except OSError:
            raise RuntimeError(
                "host_call: reply stream fd is dead (closed/recycled)"
            )
        if (st.st_dev, st.st_ino) != _PROTOCOL_IDENT:
            raise RuntimeError(
                "host_call: reply stream identity lost (fd recycled)"
            )
        # Lockstep means at most one reply line is in flight per read, so
        # buffered-but-unread data (invisible to select on the raw fd)
        # can't false-trigger the deadline in the single-reader protocol;
        # in an already-desynced burst this degrades to loud-and-bounded
        # instead of fast resync, which is the right trade.
        if bounded:
            ready, _, _ = _select.select([fd], [], [], _reply_deadline_s())
            if not ready:
                raise RuntimeError(
                    "host_call: no reply within %ss (protocol channel lost)"
                    % _reply_deadline_s()
                )
    return stream.readline()


def _host_call(method: str, args: list):
    """Synchronous RPC to the host process, usable mid-execution.

    Writes a host_call message to the published protocol stdout
    (sys._operon_protocol_stdout \u2014 bypassing StringIO capture) and blocks
    reading the published protocol stdin for a host_response. The host's
    _readProtocolResponse() loop dispatches the call and writes back before
    continuing to wait for this execution's final result.
    """
    call_id = str(_uuid.uuid4())
    req = {"type": "host_call", "id": call_id, "method": method, "args": args}
    try:
        line = _json.dumps(req, allow_nan=False)
    except (ValueError, TypeError) as e:
        # Non-finite floats (inf/nan) \u2192 ValueError; non-JSON-native objects
        # (numpy scalars/arrays, datetime, set, bytes\u2026) \u2192 TypeError. Either
        # produces invalid JSON that the host can't parse \u2014 which deadlocks
        # the kernel (it blocks on stdin for a reply that never comes).
        # Fail here with a clear message instead.
        raise ValueError(
            f"host_call '{method}': args contain a non-JSON-serializable "
            f"value (inf/nan, or types like numpy/datetime/set \u2014 convert to "
            f"native Python first): {e}"
        ) from None
    # The host's stdout line splitter hard-fails at 16MB (MAX_LINE_BYTES,
    # base.ts) \u2014 exceeding it kills the kernel and loses all in-memory
    # state, with an error that blames stdout corruption. Inline base64
    # image blocks (\`\`{"type":"image","pil":...}\`\` tiles) are the realistic
    # way to get there. Reject before writing, while the kernel is still
    # alive to report it. Cheap char-length pre-filter; exact byte count
    # only when close to the cap.
    if len(line) > 8 * 1024 * 1024:
        _nbytes = len(line.encode("utf-8", errors="surrogatepass"))
        if _nbytes > 15 * 1024 * 1024:
            raise ValueError(
                f"host_call {method!r}: serialized request is "
                f"{_nbytes} bytes, exceeding the 15MB wire cap (the host "
                f"kills the kernel at 16MB). For LLM requests, pass "
                f"images=[workspace paths] instead of inline base64/PIL "
                f"content blocks \u2014 the host reads and downsamples paths "
                f"without the payload crossing the kernel wire."
            )
    with _HOST_CALL_LOCK:
        with _PROTOCOL_WRITE_LOCK:
            _PROTOCOL_STDOUT.write(line + "\\n")
            _PROTOCOL_STDOUT.flush()
        # Discard id-mismatched replies \u2014 a SIGINT during the readline of a
        # prior host_call can leave that call's reply on stdin, which this
        # call would otherwise consume (silent wrong data, off-by-one for the
        # rest of the cell). The host-side write-suppression on soft-interrupt
        # handles the common case; this loop is the general guard. Bounded so
        # a host bug (missing id) surfaces as an error rather than a hang.
        acked = False
        discards = 0
        while True:
            line = _read_reply_line(bounded=not acked)
            if not line:
                raise RuntimeError("host_call: stdin closed (host terminated?)")
            # Every non-matching frame shape counts toward the SAME bounded
            # discard budget (recovered build-1212375 family merged_bug_002;
            # parse failures too \u2014 finding 3369738624): an exempt class
            # (stale acks, non-dict JSON values, non-JSON bytes) would defeat
            # the "a host bug surfaces as an error rather than a hang"
            # contract \u2014 unbounded consumption of whatever keeps arriving,
            # or a raw JSONDecodeError escaping into user code.
            try:
                resp = _json.loads(line)
            except ValueError:
                resp = None  # falls through to the discard budget below
            if isinstance(resp, dict):
                if resp.get("type") == "host_ack":
                    # Receipt ack (no \`id\` on purpose \u2014 see _read_reply_line).
                    # Only OUR first ack lifts the deadline; a stale ack for a
                    # prior SIGINT-abandoned call, or a duplicate, is a host
                    # bug and falls through to the discard budget.
                    if resp.get("for") == call_id and not acked:
                        acked = True
                        continue
                elif resp.get("id") == call_id:
                    break
            discards += 1
            if discards >= 8:
                raise RuntimeError(
                    f"host_call {method!r}: no matching reply id after 8 reads "
                    f"(protocol desync \u2014 restart the kernel)"
                )
        if resp.get("error") is not None:
            raise RuntimeError(f"host_call {method!r} failed: {resp['error']}")
        return resp.get("data")


def _llm_encode_pil(r):
    """Encode \`\`{"type":"image","pil":Image}\`\` content blocks to inline
    base64 PNG so callers can fan out in-memory tiles without writing them
    to the workspace (where auto-view would attach up to 20 as vision
    blocks and skip the rest). Non-dict message entries never reach this
    function on the dispatch paths \u2014 \`\`_llm_req_guard\`\` refuses them
    client-side, whole-call, before encoding (#2957); the isinstance
    pass-throughs below are defensive only."""
    if not isinstance(r, dict):
        return r
    ms = r.get("messages")
    if not isinstance(ms, list):
        return r
    out = []
    changed = False
    for m in ms:
        if not isinstance(m, dict):
            out.append(m)
            continue
        c = m.get("content")
        if not isinstance(c, list):
            out.append(m)
            continue
        blocks = []
        for b in c:
            if isinstance(b, dict) and b.get("type") == "image" and "pil" in b:
                try:
                    import base64 as _b64
                    import io as _bio
                    img = b["pil"]
                    if img.mode not in ("RGB", "RGBA", "L"):
                        img = img.convert("RGB")
                    buf = _bio.BytesIO()
                    img.save(buf, "PNG")
                    # Preserve sibling keys the caller set on the block
                    # (cache_control etc.) \u2014 only "pil" is replaced by
                    # "source". Mirrors the except-path below.
                    new_b = {k: v for k, v in b.items() if k != "pil"}
                    new_b["source"] = {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": _b64.b64encode(buf.getvalue()).decode(),
                    }
                    blocks.append(new_b)
                    changed = True
                except Exception:
                    # Non-PIL value (None from a failed .crop(), a path
                    # str, bytes, ndarray). Strip the "pil" key so the
                    # block stays JSON-serializable \u2014 _host_call's
                    # json.dumps would otherwise raise on bytes/ndarray
                    # and kill the whole batch pre-dispatch. The host
                    # rejects the now-sourceless image block per-request
                    # with {error} (per-request isolation).
                    blocks.append(
                        {k: v for k, v in b.items() if k != "pil"}
                    )
                    changed = True
            else:
                blocks.append(b)
        out.append({**m, "content": blocks} if changed else m)
    return {**r, "messages": out} if changed else r



def _llm_req_guard(req, label=""):
    # M4/M15: model='' silently coerces to the default host-side,
    # masking a typo-to-empty bug; max_tokens<1 / non-int
    # silently rides LLM_DEFAULT_MAX_TOKENS. Require valid or None \u2014
    # equally loud in BOTH lanes (\uD83D\uDD34 3378028316: the batch loop had
    # hand-mirrored only the model half; one predicate, both lanes
    # derive \u2014 label is "" for the single lane, f"requests[{i}]." for
    # the batch lane, producing byte-identical single-lane messages).
    # .strip() (\uD83D\uDFE1 3375199109): the resolution-site .trim() means a
    # whitespace-only model (f-string of an empty var) ALSO coerces to
    # the client default silently \u2014 same class, must be equally loud.
    # \\ufeff (\uD83D\uDFE1 3377128267): JS .trim() strips BOM, Python .strip()
    # does not \u2014 a BOM-only model (utf-8-sig file read without the
    # codec) would pass here and coerce host-side.
    if req.get("model") is not None and (
        not isinstance(req["model"], str)
        or not req["model"].replace("\\ufeff", "").strip()
    ):
        raise TypeError(
            f"host.llm: {label}model must be a non-empty str or None, "
            f"got {req['model']!r}"
        )
    # System prompts are host-controlled and rejected host-side (both
    # wires); a system-role message is the same thing by another name.
    # Fail fast client-side with a clearer, pre-dispatch error.
    # DELIBERATELY whole-call in the batch lane (not per-request {error}):
    # client-side guards are fail-fast-loud BY DESIGN \u2014 the model/
    # max_tokens halves of this predicate have raised whole-call since
    # \uD83D\uDD34 3378028316, and a pre-dispatch raise costs nothing (zero requests
    # sent) vs. silently burning N-1 dispatches around a typo. Per-request
    # isolation is the HOST's contract (the forgeable wire), unchanged.
    msgs = req.get("messages")
    if isinstance(msgs, (list, tuple)):
        for j, m in enumerate(msgs):
            if not isinstance(m, dict):
                # Shape error, not the system-override one \u2014 a typo'd
                # message must not read as a policy violation.
                raise TypeError(
                    f"host.llm: {label}messages[{j}] must be a "
                    f"{{'role', 'content'}} dict, got {type(m).__name__}"
                )
            role = m.get("role")
            if not isinstance(role, str):
                # Missing or non-string role (None, 5, True, ["user"]) is
                # a shape mistake, not an override attempt \u2014 keep the
                # policy wording off it (mirrors the host's
                # typeof-role-is-string branch).
                raise TypeError(
                    f"host.llm: {label}messages[{j}] has no string "
                    f"'role' (got {role!r}) \u2014 each message must be a "
                    f"{{'role', 'content'}} dict with role 'user' or "
                    f"'assistant'"
                )
            if role not in ("user", "assistant"):
                raise TypeError(
                    f"host.llm: {label}messages[{j}].role must be 'user' "
                    f"or 'assistant', got {role!r} \u2014 use the "
                    f"top-level \`system\` field instead"
                )
    if req.get("max_tokens") is not None and (
        not isinstance(req["max_tokens"], int)
        or isinstance(req["max_tokens"], bool)
        or req["max_tokens"] < 1
    ):
        raise TypeError(
            f"host.llm: {label}max_tokens must be a positive int or "
            f"None, got {req['max_tokens']!r}"
        )

class _LineageAccessor:
    """Lazy dict-like: host.lineage[version_id] -> {code, messages, env, inputs,
    artifact_id, version_id, filename, frame_id, project_id,
    producing_cell_id, checksum, extraction_pending}.

    \`inputs\` is a list of {version_id, filename, path} dicts \u2014 \`path\` is the
    resolved filesystem path that appears in \`code\`. May be empty if the
    artifact has no dependencies. Recurse host.lineage[inp["version_id"]]
    to walk upstream to source data \u2014 don't parse paths for ids.
    \`env["environment_name"]\` is the conda env. \`messages\` can be large
    (dozens of messages) \u2014 slice, don't print.
    \`frame_id\` / \`producing_cell_id\` bridge to the producing session:
    query \`frames\` / \`execution_log\` via host.query() for the transcript.
    \`checksum\` is the sha256 of the stored bytes (None = never hashed).
    \`extraction_pending\` True means lineage extraction/mapping hasn't
    settled for this version yet \u2014 inputs may still be incomplete. Pending
    responses are NOT cached: re-reading host.lineage[vid] retries.

    Edit in-place, don't re-emit:
        lin = host.lineage[vid]
        old = lin["inputs"][0]["path"]
        assert old in lin["code"]  # .replace() is literal; whitespace matters
        exec(lin["code"].replace(old, new_path))

    When batching across inputs, also swap the OUTPUT filename or each
    iteration overwrites the last. To replay without clobbering your
    locals: exec(lin["code"], {}, {}).

    WALKING A DAG? Use host.lineage.graph(vid) FIRST \u2014 it returns the
    whole ancestry topology (nodes + edges) in ONE cheap call with zero
    LLM extraction. host.lineage[vid] per node does a full host-side
    extraction each call (code + conversation slice + env) \u2014 minutes on a
    deep graph. Fetch per-node [vid] payloads only for the few nodes you
    actually need code/messages from.
    """

    def __init__(self):
        self._cache = {}

    def __getitem__(self, version_id):
        # Client-side guard \u2014 an int \`host.lineage[42]\` would otherwise be
        # coerced str() on the host side, then fail with a misleading
        # "version 42 not found" that sounds like the record doesn't exist.
        if not isinstance(version_id, str):
            raise TypeError(
                f"host.lineage[...]: version_id must be a non-empty str (UUID), "
                f"got {type(version_id).__name__}"
            )
        if not version_id:
            raise ValueError(
                "host.lineage[...]: version_id must be a non-empty str "
                "(got empty str)"
            )
        # UUIDs are case-insensitive (RFC 4122); the host stores lowercase.
        # Uppercase \u2192 "not found" was a real audit finding.
        version_id = version_id.lower()
        cached = self._cache.get(version_id)
        if cached is not None:
            return cached
        res = _host_call("get_lineage", [version_id])
        # Don't lock in a mid-extraction read (bughunter 3384969343): a
        # response with extraction_pending=True has incomplete \`inputs\`;
        # caching it would pin the stale snapshot for the whole session and
        # make the documented paced re-read (poll periodically \u2014 retries
        # are ~30s apart and bounded, 3386767475) a silent no-op.
        # Pending responses stay uncached, so re-reading [vid] retries the
        # host (and the host-side read itself re-triggers pending re-maps).
        if not (isinstance(res, dict) and res.get("extraction_pending")):
            self._cache[version_id] = res
        return res

    def __contains__(self, version_id: str):
        """True if version_id has already been fetched into the local cache.

        NOT an existence probe against the host \u2014 a version_id that exists
        but hasn't been fetched yet returns False.
        """
        return version_id in self._cache

    def graph(self, version_id, direction="up", max_depth=None, max_nodes=None):
        """Lineage DAG topology in one call \u2014 NO extraction, NO LLM cost.

        Returns {root_version_id, direction, truncated, extraction_pending,
        nodes, edges}:
          nodes: [{version_id, artifact_id, filename, version_number,
                   frame_id, producing_cell_id, created_at, content_type,
                   size_bytes, language, checksum, has_extracted_code}, ...]
          edges: [{version_id, depends_on_version_id, reference_name}, ...]
                 (version_id DEPENDS ON depends_on_version_id)

        direction="up" walks ancestors (what this was made from);
        "down" walks descendants (what was made from it).
        truncated=True means max_nodes cut the frontier \u2014 re-query from a
        frontier node or raise max_nodes.

        extraction_pending (about the ROOT version): dependency edges are
        written ASYNCHRONOUSLY after save_artifacts (a background LLM
        extraction pass, seconds). True = extraction/mapping is still in
        flight for the root. **0 edges + extraction_pending=True means
        "not extracted YET"; it does NOT mean the artifact has no
        dependencies.** graph() itself is a pure read and never drives
        the extraction \u2014 to make a stuck-pending mapping converge, read
        host.lineage[vid] (that call retries the mapping; retries are
        paced ~30s apart and bounded, so poll it periodically \u2014 not in a
        tight loop \u2014 until extraction_pending clears), then graph() again. False does not guarantee
        edges exist (an extraction interrupted by a daemon restart leaves
        the flag False with no edges recorded). direction="down" caveat:
        the flag still describes only the ROOT's own extraction \u2014 a
        descendant saved moments ago writes its edge asynchronously too,
        so a down-walk can show 0 edges with extraction_pending=False;
        re-read when recent saves may be in flight.

        Per-node checksum is the sha256 of the stored bytes (None = never
        hashed: pre-checksum rows or oversized/degraded registrations).

        Never cached (topology changes as new versions land). Fetch
        host.lineage[vid] afterwards ONLY for nodes whose code/messages
        you need \u2014 that call is expensive per node.
        """
        if not isinstance(version_id, str) or not version_id:
            raise TypeError(
                "host.lineage.graph(...): version_id must be a non-empty "
                f"str (UUID), got {type(version_id).__name__}"
            )
        if direction not in ("up", "down"):
            raise ValueError(
                f"host.lineage.graph(...): direction must be 'up' or 'down', got {direction!r}"
            )
        opts = {"direction": direction}
        if max_depth is not None:
            opts["max_depth"] = int(max_depth)
        if max_nodes is not None:
            opts["max_nodes"] = int(max_nodes)
        return _host_call("get_lineage_topology", [version_id.lower(), opts])

    def clear(self):
        """Drop all cached lineage entries (next access re-fetches from host)."""
        self._cache.clear()


class _QueryAccessor:
    """Callable query object \u2014 \`\`host.query(sql)\`\` runs a query,
    \`\`host.query.schema()\`\` returns the queryable-table schema."""

    def __repr__(self):
        return "<host.query \u2014 call with SQL or use .schema() for table info>"

    def __call__(self, sql, params=None, limit=None, df=False, scope="project"):
        """Run read-only SQL against the Claude Science metadata DB.

        Available via the \`repl\` tool only \u2014 from the \`python\`/\`r\` tools
        this raises; run the query there and write results to a file in
        your workspace to hand off.

        Engine-level readonly connection; denylist blocks secrets/credentials
        tables; row/cell/total caps keep output bounded; 5s timeout.

        Dialect: SQLite with epoch-ms timestamps (compare with
        strftime('%s','now')*1000), 0/1 booleans, recursive CTEs OK.

        scope="project" (default) shadows project-owned tables (artifacts,
        frames, notes, \u2026) with the current project only \u2014 unchanged behavior.
        scope="global" drops that shadow so the query sees every project's
        rows; join on \`project_id\` to see where each row came from. Reads
        only \u2014 the connection is opened readonly. Memories and secrets
        tables are scoped/blocked in both modes.

        df=True returns a pandas.DataFrame; if pandas isn't importable,
        falls back to the raw dict with a note on stderr.
        """
        if not isinstance(sql, str):
            raise TypeError(
                f"host.query: sql must be a str, got {type(sql).__name__}"
            )
        if not sql.strip():
            raise ValueError("host.query: sql must be a non-empty str")
        if params is not None and not isinstance(params, (list, tuple)):
            raise TypeError(
                f"host.query: params must be a list or tuple, got "
                f"{type(params).__name__}. (dicts iterate keys, strings "
                f"iterate chars \u2014 both produce silent wrong results.)"
            )
        if limit is not None and (
            not isinstance(limit, int) or isinstance(limit, bool) or limit < 1
        ):
            raise TypeError(
                f"host.query: limit must be a positive int or None, got {limit!r}"
            )
        if not isinstance(df, bool):
            raise TypeError(
                f"host.query: df must be a bool, got {type(df).__name__}"
            )
        if scope not in ("project", "global"):
            raise ValueError(
                f"host.query: scope must be 'project' or 'global', "
                f"got {scope!r}"
            )
        result = _host_call("query_db", [sql, list(params or []), limit, scope])  # noqa: F821
        if not df:
            return result
        try:
            import pandas as pd
        except ImportError:
            print(
                "host.query: pandas not available, returning raw dict",
                file=_sys.stderr,
            )
            return result
        return pd.DataFrame(result["rows"], columns=result["columns"])

    def schema(self):
        """Return the queryable-table schema: {table_name: [col, ...], ...}.

        Use this to discover which tables and columns are available before
        writing SQL \u2014 e.g. \`\`host.query.schema()["artifact_versions"]\`\`
        shows that \`\`content_type\`\` lives there, not on \`\`artifacts\`\`.
        """
        return _host_call("query_schema", [])  # noqa: F821


# \u2500\u2500 Contact-email exceptions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# The \`get_user_email\` host call NEVER throws for a missing address \u2014 the
# host's deny-on-failure posture returns a soft \`{email, status, message?}\`
# dict (status "allowed" / "declined" / "unavailable"). The SDK normalizes
# that into a typed raise (same idiom as the other soft-dict\u2192raise wrappers:
# host.compute / host.agents / host.artifacts) so user code gets the address
# as a plain \`str\` or a catchable exception, never a dict to inspect.
#
# Defined at module level so the names land in the kernel namespace, AND
# re-exposed as class attributes on \`_OperonSDK\` below so the documented
# spelling \`except operon.ContactEmailUnavailable:\` works (the singleton is
# also registered as the \`operon\`/\`host\` modules in sys.modules).
class ContactEmailUnavailable(RuntimeError):
    """\`\`host.get_user_email()\`\` could not return an address.

    \`\`status\`\` is \`\`"unavailable"\`\`: no consent decision could be obtained
    (or the payload was unusable). The subclass
    :class:\`ContactEmailDeclined\` (\`\`status == "declined"\`\`) means the user
    explicitly said no \u2014 it IS-A \`\`ContactEmailUnavailable\`\`, so a single
    \`\`except operon.ContactEmailUnavailable:\`\` handles both. \`\`str(e)\`\` is
    the host's guidance verbatim; the recovery is always the same: omit the
    email parameter \u2014 most services work without it. Never ask the user for
    an address and never fabricate one.
    """

    status = "unavailable"
    # Mirrors the host's \`message\` for this status \u2014 used only when the
    # host omitted the field.
    _DEFAULT_MESSAGE = (
        "No contact-email decision could be obtained. Omit the parameter "
        "\u2014 most services work without it."
    )

    def __init__(self, message=None):
        super().__init__(message or self._DEFAULT_MESSAGE)


class ContactEmailDeclined(ContactEmailUnavailable):
    """The user explicitly declined to share a contact email.

    Do NOT ask the user for an address. Subclass of
    :class:\`ContactEmailUnavailable\` on purpose: the recovery is identical
    (omit the parameter), so one \`\`except\`\` clause covers both.
    """

    status = "declined"
    _DEFAULT_MESSAGE = (
        "The user declined to share a contact email. Do not ask the "
        "user; omit the parameter \u2014 most services work without it."
    )


# Re-exec identity. The repl kernel re-executes this bundle before EVERY
# cell (executeKernelCode in the daemon\u2019s compute tool \u2014 anti-monkey-patch),
# and \`except\` matches by CLASS IDENTITY: a fresh pair of class objects per
# exec would make \`except h.ContactEmailUnavailable:\` silently miss on any
# handle minted by an earlier exec \u2014 exactly what the documented
# \`import host\` / \`import operon\` recovery hands out, since sys.modules
# keeps the FIRST singleton (setdefault below). Same one-object-per-process
# discipline as _HOST_CALL_LOCK at the top of this file: the first exec
# publishes the pair on \`sys\`; every later exec adopts it, so the kernel
# only ever sees ONE class object per name.
_CE_EXC_PRIOR = getattr(_sys, "_operon_contact_email_excs", None)
if _CE_EXC_PRIOR is None:
    _sys._operon_contact_email_excs = (
        ContactEmailUnavailable,
        ContactEmailDeclined,
    )
else:
    ContactEmailUnavailable, ContactEmailDeclined = _CE_EXC_PRIOR


# Extension pattern (developer-facing \u2014 not part of help(host)): add a
# method delegating to _host_call("name", [args]) in the appropriate gated
# fragment (sdk/artifacts.py, sdk/supervision.py, etc.), register a matching
# handler in hostCalls.ts, and add a doc section to the matching
# RULES_OPERON_SDK_* prompt key.
class _OperonSDK:
    """Singleton exposed to user code as \`host\` (legacy alias: \`operon\`).

    Host-backed accessors that fetch data from the Claude Science process on demand
    via the host-callback protocol. All I/O is synchronous \u2014 a __getitem__
    or method call blocks until the host responds.

    Currently exposes:
        host.lineage[version_id] -> {"code": str, "messages": list,
                                       "env": dict, "inputs": list}
        host.llm(prompt_or_request_or_list, model=None,
                   max_tokens=None, max_concurrency=None, **options)
                                    -> {"text", "tool_use", "content",
                                        "model", "usage", "stop_reason"}
                                       for a single request, or a list of
                                       those (| {"error"}) for a list of
                                       requests (parallel fan-out)
        host.current_model()      -> str  (model id)
        host.list_models()        -> list[str]  (model ids)

    Via the \`repl\` tool only (not \`python\`/\`r\`):
        host.query(sql, params=None, limit=None, df=False, scope="project")
                                    -> {"columns": [...], "rows": [[...]],
                                        "row_count": int, "truncated": bool}
                                       or a pandas.DataFrame if df=True
        host.query.schema()       -> {table_name: [col, ...], ...}
        host.frames(...)          -> browse/search/detail frames; see
                                       help(host.frames)

    Plus host.artifacts(...), host.artifact_path(vid), and
    host.artifact_marker(vid) \u2014 see help(host.artifacts).
    When a remote compute provider is configured you also get host.compute
    (submit/wait/ssh/scp). Agents with subtask delegation also get
    host.children().
    """

    # Exception surface for get_user_email() (defined at module level
    # above). Class attributes so the documented agent spelling
    # \`except operon.ContactEmailUnavailable:\` resolves through the
    # singleton (and through \`import operon\`, which binds the same object
    # via sys.modules below) without relying on the kernel-namespace
    # globals.
    ContactEmailUnavailable = ContactEmailUnavailable
    ContactEmailDeclined = ContactEmailDeclined

    def __init__(self):
        self.lineage = _LineageAccessor()

    def llm(self, request=None, system=None, model=None, max_tokens=None,
            max_concurrency=None, **options):
        """Sample from the Anthropic API via the host's LLM client.

        Omitting \`\`model=\`\` uses the kernel utility default (Haiku-class,
        via \`\`[llm] kernel_default_model\`\`) \u2014 the right choice for
        extraction, classification, and per-chunk fan-out. For harder
        reasoning pass \`\`model=host.current_model()\`\` to run at your own
        model's level (roughly 10-30\xD7 the Haiku-class cost). Never hardcode
        a literal model-id string \u2014 model ids change across releases and a
        stale id routes to an older or retired model; resolve at runtime
        via \`\`host.current_model()\`\` or \`\`host.list_models()\`\`.

        One surface, three input shapes \u2014 the return type mirrors the
        input (single request in \u2192 single result dict out, list in \u2192
        list out, positionally matched):

        1. **Prompt string** (the classic form)::

               host.llm("Summarize this abstract: ...")["text"]
               host.llm("Be terse. Summarize: ...", max_tokens=200)

        2. **Single request dict / kwargs** \u2014 same fields as a batch
           entry, so a single call can use tools / images / messages::

               host.llm(prompt="...", tools=[tool],
                          tool_choice={"type": "tool", "name": "classify"})
               host.llm({"prompt": "what is in this image?",
                           "images": ["plot.png"]})

        3. **List of request dicts** (or bare prompt strings) \u2014 parallel
           fan-out. The host-call protocol is serial (one blocking
           readline per call), so a Python loop over \`\`host.llm()\`\`
           runs one-at-a-time; passing a list ships the whole batch to
           the host, which runs them concurrently (worker pool,
           \`\`max_concurrency\`\` at a time, cap 32) and returns results
           in order::

               host.llm([{"prompt": p} for p in page_texts],
                        max_concurrency=16)

        Each request (dict form) accepts any of:
            prompt       \u2014 str; single-turn user text (simplest form)
            messages     \u2014 list of {"role","content"}; role must be "user"
                           or "assistant"; content may be a str or a list
                           of content blocks (e.g. image blocks)
            images       \u2014 list of workspace-relative paths (max 20 per
                           request); host reads each file (capped at 32MB),
                           downsamples to API limits, and prepends as
                           image blocks to the user message. Prefer this
                           over base64-in-messages for large batches \u2014 paths
                           keep the kernel\u2192host wire small. For in-memory
                           tiles you don't want on disk (where auto-view
                           would attach them), pass a PIL.Image directly in
                           a content block as \`\`{"type":"image","pil":img}\`\`
                           \u2014 the wrapper base64-encodes it inline with no
                           downsample, so keep each image \u2264~1500px/side (or
                           use \`\`images=[path]\`\` for host-side resizing).
                           The whole call is rejected if the serialized
                           request exceeds 15MB \u2014 batch many tiles via
                           \`\`images=[path]\`\`, not inline PIL.
            model        \u2014 model id (default: the kernel utility
                           default \u2014 Haiku-class via
                           \`\`[llm] kernel_default_model\`\` \u2014 NOT the
                           session model). For session-level reasoning
                           pass \`\`host.current_model()\`\`; never a
                           hardcoded literal id (they go stale)
            max_tokens   \u2014 per-request output cap (default 4096, max
                           32768). Hard cap for list-form requests and any
                           single request using tools/images/messages/
                           temperature (truncation \u2192 \`\`stop_reason ==
                           "max_tokens"\`\`). A plain text-only single
                           request keeps the legacy serial behavior where
                           the host transparently continues past
                           max_tokens \u2014 see the dispatch note below.
            tools        \u2014 list of tool schemas for structured output
            tool_choice  \u2014 e.g. {"type":"tool","name":"classify_page"} to
                           force a specific tool
            temperature  \u2014 float

        A single request returns
        \`\`{"text", "tool_use", "content", "model", "usage", "stop_reason"}\`\`
        (\`\`tool_use\`\` is the first tool_use block's \`\`{"name","input"}\`\` or
        None; plain-prompt calls return the same shape without
        \`\`tool_use\`\`/\`\`content\`\`) and raises \`\`RuntimeError\`\` on failure.
        A list returns one such dict per request \u2014 or \`\`{"error": str}\`\`
        for the requests that failed. One bad request does not fail the
        batch. External builds enforce a per-frame token ceiling
        (\`\`[llm] kernel_sdk_token_ceiling\`\`, default 2M) \u2014 the call
        that crosses completes; the next raises \`\`RuntimeError\`\`.
        Per-call bounds still apply (e.g. at most 512
        requests per batched call \u2014 chunk bigger inputs).

        \`\`stop_reason == "max_tokens"\`\` means output was truncated \u2014
        re-issue with a larger \`\`max_tokens\`\` or chunk the input.

        \`\`system\`\` (str, optional, \u226464 KB) is accepted and forwarded to
        the host, which wraps it in a safeguards envelope and appends it
        AFTER the host's own system floor \u2014 it never speaks with harness
        authority. \`\`<\`\`/\`\`>\`\` in \`\`system\`\` are mapped to \`\`\u2039\`\`/\`\`\u203A\`\`
        by the host, so use non-angle-bracket delimiters for
        structured-output instructions. Pass \`\`model\`\`/\`\`max_tokens\`\` by
        keyword, never positionally.

        Dispatch note: a single request that uses only
        \`\`prompt\`\`/\`\`model\`\`/\`\`max_tokens\`\` goes over the
        legacy serial wire, which auto-continues past \`\`max_tokens\`\` (so
        truncation is rare and \`\`stop_reason\`\` is usually \`\`"end_turn"\`\`).
        Adding any of \`\`tools\`\`/\`\`tool_choice\`\`/\`\`images\`\`/\`\`messages\`\`/
        \`\`temperature\`\` \u2014 or passing a list \u2014 routes through the batch
        wire where \`\`max_tokens\`\` is a hard cap.

        Example \u2014 classify every page of a PDF in parallel::

            tool = {"name": "classify", "input_schema": {"type": "object",
                    "properties": {"relevant": {"type": "boolean"},
                                   "score": {"type": "number"}},
                    "required": ["relevant", "score"]}}
            reqs = [{"prompt": f"Page {i}:\\\\n{txt}\\\\nRelevant to: {query}?",
                     "tools": [tool],
                     "tool_choice": {"type": "tool", "name": "classify"},
                     "max_tokens": 256}
                    for i, txt in enumerate(page_texts)]
            for r in host.llm(reqs, max_concurrency=16):
                if "error" not in r:
                    print(r["tool_use"]["input"]["score"])
        """
        # \`system\` is accepted (host wraps it in the safeguards envelope
        # and appends after its own floor). Non-string values are refused
        # pre-dispatch so the shape error is Python-native. \`None\` stays a
        # no-op (legacy wire shape).
        if system is not None and not isinstance(system, str):
            raise TypeError(
                f"host.llm: system must be a str or None, got "
                f"{type(system).__name__}"
            )
        # \u2500\u2500 list \u2192 parallel fan-out, returns a list \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        # **options / free-form dicts silently absorb misspelled fields
        # (max_token=, tool=[...], temprature=) \u2014 the typo'd option is
        # dropped and the call "succeeds" without it. Reject unknown
        # fields up front, on both the list and single-request paths.
        _known = {"prompt", "messages", "images", "model", "system",
                  "max_tokens", "tools", "tool_choice", "temperature"}
        if isinstance(request, (list, tuple)):
            if (system is not None or model is not None
                    or max_tokens is not None or options):
                raise TypeError(
                    "host.llm: when passing a list of requests, put "
                    "per-request options (system/model/max_tokens/"
                    "tools/...) inside each request dict"
                )
            if max_concurrency is not None and (
                not isinstance(max_concurrency, int)
                or isinstance(max_concurrency, bool)
                or max_concurrency < 1
            ):
                raise TypeError(
                    f"host.llm: max_concurrency must be a positive int "
                    f"or None, got {max_concurrency!r}"
                )
            reqs = []
            for i, r in enumerate(request):
                if isinstance(r, str):
                    reqs.append({"prompt": r})
                elif isinstance(r, dict):
                    # A None \`system\` placeholder (legacy kwargs-with-
                    # defaults helpers) is dropped silently, matching the
                    # host's null tolerance. Non-string values get a shape
                    # error pre-dispatch.
                    if r.get("system") is None:
                        r = {k: v for k, v in r.items() if k != "system"}
                    elif not isinstance(r["system"], str):
                        raise TypeError(
                            f"host.llm: requests[{i}].system must be a "
                            f"str or None, got "
                            f"{type(r['system']).__name__}"
                        )
                    _unknown = set(r) - _known
                    if _unknown:
                        raise TypeError(
                            f"host.llm: requests[{i}] has unknown "
                            f"field(s) {sorted(_unknown)!r}; valid fields "
                            f"are {sorted(_known)!r}"
                        )
                    if (r.get("prompt") is not None
                            and r.get("messages") is not None):
                        raise TypeError(
                            f"host.llm: requests[{i}] has both 'prompt' "
                            f"and 'messages' \u2014 the host uses messages and "
                            f"silently ignores the prompt; pass one or "
                            f"the other"
                        )
                    # M4/M15 parity for the batch lane (\uD83D\uDD34 3376841752,
                    # completed by \uD83D\uDD34 3378028316): the single-request guard
                    # below never runs for list-form \u2014 without this, a
                    # whitespace-only per-request model, a smuggled
                    # system-role message, or a bad max_tokens (silently
                    # coerced to the default) ride a \u2264512-request
                    # fan-out without a sound. Shared predicate with the
                    # single lane \u2014 see _llm_req_guard.
                    _llm_req_guard(r, label=f"requests[{i}].")
                    reqs.append(r)
                else:
                    raise TypeError(
                        f"host.llm: requests[{i}] must be a dict or a "
                        f"prompt str, got {type(r).__name__}"
                    )
            if not reqs:
                return []
            return _host_call(
                "llm_batch", [[_llm_encode_pil(r) for r in reqs], max_concurrency]
            )

        if max_concurrency is not None:
            raise TypeError(
                "host.llm: max_concurrency only applies when passing a "
                "list of requests"
            )

        # \u2500\u2500 normalize the single-request forms to one dict \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if isinstance(request, dict):
            if (system is not None or model is not None
                    or max_tokens is not None or options):
                raise TypeError(
                    "host.llm: pass options inside the request dict OR "
                    "as keyword arguments, not both"
                )
            req = dict(request)
            # Same policy as the list lane: silent drop for a legacy None
            # placeholder; non-string values get a shape error.
            if req.get("system") is None:
                req.pop("system", None)
            elif not isinstance(req["system"], str):
                raise TypeError(
                    f"host.llm: system must be a str or None, got "
                    f"{type(req['system']).__name__}"
                )
        elif isinstance(request, str) or request is None:
            req = dict(options)
            if isinstance(request, str):
                if "prompt" in req:
                    raise TypeError(
                        "host.llm: prompt given both positionally and as "
                        "a keyword"
                    )
                req["prompt"] = request
            if system is not None:
                req["system"] = system
            if model is not None:
                req["model"] = model
            if max_tokens is not None:
                req["max_tokens"] = max_tokens
        else:
            # F-05: llm(None)/llm(123) reached host and said "got object"
            # (JS typeof). Fail with the Python type name instead.
            raise TypeError(
                f"host.llm: expected a prompt str, a request dict, or a "
                f"list of request dicts; got {type(request).__name__}"
            )

        # \u2500\u2500 validate the single request \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        _unknown = set(req) - _known
        if _unknown:
            raise TypeError(
                f"host.llm: unknown request field(s) "
                f"{sorted(_unknown)!r}; valid fields are {sorted(_known)!r}"
            )
        # Applies to all three single-request shapes (positional str +
        # kwargs, pure kwargs, request dict) \u2014 the host prefers messages
        # and would silently drop the prompt. Value check, not key
        # presence: messages=None from a kwargs-with-defaults helper is
        # not ambiguous (the host gates on a non-empty array).
        if (req.get("prompt") is not None
                and req.get("messages") is not None):
            raise TypeError(
                "host.llm: both 'prompt' and 'messages' given \u2014 the "
                "host uses messages and silently ignores the prompt; "
                "pass one or the other"
            )
        prompt = req.get("prompt")
        messages = req.get("messages")
        if messages is None:
            if not isinstance(prompt, str):
                raise TypeError(
                    f"host.llm: prompt must be a str, got "
                    f"{type(prompt).__name__}"
                )
            if not prompt.strip():
                raise ValueError("host.llm: prompt must be a non-empty str")
        # M4/M15 guards (model/max_tokens) + messages-role check \u2014 shared
        # predicate with the batch-lane loop above; rationale + finding
        # citations live on _llm_req_guard (\uD83D\uDD34 3378028316: one predicate,
        # both lanes).
        _llm_req_guard(req)

        # \u2500\u2500 dispatch \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        # Plain text requests keep the serial "llm" host-call (documented
        # behavior: the host transparently stitches past max_tokens).
        # Requests using the newer capabilities go through the batch
        # handler as a 1-element list \u2014 full request-shape support, and
        # max_tokens is treated as a hard per-request budget there.
        extended = ("tools", "tool_choice", "images", "messages",
                    "temperature")
        if any(req.get(k) is not None for k in extended):
            out = _host_call("llm_batch", [[_llm_encode_pil(req)], 1])
            r = out[0] if isinstance(out, list) and out else {}
            if isinstance(r, dict) and "error" in r and "text" not in r:
                raise RuntimeError(f"host.llm: {r['error']}")
            return r
        return _host_call(
            "llm",
            [{"prompt": prompt, "system": req.get("system"),
              "model": req.get("model"),
              "max_tokens": req.get("max_tokens")}],
        )

    def current_model(self):
        """Return the session's active chat model id as a string.

        This is what the AGENT is running as \u2014 NOT what \`\`host.llm()\`\`
        defaults to (that is the Haiku-class kernel utility default via
        \`\`[llm] kernel_default_model\`\`). Pass this value as
        \`\`host.llm(model=...)\`\` when you want session-level reasoning.
        On public builds, internal/unreleased model ids are redacted to
        \`\`"internal"\`\`.
        """
        return _host_call("current_model", [])

    def list_models(self):
        """Return the list of model ids visible to the host's credentials.

        Pass an id from this list as \`\`host.llm(model=...)\`\` to override
        the kernel default (Haiku, unless the deployment overrides
        \`\`[llm] kernel_default_model\`\`). On public builds, internal/unreleased entries
        are dropped; on internal builds they surface as \`\`"internal"\`\`
        (not a usable \`\`model=\`\` value). Hits the Anthropic API \u2014 call
        once and cache the result rather than per-iteration.
        """
        return _host_call("list_models", [])

    def get_user_email(self):
        """Return the user's consented contact email as a plain \`\`str\`\`.

        Only available via the \`\`repl\`\` tool (the analysis kernel gets a
        refusal). May block while the user answers a consent prompt.

        Raises when there is no address to use:

        - \`\`operon.ContactEmailDeclined\`\` \u2014 the user said no. Do NOT ask
          them for an address.
        - \`\`operon.ContactEmailUnavailable\`\` \u2014 no decision could be
          obtained. This is also the BASE class of \`\`ContactEmailDeclined\`\`,
          so one \`\`except\`\` clause covers both.

        Either way the recovery is the same \u2014 omit the email parameter
        (most services work without it)::

            try:
                email = operon.get_user_email()
            except operon.ContactEmailUnavailable as e:
                print(e)      # the host's guidance, verbatim
                email = None

        This is the ONLY legitimate source of a contact email \u2014 never
        fabricate one or read addresses from environment variables.
        """
        r = _host_call("get_user_email", [])
        # Forward-compat: a host that returns the bare address directly.
        if isinstance(r, str):
            return r
        if isinstance(r, dict):
            status = r.get("status")
            email = r.get("email")
            if status == "allowed" and isinstance(email, str) and email:
                return email
            # The host's \`message\` field carries the recovery instruction
            # verbatim; the exception defaults cover hosts that omit it.
            message = r.get("message")
            if not (isinstance(message, str) and message):
                message = None
            if status == "declined":
                raise ContactEmailDeclined(message)
            # "unavailable", an unrecognized status, or an "allowed" row
            # with no usable address \u2014 same recovery, base class.
            raise ContactEmailUnavailable(message)
        # Malformed payload (None, list, \u2026): never hand it back as if it
        # were an address. Note: a HANDLER failure never reaches here \u2014
        # \`_host_call\` already raised RuntimeError("host_call ... failed:")
        # for \`{error}\` replies (permit refusal, replay shim, channel loss),
        # and that mapping is deliberately not wrapped.
        raise ContactEmailUnavailable()


    def capabilities(self):
        """Return which SDK capabilities are available in the current kernel.

        Returns a dict like {"query": True, "agents": False, ...}. Use this
        to check what's available before calling \u2014 avoids RuntimeError from
        host-call refusal in the wrong kernel.
        """
        # \`query\` is an instance attr set by the repl-only frames.py
        # fragment (query_db/query_schema are in OPERON_PERMIT, not
        # ANALYSIS_PERMIT) \u2014 getattr\u2192__getattr__\u2192AttributeError\u2192None in the
        # analysis kernel. Other gated attrs follow the same pattern.
        return {
            "query": callable(getattr(self, "query", None)),
            "llm": callable(getattr(type(self), "llm", None)),
            "current_model": callable(getattr(type(self), "current_model", None)),
            "list_models": callable(getattr(type(self), "list_models", None)),
            "agents": hasattr(self, "agents"),
            "skills": hasattr(self, "skills"),
            "goal": hasattr(self, "goal"),
            "frames": callable(getattr(self, "frames", None)),
            "compute": hasattr(self, "compute"),
            "mcp": hasattr(self, "mcp"),
            "children": callable(getattr(self, "children", None)),
            "delegate": callable(getattr(self, "delegate", None)),
            "delegation_stats": callable(
                getattr(self, "delegation_stats", None)
            ),
            "lineage": hasattr(self, "lineage"),
            "artifacts": callable(getattr(self, "artifacts", None)),
            "credentials": hasattr(self, "credentials"),
            "app": callable(getattr(self, "app", None)),
            "exec_peek": callable(getattr(self, "exec_peek", None)),
            "exec_interrupt": callable(getattr(self, "exec_interrupt", None)),
            "submit_output": callable(getattr(self, "submit_output", None)),
        }

    def _avail(self):
        # Public surface = class-defined callables/properties + instance attrs
        # set by fragment injection (agents/skills/compute/children/mcp). This
        # is the source of truth \u2014 no hardcoded list that goes stale or lies
        # about gated methods in the analysis kernel.
        names = set(self.__dict__)
        for klass in type(self).__mro__:
            if klass is object:
                break
            names.update(klass.__dict__)
        return sorted(n for n in names if not n.startswith("_"))

    def __getattr__(self, name):
        # Only called when normal lookup fails. Give a helpful error for
        # gated methods (sub-agents without enable_subtask_delegation don't
        # get SDK_SUPERVISION_PY, so host.children is a plain
        # AttributeError indistinguishable from a typo). Check __dict__
        # directly so we don't re-enter __getattr__.
        if name == "llm_batch":
            # Removed back-compat alias (undocumented, from #1879): the
            # unified list-form is the one surface. Errors-that-teach per
            # the #2905 pattern \u2014 name the one-line migration.
            raise AttributeError(
                "host.llm_batch was removed \u2014 use "
                "host.llm([...], max_concurrency=N) instead "
                "(same wire, same semantics: list in \u2192 ordered list out)."
            )
        if (name in ("delegate", "delegation_stats")
                and self.__dict__.get("_leaf_frame_scrubbed")):
            # Leaf repl kernel (#2659): the agent IS in the repl tool \u2014
            # the generic redirect below would send it in a retry loop.
            raise AttributeError(
                f"host.{name}() is root-only and this frame is a "
                f"sub-agent (leaf) \u2014 delegation is not available here. "
                f"Complete the task yourself and return results to your "
                f"parent."
            )
        # "delegate"/"delegation_stats" need KERNEL-AWARE wording (#2672
        # follow-up 1 found the naive redirect circular): when the symbols
        # are absent, the reason differs by kernel. In the OPERON kernel
        # (detectable: control-plane methods like \`frames\` are installed)
        # absence means delegation is disabled for this session; in the
        # analysis kernel they never exist, and the honest advice is the
        # repl tool IF the session has delegation at all. Neither message
        # promises the method exists anywhere it might not.
        if name in ("delegate", "delegation_stats"):
            if self.__dict__.get("frames") is not None:
                raise AttributeError(
                    f"host.{name}() is not available: delegation is not "
                    f"enabled for this session (or this is a sub-agent "
                    f"frame). Complete the task directly."
                )
            raise AttributeError(
                f"host.{name}() has no surface in the \`python\` kernel. "
                f"If this session has delegation enabled, re-run in the "
                f"\`repl\` tool; otherwise delegation is off \u2014 complete "
                f"the task directly."
            )
        if name == "children":
            raise AttributeError(
                f"host.{name}() is only available via the \`repl\` tool "
                f"(control-plane kernel). Re-run this cell with the "
                f"\`repl\` tool instead of \`python\`."
            )
        if name == "mcp":
            # MCP is repl-kernel-only (hostCalls.ts OPERON_PERMIT): this
            # kernel runs third-party pip/conda packages, so it has no MCP
            # surface at all \u2014 the method doesn't exist here, and the host
            # refuses the raw host call too. Mirror the host-side wording so
            # the redirect is consistent however the call was attempted.
            raise AttributeError(
                "host.mcp() is only available via the \`repl\` tool \u2014 "
                "MCP/connector tools have no surface in this kernel. Fetch "
                "the data in a \`repl\` cell, write it to "
                "./handoff/<name>.json, and read that file from this kernel."
            )
        if name in (
            "agents",
            "skills",
            "compute",
            "query",
            "frames",
            "exec_peek",
            "exec_interrupt",
            "submit_output",
        ):
            raise AttributeError(
                f"host.{name} is only available via the \`repl\` tool. "
                f"Re-run this cell with the \`repl\` tool instead of "
                f"\`python\` \u2014 the \`python\` tool is for data work and "
                f"doesn't carry control-plane methods. The two share your "
                f"workspace cwd (so prepare input files in \`python\` first) "
                f"but not memory; the \`repl\` tool is stdlib-only."
            )
        raise AttributeError(
            f"host has no method '{name}'. "
            f"Available: {', '.join(self._avail())}."
        )

    def __repr__(self):
        return f"<host SDK \u2014 {', '.join('host.' + a for a in self._avail())}>"


host = _OperonSDK()
# Legacy alias: pre-rename transcripts, \`host.lineage[vid]["code"]\` replay
# of old cells, and user muscle memory all say \`operon\`. Same object \u2014
# dropping the alias later is a two-line change (here + sys.modules below).
operon = host

# Make \`import host\` (and legacy \`import operon\`) no-ops that bind the same
# singleton. The SDK is a kernel global, not a real module \u2014 but users
# reflexively import it and burn a turn on ModuleNotFoundError. sys.modules
# accepts any object; after this, \`import host\` resolves to the instance
# above. \`from host import query\` even works (getattr on the singleton);
# \`from host import <unknown>\` raises a plain ImportError.
#
# DECLARED TRADE-OFF (review 3398748857): this shadows a user-authored
# local \`host.py\` in the analysis kernel \u2014 \`import host\` returns the SDK
# even after sys.path surgery, because sys.modules wins before the path
# scan. Accepted: PYTHONSAFEPATH=1 means a local module already needs
# explicit path setup, and the failure mode is loud ("AttributeError:
# host has no method 'x'. Available: \u2026" names the SDK surface, which
# signals the shadow). Scoping the registration to the repl kernel was
# considered and rejected \u2014 the rebound-host advisory's \`import host\`
# recovery and the dual-import alias contract (hostCalls pin) hold in
# BOTH kernels.
_sys.modules.setdefault("host", host)
_sys.modules.setdefault("operon", host)

# Claude Science SDK fragment: agents (repl-kernel only \u2014 see skills/customize).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER base
# in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are already
# bound in that namespace.
#
# Host-call handlers: hostCalls.ts cases "agent_*" / "connector_list"
#
# Executes via the \`repl\` tool (control-plane kernel). Shares cwd with the
# python/R kernels but not memory \u2014 persist to ./handoff/*.json to cross.


def _op_agents_require_str(method, pname, val):
    if not isinstance(val, str) or not val:
        raise TypeError(
            f"host.agents.{method}: {pname} must be a non-empty str, "
            f"got {val!r}"
        )


def _op_agents_call(method, host_method, payload):
    # Drop None values \u2014 Python None \u2192 JSON null, which zod
    # \`z.string().optional()\` on the host REJECTS (it wants absent, not null).
    # See frame 642436b0 cell 8: attach_connector(..., includeToolsPattern=None)
    # \u2192 "Expected string, received null". Same pattern as sdk/compute.py's
    # _compute_call.
    payload = {k: v for k, v in payload.items() if v is not None}
    r = _host_call(host_method, [payload])  # noqa: F821 (defined in base.py)
    # Handlers return {error: "..."} for soft failures (name collision, not
    # found, bundled-profile protection). Surface as an exception unless the
    # dict also carries a success key the caller is expected to inspect.
    if isinstance(r, dict) and "error" in r and len(r) == 1:
        raise RuntimeError(f"host.agents.{method}: {r['error']}")
    return r


def _op_agents_create_or_update(method, host_method, payload):
    """Like _op_agents_call but warns when the server normalized the name."""
    r = _op_agents_call(method, host_method, payload)
    if isinstance(r, dict) and r.get("nameNormalized"):
        import warnings
        warnings.warn(
            f"host.agents.{method}: name was normalized to "
            f"UPPER_SNAKE_CASE \u2192 '{r['name']}'. "
            f"Pass the uppercase name directly to silence this warning.",
            UserWarning, stacklevel=3,
        )
    return r


def _op_agents_compat(compat, method, mapping):
    """Coalesce legacy camelCase kwargs (pre-snake_case-rename). Silent
    fallback \u2014 no DeprecationWarning spam in the agent loop."""
    out = {}
    for legacy, canonical in mapping.items():
        if legacy in compat:
            out[canonical] = compat.pop(legacy)
    if compat:
        raise TypeError(
            f"host.agents.{method}: unexpected keyword argument(s) "
            f"{sorted(compat)!r}"
        )
    return out


# update() patch-dict keys \u2014 accept snake_case, send camelCase on the wire.
# (Wire schema is zod z.object(...).strict() \u2192 unknown keys rejected.)
_OP_AGENTS_PATCH_KEY_MAP = {
    "display_name": "displayName",
    "system_prompt": "systemPrompt",
    "skill_names": "skillNames",
    "icon_key": "iconKey",
    "color_key": "colorKey",
}


class _AgentsAccessor:
    """Agent-profile CRUD + connector introspection. Load skill 'customize'
    for usage."""

    def __repr__(self):
        return "<host.agents \u2014 load skill 'customize' for API docs>"

    def list(self):
        """Return all agent profiles (bundled + custom) as a list of dicts.

        Each entry: {name, displayName, description, source, enabled,
        systemPrompt, iconKey, colorKey, unrestricted, skillNames: [...],
        connectors: [...], excludedTools: [...], excludedToolsDetail: [...]}.
        (Return-dict keys are camelCase \u2014 wire shape.) Directly iterable \u2014
        \`for p in host.agents.list(): print(p["name"])\`.
        """
        r = _op_agents_call("list", "agent_list", {})
        # Handler returns {"agents": [...]}. Unwrap so \`for p in .list()\`
        # yields dicts, not the single key string "agents" (frame 642436b0
        # cells 0/1 \u2014 TypeError: string indices must be integers).
        return r["agents"] if isinstance(r, dict) and "agents" in r else r

    def get(self, name):
        """Return a single agent profile by name, or raise if not found.

        Equivalent to filtering \`list()\` by name, but cheaper \u2014 single
        lookup. Raises RuntimeError if the agent doesn't exist.

        \`name\` is case-insensitive (resolved to UPPER_SNAKE internally).
        """
        _op_agents_require_str("get", "name", name)
        return _op_agents_call("get", "agent_get", {"name": name})

    def switch(self, name):
        """Ask to continue this conversation as \`name\` (shows the user an
        approval card).

        On Allow, the switch takes effect on their next message \u2014 the
        current turn finishes as the current profile. On decline, tell the
        user they can select the profile from the session config popover on
        any new conversation.

        Returns \`\`{switched, name, displayName}\`\`.
        """
        _op_agents_require_str("switch", "name", name)
        return _op_agents_call("switch", "agent_switch", {"name": name})

    def create(self, name, display_name=None, description=None, *,
               system_prompt="", skill_names=None, **_compat):
        """Create a new custom profile.

        \`name\` is the profile identifier \u2014 **2\u201332 chars, UPPERCASE
        letters / digits / underscores only** (e.g. "MY_AGENT"). Lowercase
        or dashes are rejected by the host. \`display_name\` is the
        human-friendly label shown in the agent picker; \`description\` is
        the one-line summary.

        Skill allowlist semantics: leave \`skill_names\` UNSET (None) and the
        new profile is **unrestricted** \u2014 it sees the full live skill catalog
        and every connector, same as the main agent (the profile's
        \`unrestricted\` flag is true; \`skillNames\` is inert). Pass an EXPLICIT
        list and the profile gets exactly those skills (\`unrestricted\` false) \u2014
        including \`skill_names=[]\` for a profile with no skills at all. A curated
        profile starts with ZERO connectors \u2014 call attach_connector for each
        one you want after create. Built-ins are detachable from custom
        profiles later via detach_skill/update.

        Returns the stored profile record (camelCase keys)."""
        c = _op_agents_compat(_compat, "create", {
            "displayName": "display_name", "systemPrompt": "system_prompt",
            "skillNames": "skill_names",
        })
        display_name = display_name if display_name is not None \\
            else c.get("display_name")
        description = description  # positional only
        system_prompt = system_prompt or c.get("system_prompt") or ""
        skill_names = skill_names if skill_names is not None \\
            else c.get("skill_names")
        _op_agents_require_str("create", "name", name)
        _op_agents_require_str("create", "display_name", display_name)
        _op_agents_require_str("create", "description", description)
        if system_prompt is not None and not isinstance(system_prompt, str):
            raise TypeError(
                f"host.agents.create: system_prompt must be a str, got "
                f"{type(system_prompt).__name__}"
            )
        if skill_names is not None and not isinstance(skill_names,
                                                      (list, tuple)):
            raise TypeError(
                f"host.agents.create: skill_names must be a list of str or "
                f"None, got {type(skill_names).__name__}"
            )
        return _op_agents_create_or_update(
            "create", "agent_create",
            # skill_names=None is OMITTED from the wire (dropped by
            # _op_agents_call) so the host marks the profile \`unrestricted\`
            # (full live catalog + all connectors); an explicit list \u2014
            # including [] \u2014 is persisted exactly with unrestricted=false.
            {"name": name, "displayName": display_name,
             "description": description, "systemPrompt": system_prompt or "",
             "skillNames": list(skill_names) if skill_names is not None
             else None},
        )

    def update(self, name, patch):
        """Patch an existing profile. \`patch\` is a dict of fields to change \u2014
        any of: display_name, description, system_prompt, skill_names,
        unrestricted, icon_key, color_key (camelCase spellings also
        accepted). Unspecified fields are left as-is. \`skill_names\` REPLACES
        the full skill allowlist exactly as given (built-ins included \u2014 omit
        one to detach it; [] empties the list) and implicitly flips the
        profile's \`unrestricted\` flag false. \`{"unrestricted": True}\` flips
        it back to the full live catalog + connector view (see create()).
        The main agent's profile is the exception: its built-in set is
        locked and silently re-unioned. excludedTools is NOT a patch field \u2014
        it's per-connector; use attach_connector's include_tools_pattern /
        exclude_tools_pattern instead."""
        _op_agents_require_str("update", "name", name)
        if not isinstance(patch, dict):
            raise TypeError(
                f"host.agents.update: patch must be a dict, got "
                f"{type(patch).__name__}"
            )
        # Map snake_case \u2192 wire camelCase. Unmapped keys pass through as-is
        # (description, camelCase originals, etc.).
        patch = {_OP_AGENTS_PATCH_KEY_MAP.get(k, k): v
                 for k, v in patch.items()}
        return _op_agents_create_or_update(
            "update", "agent_update", {"name": name, "patch": patch},
        )

    def delete(self, name):
        """Delete a custom profile. Bundled profiles are protected."""
        _op_agents_require_str("delete", "name", name)
        return _op_agents_call("delete", "agent_delete", {"name": name})

    def attach_skill(self, name, skill):
        """Add \`skill\` to the profile's skill allowlist."""
        _op_agents_require_str("attach_skill", "name", name)
        _op_agents_require_str("attach_skill", "skill", skill)
        return _op_agents_call(
            "attach_skill", "agent_attach_skill",
            {"agentName": name, "skillName": skill},
        )

    def detach_skill(self, name, skill):
        """Remove \`skill\` from the profile's skill allowlist. Built-in
        (anthropic) skills are detachable from custom profiles; the main
        agent's built-in set is locked (raises)."""
        _op_agents_require_str("detach_skill", "name", name)
        _op_agents_require_str("detach_skill", "skill", skill)
        return _op_agents_call(
            "detach_skill", "agent_detach_skill",
            {"agentName": name, "skillName": skill},
        )

    def attach_connector(self, name, connector, *,
                         include_tools_pattern=None,
                         exclude_tools_pattern=None, **_compat):
        """Attach an MCP connector to the profile. Optional include/exclude
        regex patterns scope which of the connector's tools the profile
        sees. Patterns match the connector's BARE tool names (as returned
        by list_connectors(connector)['tools'], e.g. '^list_marts$'); the
        resulting excludedTools entries are stored fully-qualified as
        mcp_<connector>_<tool> since the list aggregates across all
        attached connectors. Re-attaching an already-attached connector
        without include_tools_pattern/exclude_tools_pattern preserves the
        existing exclusion list; pass include_tools_pattern='.*' to clear
        it."""
        c = _op_agents_compat(_compat, "attach_connector", {
            "includeToolsPattern": "include_tools_pattern",
            "excludeToolsPattern": "exclude_tools_pattern",
        })
        include_tools_pattern = include_tools_pattern \\
            if include_tools_pattern is not None \\
            else c.get("include_tools_pattern")
        exclude_tools_pattern = exclude_tools_pattern \\
            if exclude_tools_pattern is not None \\
            else c.get("exclude_tools_pattern")
        _op_agents_require_str("attach_connector", "name", name)
        _op_agents_require_str("attach_connector", "connector", connector)
        for _pname, _val in (("include_tools_pattern", include_tools_pattern),
                             ("exclude_tools_pattern", exclude_tools_pattern)):
            if _val is not None and (not isinstance(_val, str) or not _val):
                raise TypeError(
                    f"host.agents.attach_connector: {_pname} must be a "
                    f"non-empty str or None, got {_val!r}"
                )
        return _op_agents_call(
            "attach_connector", "agent_attach_connector",
            {"agentName": name, "connectorName": connector,
             "includeToolsPattern": include_tools_pattern,
             "excludeToolsPattern": exclude_tools_pattern},
        )

    def detach_connector(self, name, connector):
        """Remove an MCP connector from the profile."""
        _op_agents_require_str("detach_connector", "name", name)
        _op_agents_require_str("detach_connector", "connector", connector)
        return _op_agents_call(
            "detach_connector", "agent_detach_connector",
            {"agentName": name, "connectorName": connector},
        )

    def list_connectors(self, connector_name=None, **_compat):
        """List all connectors (bundled + directory + user-added MCP) with
        auth state and which profiles use each. Pass connector_name to get
        one connector with its full tool list.

        No arg \u2192 list of dicts: [{name, displayName, source, description,
        authState, attachedAgents: [...]}, ...]. (Return-dict keys are
        camelCase \u2014 wire shape.) Directly iterable.
        With connector_name \u2192 single dict with an extra \`tools\` key.
        """
        c = _op_agents_compat(_compat, "list_connectors",
                              {"connectorName": "connector_name"})
        connector_name = connector_name if connector_name is not None \\
            else c.get("connector_name")
        if connector_name is not None:
            _op_agents_require_str("list_connectors", "connector_name",
                                   connector_name)
        r = _op_agents_call(
            "list_connectors", "connector_list",
            {"connectorName": connector_name},
        )
        # No-arg: handler returns {"connectors": [...]} \u2014 unwrap to a bare
        # list so \`for c in .list_connectors()\` yields dicts (frame 642436b0
        # cell 3). Single-name mode returns the connector dict directly.
        if connector_name is None and isinstance(r, dict) and "connectors" in r:
            return r["connectors"]
        return r


host.agents = _AgentsAccessor()  # noqa: F821 (host defined in base.py)

# Claude Science SDK fragment: app (MCP-app tiles \u2014 drive live iframe widgets).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER
# base in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are
# already bound.
#
# Host-call handlers: hostCalls.ts cases "app_tool" / "app_tools_list"
# \u2192 appToolsBroker via KernelBinding.onAppToolCall / .onAppToolsList.
#
# Unlike host.mcp() (stdio server), host.app() relays into a LIVE
# browser iframe over ws \u2014 the tile must be open. The return value of the
# app's open_* tool names the artifact_id to target; handler names come from
# .tools() or the next-turn \`<live_interactive_app>\` block.


class _OperonAppProxy:
    """One MCP-app viewer. host.app(server).<tool>(artifact_id=, **kw)
    relays into the live iframe; .tools() lists registered handlers."""

    def __init__(self, server):
        self._server = server

    def __repr__(self):
        return f"<host.app({self._server!r}) \u2014 .tools() for live handlers>"

    def tools(self):
        """List handlers the open tile(s) have registered. Returns
        [{name, description, inputSchema, artifact_id}, ...]; empty if no
        tile is open yet."""
        return _host_call(
            "app_tools_list", [{"server": self._server}]
        )

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        _server = self._server

        def _call(artifact_id=None, **kw):
            if artifact_id is not None and (
                not isinstance(artifact_id, str) or not artifact_id
            ):
                raise TypeError(
                    f"host.app({_server!r}).{name}: artifact_id must be "
                    f"a non-empty str or None, got {artifact_id!r}"
                )
            try:
                return _host_call(
                    "app_tool",
                    [
                        {
                            "server": _server,
                            "tool": name,
                            "artifact_id": artifact_id,
                            "args": kw,
                        }
                    ],
                )
            except RuntimeError as e:
                # Broker-side arg validation (appToolsBroker.ts
                # validateAppToolArgs) rejects unknown kwargs / tool names
                # BEFORE the iframe relay. Re-raise those as the Python
                # exception a signature mismatch would produce, so a typo'd
                # kwarg reads like a normal TypeError instead of a host-call
                # RuntimeError. Anchored to the start of the message \u2014
                # base.py wraps every host error as
                # "host_call 'app_tool' failed: <text>", and an iframe
                # handler's own error text rides the same wrapper, so a
                # substring match could miscategorize an iframe error that
                # merely mentions the marker. The broker message prefixes
                # AND base.py's wrapper are a contract with this block \u2014
                # change them in all places together.
                msg = str(e)
                prefix = "host_call 'app_tool' failed: "
                arg_marker = f"{prefix}{name}: unexpected argument"
                tool_marker = f"{prefix}{name}: unknown tool"
                if msg.startswith(arg_marker):
                    raise TypeError(
                        f"host.app({_server!r}).{msg[len(prefix):]}"
                    ) from None
                if msg.startswith(tool_marker):
                    raise AttributeError(
                        f"host.app({_server!r}).{msg[len(prefix):]}"
                    ) from None
                raise

        _call.__name__ = name
        _call.__qualname__ = f"host.app({_server!r}).{name}"
        return _call


def _op_app(server):
    """Drive a live MCP-app tile (Ketcher etc). \`server\` is the same name
    you'd pass to host.mcp(). Attribute access relays into the iframe.

    Opening a tile is an MCP call, so it happens in the \`repl\` tool
    (host.mcp() is repl-kernel-only); driving the already-open tile
    works from either kernel. The two kernels share no memory \u2014 hand the
    artifact_id across via a ./handoff/ file:

        # \`repl\` cell \u2014 open the tile, write the id to handoff:
        import json
        r = host.mcp("ketcher-chemistry", "open_sketcher",
                       smiles="c1ccccc1", filename="benzene.ket")
        with open("./handoff/tile.json", "w") as f:
            json.dump({"artifact_id": r["artifact_id"]}, f)

        # \`python\` cell \u2014 read the id from handoff, drive the tile:
        import json
        aid = json.load(open("./handoff/tile.json"))["artifact_id"]
        host.app("ketcher-chemistry").highlight_atoms(
            artifact_id=aid, atoms=[0, 2, 4])

    .tools() lists registered handlers. Calls error cleanly if no tile is
    open or artifact_id doesn't match a live one. From the analysis
    (python) kernel, only bundled viewers are reachable \u2014 custom-server
    tiles require the \`repl\` tool.
    """
    if not isinstance(server, str) or not server:
        raise TypeError(f"host.app: server must be a non-empty str, got {server!r}")
    return _OperonAppProxy(server)


host.app = _op_app

# Claude Science SDK fragment: artifacts (universal \u2014 any agent with a kernel).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER
# base in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are
# already bound in that namespace.
#
# Migrated tools: list_artifacts \u2192 host.artifacts(**filters)
# Host-call handlers: hostCalls.ts case "list_artifacts" \u2192 conciergeTools.listArtifacts
#
# read_file stays a tool \u2014 image/PDF paths queue vision content blocks
# onto ctx.pending_files (protocol-level, not expressible via host-call),
# and file_path text mode is just open(). One unified tool is cleaner
# than splitting by content-type.


# F-01: IANA top-level MIME types (RFC 6838). content_type is prefix-matched
# on the host against lowercase stored values, so 'png/' or 'csv' silently
# return empty. Whitelist the top-level.
_OP_ARTIFACTS_VALID_MIME_TOPLEVEL = (
    "text", "image", "audio", "video", "application",
    "font", "multipart", "model", "message", "example",
)


def _op_artifacts(
    version_id=None,
    frame_id=None,
    project_id=None,
    filename=None,
    exact=False,
    content=None,
    content_type=None,
    after=None,
    before=None,
    include_intermediate=False,
    limit=200,
    offset=0,
    search=None,
):
    """Query the artifact store \u2014 THE way to find prior work.

    Artifacts are store records (versioned, cross-session), not workspace
    files: ls/find/glob cannot discover them, and an empty filesystem
    search proves nothing. Before concluding a data product doesn't exist
    or recomputing it, query here.

    Returns {count, scope, provenance, artifacts: [{id, filename,
    content_type, size_bytes, latest_version_id, checksum,
    root_frame_id, project_id, is_user_upload, priority, created_at},
    ...]}. Results are **newest-first** (most recently created artifacts
    first) \u2014 except under \`search=\`, which returns results in **rank
    order** (best match first) \u2014 and \`count\` is the TOTAL number of
    matches. When there are
    more matches than \`limit\`, the response also carries
    \`truncated: True\` and a \`hint\` explaining how to page (offset) or
    narrow (filters) \u2014 check it before concluding something doesn't
    exist. The top-level \`provenance\` block is {root_frame_id,
    project_id, agent_name} \u2014 the calling kernel's session identity,
    for stamping published outputs. \`checksum\` is the sha256 of the
    latest version's stored bytes (None = never hashed: legacy rows or
    oversized/degraded registrations).

    Direct lookup:
      version_id      \u2014 fetch one version by id; ignores all other filters.

    Filters, all optional:
      search          \u2014 ranked fuzzy search, SAME engine as the app's
                        @-mention / \u2318K palette. Tokenizes the query
                        ("umap coords" \u2192 ["umap","coords"]) and matches each
                        token against filename + parent-session title with
                        word-order, separator, and typo tolerance plus
                        domain synonyms and extension aliases. Results come
                        back in rank order (best first), each with \`_score\`
                        and \`_weak\`. Use this when you know WHAT you want
                        but not the exact filename. Mutually exclusive with
                        filename/content; composes with
                        project_id/frame_id/content_type/after/before.
                        Applies the palette's discovery visibility rules
                        (intermediates, plan files, and priority-hidden
                        artifacts are excluded regardless of
                        include_intermediate) \u2014 use filename= for those.
      frame_id        \u2014 scope to one session (root frame ID)
      project_id      \u2014 query a specific project. Defaults to the current
                        project. Pass another project's id to list its
                        artifacts cross-project, or "all" to list every
                        project at once (reads cross projects; saves are
                        always local). Every returned artifact carries its
                        own \`project_id\` so you can see where it came from.
      filename        \u2014 filename substring, case-insensitive
      exact           \u2014 with filename: require a whole-basename match
                        instead of substring. Use this when the user names a
                        specific file ("open foo.csv") so foo.csv.bak and
                        old_foo.csv don't match.
      content         \u2014 grep raw file bytes (text/JSON only; reads disk,
                        runs after other filters narrow the set)
      content_type    \u2014 MIME prefix: 'text/', 'image/', 'application/json'
      after/before    \u2014 ISO 8601 date/datetime bounds. Compared against UTC;
                        a bare date means midnight UTC at the start of that
                        day, so before='2026-04-02' excludes April 2nd \u2014 use
                        the day after your cutoff or a full datetime.
      include_intermediate \u2014 include auto-promoted intermediate files
      limit           \u2014 max results per page (default 200, clamped to
                        [1,1000])
      offset          \u2014 skip N results (pair with limit to page; without
                        search= results are newest-first so offset=200 is
                        the NEXT-OLDER page; with search= offset pages
                        WEAKER matches)

    Each artifact dict carries latest_version_id \u2014 pass that to read_file,
    host.artifact_path(vid), or a literal {{artifact:VID}} marker in code.
    Two independent widening axes: project_id widens across PROJECTS
    (omit = current project, "proj_X" = that project, "all" = every
    project); frame_id narrows to one SESSION (omit = all sessions in the
    project scope). A frame_id from any project resolves directly \u2014 no
    project_id needed, the response reports that frame's project. To find
    where a cross-project artifact came from, check its \`project_id\` field.

    Compose freely: host.artifacts(content_type='text/csv', after='2026-03-01')
    or [a for a in host.artifacts()['artifacts'] if a['size_bytes'] > 1e6]
    """
    # Direct lookup \u2014 bypasses includeIntermediate filter, returns 1 row.
    if version_id is not None:
        if not isinstance(version_id, str) or not version_id:
            raise TypeError(
                f"host.artifacts: version_id must be a non-empty str, "
                f"got {version_id!r}"
            )
        return _host_call("list_artifacts", [{"version_id": version_id}])  # noqa: F821
    # Client-side guards \u2014 fail fast before the host round-trip.
    # C6/C9/F-01: content_type is matched as a prefix on the host against
    # lowercase stored values \u2014 'CSV' or 'Image/' or 'png/' silently return
    # empty. Normalise to lowercase (MIME is case-insensitive per RFC 2045)
    # and whitelist the top-level type.
    if content_type is not None:
        if not isinstance(content_type, str) or not content_type:
            raise TypeError(
                f"host.artifacts: content_type must be a non-empty str, "
                f"got {content_type!r}"
            )
        content_type = content_type.lower()
        toplevel = content_type.split("/", 1)[0]
        if toplevel not in _OP_ARTIFACTS_VALID_MIME_TOPLEVEL:
            raise ValueError(
                f"host.artifacts: content_type={content_type!r} is not a "
                f"valid MIME type prefix. Top-level type must be one of: "
                f"{', '.join(_OP_ARTIFACTS_VALID_MIME_TOPLEVEL)}. "
                f"Use e.g. 'image/', 'text/csv'."
            )
    # M1/M9: limit/offset default host-side but a non-int (or bool, which is
    # a subclass of int) silently coerces to a bogus clamp. offset=0 is the
    # default so allow 0; limit<1 is always a bug.
    if limit is not None and (
        not isinstance(limit, int) or isinstance(limit, bool) or limit < 1
    ):
        raise TypeError(
            f"host.artifacts: limit must be a positive int or None, got {limit!r}"
        )
    if offset is not None and (
        not isinstance(offset, int) or isinstance(offset, bool) or offset < 0
    ):
        raise TypeError(
            f"host.artifacts: offset must be a non-negative int or None, got {offset!r}"
        )
    # I3: include_intermediate=1 truthy-coerces on the host (same as frames'
    # roots_only). Require actual bool.
    if not isinstance(include_intermediate, bool):
        raise TypeError(
            f"host.artifacts: include_intermediate must be a bool, got "
            f"{type(include_intermediate).__name__}"
        )
    if not isinstance(exact, bool):
        raise TypeError(
            f"host.artifacts: exact must be a bool, got "
            f"{type(exact).__name__}"
        )
    if exact and filename is None:
        raise ValueError(
            "host.artifacts: exact=True requires a filename to match against"
        )
    if search is not None:
        if not isinstance(search, str) or search.strip() == "":
            raise ValueError(
                "host.artifacts: search= must be a non-blank str \u2014 pass "
                "None to skip the filter"
            )
        if filename is not None or content is not None:
            raise ValueError(
                "host.artifacts: search= is mutually exclusive with "
                "filename=/content= \u2014 use search= for ranked fuzzy "
                "discovery, or the literal filters for exact lookup"
            )
    # C2/M3: string filters \u2014 filename=42 etc. leaked a raw JS
    # '.trim is not a function' from the host; '' matched everything via
    # LIKE '%%'. Require str or None; '' is ambiguous (pass None to skip).
    for _name, _val in (
        ("filename", filename),
        ("content", content),
        ("after", after),
        ("before", before),
        ("frame_id", frame_id),
        ("project_id", project_id),
    ):
        if _val is None:
            continue
        if not isinstance(_val, str):
            raise TypeError(
                f"host.artifacts: {_name} must be a str or None, got "
                f"{type(_val).__name__}"
            )
        if _val == "":
            raise ValueError(
                f"host.artifacts: {_name}='' is ambiguous \u2014 pass None to "
                f"skip the filter"
            )
    # None values are passed through \u2014 the handler's arg extraction
    # (conciergeTools.ts listArtifacts) treats missing-and-None identically.
    r = _host_call(
        "list_artifacts",
        [
            {
                "frame_id": frame_id,
                "project_id": project_id,
                "search": search,
                "filename": filename,
                "filename_exact": exact,
                "content": content,
                "content_type": content_type,
                "after": after,
                "before": before,
                "include_intermediate": include_intermediate,
                "limit": limit,
                "offset": offset,
            }
        ],
    )
    # C7/C10: the host returned {'error': 'Frame X not found'} as a dict
    # (not a raise) for a bad frame_id \u2014 the only {error} dict left in the
    # SDK. Surface it as an exception. blue-river is also making the host
    # throw, so this is defense-in-depth going forward.
    if isinstance(r, dict) and "error" in r and "artifacts" not in r:
        raise RuntimeError(f"host.artifacts: {r['error']}")
    return r


host.artifacts = _op_artifacts


def _op_artifact_path(version_id):
    """Resolve an artifact version_id (or artifact_id) to a local filesystem path.

    {{artifact:UUID}} markers are rewritten to paths BEFORE your code runs, so
    the UUID must be a literal in source. If you only learn the id at runtime
    (e.g. from host.artifacts()), use this instead:

        arts = host.artifacts(filename="fleet_dashboard.csv")
        vid = arts["artifacts"][0]["latest_version_id"]
        df = pd.read_csv(host.artifact_path(vid))

    Tries version_id first, then artifact_id \u2192 latest version. Works for
    artifacts in any of the user's projects \u2014 list cross-project ids via
    host.artifacts(project_id=X). Raises if the artifact can't be found
    or is a reference-only entry whose host file is no longer accessible.
    """
    if not isinstance(version_id, str) or not version_id:
        raise TypeError(
            "host.artifact_path: version_id must be a non-empty str, got "
            f"{type(version_id).__name__}"
        )
    return _host_call("artifact_path", [version_id])  # noqa: F821


host.artifact_path = _op_artifact_path


def _op_artifact_marker(version_id):
    """Return the literal artifact-marker string for embedding in generated
    HTML/markdown/LaTeX, for the renderer to resolve LATER when the output
    is viewed.

    The kernel's pre-exec resolver substring-scans your code source for the
    marker prefix and hard-fails on any non-UUID match \u2014 so writing the
    marker inline (f-string, .format, concat) to build a report gets
    intercepted before your code runs. This helper constructs the string at
    runtime without tripping that scan:

        html = f'<img src="{host.artifact_marker(vid)}">'

    For a local filesystem path to open/read the artifact yourself, use
    host.artifact_path(vid) instead.
    """
    if not isinstance(version_id, str) or not version_id:
        raise TypeError(
            "host.artifact_marker: version_id must be a non-empty str, "
            f"got {type(version_id).__name__}"
        )
    # Split so this source file itself carries no literal marker prefix.
    return "{" + "{" + "artifact:" + version_id + "}" + "}"


host.artifact_marker = _op_artifact_marker


# \u2500\u2500\u2500 Image attach helper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Pure-Python (PIL) \u2014 no new host-call. Writes a PNG to cwd so the existing
# auto-view pipeline (scanWorkspace \u2192 buildAutoViewImages \u2192 pending_files)
# attaches it as a vision block on the NEXT turn.
#
# Hill-climb result (core/scripts/bench-zoom-crop): the docstring and SP
# guidance intentionally LEAD with the compute-first PIL recipe. Framing this
# as a "zoom tool" ("call, look, guess coords, crop again") measurably hurts \u2014
# the model's visual coord estimates are ~5-10% off and it loops. "PIL" in the
# prompt primes np.asarray \u2192 pixel-mask \u2192 exact crop on turn 1.

_op_view_image_n = [0]  # list so the closure can mutate it without \`global\`


def _op_view_image(source, crop=None, *, max_size=1568, out=None):
    """Attach an image (or a cropped region of one) to your visual context.

    Open the original with PIL, crop the region of interest, and pass it
    here (or just \`.save('region.png')\` \u2014 same effect). The PNG is written
    to the workspace and auto-attached on the NEXT message.

        from PIL import Image
        img = Image.open("figure.png")            # W, H = img.size
        host.view_image(img.crop((x0, y0, x1, y1)))

    Always crop from the **original file**, not from a previously-saved
    crop (saved views are downsampled). Before cropping tight, note any
    units, scale bars, legends, or "\xD7N" qualifiers in the full view \u2014 a
    tight crop hides them.

    **For grid/table/dense-text images where you need the value at a
    specific row/col** \u2014 don't guess margins. Tile the image with PIL,
    pass the tiles as a request list to \`host.llm\` to transcribe them
    in parallel, then answer from the assembled text map. Tile at roughly
    the visible cell granularity and cap at ~100 tiles (cost scales
    linearly)::

        from PIL import Image
        img = Image.open("heatmap.png"); W, H = img.size
        N, M = 10, 10  # \u2248 visible cols, rows; keep N*M \u2272 100
        tiles = [img.crop((c*W//N, r*H//M, (c+1)*W//N, (r+1)*H//M))
                 for r in range(M) for c in range(N)]
        res = host.llm(
            [{"messages": [{"role": "user", "content": [
                {"type": "image", "pil": t},
                {"type": "text", "text": "Transcribe all visible text/numbers."}]}],
              "max_tokens": 100} for t in tiles])
        text_map = {(r, c): res[r*N+c].get("text", "") for r in range(M) for c in range(N)}

    Args:
      source    \u2014 a PIL.Image.Image, OR a workspace/absolute file path, OR a
                  bare artifact version_id (resolved via
                  host.artifact_path()).
      crop      \u2014 optional (x0, y0, x1, y1) in original-image pixels (PIL box
                  order: left, upper, right, lower). If every value is \u2264 1.0
                  they're treated as fractions of width/height.
      max_size  \u2014 cap the longer output side (default 1568 = the API vision
                  limit, so crops reach the model at full resolution).
      out       \u2014 output filename; defaults to \`_view_<NNN>_<basename>.png\`.

    Returns {source, original_size, crop, output_size, saved_to}.
    Requires Pillow (in the default \`python\` conda env).
    """
    import os as _os
    import re as _re
    # Fail fast, before the artifact_path host call / file open / full
    # decode \u2014 sibling source/crop validations in this function all pay
    # I/O first only when they need the image dimensions; this one doesn't.
    if max_size is not None and (
        not isinstance(max_size, int)
        or isinstance(max_size, bool)
        or max_size < 1
    ):
        raise TypeError(
            f"host.view_image: max_size must be a positive int or None, "
            f"got {max_size!r}"
        )
    try:
        from PIL import Image as _Image
    except ImportError:
        raise RuntimeError(
            "host.view_image requires Pillow. It's in the default \`python\` "
            "conda env \u2014 call this from the \`python\` tool, or "
            "manage_packages(mode='install', packages=['pillow'])."
        )

    region = None
    base = "image"
    if isinstance(source, _Image.Image):
        img = source
        W, H = img.size
        base = (getattr(source, "filename", "") or "image")
        base = _os.path.splitext(_os.path.basename(base))[0] or "image"
    else:
        if not isinstance(source, str) or not source:
            raise TypeError(
                "host.view_image: source must be a PIL.Image, a file path, "
                f"or an artifact version_id; got {type(source).__name__}"
            )
        if _re.fullmatch(r"[0-9a-fA-F-]{36}", source):
            path = _host_call("artifact_path", [source])  # noqa: F821
        else:
            path = source
        if not _os.path.exists(path):
            raise FileNotFoundError(
                f"host.view_image: {path!r} not found. Pass a workspace "
                f"path, a PIL.Image, or an artifact version_id."
            )
        # Real microscopy / whole-slide images routinely exceed PIL's 89MP
        # DecompressionBomb threshold. Scope the override to this single
        # open+load so bomb protection stays on for every other PIL open in
        # the (long-lived) kernel process. Header-only dimension check before
        # .load() caps at 500MP (~5.6\xD7 PIL's default) so a crafted bomb
        # can't OOM the kernel via this path while legitimate large scans
        # still pass.
        _prev_max = _Image.MAX_IMAGE_PIXELS
        _Image.MAX_IMAGE_PIXELS = None
        try:
            img = _Image.open(path)
            W, H = img.size
            if W * H > 500_000_000:
                raise ValueError(
                    f"host.view_image: image is {W}x{H} ({W*H/1e6:.0f} MP), "
                    f"exceeding the 500 MP safety cap. For ultra-high-res "
                    f"images, crop with PIL directly (Image.open(path)"
                    f".crop(box)) or use a tiled reader like openslide."
                )
            img.load()
        finally:
            _Image.MAX_IMAGE_PIXELS = _prev_max
        base = _os.path.splitext(_os.path.basename(path))[0]

    if crop is not None:
        if not (hasattr(crop, "__len__") and len(crop) == 4):
            raise TypeError(
                "host.view_image: crop must be (x0, y0, x1, y1) \u2014 "
                "left, upper, right, lower in original-image pixels "
                "(or fractions in [0,1])."
            )
        x0, y0, x1, y1 = (float(v) for v in crop)
        if max(abs(x0), abs(y0), abs(x1), abs(y1)) <= 1.0:
            x0, y0, x1, y1 = x0 * W, y0 * H, x1 * W, y1 * H
        x0 = max(0, min(W, int(round(x0))))
        y0 = max(0, min(H, int(round(y0))))
        x1 = max(0, min(W, int(round(x1))))
        y1 = max(0, min(H, int(round(y1))))
        if x1 <= x0 or y1 <= y0:
            raise ValueError(
                f"host.view_image: crop box has zero/negative area "
                f"after clamping to {W}\\u00d7{H}: ({x0},{y0},{x1},{y1}). "
                f"Check coord order (left, upper, right, lower)."
            )
        img = img.crop((x0, y0, x1, y1))
        region = (x0, y0, x1, y1)

    cw, ch = img.size
    if img.mode not in ("RGB", "RGBA", "L"):
        # Convert before resize: Pillow forces NEAREST on mode "P"/"1"
        # regardless of resample=, which aliases glyph strokes on
        # palette-mode sources (pngquant output, GIFs, etc.).
        img = img.convert("RGB")
    if max_size and max(cw, ch) > max_size:
        s = max_size / max(cw, ch)
        img = img.resize((max(1, int(cw * s)), max(1, int(ch * s))))

    _op_view_image_n[0] += 1
    saved = out or f"_view_{_op_view_image_n[0]:03d}_{base}.png"
    img.save(saved)

    # repr() guards against control chars in filenames leaking into the
    # tool_result stream (bench-zoom-crop adversarial finding).
    tag = f"crop x={region[0]}..{region[2]} y={region[1]}..{region[3]} " if region else ""
    print(
        f"[view_image] {base!r} [{W}\\u00d7{H}px] \\u2192 {tag}"
        f"[{img.size[0]}\\u00d7{img.size[1]}px] \\u2192 {saved!r}"
    )
    return {
        "source": source if isinstance(source, str) else "<PIL.Image>",
        "original_size": (W, H),
        "crop": region,
        "output_size": img.size,
        "saved_to": saved,
    }


host.view_image = _op_view_image


"""
Claude Science kernel SDK \u2014 compute fragment. Gated on hasRemoteComputeProvider().
Installs host.compute = namespace with one constructor (create).

Runs after sdk/base.py \u2014 relies on _host_call and the \`host\` singleton being
already defined in the namespace.

Executes via the \`repl\` tool (control-plane kernel). Stdlib-only
(no pandas/numpy/third-party packages). Shares cwd with the python/R kernels
but not memory \u2014 persist to ./handoff/*.json to cross.
"""


import itertools as _itertools
import os as _os
import random as _random
import time as _time


class SessionConcurrencyFull(RuntimeError):
    """Raised by submit_job(on_full="raise") when this session's
    set_concurrency_limit is reached. Carries .live and .limit."""

    def __init__(self, live, limit):
        self.live = live
        self.limit = limit
        super().__init__(
            f"session concurrency limit reached (live={live}/{limit})"
        )

# Host-injected colon-separated absolute paths (OPERON_ARTIFACTS_ROOTS) under
# which absolute kernel paths are accepted by _relativize_local. The host
# resolves and streams through these via the same fd-pinned tar pipeline that
# workspace inputs use. Empty/unset \u2192 only the legacy /mnt/artifacts/ exception
# applies.
_ARTIFACT_ROOTS = [
    _os.path.realpath(p)
    for p in (_os.environ.get("OPERON_ARTIFACTS_ROOTS", "").split(":"))
    if p
]


def _relativize_local(p):
    """Agent often passes os.path.abspath(...) which is the VM-side path the
    host can't see. Strip the cwd prefix so the host gets a workspace-relative
    path it can resolve via getWorkspaceDir(frameId)."""
    import os
    if not isinstance(p, str):
        return p
    cwd_prefix = os.getcwd() + "/"
    if p.startswith(cwd_prefix):
        return p[len(cwd_prefix):]
    if p.startswith("/"):
        # Legacy: VM-side bind-mount of the artifact store. Kept so the older
        # code path that passes /mnt/artifacts/... still works while the new
        # OPERON_ARTIFACTS_ROOTS path is rolled out.
        if "/mnt/artifacts/" in p:
            return p
        # Daemon-side: any absolute path under one of the host-allowlisted
        # artifact roots (env: OPERON_ARTIFACTS_ROOTS, colon-separated). Pass
        # through as-is \u2014 the host extracts the artifact_id via regex and
        # resolves it through the artifact-store DB; the agent-supplied path
        # is never opened directly on the host. This check is advisory only
        # (the kernel is adversarial python and can monkeypatch
        # _ARTIFACT_ROOTS); the TS host's regex + DB lookup is the real gate.
        real = os.path.realpath(p)
        for root in _ARTIFACT_ROOTS:
            try:
                if os.path.commonpath([real, root]) == root:
                    return p
            except ValueError:
                continue
        raise ValueError(
            "local path must be workspace-relative, {'version_id': ...}, "
            "{{artifact:ID}}, or under OPERON_ARTIFACTS_ROOTS "
            f"(got absolute path {p!r}; roots={_ARTIFACT_ROOTS or 'unset'})"
        )
    return p


def _normalize_provider_params(provider, pp):
    """None-drop inside the nested family block ({'modal':{'gpu':None}} \u2192
    {'modal':{}}). Anything outside the family key is passed through
    verbatim so the host's checkStrayProviderParams rejects it loudly
    (bh 3469575267). NO flat\u2192nested auto-wrap (alo rv 4566733844) \u2014 a
    flat {'gpu':'A100'} lands as a stray at the host check, which was
    already the clear one-turn error pre-PR; auto-wrapping would silently
    rewrite the agent's input and mis-wrap on non-modal families.
    Idempotent."""
    if not pp:
        return None
    if not isinstance(pp, dict):
        raise TypeError(
            "provider_params must be a dict ({'%s': {'gpu':'A100', ...}}); "
            "got %r" % (provider.split(":", 1)[-1], pp)
        )
    fam = provider.split(":", 1)[-1]
    strays = {k: v for k, v in pp.items() if k != fam and v is not None}
    inner = pp.get(fam)
    if inner is None:
        return strays or None
    if not isinstance(inner, dict):
        raise TypeError(
            "provider_params['%s'] must be a dict; got %r" % (fam, inner)
        )
    inner = {k: v for k, v in inner.items() if v is not None}
    out = ({fam: inner} if inner else {}) | strays
    return out or None


def _compute_call(op, kw):
    # Drop None kwargs \u2014 same shape as a tool call where optional params were
    # omitted, so the existing handler validation paths work.
    kw = {k: v for k, v in kw.items() if v is not None and k != "self"}
    r = _host_call(f"compute_{op}", [kw])  # noqa: F821 (defined in base.py)
    # Handlers return {error: "..."} for soft failures (decline, bad arg).
    # Surface as an exception unless it's a status-carrying result the caller
    # is expected to inspect (.result()'s exit_code != 0).
    if isinstance(r, dict) and r.get("error") and "status" not in r:
        e = RuntimeError(f"host.compute.{op}: {r['error']}")
        e.error_kind = r.get("error_kind")
        e.concurrency = r.get("concurrency")
        raise e
    return r


class _OperonComputeJob:
    """One submitted job. Returned by Instance.submit_job(); recover later via
    host.compute.create(provider).attach_job(job_id)."""

    def __init__(self, provider, job_id, workdir=None):
        self._provider = provider
        self._job_id = job_id
        self._workdir = workdir
        self.result_dict = None
        self.output_files = []
        self.featured_files = []
        # byoc only \u2014 the egress posture the job's sandbox was CREATED with
        # (e.g. "allowlist (2 domains; mirror off; +0 from the env)" or
        # "blocked (no outbound network)"), host-authored at submit time.
        # It describes THIS sandbox for its whole life: changing the
        # provider's Egress setting later affects only sandboxes created
        # afterwards, never this one. None for non-byoc providers and for
        # sandboxes that predate the policy stamp.
        self.egress = None

    def __repr__(self):
        eg = f" egress={self.egress!r}" if self.egress else ""
        return (
            f"<host.compute.Job {self._provider}/{self._job_id} "
            f"state={self.status}{eg} \u2014 recover with "
            f"host.compute.create({self._provider!r})"
            f".attach_job({self._job_id!r})>"
        )

    @property
    def job_id(self):
        return self._job_id

    # Alias \u2014 .id is what callers reach for (friction scan F4).
    id = job_id

    @property
    def exit_code(self):
        """None until the job is terminal. Call .result() after the
        compute_done notification to populate."""
        r = self.result_dict or {}
        ec = r.get("exit_code")
        if ec is None and r.get("status") in (None, "submitted", "running",
                                              "queued", "harvesting",
                                              "pending"):
            if not getattr(self, "_exit_code_warned", False):
                self._exit_code_warned = True
                import sys
                print("[host.compute] .exit_code is None until the job is "
                      "terminal \u2014 call .result() after wait_for_notification",
                      file=sys.stderr)
        return ec

    @property
    def status(self):
        return (self.result_dict or {}).get("status", "submitted")

    @property
    def workdir(self):
        """Absolute job workdir on the remote host (under scratch). Populated
        from the submit/result() response; None for an attached job until
        result() is called."""
        return self._workdir

    def result(self):
        """Non-blocking read of the job's result dict for all provider
        families (\`\`ssh:*\`\` and \`\`byoc:*\`\`). Returns the persisted result if
        the daemon's poller has already harvested it; otherwise
        \`\`{'status': 'running', ...}\`\` with guidance to use the
        \`\`wait_for_notification\`\` brain-tool.

        The daemon's background poller polls the remote (ssh \`\`statusBatch\`\`
        or byoc \`\`probe()\`\`), harvests into \`\`hpc/<job_id>/\`\`, and emits a
        \`\`compute_done\`\` notification when done \u2014 exit this cell and use
        \`\`wait_for_notification\`\`; the payload includes \`\`featured_files\`\` so
        you can \`\`save_artifacts(...)\`\` without re-entering the kernel.

        Returns \`\`{status, exit_code, output_files, featured_files,
        left_on_remote, remote_workdir, stdout_tail?, stderr_tail?,
        job_wall_s?, ...}\`\` once terminal. \`\`output_files\`\` is the full
        list (uncapped) ordered featured-first; the same files are on
        disk under \`\`hpc/<job_id>/\`\`. Does NOT raise on
        \`\`status='failed'\`\` or \`\`status='timed_out'\`\` (deadline-terminated,
        outputs harvested) \u2014 read \`\`exit_code\`\` / \`\`error_kind\`\`.
        """
        if self.result_dict and self.result_dict.get("status") not in (
            "running", "timeout", "harvesting",
        ):
            return self.result_dict
        r = _compute_call("result", {
            "job_id": self._job_id, "provider": self._provider,
        })
        self.result_dict = r
        self.output_files = r.get("output_files", [])
        self.featured_files = r.get("featured_files", [])
        if not self._workdir:
            self._workdir = r.get("remote_workdir")
        # A job recovered with attach_job() never saw a submit reply, so
        # backfill the birth-egress line from the persisted result: None
        # must keep meaning "no fence", never "we lost track of one".
        if self.egress is None and r.get("egress"):
            self.egress = r["egress"]
        # Host-authored egress attribution: present only when this job ran
        # under an egress fence AND its outcome looks like the fence (a
        # terminal failure, or connect-level errors in the tails). Printed
        # once so it lands in the transcript next to the output the agent
        # is about to reason about; the raw error text is never altered.
        hint = r.get("egress_hint")
        if hint and not getattr(self, "_egress_hint_printed", False):
            self._egress_hint_printed = True
            print(hint)
        return r

    def cancel(self):
        """Terminate the running job (scheduler cancel / process-group
        SIGTERM / sandbox terminate). This is the ONLY thing that kills a
        job \u2014 the user's Stop button, a kernel crash, or exiting the
        \`\`repl\`\` cell never auto-cancel; the daemon's poller keeps
        tracking and will harvest the job when it finishes. Call this (or
        \`\`c.close()\`\`) when you actually want to stop the remote work and
        free the allocation."""
        return _compute_call(
            "cancel", {"job_id": self._job_id, "provider": self._provider}
        )


class _OperonComputeInstance:
    """Dispatch to one provider. Bind once with create(); each method's
    approval modal still gates the actual remote exec.

    help(c.submit_job) for params; the remote-compute-ssh skill has the
    worked example. For byoc:* providers, pass provider_params to create()
    \u2014 e.g. create('byoc:modal', provider_params={'modal': {'image': ...,
    'gpu': 'A100'}}). \`timeout\` (container lifetime, seconds) is optional;
    omitted, it fills from the provider's Settings default.
    """

    def __init__(self, provider, provider_params=None):
        self._provider = provider
        self._provider_params = _normalize_provider_params(
            provider, provider_params)
        self._jobs = []
        self._reuse_via = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        try:
            self.close()
        except Exception:
            pass

    def __repr__(self):
        # The handle is stateless until submit_job \u2014 nothing to "recover" here.
        # For byoc, the params (image/gpu) are what you'd re-supply.
        pp = self._provider_params or {}
        pid = self._provider.split(":")[-1]
        bits = []
        for k in ("image", "gpu"):
            v = (pp.get(pid) or {}).get(k)
            if v:
                bits.append(f"{k}={v!r}")
        extra = (" " + " ".join(bits)) if bits else ""
        return f"<host.compute {self._provider}{extra}>"

    def submit_job(
        self,
        *,
        command,
        intent,
        inputs=None,
        outputs=None,
        environment=None,
        harvest=None,
        timeout_seconds=None,
        scheduler=None,
        tier=None,
        credentials=None,
        on_full="wait",
        # \u2014 aliases (friction scan F4) \u2014 normalized here, never sent \u2014
        timeout=None,
        timeout_s=None,
        env=None,
    ):
        """Stage inputs, write the job script, dispatch. Approval-gated.

        Returns immediately after dispatch. When a session
        \`\`set_concurrency_limit\`\` is in effect and the cap is full, the
        host refuses with \`\`error_kind="session_concurrency_full"\`\` and
        this call's \`\`on_full\`\` decides what happens:
        \`\`"wait"\`\` (default) prints one \`\`[concurrency] L/K full \u2014
        waiting\`\` line and retries with jittered exponential backoff
        (capped ~20s) until a slot opens; \`\`"raise"\`\` raises
        \`\`SessionConcurrencyFull(live, limit)\`\` immediately. The wait is a
        plain \`\`time.sleep\`\` \u2014 Stop interrupts it; no daemon-side state.
        Print the returned Job (its repr is the recovery handle),
        end the cell, and use the \`\`wait_for_notification\`\` brain-tool to
        park until the daemon's poller emits the \`\`compute_done\`\`
        notification (its payload carries \`\`featured_files\`\`). Call
        \`\`.result()\`\` for a non-blocking read of the harvested result dict.

        For byoc providers, the FIRST submit_job() on a handle creates the
        container; subsequent calls reuse it (weights/caches stay warm).
        Sequential only \u2014 submit job N+1 AFTER job N's \`\`compute_done\`\`
        notification arrives, since each submit wipes /work. Container
        shape (image/gpu/volume/region/timeout) is fixed at \`\`create()\`\` \u2014
        to change it, call \`\`create()\`\` again for a fresh handle; there is
        no per-\`\`submit_job\`\` override (the warm container can't honor it).

        Returns an _OperonComputeJob.
          intent \u2014 REQUIRED one-line approval-modal headline; name tool,
            target, scale, e.g. \`\`intent='run boltz2 on 3 seqs (A100,
            ~8min)'\`\`.
          command \u2014 job script. Scheduler directives at the top; cwd is a
            fresh per-job workdir; address inputs as './<dst_filename>'.
          inputs \u2014 list of {src, dst_filename} (workspace-relative path or
            {{artifact:ID}}, staged from this machine), {version_id,
            dst_filename} (artifact by version id, staged), or
            {remote_path, dst_filename} (absolute path already on the
            host, symlinked). A bare string entry \`\`'path/to/file'\`\` is
            accepted and coerced to \`\`{'src': 'path/to/file'}\`\`.
            dst_filename is a bare filename (no '/' \u2014 rejected at submit);
            inputs stage flat into the workdir root. For {src}/{remote_path}
            entries it may be omitted (defaults to that path's basename);
            {version_id} entries REQUIRE it (there is no filename to derive
            a default from at submit time).
          outputs \u2014 glob list. Bare string = featured; {glob, visibility:
            'hidden'} = diagnostic; {glob, residency:'remote'} = leave on
            host (SSH providers only; rejected on byoc; ignored by proxy
            providers).
          harvest \u2014 {exclude:['work/**'], max_file_mb, max_total_mb}.
          timeout_seconds \u2014 optional per-job runaway guard (aliases:
            \`\`timeout=\`\`, \`\`timeout_s=\`\`). SSH/proxy: default 1800s. byoc:
            defaults to the container's remaining life minus the harvest
            margin; outputs are staged even when it fires (the job lands
            as status 'timed_out', partial outputs already harvested). A
            warm-reuse submit whose deadline doesn't fit in the
            container's remaining life transparently creates a fresh
            sandbox instead. Set it when you can name the job's budget.
          environment \u2014 remote env name (alias: \`\`env=\`\`).
          credentials \u2014 list of credential NAMES (e.g. ['HF_TOKEN']) to
            forward from the host's credential store into the remote job's
            env. Host-resolved; the agent never sees the values. Names are
            shown on the approval card. byoc providers only.
          on_full \u2014 "wait" (default) | "raise". See above.
        """
        # \u2014 kwarg aliases (friction scan F4) \u2014
        if timeout_seconds is None:
            timeout_seconds = timeout if timeout is not None else timeout_s
        if environment is None:
            environment = env
        if inputs:
            # Bare string \u2192 {'src': str} (friction scan F3); _relativize_local
            # on src as before. Build a new list so the caller's list isn't
            # mutated in place. Container-type guard (bh 3469801828/3470239160):
            # a top-level string/dict would otherwise iterate chars/keys.
            if isinstance(inputs, (str, dict)):
                inputs = [inputs]
            norm = []
            for inp in inputs:
                if isinstance(inp, str):
                    inp = {"src": inp}
                if isinstance(inp, dict) and "src" in inp:
                    inp = {**inp, "src": _relativize_local(inp["src"])}
                norm.append(inp)
            inputs = norm
        for attempt in _itertools.count():
            try:
                r = _compute_call(
                    "submit",
                    {"provider": self._provider, "command": command,
                     "intent": intent, "inputs": inputs, "outputs": outputs,
                     "environment": environment, "harvest": harvest,
                     "timeout_seconds": timeout_seconds,
                     "scheduler": scheduler, "tier": tier,
                     "credentials": credentials,
                     "provider_params": self._provider_params,
                     "reuse_job_id": self._reuse_via},
                )
                break
            except RuntimeError as e:
                ek = getattr(e, "error_kind", None)
                if ek == "session_concurrency_full":
                    c = getattr(e, "concurrency", None) or {}
                    live, limit = c.get("live"), c.get("limit")
                    if on_full == "raise":
                        raise SessionConcurrencyFull(live, limit) from None
                    if attempt == 0:
                        print(
                            f"[concurrency] {live}/{limit} full \u2014 "
                            f"waiting for a slot"
                        )
                    _time.sleep(
                        min(2 * 1.5 ** min(attempt, 20), 20)
                        + _random.uniform(0, 2)
                    )
                    continue
                # Only drop the warm-container anchor if the error suggests
                # the container itself is gone \u2014 pre-create failures
                # (declined approval, at-cap, not-configured, bad params)
                # shouldn't cost the user a cold start on retry. Match on
                # the structured error_kind the host attaches.
                if ek in {
                    "not_found", "ownership_mismatch", "provider_degraded",
                    "result_rejected", "reuse_not_found", "transient",
                    "reuse_window_exhausted",
                    # NOTE: "reuse_timeout_too_large" is deliberately NOT
                    # here \u2014 the sandbox is healthy, only the request was
                    # too big. Keeping the anchor lets a corrected
                    # (smaller) retry reuse the warm sandbox instead of
                    # silently cold-starting.
                }:
                    self._reuse_via = None
                raise
        if "job_id" not in r:
            raise RuntimeError(r.get("message") or "submit cancelled")
        job = _OperonComputeJob(
            self._provider, r["job_id"], r.get("remote_workdir"),
        )
        job._concurrency = r.get("concurrency")
        conc = r.get("concurrency") or {}
        if conc.get("limit") is not None:
            print(
                f"[concurrency] live={conc.get('live')}/{conc.get('limit')}"
            )
        self._jobs.append(job)
        self._reuse_via = r["job_id"]
        # Host-attached info line (container timeout filled from the
        # Settings default, reuse fell back to a fresh sandbox, \u2026) \u2014 print
        # it so the disclosure actually reaches the transcript instead of
        # dying inside the return dict.
        note = r.get("system_note")
        if note:
            print(f"[note] {note}")
        # byoc: echo the sandbox's birth egress posture so the agent knows
        # what this job can reach before any output exists. The job keeps
        # this posture for its whole life \u2014 a Settings change only affects
        # sandboxes created after it.
        job.egress = r.get("egress")
        if job.egress:
            print(f"[egress] sandbox egress at creation: {job.egress}")
        # Print the recovery handle so it survives in the transcript even if a
        # later line in this cell raises before the agent prints it.
        print(job)
        return job

    def call_command(self, command, *, intent, login_shell=False,
                     timeout_seconds=60):
        """One synchronous command on the host (60s, 64KB cap). Approval-gated.

        For introspection \u2014 not job dispatch (use .submit_job()). Set
        login_shell=True when you need module/conda on PATH.
        Returns {stdout, stderr, exit_code}.
        """
        return _compute_call(
            "ssh",
            {"provider": self._provider, "command": command, "intent": intent,
             "login_shell": login_shell, "timeout_seconds": timeout_seconds},
        )

    def download(self, remote, local=None):
        """Copy one file from the host to your workspace. \`\`remote\`\` is ANY
        readable absolute path on the host \u2014 not restricted to job outputs
        or scratch. Paths inside scratch_root/data_roots transfer silently;
        any other path raises an approval card the user clicks Allow/Deny on
        (and may remember for the directory). When asked for a host file,
        call this directly with the path they gave \u2014 the approval card is the
        authorization gate, don't refuse on their behalf and don't \`\`cp\`\`
        into scratch first to dodge it. Dotfiles (\`\`~/.ssh/*\`\`,
        \`\`.gitconfig\`\`, \`\`.env\`\`, \u2026) get a hardened per-file confirmation.
        local=None saves as the basename. The poller already harvests the
        workdir into output_files before the compute_done notification fires
        \u2014 so this is for what the harvest globs missed, a left_on_remote
        file, or a host file outside the workdir. Slow; chain via
        inputs:[{remote_path: uri}] when the next job needs it instead."""
        return _compute_call(
            "scp",
            {"provider": self._provider, "direction": "down",
             "remote": remote, "local": local},
        )

    def upload(self, local, remote):
        """Copy one workspace file to the host's scratch tree (256MB cap).
        Path-jailed at both ends. For job inputs, DON'T upload first \u2014
        submit_job(inputs=[{src: 'file', dst_filename: ...}]) stages for
        you. This is for one-off placement (config you're not submitting,
        seeding a shared dir)."""
        return _compute_call(
            "scp",
            {"provider": self._provider, "direction": "up",
             "local": _relativize_local(local), "remote": remote},
        )

    def close(self):
        """Terminate this handle's container (byoc) and cancel any
        still-running jobs, then remove their workdirs (ssh). Every handle
        ends with close() \u2014 after its last job, not between jobs being
        chained warm (or that the user asked to keep warm), and not while
        a result says the container holds the only copy of the outputs
        (harvest_failed / result_rejected \u2014 recover those first). For byoc
        the container bills until close(), ~30 min of idle (the sandbox's
        idle watchdog), or the container timeout \u2014 whichever comes first,
        even after a failed job. Close once compute_done has arrived, the
        harvest is confirmed, and you've saved anything the globs missed
        (.download() on ssh \u2014 scp is SSH-only; on byoc read it off the
        sandbox from a compute_provider cell: modal.Sandbox.list(
        app_id=app.app_id, tags={'claude-science-job': job_id})
        finds the container \u2014 the tag names the job whose submit
        cold-started it \u2014 then sb.exec('cat', path))."""
        self._reuse_via = None
        return _compute_call(
            "close",
            {"provider": self._provider,
             "job_ids": [j._job_id for j in self._jobs]},
        )

    def attach_job(self, job_id):
        """Recover a job submitted in an earlier cell. Tracked by this
        instance so .close() cleans it up too; subsequent submit_job()
        reuses its container."""
        job = _OperonComputeJob(self._provider, job_id)
        self._jobs.append(job)
        self._reuse_via = job_id
        return job


class _ComputeNamespace:
    """Remote compute dispatch \u2014 host.compute.create(target) -> Compute.

    Runs via the \`repl\` tool only. Lifecycle: prepare input files in a
    \`python\` cell -> switch to the \`repl\` tool -> c =
    host.compute.create("<provider>") (e.g. "ssh:myhost", "byoc:modal";
    discover targets with the \`list_compute\` / \`compute_details\` tools) ->
    c.submit_job(command=..., intent=..., inputs=[{src, dst_filename}, ...])
    or c.call_command(cmd, intent=...). submit_job is keyword-only and
    \`command\` (the job script) is required; \`inputs\` entries are dicts \u2014
    {src: <workspace-relative path or {{artifact:ID}}>, dst_filename},
    {version_id, dst_filename}, or {remote_path, dst_filename}. Jobs run
    remotely; the cell returns immediately and the daemon posts a
    \`compute_done\` notification when outputs are harvested into your
    workspace (wait_for_notification collects it). help(host.compute.create)
    and the provider's remote-compute skill document the full parameter
    surface.
    """

    @staticmethod
    def create(provider, provider_params=None):
        """Create a Compute handle for a registered provider target.

        provider \u2014 target string, e.g. "ssh:<alias>" or "byoc:modal".
        provider_params \u2014 optional provider-specific dict (image, gpu,
        volumes, ...). Returns a Compute instance with submit_job /
        call_command / download / upload / attach_job methods \u2014
        submit_job returns a Job whose \`.status\` property tracks the run;
        help(<instance>.submit_job) for the job-spec fields.
        """
        return _OperonComputeInstance(provider, provider_params)

    @staticmethod
    def set_concurrency_limit(max_concurrent):
        """Cap LIVE compute jobs across this whole session (the frame tree
        rooted at the orchestrator). Any frame may LOWER it; only the
        orchestrator (root frame) may RAISE it. Sub-agents inherit
        automatically. Submits past the cap are refused with
        \`\`error_kind="session_concurrency_full"\`\`; \`\`submit_job\`\` retries
        with jittered backoff by default (\`\`on_full="wait"\`\`). Last call
        wins within those bounds."""
        return _compute_call(
            "set_concurrency", {"max_concurrent": int(max_concurrent)}
        )

    @staticmethod
    def status():
        """{live, limit, daemon_live, provider_caps} for this session's
        root. \`limit\` is None when no cap is set. \`provider_caps\` is each
        enabled provider's own max-concurrent ceiling \u2014 submits past a
        provider's cap refuse with their own error_kind (not retried by
        on_full)."""
        return _compute_call("status", {})

    def __repr__(self):
        return (
            "<host.compute \u2014 create(target) -> Compute; "
            "set_concurrency_limit(n); status(); "
            "help(host.compute) for the lifecycle>"
        )


host.compute = _ComputeNamespace()  # noqa: F821 (host defined in base.py)

# Claude Science SDK fragment: credentials (universal \u2014 any agent with a kernel).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER
# base in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are
# already bound.
#
# Host-call handlers: hostCalls.ts case "credentials_list" / "credentials_get"
# \u2192 UserSecretRepository. Return values are already covered by the output
# scrubber (getAllDecrypted populates scrubValues for every credential), and
# both methods are in DERIVABLE_HOST_CALLS so data is never persisted to
# host_call_log.


class _CredentialsAccessor:
    """host.credentials \u2014 list and fetch user-configured credentials by name.

    The primary credential for each provider is also exported as environment
    variables (AWS_ACCESS_KEY_ID, GOOGLE_APPLICATION_CREDENTIALS, etc.). This
    accessor reaches non-primary credentials and credential types that don't
    map cleanly onto environment variables \u2014 e.g. a GCS HMAC key alongside a
    GCP service account, or a second AWS profile.

        for c in host.credentials.list():
            print(c["name"], c["provider"], c["credential_type"])

        # GCS HMAC via the S3-compatible XML API. Use virtual-hosted
        # addressing so requests go to <bucket>.storage.googleapis.com \u2014
        # the sandbox egress denylist always blocks the path-style
        # storage.googleapis.com host (any-bucket front door), but the
        # bucket-qualified hostname can be allowed via
        # request_network_access("mybucket.storage.googleapis.com").
        # Bucket-less account-level calls (e.g. s3.list_buckets()) hit the
        # bare host and are always blocked \u2014 get bucket names from the
        # \`buckets\` field in host.credentials.list() instead.
        from botocore.config import Config
        hmac = host.credentials.get("GCS HMAC")
        s3 = boto3.client(
            "s3",
            endpoint_url="https://storage.googleapis.com",
            config=Config(s3={"addressing_style": "virtual"}),
            aws_access_key_id=hmac["access_key_id"],
            aws_secret_access_key=hmac["secret_access_key"],
        )

        # Google Cloud service account \u2014 service_account_json is a dict:
        from google.oauth2 import service_account
        sa = host.credentials.get("Google Cloud")["service_account_json"]
        creds = service_account.Credentials.from_service_account_info(sa)
        # (do not set GOOGLE_APPLICATION_CREDENTIALS \u2014 it's reset to the
        # primary SA before each cell)

        # Azure service principal \u2014 for a non-primary profile:
        from azure.identity import ClientSecretCredential
        az = host.credentials.get("Azure Staging")
        creds = ClientSecretCredential(
            tenant_id=az["tenant_id"],
            client_id=az["client_id"],
            client_secret=az["client_secret"],
        )
    """

    def list(self):
        """Return metadata for every configured credential.

        Each entry is {name, provider, credential_type, is_primary, buckets,
        region}. No secret values \u2014 use .get(name) for those.
        """
        return _host_call("credentials_list", [])  # noqa: F821

    def get(self, name):
        """Return the full decrypted fields for the named credential.

        Field set varies by provider / credential_type \u2014 e.g. AWS and GCS
        HMAC return {access_key_id, secret_access_key}, a GCP service
        account returns {service_account_json} (a dict \u2014 pass it to
        google.oauth2.service_account.Credentials.from_service_account_info),
        github returns {token}, and a generic secret returns {value}. The
        {name, provider, credential_type, buckets, region} metadata is
        always included.

        Raises if the name isn't found. Values are redacted from cell
        output \u2014 pass them directly to client libraries rather than
        printing.
        """
        if not isinstance(name, str):
            raise TypeError(
                f"host.credentials.get: name must be a str, got "
                f"{type(name).__name__}"
            )
        if not name:
            raise ValueError(
                "host.credentials.get: name must be a non-empty str"
            )
        return _host_call("credentials_get", [name])  # noqa: F821

    def __repr__(self):
        try:
            names = [c["name"] for c in self.list()]
        except Exception:
            return "<host.credentials>"
        return f"<host.credentials \u2014 {len(names)} configured: {names!r}>"


host.credentials = _CredentialsAccessor()

# \u2500\u2500 host.exec_peek / host.exec_interrupt \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Introspect and control a backgrounded local_exec cell (async local_exec
# interrupt path \u2014 a \`python\`/\`bash\`/\`r\` tool call that was interrupted by a
# user/parent message and is finishing in the background). The \`exec_id\` is
# in the \`{status:"running", exec_id}\` placeholder tool_result.


def _op_exec_peek(exec_id):
    """Return accumulated stdout for a backgrounded cell without waiting.

    Returns {status: "running"|"done", stdout, stderr, exit_code, error,
    elapsed_s, tool_name}. When status=="done" the full scrubbed result is
    included (equivalent to what wait_for_notification will deliver);
    \`error\` is the handler's error message if it failed (None otherwise).
    While running, stdout is the live (scrubbed) stream so far;
    stderr/exit_code/error are empty/None.

    If exec_id is unknown (already drained, daemon restarted, or stale),
    returns a bare {error: "No background execution with exec_id ..."}
    with NO \`status\` key \u2014 check for \`status\` presence before indexing.
    """
    return _host_call("exec_peek", [exec_id])  # noqa: F821


def _op_exec_interrupt(exec_id):
    """Stop the backgrounded cell.

    python/r/compute_provider: SIGINT the kernel \u2014 raises KeyboardInterrupt
    in user code. The kernel process survives (DataFrames, provider_params,
    handles in the namespace stay intact). One-shot per cell: if the cell's
    own code catches KeyboardInterrupt and continues, a second call is a
    no-op (the SIGINT is swallowed outside the interrupt bracket).

    bash/manage_*: SIGTERM the subprocess group (SIGKILL after 2s grace).
    The process tree is terminated; partial stdout/stderr captured so far
    is returned with a non-zero exit code.

    Caveat: manage_environments/manage_packages may return
    {interrupted: False, reason: "not interruptible (no signal-observing
    subprocess; will run to completion)"} \u2014 either because the backend is
    conda (CondaExecutor does not yet thread the abort signal) or because
    the interrupt arrived before a signal-observing subprocess was reached
    (pre-dispatch metadata read, or mode=register paths that never spawn
    one). The final result still arrives via wait_for_notification like a
    normal completion.

    Except for the caveat above, the cell's execute() resolves with partial
    output, delivered via wait_for_notification like a normal completion.
    Returns {interrupted: bool, via?: "sigint"|"sigterm", reason?: str}.
    """
    return _host_call("exec_interrupt", [exec_id])  # noqa: F821


host.exec_peek = _op_exec_peek  # noqa: F821
host.exec_interrupt = _op_exec_interrupt  # noqa: F821

# Claude Science SDK fragment: frames (repl-kernel only \u2014 concatenated by
# buildOperonSdkCode, not buildAnalysisSdkCode; list_frames/query_db are
# in OPERON_PERMIT not ANALYSIS_PERMIT).
#
# Attaches onto the \`host\` object installed by sdk/base.py.
#
# Executes via the \`repl\` tool (control-plane kernel). Stdlib-only
# (no pandas/numpy/third-party packages). Shares cwd with the python/R kernels
# but not memory \u2014 persist to ./handoff/*.json to cross.
#
# Host-call handler: hostCalls.ts case "list_frames" \u2192 hostCallFrames.ts

_OP_FRAMES_VALID_STATUS = frozenset({
    "processing", "completed", "failed", "cancelled",
    "awaiting_user_response", "awaiting_plan_approval",
})


def _op_frames(
    frame_id=None,
    pattern=None,
    project_id=None,
    status=None,
    roots_only=True,
    has_task=False,
    after=None,
    before=None,
    max_results=None,
    offset=0,
    include_tool_results=True,
):
    """Browse, search, or detail frames \u2014 three modes, one call.

    Mode is inferred from args:
        frame_id set  \u2192 detail: full message history for one frame
                        (short-prefix match OK). Pair with pattern to
                        regex-filter the returned messages.
        pattern set   \u2192 search: regex over name/task_summary/message
                        content. Returns matches with context snippets.
        neither       \u2192 browse: metadata list with artifact counts.

    Filters compose across modes \u2014 host.frames(pattern="error",
    status="failed") greps only failed frames.

    Browse return: {"mode": "browse", "count", "scope", "frames": [
        {id, root_frame_id, parent_frame_id, name, status, agent_name,
         task_summary, project_id, artifact_count, created_at, ...}
    ]}

    Search return: {"mode": "search", "pattern", "matches": [
        {frame_id, agent_name, status, project_id, snippets: [...], ...}
    ], "total_matches", "searched_frames"} \u2014 with project_id="all",
        also "projects_searched".

    Detail return: {"mode": "detail", "frame_id", "name", "agent_name",
        "status", "project_id", "input", "created_at", "messages": [...],
        "total_messages"}
        \u2014 set include_tool_results=False to omit tool_result blocks from
        messages for a compact trace. Paginates: on truncated=True, re-call
        with offset += len(messages). max_results default 50, cap 500.
        ALWAYS check truncated \u2014 messages are returned oldest-first, so the
        newest activity (e.g. [delegate] frame_id= dispatch lines you're
        grepping for) lives on the LAST page; a first-page regex that finds
        nothing means "page further", not "not there".

    before/after compare against UTC; a bare date means midnight UTC at the
    start of that day, so before='2026-04-02' excludes April 2nd \u2014 use the
    day after your cutoff or a full datetime.

    Project scope: defaults to the current project. All the user's
    projects are reachable \u2014 pass project_id="proj_X" to browse/search
    one, project_id="all" to span every project, or a frame_id from any
    project (it resolves directly, no flag needed). Every row carries
    project_id so you can see where it came from. "all" mode scans a
    newest-first window, not unbounded history: if the response carries
    candidates_truncated=True, older frames were never enumerated \u2014 narrow
    with before/after or per-project calls instead of trusting an empty
    result as "doesn't exist anywhere". Likewise regex_truncated=True /
    regex_skipped=N means the regex budget fired mid-scan and results are
    partial \u2014 narrow the pattern or scope before trusting "not present".

    Examples:
        host.frames()                             # all sessions (this project)
        host.frames(status="processing")          # what's running
        host.frames(has_task=True)                # delegated benches
        host.frames(pattern="BRCA1")              # grep content
        host.frames(pattern="BRCA1", project_id="all")  # grep every project
        host.frames(frame_id="abc12345")          # full transcript (any project)
        df = pd.DataFrame(host.frames()["frames"])  # straight to pandas
    """
    # Client-side guards \u2014 fail fast before the host round-trip.
    # M8: frame_id="" would fall through to browse mode (neither frame_id
    # nor pattern set \u2192 browse) \u2014 almost certainly a bug at the call site.
    if frame_id is not None and (not isinstance(frame_id, str) or not frame_id):
        raise TypeError(
            f"host.frames: frame_id must be a non-empty str, got {frame_id!r}"
        )
    # I1: pattern must be a regex str.
    if pattern is not None and not isinstance(pattern, str):
        raise TypeError(
            f"host.frames: pattern must be a str or None, got "
            f"{type(pattern).__name__}"
        )
    # C5/I4: the host silently returns empty on a status typo. Validate the
    # enum client-side so "completeed" raises instead of returning [].
    if status is not None:
        if not isinstance(status, str):
            raise TypeError(
                f"host.frames: status must be a str, got {type(status).__name__}"
            )
        if status not in _OP_FRAMES_VALID_STATUS:
            raise ValueError(
                f"host.frames: status={status!r} is not valid. "
                f"Must be one of: {sorted(_OP_FRAMES_VALID_STATUS)}"
            )
    # C2: max_results=-1 \u2192 JS .slice(0,-1) drops the last row; True \u2192 1.
    if max_results is not None and (
        not isinstance(max_results, int) or isinstance(max_results, bool)
        or max_results < 1
    ):
        raise TypeError(
            f"host.frames: max_results must be a positive int or None, "
            f"got {max_results!r}"
        )
    if offset is not None and (
        not isinstance(offset, int) or isinstance(offset, bool) or offset < 0
    ):
        raise TypeError(
            f"host.frames: offset must be a non-negative int or None, "
            f"got {offset!r}"
        )
    # C4: roots_only='no' truthy-coerces to True on the host (opposite of
    # intent). Require actual bool.
    for _name, _val in (("roots_only", roots_only), ("has_task", has_task),
                        ("include_tool_results", include_tool_results)):
        if _val is not None and not isinstance(_val, bool):
            raise TypeError(
                f"host.frames: {_name} must be a bool, got "
                f"{type(_val).__name__}"
            )
    return _host_call(
        "list_frames",
        [{
            "frame_id": frame_id,
            "pattern": pattern,
            "project_id": project_id,
            "status": status,
            "roots_only": roots_only,
            "has_task": has_task,
            "after": after,
            "before": before,
            "max_results": max_results,
            "offset": offset,
            "include_tool_results": include_tool_results,
        }],
    )


host.frames = _op_frames
# query_db/query_schema are in OPERON_PERMIT only \u2014 assign here (not in
# base.py __init__) so capabilities()["query"] is False in the analysis
# kernel. _QueryAccessor is defined in base.py (always loaded first).
host.query = _QueryAccessor()  # noqa: F821 (defined in base.py)

# Claude Science SDK fragment: mcp (OPERON KERNEL ONLY).
#
# Attaches onto the \`host\` object installed by sdk/base.py.
#
# Host-call handler: hostCalls.ts case "mcp" \u2192 executeMcpTool via MCPPool
#
# Concatenated by buildOperonSdkCode() only \u2014 never buildAnalysisSdkCode().
# The repl kernel runs \`python -I -S\` (stdlib only, agent-authored cells),
# so it is the one kernel where third-party pip/conda code cannot execute;
# that makes it the only kernel with an MCP surface. Analysis kernels reach
# MCP data through workspace files: fetch here, write ./handoff/*.json, read
# it from the python/R kernel. Enforcement is host-side (OPERON_PERMIT) \u2014
# this fragment's absence from the analysis SDK is ergonomics, not security.
#
# REPL-native MCP invocation. The loop happens inside the kernel:
#     genes = ["APC", "CTNNB1", "AXIN1"]
#     hits = [host.mcp("bio", "civic_search_genes", entrez_symbol=g) for g in genes]
# One repl tool_use, N host round-trips inside it, one tool_result. The
# transcript sees the cell's stdout, not N tool_use blocks. A discrete
# per-call tool would put 2N context blocks in history that replay every
# subsequent turn \u2014 quadratic in N over the turn count.


import json as _op_mcp_json


def _op_mcp(server, method, /, **kwargs):
    """Call an MCP server method. Returns parsed JSON if the response is
    JSON, else the raw string.

    \`server\` and \`method\` are positional-only (PEP 570) so they can never
    collide with a tool's own parameters \u2014 e.g. bioRxiv's search_preprints
    takes a kwarg literally named \`server\` (biorxiv|medrxiv):
        host.mcp("bio", "search_preprints", server="medrxiv", recent_days=7)

    Server/method names and schemas are in the mcp-<server> skill docs \u2014
    load the skill first (via the \`skill\` tool) to see what's available.

    Args are validated against the server's schema on the host; a
    mismatch raises RuntimeError with the schema echoed back. Approval
    must be pre-granted \u2014 the kernel can't prompt mid-execution.

    Examples:
        r = host.mcp("bio", "search_trials",
                       condition="colorectal cancer", page_size=10)
        for t in r.get("items", []):
            print(t["nct_id"], t["title"])

        # Batch \u2014 this is why mcp lives in the REPL:
        hits = {g: host.mcp("bio", "clingen_gene_validity",
                              gene=g)
                for g in my_gene_list}
    """
    # Client-side guards \u2014 fail fast before the host round-trip. The host
    # also validates (hostCalls.ts case "mcp"), but a typo in the first
    # iteration of a 50-item loop should fail immediately, not after the
    # round-trip.
    if not isinstance(server, str) or not server:
        raise TypeError(
            f"host.mcp: server must be a non-empty str, got {server!r}"
        )
    if not isinstance(method, str) or not method:
        raise TypeError(
            f"host.mcp: method must be a non-empty str, got {method!r}"
        )
    raw = _host_call("mcp", [server, method, kwargs])
    # executeMcpTool unwraps to the server's raw response text. Most MCP
    # servers emit JSON \u2014 parse opportunistically so the caller gets a
    # dict/list to iterate without a manual json.loads() on every line of
    # a loop. Non-JSON text (rare; some servers return plain prose) passes
    # through unchanged.
    if isinstance(raw, str) and raw and raw[0] in "{[":
        try:
            return _op_mcp_json.loads(raw)
        except _op_mcp_json.JSONDecodeError:
            pass
    return raw


host.mcp = _op_mcp

"""Claude Science kernel SDK \u2014 managed model endpoints fragment.

Installs \`\`host.model_endpoints\`\`: the registration surface for LOCALLY
HOSTED model servers (containers \u2014 e.g. NVIDIA NIMs) whose lifecycle the
DAEMON owns. Register once; afterwards every
\`\`compute_provider\`\` cell against the endpoint just works \u2014 the daemon
probes readiness, swaps the resident model off the GPU when needed, runs
the approved start script, and only dispatches your cell when the model
answers its readiness route.

Runs after sdk/base.py \u2014 relies on _host_call and the \`host\` singleton
being already defined in the namespace. Repl (control-plane) kernel
only. Load the \`\`managed-model-endpoints\`\` skill for the full
mechanics (idempotent-start pattern, cache mounts, worked examples).
"""


class _ModelEndpointsAccessor:
    """host.model_endpoints \u2014 register daemon-managed local model servers.

    Flow (once per model)::

        port = host.model_endpoints.free_port()
        host.model_endpoints.register(
            name="my-model-service",         # container name = endpoint name
            url=f"http://127.0.0.1:{port}",
            credential="NVIDIA_API_KEY",     # NAME of a saved credential
            skill="my-model-runbook",        # the model's runbook skill
            start='''...opaque bash...''',   # idempotent: inspect -> start | run
            stop="docker stop my-model-service",
            live="/health/ready",            # from the model's runbook
        )

    register() ALWAYS raises a permission card showing both scripts
    verbatim plus the port, service dir, and credential NAME \u2014 unless the
    registration is byte-identical to one already approved (same bytes are
    silent forever). The daemon hands the scripts HOST_PORT, SERVICE_DIR,
    and the credential VALUE via process env; your kernel code never sees
    the value, and inference calls to the local endpoint need no auth
    header.
    """

    def free_port(self):
        """Allocate a RANDOM host port from the managed range (20000-29999).

        Draws randomly (not sequentially), skipping ports owned by other
        managed endpoints and ports currently bound on the machine. Use the
        result inside the \`\`url\`\` you pass to :meth:\`register\` \u2014 the port
        lives in the URL and doubles as the endpoint's mutex.

        Errors until the user enables "NVIDIA BioNeMo NIM" under
        Customize \u2192 Compute (Model endpoints section) \u2014 same gate as register().
        """
        r = _host_call("model_endpoints_free_port", [{}])  # noqa: F821
        return r["port"]

    def register(
        self,
        name,
        url,
        skill,
        start=None,
        stop=None,
        live=None,
        credential="NVIDIA_API_KEY",
    ):
        """Register a managed model endpoint (always carded; see class doc).

        Args:
            name: endpoint name, 1-64 chars [a-z0-9-]. Becomes the
                \`\`compute_provider\`\` provider id.
            url: LOCAL \u2014 \`\`http://127.0.0.1:<port>\`\`, the LITERAL IPv4
                loopback (\`\`localhost\`\` is rejected: rootless docker
                resolves it to ::1 while the container publishes on IPv4).
                REMOTE \u2014 \`\`https://<upstream>/<model-path>\`\`; the host must
                equal the configured upstream and the machine must be in
                URL/remote mode. Remote endpoints take NO start/stop/live
                (the daemon owns no lifecycle for them).
            skill: name of the skill documenting the model's native API.
            start: LOCAL ONLY \u2014 opaque bash. Must be IDEMPOTENT \u2014 the
                documented convention is \`\`docker inspect <name> && docker
                start || (docker login \u2026 && docker run -d \u2026)\`\`. Receives
                HOST_PORT, SERVICE_DIR, and the credential value in its env.
            stop: LOCAL ONLY \u2014 opaque bash; must exit 0 only when the
                server is actually stopped (the daemon verifies the port
                frees afterwards).
            live: LOCAL ONLY \u2014 the model's READINESS route (e.g.
                \`\`/v1/health/ready\`\`, from its runbook) \u2014 polled for 200;
                never a TCP ping.
            credential: NAME of a saved credential (Customize \u2192
                Credentials). Never a value. The daemon accepts only the
                family credential \`\`NVIDIA_API_KEY\`\`, which is the default \u2014
                leaving the argument alone just works. Any OTHER name (or an
                explicit \`\`credential=None\`\`) is rejected at registration.

        Returns {registered, changed, name, url, port, service_dir, note}
        for local; {registered, changed, name, url, hosted, note} for
        remote.

        Errors until the user connects "NVIDIA BioNeMo NIM" under
        Customize \u2192 Compute (Model endpoints section); ask them to connect
        it there if this raises the not-connected error.
        """
        for label, v in (("name", name), ("url", url), ("skill", skill)):
            if not isinstance(v, str) or not v.strip():
                raise TypeError(
                    f"host.model_endpoints.register: {label} must be a "
                    "non-empty str"
                )
        hosted = isinstance(url, str) and url.strip().lower().startswith(
            "https://"
        )
        if hosted:
            for label, v in (("start", start), ("stop", stop), ("live", live)):
                if v is not None:
                    raise TypeError(
                        "host.model_endpoints.register: remote endpoints "
                        f"(https url) take no \`{label}\` \u2014 the daemon owns "
                        "no lifecycle for them; omit start/stop/live"
                    )
        else:
            for label, v in (("start", start), ("stop", stop), ("live", live)):
                if not isinstance(v, str) or not v.strip():
                    raise TypeError(
                        f"host.model_endpoints.register: {label} must be a "
                        "non-empty str for a local endpoint"
                    )
        if credential is not None and (
            not isinstance(credential, str) or not credential.strip()
        ):
            raise TypeError(
                "host.model_endpoints.register: credential must be the NAME "
                "of a saved credential (a str), never a key value"
            )
        kw = {
            "name": name,
            "url": url,
            "skill": skill,
        }
        if not hosted:
            kw["start"] = start
            kw["stop"] = stop
            kw["live"] = live
        if credential is not None:
            kw["credential"] = credential
        return _host_call("model_endpoints_register", [kw])  # noqa: F821

    def __repr__(self):
        return "<host.model_endpoints \u2014 free_port() / register(...)>"


host.model_endpoints = _ModelEndpointsAccessor()

# Claude Science SDK fragment: skills (repl-kernel only \u2014 see skills/customize).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Runs AFTER base
# in the same exec(code, namespace) \u2014 \`_host_call\` and \`host\` are already
# bound in that namespace.
#
# Host-call handlers: hostCalls.ts cases "skill_list" / "skill_read" /
# "skill_edit" / "skill_publish" / "skill_delete"
#
# Executes via the \`repl\` tool (control-plane kernel). Shares cwd with the
# python/R kernels but not memory \u2014 persist to ./handoff/*.json to cross.


def _op_skills_require_str(method, pname, val):
    if not isinstance(val, str) or not val:
        raise TypeError(
            f"host.skills.{method}: {pname} must be a non-empty str, "
            f"got {val!r}"
        )


def _op_skills_call(method, host_method, payload):
    r = _host_call(host_method, [payload])  # noqa: F821 (defined in base.py)
    # Handlers return {error: "..."} for soft failures (not found, old_string
    # mismatch, publish collision). Surface as an exception unless the dict
    # also carries a success key the caller is expected to inspect.
    if isinstance(r, dict) and "error" in r and len(r) == 1:
        raise RuntimeError(f"host.skills.{method}: {r['error']}")
    return r


class _SkillList(list):
    """list of skill dicts, plus \`.note\` (str | None) from the handler.
    Keeps the bare-list iteration contract while the note rides along."""

    note = None


class _SkillsAccessor:
    """Skill authoring: list/read/edit draft skills, then publish. Load skill
    'customize' for usage."""

    def __repr__(self):
        return "<host.skills \u2014 load skill 'customize' for API docs>"

    def list(self):
        """Return all skills (bundled + custom + drafts) as a list of dicts.

        Each entry: {name, origin, description}. origin is one of
        "anthropic" (bundled, read-only), "organization"/"personal"
        (editable, republish with overwrite), "draft" (local,
        unpublished), or "unknown" (on-disk content whose provenance
        can't be verified \u2014 e.g. a cached copy of a skill no longer in
        your registry, an mcp-* leftover, or the registry is
        unreachable. Stamped cache orphans are editable and editing
        converts them to local drafts; mcp-* leftovers stay "unknown"
        even after editing). Directly iterable.
        """
        r = _op_skills_call("list", "skill_list", {})
        # Handler returns {"skills": [...], "total", "note"} \u2014 unwrap to a
        # list subclass so \`for s in host.skills.list()\` yields dicts
        # while the note rides along as an attribute.
        if isinstance(r, dict) and "skills" in r:
            out = _SkillList(r["skills"])
            out.note = r.get("note")
            return out
        return r

    def read(self, name, path="SKILL.md"):
        """Read a file from a skill's directory. Defaults to SKILL.md.

        Returns {name, origin, path, content, files?}. files (the
        skill's relative file paths) is present on SKILL.md reads (the
        default). origin is one of the list() values; "unknown" means
        provenance can't be verified \u2014 e.g. the registry is unreachable,
        or the content is a catalog miss that isn't a genuine local
        draft (a stamped cache orphan from an unpublished or
        org-switched skill, an mcp-* leftover dir, content not on local
        disk, or no skill cache root configured). Content may still be
        served.
        """
        _op_skills_require_str("read", "name", name)
        _op_skills_require_str("read", "path", path)
        return _op_skills_call(
            "read", "skill_read", {"name": name, "path": path},
        )

    def edit(self, name, path, content, old_string=None):
        """Write or edit a draft-skill file.

        old_string=None  \u2192 create \`path\` (or overwrite it) with \`content\`.
        old_string=str   \u2192 str_replace: swap the first exact match of
                           old_string for \`content\` in the existing file.

        When \`path\` is \`kernel.py\` or \`kernel.R\` and the gate probe can
        judge, the result carries \`sidecar_gate: {ok: bool, error?: str}\`
        \u2014 the SAME structural gate the load path runs. When the probe
        can't judge (interpreter unavailable, or the source doesn't parse
        under the host's interpreter \u2014 possible version drift vs. your
        env), the key is absent and \`note\` says why. Check \`sidecar_gate\`
        instead of loading the skill just to test the sidecar. publish()
        refuses only on a structural reject.
        """
        _op_skills_require_str("edit", "name", name)
        _op_skills_require_str("edit", "path", path)
        if not isinstance(content, str):
            raise TypeError(
                f"host.skills.edit: content must be a str, got "
                f"{type(content).__name__}"
            )
        if old_string is not None and not isinstance(old_string, str):
            raise TypeError(
                f"host.skills.edit: old_string must be a str or None, got "
                f"{type(old_string).__name__}"
            )
        return _op_skills_call(
            "edit", "skill_edit",
            {"name": name, "path": path,
             "old_string": old_string or "",
             "new_string": content},
        )

    def publish(self, name, overwrite=False):
        """Promote a draft skill to the live skill set so agents can load it.

        publish takes NO content args \u2014 write SKILL.md (and any other
        files) via host.skills.edit(name, "SKILL.md", content) FIRST,
        then call publish(name). Set overwrite=True to replace an
        existing published skill of the same name."""
        _op_skills_require_str("publish", "name", name)
        if not isinstance(overwrite, bool):
            raise TypeError(
                f"host.skills.publish: overwrite must be a bool, got "
                f"{type(overwrite).__name__}"
            )
        return _op_skills_call(
            "publish", "skill_publish",
            {"name": name, "overwrite": overwrite},
        )

    def delete(self, name):
        """Delete a skill. Drafts: removes the local {name}/ directory.
        Published org/personal skills: unpublishes from the registry AND
        removes the local cache. Anthropic bundled skills are protected."""
        _op_skills_require_str("delete", "name", name)
        return _op_skills_call("delete", "skill_delete", {"name": name})


host.skills = _SkillsAccessor()  # noqa: F821 (host defined in base.py)

# Claude Science SDK fragment: structured-output submission (repl control-plane kernel).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Always
# defined in the repl kernel \u2014 frames without an output_schema get a
# clear host-side error instead of a missing symbol (same anti-stale-
# kernel rationale as host.children / host.compute).
#
# Host-call handler: hostCalls.ts case "submit_output" \u2192
# ToolRouter.handleSubmitOutputHostCall.


def _op_submit_output(output, completion_bullets):
    """Submit your structured output for this task \u2014 REQUIRED before
    completing when your task carries an OUTPUT SCHEMA section.

    Build \`\`output\`\` as a plain dict in THIS kernel and submit it here \u2014
    the payload goes over the kernel wire, never through your own prose,
    so large values cost nothing to submit or to fix. If validation (or a
    reviewer) bounces it, mutate the dict in memory and call this again \u2014
    resubmitting replaces the recorded output::

        out = {"summary": text, "count": n}
        r = host.submit_output(out, completion_bullets=["Counted N items"])
        if r.get("error"):
            out["count"] = int(out["count"])     # fix in memory
            r = host.submit_output(out, completion_bullets=["Counted N items"])

    \`\`output\`\` must match the JSON schema in the OUTPUT SCHEMA section of
    your task message exactly (fields at top level). Keep payloads
    compact \u2014 save large tables/blobs as artifacts and reference them by
    version id in the schema fields. Data prepared in the \`\`python\`\`
    kernel crosses via a file (the kernels share cwd, not memory):
    \`\`json.dump(out, open("handoff.json", "w"))\`\` there, then
    \`\`json.load(open("handoff.json"))\`\` here.

    \`\`completion_bullets\`\` is a REQUIRED list of 1-4 short past-tense
    action phrases (5-7 words, verb first, no 'and') shown to the human \u2014
    e.g. \`\`["Computed square root of 144"]\`\`. It rides alongside the
    schema fields, not inside them.

    Returns the host's result dict: on success \`\`{"status": "success",
    ...}\`\` with the RECORDED payload echoed back \u2014 verify every value
    (numeric magnitudes, exponents, units) is exactly what you intended;
    on validation failure \`\`{"error": ...}\`\` naming the failing fields.
    A submission may be held for review \u2014 if the reviewer raises blocking
    findings you'll be asked to address them and submit again.
    """
    if not isinstance(output, dict):
        raise TypeError(
            f"host.submit_output: output must be a dict matching your "
            f"task's OUTPUT SCHEMA, got {type(output).__name__}"
        )
    if isinstance(completion_bullets, str):
        completion_bullets = [completion_bullets]
    if (not isinstance(completion_bullets, (list, tuple))
            or not completion_bullets
            or not all(isinstance(b, str) and b.strip()
                       for b in completion_bullets)):
        raise TypeError(
            "host.submit_output: completion_bullets must be a non-empty "
            "list of short past-tense strings (e.g. ['Computed square "
            "root of 144'])"
        )
    r = _host_call(
        "submit_output",
        [{"output": output, "completion_bullets": list(completion_bullets)}],
    )
    return r


host.submit_output = _op_submit_output

# Claude Science SDK fragment: supervision (gated on enable_subtask_delegation).
#
# Attaches onto the \`host\` object installed by sdk/base.py. Only sent to
# agents that can spawn children \u2014 ungated agents get AttributeError on
# host.children() instead of a host round-trip.
#
# Executes via the \`repl\` tool (control-plane kernel). Stdlib-only
# (no pandas/numpy/third-party packages). Shares cwd with the python/R kernels
# but not memory \u2014 persist to ./handoff/*.json to cross.
#
# Host-call handler: hostCalls.ts case "list_running_children".
#
# child_trace() was removed \u2014 it was redundant with host.frames(frame_id=X)
# which returns the full message trace for any frame. Any include_thinking /
# max_messages filtering can be done in-kernel on the returned message list.


def _op_children():
    """List running child frames spawned by this frame.

    Returns {"running_children": [...], "count": N} where each entry is
    {frame_id, name?, agent_name, status, task, started_at} \u2014 "name" is
    the label you passed to delegate(name=...); "agent_name" is the
    child's PROFILE id, so identify children by "name".
    Only children with status in ("processing", "awaiting_user_response")
    \u2014 completed/failed children don't appear. A child in
    "awaiting_user_response" is PARKED on an approval/input card and
    makes no progress until the card is resolved \u2014 blocked, not slow.

    Data stays in-kernel: iterate, filter by agent_name, join against
    host.query results. No JSON dumped into context.

    For the bare list: host.children()["running_children"]

    For the full message trace of a child frame, use
    host.frames(frame_id=child_id) \u2014 it returns the complete conversation.
    """
    return _host_call("list_running_children", [])


# Fields accepted by host.delegate() request dicts \u2014 matches the \`delegate\`
# brain tool's input_schema minus \`track\` (plan-track linkage is an agent-loop
# concept, not a kernel-script one).
_DELEGATE_FIELDS = frozenset(
    ("task", "name", "context_summary", "profile", "output_schema", "model")
)


def _emit_child_frame_ids(results):
    """Echo every spawned child's frame id to cell stdout \u2014 ALWAYS, not
    only when the script prints the handle (owner ruling, #2882 final
    round). The line is machine-greppable and lands at the HEAD of the
    cell's output stream relative to later payload prints (tool-result
    truncation keeps the head \u2014 truncateResultSplit slices [0:max]), so a
    fresh kernel that lost its namespace can recover steerable ids from
    the transcript: host.stop_child / host.send_message / collect.
    """
    try:
        rs = results if isinstance(results, list) else [results]
        for r in rs:
            if isinstance(r, dict) and isinstance(r.get("frame_id"), str):
                nm = r.get("name") or r.get("agent_name")
                label = f" {nm}" if isinstance(nm, str) and nm else ""
                print(
                    f"[delegate] child{label} frame_id={r['frame_id']} "
                    f"(steer: host.send_message/host.stop_child; "
                    f"retrieve: host.collect)",
                    flush=True,
                )
    except Exception:
        pass  # emission must never break the dispatch result path


def _op_delegate(request=None, task=None, name=None, context_summary=None,
                 profile=None, output_schema=None, model=None, timeout=None, wait=True,
                 **_removed_kwargs):
    """Spawn a child agent, wait for it to finish, return its result.

    Blocking by default \u2014 the call returns when the
    child completes, so you can loop over inputs and act on each result
    without a \`\`wait_for_notification\`\` round-trip. Each call spawns a real
    child frame (own context, kernel, workspace); depth increments and is
    bounded host-side.

    The call BLOCKS the cell until the children finish. For long-running
    children, run it in a background cell so you keep control of the
    session while they work. Two different "interrupts" behave differently:
    an incoming USER MESSAGE mid-call backgrounds the call (children keep
    running; the result arrives when they finish), while an explicit
    Stop / cell interrupt CANCELS the children of a BLOCKING call.
    \`\`wait=False\`\` children and children past a \`\`timeout=\`\` deadline are
    decoupled from this cell's interrupt \u2014 they keep running; stop those
    with \`\`host.stop_child()\`\` (batch form).

    One surface, three input shapes \u2014 return type mirrors the input::

        r = host.delegate("Summarize artifact {{artifact:VID}}.")
        print(r.get("response") or r.get("error"))

        r = host.delegate(task="Classify this abstract: ...",
                            output_schema={"type": "object",
                                           "properties": {"label": {"type": "string"}},
                                           "required": ["label"]})
        print(r.get("structured_output", {}).get("label") or r.get("response"))

        schema = {"type": "object",
                  "properties": {"summary": {"type": "string"}},
                  "required": ["summary"]}
        results = host.delegate(
            [{"task": f"Process gene {g}", "name": g,
              "output_schema": schema} for g in genes],
        )
        for r in results:
            if r.get("error"):
                print(r.get("frame_id"), "failed:", r["error"])
            elif r.get("structured_output_unsatisfied"):
                print(r.get("frame_id"), "no structured output:", r.get("response"))
            else:
                print(r["structured_output"]["summary"])

    Each request (dict form) accepts:
        task            \u2014 str; what the child should do (required)
        name            \u2014 short UI label for the child (1-2 words)
        context_summary \u2014 background the child needs (it sees only this +
                          task, never your conversation). Reference artifact
                          version ids for data: \`\`{{artifact:VID}}\`\` markers
                          in the task resolve to readable paths child-side.
        profile         \u2014 run the child as a different agent profile. Omit
                          to inherit your own. Invalid names return an
                          \`\`{"error": ...}\`\` listing valid choices.
        output_schema   \u2014 JSON Schema. When set, the child must call
                          host.submit_output() matching it; you get back
                          \`\`structured_output\`\` instead of prose. Keep
                          payloads compact \u2014 large tables should be saved
                          as artifacts and referenced by id in the schema.
        model           \u2014 model id the child runs on (e.g. a haiku-class
                          id for cheap fan-outs). Free text, forwarded
                          as-is (same stance as host.llm \u2014 no client
                          allowlist); an unknown id fails the child on
                          its first LLM call and that slot returns
                          \`\`{"error": ...}\`\`. Omit to inherit the normal
                          chain (session subagent model \u2192 tier policy \u2192
                          parent's model). Per-request in list form \u2014
                          each child can run a different model.

    Every dispatch also echoes one line per spawned child to the cell's
    stdout \u2014 \`\`[delegate] child <name> frame_id=<uuid> (steer: ...)\`\` \u2014
    so the ids survive in the transcript even if you never print the
    returned handles (a fresh kernel can grep them to steer/collect).

    Returns per request:
        {"frame_id"?, "name"?, "status", "response"?, "structured_output"?,
         "structured_output_unsatisfied"?, "artifacts_created"?, "error"?}
    \`\`name\`\` echoes the label you passed (\`\`agent_name\`\`, where present,
    is the child's PROFILE id \u2014 identify children by \`\`name\`\`).
    \`\`status\`\` is "completed" / "failed" / "cancelled" for settled slots.
    With \`\`wait=False\`\` every slot returns a \`\`{"frame_id", "status":
    "running", "dispatched": True, "child_status"?}\`\` descriptor instead;
    with \`\`timeout=\`\` slots still running at the deadline return the same
    "running" descriptor (no \`\`dispatched\`\` flag) \u2014 both are completed
    later via \`\`host.collect()\`\`, never by this call. \`\`frame_id\`\` is
    absent when the request fails before a child frame is created (invalid
    profile, empty task, unresolvable \`\`{{artifact:VID}}\`\` marker in task,
    or cancelled while queued).
    \`\`structured_output_unsatisfied\`\` is True when the child completed
    without calling host.submit_output() despite an \`\`output_schema\`\` \u2014 \`\`response\`\`
    then carries its prose answer instead of \`\`structured_output\`\`.
    LARGE OUTPUTS: don't ask a child to return big payloads (>~10 KB) as
    prose \u2014 a 50 KB final response is many minutes of raw token
    generation and looks like a hang. Have the child write an artifact
    and return the version_id (or use \`\`output_schema\`\` for compact
    structured results), and put a \`\`timeout=\`\` on the wait.
    Structural validation
    (wrong types, unknown fields) raises; a child that *runs* and then fails
    returns \`\`{"error": ..., "status": "failed"}\`\` for that slot without
    failing the batch. A child that parks on a question or approval
    (ask_user / request_*_access) STAYS PARKED: its card surfaces to the
    user in the session UI, and (in a BLOCKING call) this call resumes
    once the user acts and the child finishes. You cannot see or answer
    the question yourself \u2014 the user does \u2014 and a parked child waits
    indefinitely until they do (for a blocking call,
    an explicit Stop / cell interrupt cancels it; an incoming user
    message merely backgrounds the call \u2014
    \`\`wait=False\`\` / post-deadline children are decoupled and
    park unaffected; they show \`\`child_status: "awaiting_user_response"\`\`
    in descriptors and collect() results). Parked children don't affect
    their siblings in a list call.

    List form spawns ALL requests concurrently, up to a HARD cap of 48
    requests per call (checked upfront \u2014 an oversized list raises before
    any child spawns). For larger fan-outs, batch into waves: delegate 48,
    collect the results, then send the next wave. Below the cap there is
    no concurrency limit; global API backpressure is handled engine-side.
    The host-call wire is serial, so pass a list rather than calling
    \`\`delegate()\`\` in a Python loop when you want parallelism.

    There is also a CUMULATIVE cap for this conversation (default 1000
    spawns, checked upfront \u2014 a violating call spawns nothing) that does
    NOT reset on the user's next message. When you hit it, report results
    and stop. (ROUTINE sessions are the exception: the cap is per-TICK
    via \`\`routines.max_spawns_per_tick\`\` and refreshes each tick.) Before
    a large multi-wave fan-out, check \`\`host.delegation_stats()\`\` for
    remaining headroom and plan the waves to fit.

    \`\`timeout\`\` (seconds, default None = wait indefinitely): at the
    deadline the call RETURNS instead of blocking further \u2014 finished
    slots carry their normal result dicts; unfinished slots carry
    \`\`{"frame_id": ..., "status": "running", ...}\`\` descriptors (a child
    parked on user approval shows \`\`child_status:
    "awaiting_user_response"\`\`). Children are NOT cancelled at the
    deadline \u2014 they keep running host-side. Act on a running descriptor
    with \`\`host.send_message()\`\` / \`\`host.stop_child()\`\`, and retrieve
    its result with \`\`host.collect([frame_id, ...], timeout=...)\`\` \u2014
    collect is the ONLY way to get a timed-out child's result (it will
    not arrive via \`\`wait_for_notification\`\`).

    \`\`wait=False\`\` \u2014 async dispatch: the call returns as soon as every
    child is SPAWNED, with one \`\`{"frame_id": ..., "status": "running",
    "dispatched": True}\`\` descriptor per request. **Return shape mirrors
    the input exactly like the blocking form**: a single request (str or
    dict) returns ONE descriptor dict \u2014 \`\`delegate(req, wait=False)[0]\`\`
    is a \`\`KeyError: 0\`\` and the child is already spawned; pass a
    one-element list when you want a list back. The kernel is free
    immediately: dispatch a wave, keep computing, dispatch more. Results
    are retrieved EXCLUSIVELY with \`\`host.collect(frame_ids)\`\` \u2014 they
    never arrive via \`\`wait_for_notification\`\`. The canonical idle
    pattern: dispatch with \`\`wait=False\`\`, then run \`\`host.collect\`\`
    in a background cell (\`\`background: true\`\`) and end your turn \u2014 the
    collect CELL's completion wakes you with results already in kernel
    variables. collect is deadline-bounded (default 30s, max 1800s;
    \`\`timeout=None\`\` raises) so a backgrounded collect always self-frees
    \u2014 for multi-wave flows loop short collect timeouts; while one runs,
    new persistent repl cells are rejected, but steering stays
    available via \`\`host.stop_child()\`\` / \`\`host.send_message()\`\` in
    a \`\`fresh: true\`\` cell. wait=False
    children are decoupled from this cell's interrupt \u2014 stop a wave with
    \`\`host.stop_child([fid, ...])\`\` (batch form; accepts the
    descriptor dicts directly). Mutually exclusive with \`\`timeout=\`\`.

    Available only while this frame is within the daemon's delegation
    depth cap (a sub-agent may itself delegate one further level when
    the cap allows; at the cap the call raises) and only while the
    session's Delegation toggle (ultra mode) is on.
    """
    # Kwargs removed in #2586 are accepted and ignored so saved/re-executed
    # cells from before the removal keep working; anything else unknown is
    # a real error (typo safety).
    _unknown_kwargs = set(_removed_kwargs) - {"max_concurrency"}
    if _unknown_kwargs:
        raise TypeError(
            f"host.delegate: unknown keyword argument(s) "
            f"{sorted(_unknown_kwargs)!r}"
        )
    if timeout is not None:
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
            raise TypeError(
                f"host.delegate: timeout must be a positive number of "
                f"seconds or None, got {type(timeout).__name__}"
            )
        if timeout <= 0:
            raise ValueError(
                "host.delegate: timeout must be a positive number of seconds"
            )
    if not isinstance(wait, bool):
        raise TypeError(
            f"host.delegate: wait must be a bool, got {type(wait).__name__}"
        )
    if wait is False and timeout is not None:
        raise ValueError(
            "host.delegate: timeout= is meaningless with wait=False \u2014 "
            "use host.collect(frame_ids, timeout=...) to bound the "
            "re-await"
        )
    # Options ride as a second wire element only when set \u2014 older hosts
    # (and the host-side validator) accept the bare [requests] form.
    _opts = {}
    if timeout is not None:
        _opts["timeout"] = float(timeout)
    if wait is False:
        _opts["wait"] = False
    _wire_opts = [_opts] if _opts else []

    def _norm(r, where):
        if isinstance(r, str):
            if not r.strip():
                raise ValueError(
                    f"host.delegate: {where} task must be a non-empty str"
                )
            return {"task": r}
        if not isinstance(r, dict):
            raise TypeError(
                f"host.delegate: {where} must be a task str or a request "
                f"dict, got {type(r).__name__}"
            )
        unknown = set(r) - _DELEGATE_FIELDS
        if unknown:
            raise TypeError(
                f"host.delegate: {where} has unknown field(s) "
                f"{sorted(unknown)!r}; valid fields are "
                f"{sorted(_DELEGATE_FIELDS)!r}"
            )
        task = r.get("task")
        if not isinstance(task, str) or not task.strip():
            raise TypeError(
                f"host.delegate: {where} 'task' must be a non-empty str, "
                f"got {type(task).__name__}"
            )
        if (r.get("output_schema") is not None
                and not isinstance(r["output_schema"], dict)):
            raise TypeError(
                f"host.delegate: {where} 'output_schema' must be a dict "
                f"(JSON Schema) or None"
            )
        for fname in ("name", "context_summary", "profile", "model"):
            v = r.get(fname)
            if v is not None and not isinstance(v, str):
                raise TypeError(
                    f"host.delegate: {where} {fname!r} must be a str or "
                    f"None, got {type(v).__name__}"
                )
        # \uD83D\uDFE1 3375199109 (M4/M15 mirror for the delegation surface): both
        # delegator lanes coerce blank/whitespace model to undefined \u2014 the
        # pin would silently fall through to the inherited session model.
        # Reject loudly here, same posture as host.llm's model guard.
        # \\ufeff (\uD83D\uDFE1 3377128267): JS .trim() strips BOM, Python .strip()
        # does not \u2014 same loudness contract as the llm guards.
        mv = r.get("model")
        if mv is not None and not mv.replace("\\ufeff", "").strip():
            raise ValueError(
                f"host.delegate: {where} 'model' must be a non-empty str "
                f"or None, got {mv!r}"
            )
        return dict(r)

    if isinstance(request, (list, tuple)):
        if (task is not None or name is not None or context_summary is not None
                or profile is not None or output_schema is not None
                or model is not None):
            raise TypeError(
                "host.delegate: when passing a list of requests, put "
                "per-request options (name/context_summary/profile/"
                "output_schema/model) inside each request dict"
            )
        reqs = [_norm(r, f"requests[{i}]") for i, r in enumerate(request)]
        if not reqs:
            return []
        _results = _host_call("delegate", [reqs] + _wire_opts)
        _emit_child_frame_ids(_results)
        return _results

    if isinstance(request, dict):
        if (task is not None or name is not None or context_summary is not None
                or profile is not None or output_schema is not None
                or model is not None):
            raise TypeError(
                "host.delegate: pass options inside the request dict OR "
                "as keyword arguments, not both"
            )
        req = _norm(request, "request")
    elif isinstance(request, str) or request is None:
        req = {}
        if isinstance(request, str):
            if task is not None:
                raise TypeError(
                    "host.delegate: task given both positionally and as "
                    "a keyword"
                )
            req["task"] = request
        elif task is not None:
            req["task"] = task
        if name is not None:
            req["name"] = name
        if context_summary is not None:
            req["context_summary"] = context_summary
        if profile is not None:
            req["profile"] = profile
        if output_schema is not None:
            req["output_schema"] = output_schema
        if model is not None:
            req["model"] = model
        req = _norm(req, "request")
    else:
        raise TypeError(
            f"host.delegate: expected a task str, a request dict, or a "
            f"list of those; got {type(request).__name__}"
        )

    out = _host_call("delegate", [[req]] + _wire_opts)
    if not (isinstance(out, list) and out):
        raise RuntimeError(
            "host.delegate: host returned no result for single request"
        )
    _emit_child_frame_ids(out)
    return out[0]


def _op_delegation_stats():
    """Cumulative delegation budget: how many children this conversation
    has spawned.

    Returns \`\`{"spawned_this_task", "cap", "remaining"}\`\`. The counter
    covers every \`\`host.delegate()\`\` spawn in this conversation's
    lifetime and does NOT reset \u2014 the cap (\`\`remaining == 0\`\`) means:
    report results to the user. (ROUTINE sessions are the exception: the
    cap is per-TICK via \`\`routines.max_spawns_per_tick\`\` and refreshes
    each tick.) Check this BEFORE a large multi-wave fan-out and size the
    waves to fit \`\`remaining\`\`; a call that would exceed the cap raises
    without spawning anything.

    Spawn-count visibility only \u2014 no token/cost quotas are exposed here.
    Available wherever \`\`host.delegate()\`\` is (within the daemon's
    delegation depth cap).
    """
    return _host_call("delegation_stats", [])




def _coerce_child_ids(val, label):
    """str | descriptor/result dict | list of either (mixed) \u2192 list[str].

    Descriptor dicts are the handles \`\`host.delegate(wait=False)\`\` /
    \`\`timeout=\`\` return; plucks \`\`frame_id\`\` (or \`\`child_frame_id\`\`) so the
    natural \`\`collect(handles)\`\` / \`\`stop_child(handles)\`\` pattern works
    without manual id extraction.
    """
    def _one(x):
        if isinstance(x, str) and x:
            return x
        if isinstance(x, dict):
            fid = x.get("frame_id") or x.get("child_frame_id")
            if isinstance(fid, str) and fid:
                return fid
            raise TypeError(
                f"{label}: dict entry has no usable frame_id \u2014 pass the "
                f"descriptor/result dict from host.delegate() (it carries "
                f"frame_id), or the id string itself; got keys "
                f"{sorted(x.keys())!r}"
            )
        raise TypeError(
            f"{label}: each entry must be a frame-id str or a "
            f"descriptor/result dict carrying frame_id, got "
            f"{type(x).__name__}"
        )
    if isinstance(val, (list, tuple)):
        if not val:
            raise TypeError(f"{label}: list must be non-empty")
        return [_one(x) for x in val]
    return [_one(val)]


def _coerce_child_slots(val, label):
    """Lenient sibling of \`\`_coerce_child_ids\`\` \u2014 per-slot isolation.

    Returns \`\`(slots, had_list)\`\` where each slot is \`\`("ok", frame_id)\`\`
    or \`\`("bad", error_message)\`\`. A malformed entry (junk dict, wrong
    type) becomes a failed SLOT instead of aborting the whole batch \u2014 one
    bad handle in a cleanup/collect wave must not cost the other
    children's results (delegation chaos scorecard, 2026-06-09). Empty
    lists still raise: that is argument misuse, not a bad slot.
    """
    def _one(x):
        if isinstance(x, str) and x:
            return ("ok", x)
        if isinstance(x, dict):
            fid = x.get("frame_id") or x.get("child_frame_id")
            if isinstance(fid, str) and fid:
                return ("ok", fid)
            return ("bad", (
                f"{label}: dict entry has no usable frame_id \u2014 pass the "
                f"descriptor/result dict from host.delegate() (it "
                f"carries frame_id), or the id string itself; got keys "
                f"{sorted(x.keys())!r}"
            ))
        return ("bad", (
            f"{label}: each entry must be a frame-id str or a "
            f"descriptor/result dict carrying frame_id, got "
            f"{type(x).__name__}"
        ))
    if isinstance(val, (list, tuple)):
        if not val:
            raise TypeError(f"{label}: list must be non-empty")
        return [_one(x) for x in val], True
    return [_one(val)], False


def _op_stop_child(child_frame_id, reason=None):
    """Stop a running child agent \u2014 or a backgrounded execution.

    \`\`child_frame_id\`\` is a child frame id (from \`\`host.delegate()\`\`
    results, \`\`host.children()\`\`, or an earlier tool-lane delegation) OR
    the \`\`exec_id\`\` of a backgrounded execution (from
    \`\`wait_for_notification\`\`'s \`\`pending_work.executions\`\`).

    Accepts id strings OR the descriptor/result dicts \`\`host.delegate()\`\`
    returns (\`\`frame_id\`\` is plucked), mixed freely in the list form.

    Batch form: pass a LIST to stop a whole wave in one call
    (\`\`host.stop_child([fid1, handle2, ...])\`\`) \u2014 per-id isolation.
    **Return shape mirrors the input** (same rule as \`\`delegate\`\`/
    \`\`collect\`\`): a single id/handle returns ONE result dict; a list
    returns a LIST of result dicts in the same order. The
    remedy surface for \`\`wait=False\`\` dispatches, which are decoupled from
    the cell's interrupt.

    EXPECT NO OUTPUT from a stopped child: a child killed mid-work has
    usually produced nothing durable yet, so \`\`output_data\`\` is absent in
    the common case. Only output the child had ALREADY persisted before
    the stop (submitted structured_output, created artifacts, a finished
    response) comes back under \`\`output_data\`\` \u2014 stop is not a harvest
    mechanism; if partial results matter, have the child checkpoint to
    artifacts as it goes. Calling this on an already-completed/stopped
    CHILD FRAME is idempotent \u2014 you get its final \`\`output_data\`\` back
    instead of an error. EXEC IDS differ: a backgrounded execution that
    already settled returns \`\`{"status": "noop", "outcome":
    "already_finished" | "already_interrupted" | "already_cancelled",
    "message": ...}\`\` with NO \`\`output_data\`\` \u2014 \`\`already_finished\`\`
    means the result was already delivered as a durable \`\`cell_result\`\`
    notification row \u2014 consume it via \`\`wait_for_notification()\`\` (a
    \`\`[System]\`\` tail message appears only when the row write failed);
    don't re-run. \`\`already_interrupted\`\` means only partial output
    was delivered; \`\`already_cancelled\`\` means the exec was lost to a
    restart/force-stop and its results were NOT delivered \u2014 re-run the
    cell if the work still matters. Only your OWN children are
    reachable (parentage-checked host-side); unrelated frames return a
    not-found error. Failures NEVER raise: a bad id or malformed handle
    yields \`\`{"status": "failed", "error": ...}\`\` (per-slot in the list
    form) \u2014 same idiom as \`\`collect\`\` \u2014 so one typo cannot abort a
    cleanup wave.
    """
    if reason is not None and not isinstance(reason, str):
        raise TypeError(
            f"host.stop_child: reason must be a str or None, got "
            f"{type(reason).__name__}"
        )
    slots, was_list = _coerce_child_slots(child_frame_id, "host.stop_child")
    good = [fid for (tag, fid) in slots if tag == "ok"]
    if not was_list:
        # Single form. Operational failures (bad handle, not-found) come
        # back as a failed dict \u2014 collect's per-slot idiom \u2014 so a typo'd
        # id in a cleanup loop can't raise mid-wave.
        if not good:
            return {"status": "failed", "error": slots[0][1]}
        r = _host_call(
            "stop_child",
            [{"child_frame_id": good[0], "reason": reason}],
        )
        if isinstance(r, dict) and "error" in r and len(r) == 1:
            return {
                "child_frame_id": good[0],
                "status": "failed",
                "error": r["error"],
            }
        return r
    if good:
        r = _host_call(
            "stop_child",
            [{"child_frame_id": good, "reason": reason}],
        )
        if isinstance(r, dict) and "error" in r and len(r) == 1:
            # Whole-batch host error (e.g. protocol) \u2014 surface per-slot so
            # the return shape stays a positional list.
            host_results = [
                {"child_frame_id": fid, "status": "failed", "error": r["error"]}
                for fid in good
            ]
        else:
            host_results = r.get("results", []) if isinstance(r, dict) else []
    else:
        host_results = []
    it = iter(host_results)
    merged = []
    for tag, v in slots:
        if tag == "ok":
            try:
                merged.append(next(it))
            except StopIteration:
                merged.append({"status": "failed", "error": "no result"})
        else:
            merged.append({"status": "failed", "error": v})
    # List in -> list out (mirror rule; ergonomics chaos run 2026-06-10:
    # the old {"results": [...]} wrapper made single-vs-batch code paths
    # diverge -- result["results"] raised KeyError on the single form).
    return merged


def _op_collect(frame_ids, timeout=30.0):
    """Retrieve results of dispatched children by frame id \u2014 the sole
    result channel for \`\`host.delegate(wait=False)\`\` dispatches and for
    children that outlived a \`\`delegate(timeout=...)\`\` deadline.

    \`\`frame_ids\`\` is a child frame id (str), a descriptor/result dict from
    \`\`host.delegate()\`\` (\`\`frame_id\`\` is plucked \u2014 pass handles directly),
    or a list mixing either \u2014 from \`\`wait=False\`\` / \`\`timeout=\`\` running
    descriptors, \`\`host.children()\`\`, or an earlier call's results. Returns a list (one dict per id, same
    order): a finished child yields its full delegate-style result dict
    (\`\`status\`\`/\`\`response\`\`/\`\`structured_output\`\`/\`\`artifacts_created\`\`);
    a child still running at the deadline yields \`\`{"frame_id": ...,
    "status": "running", "child_status": ...}\`\` \u2014 \`\`child_status:
    "awaiting_user_response"\`\` means the child is PARKED on an
    approval/input card and will not progress until it is resolved
    (blocked, not slow; the descriptor's \`\`note\`\` says so too). Terminal statuses are
    "completed" / "failed" / "cancelled" (e.g. stopped via
    \`\`stop_child\`\`), and "orphaned" (\`\`restart_casualty: True\`\`) for a
    child lost to a daemon restart. \`\`timeout\`\` is BOUNDED \u2014 default 30s,
    max 1800s; \`\`timeout=None\`\` raises (matches \`\`wait_for_notification\`\`:
    a blocked collect always self-frees at its deadline). Only your OWN children are
    reachable (parentage-checked host-side); a bad id OR a malformed
    entry (e.g. a dict without \`\`frame_id\`\`) yields a per-slot
    \`\`{"status": "failed", "error": ...}\`\` without failing the batch.

    Pass a single id to get a one-element list.

    A backgrounded collect holds the repl kernel only until its deadline
    \u2014 new repl cells are rejected meanwhile, then the kernel self-frees.
    For multi-wave flows, loop short timeouts (e.g. \`\`timeout=60\`\`) so the
    kernel frees between slices and wave-N+1 can dispatch.
    """
    slots, _ = _coerce_child_slots(frame_ids, "host.collect")
    if timeout is None:
        raise ValueError(
            "host.collect: timeout=None (unbounded) is not allowed \u2014 "
            "collect is deadline-bounded like wait_for_notification "
            "(default 30s, max 1800s). Loop short slices for long waits: "
            "still-running slots come back as {'status': 'running'} "
            "descriptors you can pass straight back in."
        )
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
        raise TypeError(
            f"host.collect: timeout must be a positive number of "
            f"seconds (default 30, max 1800), got {type(timeout).__name__}"
        )
    if timeout <= 0:
        raise ValueError(
            "host.collect: timeout must be a positive number of seconds "
            "(default 30, max 1800)"
        )
    if timeout > 1800:
        raise ValueError(
            "host.collect: timeout is capped at 1800s (matches the "
            "wait_for_notification guidance ceiling) \u2014 loop shorter "
            "slices instead of one long wait"
        )
    good = [fid for (tag, fid) in slots if tag == "ok"]
    if good:
        payload = {"frame_ids": good, "timeout": float(timeout)}
        r = _host_call("collect", [payload])
        if isinstance(r, dict) and "error" in r and len(r) == 1:
            raise RuntimeError(f"host.collect: {r['error']}")
    else:
        r = []
    # Re-splice host results into the original slot order; malformed
    # entries come back as per-slot failures (same idiom as a bad
    # id-string) instead of a batch-aborting TypeError.
    it = iter(r)
    out = []
    for tag, v in slots:
        if tag == "ok":
            out.append(next(it))
        else:
            out.append({"status": "failed", "error": v})
    return out


def _op_send_message(target=None, message=None, kind="info", *,
                     child_frame_id=None):
    """Send a message to another agent in your delegation tree.

    **Comms topology: you can message only your direct parent and your
    direct children** (from an aside, also the main session via
    \`\`"main"\`\`). Sends to any other frame \u2014 a sibling, a grandparent, a
    frame-id found elsewhere \u2014 are refused with a topology error; relay
    via your parent instead.

    \`\`target\`\` is a frame-id str, a descriptor/result dict from
    \`\`host.delegate()\`\` / \`\`host.children()\`\`, or the literal
    \`\`"parent"\`\` (resolved host-side to the agent that spawned you). From
    an aside, the literal \`\`"main"\`\` posts a note to the main session.

    **Your direct child** \u2192 existing behavior: a RUNNING child gets the
    message injected into its conversation at its next step
    (\`\`{status: "injected", ...}\`\`); a COMPLETED/CANCELLED child is
    RESUMED with your message as its next input; a child parked on an
    approval has its pending approval(s) denied with the message in the
    deny error. \`\`kind\`\` is advisory (noted in the receipt) \u2014 the
    message goes straight into the child's transcript.

    **Your direct parent** (\`\`target="parent"\`\`) \u2192 the message is pushed
    into its conversation; it consumes it at its next loop iteration
    (\`\`{status: "sent", note: ...}\`\`). Held in-memory only \u2014 not
    persisted across daemon restart. \`\`kind="question"\`\` marks it so
    your parent is prompted to answer you back via
    \`\`host.send_message\`\`. Keep it short (capped at 4000 chars); up to
    32 such posts per task. From the root frame, \`\`target="parent"\`\` is
    refused \u2014 use \`\`ask_user\`\` for the human.

    **From an aside** (side chat), \`\`target="main"\`\` posts a \`\`[From
    side chat] \u2026\`\` note to the main session \u2014 advisory context, not
    user authorization; if main is idle it waits for the user's next
    message there. \`\`kind\`\` is forced to \`\`"info"\`\` (asides cannot
    receive replies). Up to 8 such posts per aside turn. Other
    main-tree frames are topology-refused \u2014 main can forward.

    Returns a delivery RECEIPT \u2014 never the target's answer: the target
    processes your message in the background. For a child, retrieve its
    new result with \`\`host.collect([frame_id])\`\`. For a question to
    your parent, the answer (if any) arrives as a message at your next
    turn boundary \u2014 it does not block this cell.
    A bad id or malformed handle yields \`\`{"status": "failed", "error":
    ...}\`\` instead of raising \u2014 unified with \`\`collect\`\`/\`\`stop_child\`\`.
    """
    # \uD83D\uDFE13456401986: accept the #2882-era kwarg name so a keyword-style
    # call doesn't raise in-kernel before the host-side alias can help.
    if target is None:
        target = child_frame_id
    if isinstance(target, (list, tuple)):
        raise TypeError(
            "host.send_message: one target per call \u2014 pass a single "
            "frame-id str or descriptor dict (loop for a wave)"
        )
    if not isinstance(message, str) or not message.strip():
        raise TypeError(
            "host.send_message: message must be a non-empty str"
        )
    if kind not in ("info", "question"):
        raise ValueError(
            "host.send_message: kind must be 'info' or 'question', "
            f"got {kind!r}"
        )
    if target == "parent":
        fid = "parent"
    elif target == "main":
        fid = "main"
    else:
        slots, _ = _coerce_child_slots(target, "host.send_message")
        if slots[0][0] == "bad":
            return {"status": "failed", "error": slots[0][1]}
        fid = slots[0][1]
    r = _host_call(
        "send_message",
        [{"target": fid, "message": message, "kind": kind}],
    )
    if isinstance(r, dict) and "error" in r and len(r) == 1:
        # Operational failure (not-found etc.) \u2192 failed dict, not a raise
        # \u2014 unified with collect/stop_child so steering loops survive a
        # bad id (argument misuse like a list still raises above).
        return {"target": fid, "status": "failed", "error": r["error"]}
    return r


host.children = _op_children
host.delegate = _op_delegate
host.delegation_stats = _op_delegation_stats
host.stop_child = _op_stop_child
host.collect = _op_collect
host.send_message = _op_send_message

# Claude Science SDK fragment: runtime provenance instrumentation \u2014 CORE (1/3).
# Split from a single provenance.py so the sec-scanner can review it
# (OOM'd 3\xD7 on the 1400L monolith). inline-workers.mjs concats
# _prov_core.py + _prov_wraps.py + _prov_harvest.py into the single
# SDK_PROVENANCE_PY constant \u2014 runtime layout unchanged.
#
# Loaded by buildAnalysisSdkCode AFTER base.py/artifacts.py. Attaches onto
# the already-instantiated \`host\` singleton. Runs BEFORE any user code.
#
# Design (specs/artifacts-store-lineage.md L16): observe object-level data
# flow at RUNTIME instead of inferring it from code text post-hoc. Mechanism
# is recipy-style wrap-on-import: a small set of reader functions
# (pandas.read_*, numpy.load*, anndata.read_h5ad, ...) are wrapped so their
# return value is tagged with the source version_id; a small set of writer
# functions (DataFrame.to_*, Figure.savefig, numpy.save*, json.dump) are
# wrapped to harvest tags from their argument and record
# {output_path: {vids}} in __operon_prov_written. The host queries that map
# per saved output via __operon_runtime_inputs__(path) at save_artifacts
# time. Tags ride pandas .attrs (propagates through most ops natively) or a
# side-table keyed on id(obj) when the type has no .attrs slot.
#
# Non-goals (v1): full generic dataflow tracing (sys.settrace), numpy
# op-level propagation, R/bash coverage. Where the tag is lost (plain
# dicts, exec'd code, unwrapped readers), the host falls back to the
# Haiku/AST post-hoc lane. Where the tag IS present, the host skips the
# Haiku call entirely for that output.

import builtins as _prov_builtins
import os as _prov_os
import sys as _prov_sys
import weakref as _prov_weakref

_PROV_ATTR = "_operon_src"

# path -> version_id. Seeded by host.artifact_path() (below) and by the
# host's pre-exec {{artifact:}} resolver (compute.ts injects a
# __operon_prov_seed({...}) call before each cell that carried markers).
# Keys are realpath'd so symlinked store layouts match.
_prov_path_to_vid = {}

# id(obj) -> (weakref, frozenset[vid]). Weakref is the liveness guard;
# types that don't support weakref (ndarray, dict, list, bytes) are
# refused entirely (no id-reuse-after-GC risk \u2014 ic 4765227282 nit).
_prov_side = {}

# path -> frozenset[vid]. Populated by wrapped writers; the host reads it
# via __operon_runtime_inputs__(path). Keyed by the as-written path AND
# its realpath (no basename \u2014 see _prov_record_write).
_prov_written = {}

# Modules patched so far (idempotency guard for the __import__ hook).
_prov_patched = set()

# Kill switch -- the whole fragment becomes a no-op (readers/writers call
# straight through; __operon_runtime_inputs__ returns []) when this env
# var is set. Single opt-out for the entire lane.
_PROV_OFF = _prov_os.environ.get("OPERON_PROVENANCE_OFF") == "1"


# Fallback no-op stubs FIRST, before any subclass/type machinery that could
# throw on an unexpected env \u2014 a raise in the defs below must still leave
# the host's query surface intact (\`guardProvenanceShim\` is the outer
# belt; this is the inner suspender). Real implementations overwrite these
# later in this fragment.
def __operon_runtime_inputs__(_p):  # noqa: E501  (overwritten below)
    return {"fired": False, "inputs": []}


def __operon_runtime_inputs_batch__(_ps):
    return {p: {"fired": False, "inputs": []} for p in _ps}


def __operon_prov_seed(mapping):
    """Host-called before each cell that resolved {{artifact:}} markers.
    Also callable from user code / tests."""
    if _PROV_OFF:
        return
    for vid, path in (mapping or {}).items():
        try:
            rp = _prov_os.path.realpath(path)
        except Exception:
            rp = path
        _prov_path_to_vid[rp] = vid
        _prov_path_to_vid[path] = vid


def _prov_vid_of_path(p):
    if not isinstance(p, (str, bytes, _prov_os.PathLike)):
        return None
    try:
        s = _prov_os.fspath(p)
        if isinstance(s, bytes):
            s = s.decode("utf-8", "replace")
    except Exception:
        return None
    v = _prov_path_to_vid.get(s)
    if v:
        return v
    try:
        return _prov_path_to_vid.get(_prov_os.path.realpath(s))
    except Exception:
        return None


# \u2500\u2500 ndarray subclass for numpy-op propagation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Created lazily on first numpy import. \`__array_finalize__\` fires on EVERY
# array created from a _ProvNdarray (views, slices, fancy indexing, ufunc
# results, arithmetic) \u2014 it's the one mechanism that survives \`x[mask]\` and
# \`x * 2\` without sys.settrace. The shim returns this subclass from the
# pandas\u2192numpy transition points (Series.values / .to_numpy / __array__) so
# \`ax.scatter(df['x'].values[mask], ...)\` stays tagged end-to-end. Returning
# a subclass from .values is mildly invasive (\`type(x) is np.ndarray\` would
# fail) but isinstance passes and matplotlib/scipy handle subclasses; only
# applied when the source IS tagged, so untagged data paths are unchanged.
_ProvNdarray = [None]  # mutable cell \u2014 set by _prov_ensure_ndarray_cls()


def _prov_ensure_ndarray_cls():
    if _ProvNdarray[0] is not None:
        return _ProvNdarray[0]
    np = _prov_sys.modules.get("numpy")
    if np is None:
        return None

    class ProvNdarray(np.ndarray):
        __array_priority__ = 1.0

        def __array_finalize__(self, obj):
            if obj is None:
                return
            t = getattr(obj, "_prov_tags", None)
            if t:
                self._prov_tags = t

        def item(self, *a):
            r = np.ndarray.item(self, *a)
            t = getattr(self, "_prov_tags", None)
            return _prov_wrap_scalar(r, t) if t else r

        def tolist(self):
            r = np.ndarray.tolist(self)
            t = getattr(self, "_prov_tags", None)
            if not t:
                return r
            def rec(x):
                if isinstance(x, list):
                    return [rec(e) for e in x]
                return _prov_wrap_scalar(x, t)
            return rec(r)

        def __reduce__(self):
            # Pickle as the base ndarray \u2014 the subclass is a process-local
            # instrumentation detail, never something we want to persist
            # (would poison multiprocessing round-trips with ImportError).
            import numpy as _np
            return _np.ndarray.__reduce__(self.view(_np.ndarray))

        def __repr__(self):
            # Cosmetic (room #prov-shim-stress): print as a plain ndarray
            # so user-visible cell output doesn't leak \`ProvNdarray(\u2026)\`.
            return np.ndarray.__repr__(self.view(np.ndarray))

    _ProvNdarray[0] = ProvNdarray
    return ProvNdarray


def _prov_as_traced_array(arr, vids):
    """Return arr viewed as _ProvNdarray with _prov_tags=vids. Falls back to
    the side table if numpy isn't loaded or the view fails."""
    cls = _prov_ensure_ndarray_cls()
    if cls is None or arr is None:
        return _prov_tag(arr, vids)
    try:
        v = arr.view(cls)
        prev = getattr(v, "_prov_tags", frozenset())
        v._prov_tags = frozenset(prev) | frozenset(vids)
        return v
    except Exception:
        return _prov_tag(arr, vids)


# \u2500\u2500 scalar subclasses (float/int/str/bool) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Closes the df.loc[r,'c'] -> float -> ax.plot([float]) gap. Each carries
# _prov_tags and preserves it through arithmetic via the binop overrides.
# Immutable-base pattern: __new__ constructs from the plain value, __init__
# stamps tags. Pickle/copy degrade to the plain base (process-local only).
# _ProvBool subclasses int (bool can't be subclassed); identity checks
# (\`is True\`) on a _ProvBool will fail -- acceptable, rarely used on
# extracted data values.
def _prov_make_scalar_cls(base, name):
    binops = ("__add__", "__radd__", "__sub__", "__rsub__", "__mul__",
              "__rmul__", "__truediv__", "__rtruediv__", "__floordiv__",
              "__rfloordiv__", "__mod__", "__rmod__", "__pow__", "__rpow__",
              "__neg__", "__pos__", "__abs__")
    # str-returning value ops (iteration-3 gap-2): _ProvStr[:n], s+s,
    # s.replace/strip/upper/format/join all return plain str by default.
    # Re-wrap so \`open(p).read()[:50]\` and \`json.loads(s)\` paths stay tagged.
    if base is str:
        binops = binops + (
            "__getitem__", "replace", "strip", "rstrip", "lstrip",
            "upper", "lower", "title", "capitalize", "format",
            "format_map", "join", "center", "ljust", "rjust", "zfill",
            "encode",
        )

    def __new__(cls, val, _prov=()):
        return base.__new__(cls, val)

    def __init__(self, val, _prov=()):
        try:
            object.__setattr__(self, "_prov_tags", frozenset(_prov))
        except Exception:
            pass

    def __reduce__(self):
        return (base, (base(self),))

    ns = {"__new__": __new__, "__init__": __init__, "__reduce__": __reduce__}
    for op in binops:
        bop = getattr(base, op, None)
        if bop is None:
            continue

        def mk(bop=bop):
            def w(self, *a, **kw):
                r = bop(self, *a, **kw)
                if r is NotImplemented:
                    return r
                try:
                    t = getattr(self, "_prov_tags", frozenset())
                    for x in a:
                        t = t | getattr(x, "_prov_tags", frozenset())
                    for x in kw.values():
                        t = t | getattr(x, "_prov_tags", frozenset())
                    return _prov_wrap_scalar(r, t)
                except Exception:
                    return r
            return w
        ns[op] = mk()
    return type(name, (base,), ns)


_ProvFloat = _prov_make_scalar_cls(float, "_ProvFloat")
_ProvInt = _prov_make_scalar_cls(int, "_ProvInt")
_ProvStr = _prov_make_scalar_cls(str, "_ProvStr")

# numpy-scalar subclasses (3447902387): coercing np.float64/np.int64 to
# Python float/int via .item() strips .item()/.dtype/.astype()/isinstance
# (np.floating) \u2014 user cells that touched those broke only on artifact-
# derived data. Instead subclass the numpy scalar TYPE itself (per-dtype,
# cached), so the full np.generic API survives and isinstance passes.
_prov_np_scalar_cls: "dict[type, type]" = {}

_PROV_SCALAR_BINOPS = (
    "__add__", "__radd__", "__sub__", "__rsub__", "__mul__",
    "__rmul__", "__truediv__", "__rtruediv__", "__floordiv__",
    "__rfloordiv__", "__mod__", "__rmod__", "__pow__", "__rpow__",
    "__neg__", "__pos__", "__abs__",
)


def _prov_np_scalar_subclass(np_type):
    # 3447945279: failure is cached as None \u2014 key-presence check, not
    # \`is not None\`, or a failing dtype re-builds+re-raises every call.
    if np_type in _prov_np_scalar_cls:
        return _prov_np_scalar_cls[np_type]
    try:
        def _mk_binop(op):
            bop = getattr(np_type, op, None)
            if bop is None:
                return None

            def w(self, *a):
                r = bop(self, *a)
                if r is NotImplemented:
                    return r
                try:
                    t = getattr(self, "_prov_tags", frozenset())
                    for x in a:
                        t = t | getattr(x, "_prov_tags", frozenset())
                    return _prov_wrap_scalar(r, t)
                except Exception:
                    return r
            return w
        ns = {
            "__new__": lambda cls, val, _prov=(): np_type.__new__(cls, val),
            "__reduce__": lambda self: (np_type, (np_type(self),)),
        }
        for op in _PROV_SCALAR_BINOPS:
            wop = _mk_binop(op)
            if wop is not None:
                ns[op] = wop
        c = type(f"_Prov_{np_type.__name__}", (np_type,), ns)
        # verify constructible (some np scalar types reject subclass init)
        _ = c(np_type(0))
    except Exception:
        c = None
    _prov_np_scalar_cls[np_type] = c
    return c


# \u2500\u2500 json result tagging (iteration-3 gap-4, re-done per 3447929917) \u2500\u2500\u2500\u2500\u2500\u2500
# The earlier _ProvDict/_ProvList container subclasses broke three
# container contracts for artifact JSON: copy-on-access nested mutation
# (\`d['sec']['k'] = x\` mutated a throwaway), .keys()/.values() returning
# lists not views (set-algebra TypeError), and \`type(obj) is dict\`
# strict-type dispatch (yaml RepresenterError). They also wrapped the
# caller's own default on a .get() miss (3447929919 \u2014 spurious
# consensus:"runtime" edge from a literal the artifact never contained).
#
# Fix: tag LEAVES, not containers. At json.load/loads time, rebuild the
# structure ONCE with plain dict/list containers whose scalar leaves
# (values AND keys) are _Prov*-wrapped. \`type(d) is dict\` passes, views
# are native dict_keys, nested mutation hits the real child, and .get()
# is native dict.get so a miss returns the caller's default untouched.
# t06 (\`list(d.keys())\` \u2192 [_ProvStr,\u2026]) and t14 (\`d.values()\` element
# \u2192 _ProvStr) still fire because the leaves themselves carry the tag.
#
# Tradeoff (3447965497): LEAVES are subclass-typed, so exact-type
# dispatch on artifact-JSON keys/values (\`type(v) is str\`) fails. The
# one concrete consumer cited \u2014 PyYAML safe_dump \u2014 is cured via
# _prov_patch_yaml representer registration. Other strict-type
# dispatchers on artifact-JSON leaves are the documented cost of the
# leaf-wrap recall lane; escape hatch is OPERON_PROVENANCE_OFF=1.
#
# Bounded: bails to side-table-only past _PROV_JSON_LEAF_CAP nodes so a
# multi-MB JSON artifact doesn't pay O(n) wrapper-object overhead.
_PROV_JSON_LEAF_CAP = 10_000


def _prov_wrap_container(v, tags):
    """Recursively wrap scalar LEAF VALUES of a json.load/loads result with
    \`tags\`; containers stay plain dict/list, and dict KEYS stay plain
    (room #prov-shim-stress: wrapped keys break orjson.dumps dict-key
    type check; key-flow to output is synthetic \u2014 t06-only)."""
    if not tags:
        return v
    n = [0]

    def rec(x):
        n[0] += 1
        if n[0] > _PROV_JSON_LEAF_CAP:
            return x
        t = type(x)
        if t is dict:
            return {k: rec(w) for k, w in x.items()}
        if t is list:
            return [rec(e) for e in x]
        return _prov_wrap_scalar(x, tags)
    try:
        return rec(v)
    except Exception:
        return v


def _prov_wrap_scalar(v, tags):
    """Wrap a Python scalar (or numpy scalar) in the tag-carrying subclass.
    Non-scalars pass through unchanged (the caller handles them via
    _prov_tag / _prov_as_traced_array)."""
    if not tags or v is None:
        return v
    # Already wrapped (arithmetic on a _Prov* returns another _Prov* via
    # the binop override which re-calls _prov_wrap_scalar) \u2014 merge tags
    # instead of nesting subclasses.
    prev = getattr(v, "_prov_tags", None)
    if prev is not None:
        try:
            object.__setattr__(v, "_prov_tags", frozenset(prev) | frozenset(tags))
        except Exception:
            pass
        return v
    t = type(v)
    try:
        if t is bool:
            # 3447902387: bool identity MUST be preserved \u2014 wrapping as
            # _ProvInt(1/0) breaks isinstance(v,bool) and json.dumps.
            # Accept the recall loss; bools rarely drive plots directly.
            return v
        if t is float:
            return _ProvFloat(v, tags)
        if t is int:
            return _ProvInt(v, tags)
        if t is str:
            return _ProvStr(v, tags)
        # numpy scalars (np.float64 etc.) \u2014 subclass the numpy type so
        # .item()/.dtype/.astype()/isinstance(np.floating) survive
        # (3447902387). np.bool_ passes through unwrapped for the same
        # identity-preservation reason as python bool.
        np = _prov_sys.modules.get("numpy")
        if np is not None and isinstance(v, np.generic):
            if isinstance(v, np.bool_):
                return v
            sub = _prov_np_scalar_subclass(type(v))
            if sub is not None:
                r = sub(v)
                try:
                    object.__setattr__(r, "_prov_tags", frozenset(tags))
                    return r
                except Exception:
                    pass
            # Fall back to side-table \u2014 keeps original type verbatim.
            _prov_tag(v, tags)
            return v
    except Exception:
        pass
    return v


def _prov_tag(obj, vids):
    """Attach a vid set to obj. Prefers a native .attrs slot (pandas/xarray
    -- propagates through slice/copy/arith and is NOT serialized to disk);
    else the id()-keyed side table. AnnData .uns is deliberately NOT used
    (3447867042): .uns IS serialized by write_h5ad/write_zarr, so writing a
    tag there both contaminates user data and raises IORegistryError (no
    set/frozenset writer). AnnData falls through to the side table."""
    if not vids:
        return obj
    fs = frozenset(vids)
    attrs = getattr(obj, "attrs", None)
    # pandas/xarray .attrs is a plain dict; merge.
    if isinstance(attrs, dict):
        try:
            prev = attrs.get(_PROV_ATTR)
            attrs[_PROV_ATTR] = (prev | fs) if isinstance(prev, frozenset) else fs
            return obj
        except Exception:
            pass
    key = id(obj)
    try:
        ref = _prov_weakref.ref(obj, lambda _r, k=key: _prov_side.pop(k, None))
    except TypeError:
        # room #prov-shim-stress: non-weakref'able builtins (dict/list/
        # tuple/bytes/\u2026) are the EXACTLY id-reuse-risky set \u2014 a GC'd dict
        # leaves a stale side-table entry that a fresh unrelated dict at
        # the same id then matches, producing a spurious consensus:
        # "runtime" edge. Skip side-tabling entirely for these; recall
        # for json dict/list comes from leaf-wrapping instead.
        return obj
    prev = _prov_side.get(key)
    prev_fs = prev[1] if prev else frozenset()
    _prov_side[key] = (ref, prev_fs | fs)
    return obj


# Exact-type fast path set for _prov_tags_of \u2014 plain builtin scalars carry
# no tags (we never side-table them and they have no .attrs/_prov_tags).
# Kills the measured 14.6\xD7 np.array(plain-list) and 3.3\xD7 untagged .iloc
# per-element overhead. Subclass wrappers (_ProvFloat etc.) don't match
# type-is checks.
_PROV_PLAIN_SCALAR = frozenset(
    (int, float, str, bytes, bool, complex, type(None)),
)


def _prov_tags_of(obj, *, _depth=0, _seen=None):
    """Harvest vids from obj. Checks _prov_tags (ndarray subclass / scalar
    subclasses), .attrs, the side table, then recurses one level into
    list/tuple/dict-values (bounded)."""
    if type(obj) in _PROV_PLAIN_SCALAR or _depth > 4:
        return frozenset()
    out = set()
    # ndarray subclass: the primary numpy-op-surviving carrier.
    t = getattr(obj, "_prov_tags", None)
    if t:
        out |= set(t)
    attrs = getattr(obj, "attrs", None)
    if isinstance(attrs, dict):
        v = attrs.get(_PROV_ATTR)
        if v:
            out |= set(v)
    ent = _prov_side.get(id(obj))
    if ent is not None:
        ref, fs = ent
        if ref() is obj:
            out |= fs
    # ndarray: if this array is a view, also check its base.
    base = getattr(obj, "base", None)
    if base is not None and base is not obj:
        out |= _prov_tags_of(base, _depth=_depth + 1)
    if isinstance(obj, (list, tuple)) and len(obj) <= 64:
        if _seen is None:
            _seen = set()
        if id(obj) not in _seen:
            _seen.add(id(obj))
            for x in obj:
                out |= _prov_tags_of(x, _depth=_depth + 1, _seen=_seen)
    elif isinstance(obj, dict) and len(obj) <= 64:
        if _seen is None:
            _seen = set()
        if id(obj) not in _seen:
            _seen.add(id(obj))
            for x in obj.values():
                out |= _prov_tags_of(x, _depth=_depth + 1, _seen=_seen)
    return frozenset(out)


def _prov_record_write(path, vids):
    if not path:
        return
    try:
        s = _prov_os.fspath(path)
        if isinstance(s, bytes):
            s = s.decode("utf-8", "replace")
    except Exception:
        return
    fs = frozenset(vids or ())
    try:
        rp = _prov_os.path.realpath(s)
    except Exception:
        rp = s
    # Last-writer-wins (3447867043): the bytes on disk at \`path\` derive
    # only from the most recent write to that path, so REPLACE -- never
    # union across writes. Unioning would over-attribute after a same-path
    # overwrite from a different source (iterative-regen notebook shape),
    # and since consensus:"runtime" is the highest-trust tier the spurious
    # edge would persist uncorrected. An UNTAGGED overwrite (3447902386)
    # must record an EMPTY set, not leave the stale entry: key-presence
    # is the Haiku-skip \`fired\` signal (a wrapped writer observed the
    # write), so store frozenset() rather than pop \u2014 \`{fired:true,
    # inputs:[]}\` is a positive zero.
    #
    # ic 4765227282: NO basename key \u2014 the host always queries by the
    # absolute source_path (artifacts.ts \`fullPath\`), so basename is
    # never the hit, and it collides across directories (out/{a,b}/
    # result.csv both record "result.csv" last-writer-wins; a host query
    # that missed s/rp would get the wrong file's vids).
    for k in {s, rp}:
        if k:
            _prov_written[k] = fs


def __operon_runtime_inputs__(path):
    """Host-queried per saved output. Tri-state return
    \`{fired: bool, inputs: list[vid]}\`:
      - \`fired=True\`  \u2014 a wrapped writer (savefig/to_csv/json.dump/open-w
        truncate/\u2026) was observed for \`path\`; \`inputs\` is the authoritative
        runtime-tracked input set, and \`inputs==[]\` is a positive zero.
        Host skips Haiku for this output.
      - \`fired=False\` \u2014 no wrapped writer saw this path (subprocess/shutil/
        os.write/unwrapped lib). Host falls back to the Haiku\u222AAST lane.
    """
    if _PROV_OFF:
        return {"fired": False, "inputs": []}
    try:
        s = _prov_os.fspath(path)
        if isinstance(s, bytes):
            s = s.decode("utf-8", "replace")
    except Exception:
        return {"fired": False, "inputs": []}
    try:
        rp = _prov_os.path.realpath(s)
    except Exception:
        rp = s
    for k in (s, rp):
        if k in _prov_written:
            return {"fired": True, "inputs": sorted(_prov_written[k])}
    return {"fired": False, "inputs": []}


def __operon_runtime_inputs_batch__(paths):
    return {p: __operon_runtime_inputs__(p) for p in paths}


# ---- reader/writer wrappers ----------------------------------------------


# Claude Science SDK fragment: runtime provenance instrumentation \u2014 WRAPS (2/3).
# Per-library import-time patchers (pandas, numpy). Concatenated AFTER
# _prov_core.py by inline-workers.mjs \u2014 every _prov_* name referenced
# here is defined there.
#
# ruff: noqa: F821

def _prov_wrap_reader(fn, path_arg=0, path_kw=None):
    """Wrap a reader so its return is tagged with the path-arg's vid."""
    if getattr(fn, "_operon_prov", False):
        return fn

    def w(*a, **kw):
        r = fn(*a, **kw)
        try:
            p = kw.get(path_kw) if path_kw and path_kw in kw else (
                a[path_arg] if len(a) > path_arg else None
            )
            vid = _prov_vid_of_path(p)
            if vid:
                # ndarray readers \u2192 subclass so numpy ops propagate;
                # everything else \u2192 .attrs/.uns/side-table.
                np = _prov_sys.modules.get("numpy")
                if np is not None and isinstance(r, np.ndarray):
                    return _prov_as_traced_array(r, {vid})
                _prov_tag(r, {vid})
        except Exception:
            pass
        return r

    try:
        w.__name__ = getattr(fn, "__name__", "wrapped")
        w.__qualname__ = getattr(fn, "__qualname__", w.__name__)
        w.__doc__ = getattr(fn, "__doc__", None)
        w.__wrapped__ = fn
    except Exception:
        pass
    w._operon_prov = True
    return w


def _prov_wrap_method_writer(cls, name, path_arg=0, path_kw=None):
    """Wrap an unbound method \`cls.name(self, path, ...)\` so it records
    {path: tags_of(self)} after a successful write."""
    fn = getattr(cls, name, None)
    if fn is None or getattr(fn, "_operon_prov", False):
        return

    def w(self, *a, **kw):
        r = fn(self, *a, **kw)
        try:
            p = kw.get(path_kw) if path_kw and path_kw in kw else (
                a[path_arg] if len(a) > path_arg else None
            )
            _prov_record_write(p, _prov_tags_of(self))
        except Exception:
            pass
        return r

    w.__name__ = getattr(fn, "__name__", name)
    w.__doc__ = getattr(fn, "__doc__", None)
    w.__wrapped__ = fn
    w._operon_prov = True
    try:
        setattr(cls, name, w)
    except Exception:
        pass


# Per-module patch registry. Each entry is (module_name, patch_fn(mod)).
def _prov_patch_pandas(pd):
    for r in (
        "read_csv", "read_parquet", "read_json", "read_pickle", "read_hdf",
        "read_excel", "read_feather", "read_table", "read_fwf",
    ):
        if hasattr(pd, r):
            setattr(pd, r, _prov_wrap_reader(getattr(pd, r), 0,
                                             "filepath_or_buffer"))
    # merge/concat: union both sides' attrs into the result.
    for combo in ("merge", "concat"):
        orig = getattr(pd, combo, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig):
            def w(*a, **kw):
                r = orig(*a, **kw)
                try:
                    srcs = set()
                    for x in a:
                        srcs |= _prov_tags_of(x)
                    for x in kw.values():
                        srcs |= _prov_tags_of(x)
                    if srcs:
                        _prov_tag(r, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        setattr(pd, combo, mk())
    # DataFrame writers -- tags_of(self) at write.
    try:
        DF = pd.DataFrame
        S = pd.Series
    except Exception:
        return
    for m in ("to_csv", "to_parquet", "to_json", "to_pickle", "to_hdf",
              "to_excel", "to_feather"):
        _prov_wrap_method_writer(DF, m, 0, "path_or_buf")
        _prov_wrap_method_writer(S, m, 0, "path_or_buf")
    # DataFrame.merge / .join method -> union self+other.
    for m in ("merge", "join"):
        orig = getattr(DF, m, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig):
            def w(self, *a, **kw):
                r = orig(self, *a, **kw)
                try:
                    srcs = _prov_tags_of(self) | _prov_tags_of(a) | \\
                        _prov_tags_of(list(kw.values()))
                    if srcs:
                        _prov_tag(r, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        setattr(DF, m, mk())
    # pandas -> numpy transition (Series.values / .to_numpy() /
    # __array__). These are the points where .attrs is STRIPPED -- the
    # returned ndarray has no attrs slot, so side-table it. Covers
    # \`ax.plot(df['x'].values, ...)\` and matplotlib's internal
    # \`np.asarray(series)\` coercion (which calls __array__). Does NOT
    # cover subsequent numpy ops on the result (fancy indexing /
    # arithmetic produce fresh arrays with new ids) -- that gap is the
    # known recall floor for pure-numpy pipelines; see report.
    for cls in (DF, S):
        for m in ("to_numpy", "__array__"):
            orig = getattr(cls, m, None)
            if orig is None or getattr(orig, "_operon_prov", False):
                continue

            def mk(orig=orig):
                def w(self, *a, **kw):
                    r = orig(self, *a, **kw)
                    try:
                        srcs = _prov_tags_of(self)
                        if srcs:
                            return _prov_as_traced_array(r, srcs)
                    except Exception:
                        pass
                    return r
                w._operon_prov = True
                w.__wrapped__ = orig
                return w
            try:
                setattr(cls, m, mk())
            except Exception:
                pass
        # .values is a property -- wrap the fget.
        try:
            prop = cls.values
            if isinstance(vars(cls).get("values"), property):
                pdesc = vars(cls)["values"]
                if not getattr(pdesc.fget, "_operon_prov", False):
                    ofget = pdesc.fget

                    def vfget(self, _o=ofget):
                        r = _o(self)
                        try:
                            srcs = _prov_tags_of(self)
                            if srcs:
                                return _prov_as_traced_array(r, srcs)
                        except Exception:
                            pass
                        return r
                    vfget._operon_prov = True
                    setattr(cls, "values", property(vfget, pdesc.fset,
                                                    pdesc.fdel, pdesc.__doc__))
        except Exception:
            pass
    # Scalar-extraction accessors: Series.__getitem__ + .loc/.iloc/.at/.iat
    # indexer __getitem__. When the return is a plain scalar, wrap it so
    # \`df.loc[r,'c']\` -> _ProvFloat carrying df's tags. Non-scalar returns
    # (Series/DataFrame slices) already inherit .attrs natively -- leave
    # them alone. This is the scalar-extraction R-gap closer (the 3/10
    # clean-replay misses in runtime_report.md).
    def _wrap_scalar_getter(cls, attr, owner_of):
        orig = getattr(cls, attr, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            return

        def w(self, key, _o=orig, _own=owner_of):
            r = _o(self, key)
            try:
                # Only wrap genuine scalars; slices/Series keep .attrs.
                np = _prov_sys.modules.get("numpy")
                is_scalar = isinstance(r, (int, float, str, bool, bytes)) or (
                    np is not None and isinstance(r, np.generic))
                if is_scalar:
                    srcs = _prov_tags_of(_own(self))
                    if srcs:
                        return _prov_wrap_scalar(r, srcs)
            except Exception:
                pass
            return r
        w._operon_prov = True
        w.__wrapped__ = orig
        try:
            setattr(cls, attr, w)
        except Exception:
            pass

    _wrap_scalar_getter(S, "__getitem__", lambda s: s)
    # Indexer classes live in pd.core.indexing; .obj is the
    # Series/DataFrame being indexed.
    try:
        from pandas.core import indexing as _pdi
        for icls in ("_LocIndexer", "_iLocIndexer",
                     "_AtIndexer", "_iAtIndexer"):
            c = getattr(_pdi, icls, None)
            if c is not None:
                _wrap_scalar_getter(c, "__getitem__", lambda s: s.obj)
    except Exception:
        pass
    # .iterrows() -- row Series should carry the DataFrame's tags (pandas
    # doesn't propagate .attrs through iterrows). Covers
    # \`for _,r in df.iterrows(): ax.scatter(r['x'], r['y'])\`.
    try:
        orig_ir = DF.iterrows
        if not getattr(orig_ir, "_operon_prov", False):
            def _ir(self, _o=orig_ir):
                srcs = _prov_tags_of(self)
                for idx, row in _o(self):
                    if srcs:
                        try:
                            _prov_tag(row, srcs)
                        except Exception:
                            pass
                    yield idx, row
            _ir._operon_prov = True
            DF.iterrows = _ir
    except Exception:
        pass
    # GroupBy reductions that pandas does NOT propagate .attrs through
    # (iteration-3 gap-1: .size()/.count()/.nunique() \u2014 .sum()/.mean() do
    # propagate natively). Copy self.obj's tags onto the result.
    try:
        from pandas.core.groupby.groupby import GroupBy as _GB
        for gm in ("size", "count", "nunique", "ngroup", "cumcount"):
            _go = getattr(_GB, gm, None)
            if _go is None or getattr(_go, "_operon_prov", False):
                continue

            def _gmk(_go=_go):
                def w(self, *a, **kw):
                    r = _go(self, *a, **kw)
                    try:
                        srcs = _prov_tags_of(getattr(self, "obj", None))
                        if srcs:
                            _prov_tag(r, srcs)
                    except Exception:
                        pass
                    return r
                w._operon_prov = True
                w.__wrapped__ = _go
                return w
            try:
                setattr(_GB, gm, _gmk())
            except Exception:
                pass
    except Exception:
        pass


def _prov_patch_numpy(np):
    for r in ("load", "loadtxt", "genfromtxt", "fromfile"):
        if hasattr(np, r):
            setattr(np, r, _prov_wrap_reader(getattr(np, r), 0, "file"))
    for wname, data_pos, ext in (("save", 1, ".npy"), ("savez", None, ".npz"),
                                 ("savez_compressed", None, ".npz"),
                                 ("savetxt", 1, None)):
        orig = getattr(np, wname, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig, data_pos=data_pos, ext=ext):
            def w(*a, **kw):
                r = orig(*a, **kw)
                try:
                    p = a[0] if a else kw.get("file")
                    # numpy.save/savez auto-append the extension; record under
                    # the path that actually landed on disk so the host's
                    # per-saved-file lookup matches.
                    if ext and isinstance(p, (str, _prov_os.PathLike)):
                        ps = _prov_os.fspath(p)
                        if not str(ps).endswith(ext):
                            p = str(ps) + ext
                    if data_pos is not None and len(a) > data_pos:
                        srcs = _prov_tags_of(a[data_pos])
                    else:
                        srcs = _prov_tags_of(a[1:]) | \\
                            _prov_tags_of(list(kw.values()))
                    _prov_record_write(p, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        setattr(np, wname, mk())
    # np.array / np.asarray / np.asanyarray on a list/tuple of tagged
    # scalars (iteration-3 gap-3): these allocate a FRESH base ndarray
    # (\`__array_finalize__\` never fires \u2014 no subclass in the chain), so
    # \`np.mean([_ProvFloat,...])\` drops tags. Scan the input, union
    # element tags, and return a _ProvNdarray view. Only intervenes when
    # the top-level input is a python list/tuple AND carries tags \u2014 the
    # ndarray-input path is left to __array_finalize__.
    for ctor in ("array", "asarray", "asanyarray"):
        orig = getattr(np, ctor, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def amk(orig=orig):
            def w(obj, *a, **kw):
                r = orig(obj, *a, **kw)
                try:
                    # Gate also checks .attrs (room #prov-shim-stress): a
                    # tagged pandas Series has .attrs not _prov_tags, and
                    # seaborn/plotnine marshal via \`np.asarray(series)\` \u2014
                    # missing this arm = {fired:true,inputs:[]} for every
                    # seaborn plot. For list/tuple input, scan only the
                    # first 8 elements (kills the np.array(plain-list)
                    # tax; a homogeneous-type list either has a tagged
                    # head or is all-plain).
                    gate = getattr(obj, "_prov_tags", None) or (
                        isinstance(getattr(obj, "attrs", None), dict)
                        and _PROV_ATTR in obj.attrs
                    )
                    if not gate and isinstance(obj, (list, tuple)):
                        for x in obj[:8]:
                            if type(x) not in _PROV_PLAIN_SCALAR:
                                gate = True
                                break
                    if gate:
                        srcs = _prov_tags_of(obj)
                        if srcs:
                            return _prov_as_traced_array(r, srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        try:
            setattr(np, ctor, amk())
        except Exception:
            pass
    # Reductions called on a python list (iteration-3 gap-5, the 9fe169f7
    # FP root): \`np.mean([_ProvFloat,...])\` hits numpy._core._methods which
    # imported \`asanyarray\` at module-load \u2014 the np.asarray wrap above
    # never sees it. Wrap the user-facing reduction itself: harvest tags
    # from the FIRST positional (the data arg), stamp onto the result
    # (scalar \u2192 _prov_wrap_scalar, ndarray \u2192 _prov_as_traced_array).
    REDUCE = ("mean", "sum", "std", "var", "median", "min", "max", "prod",
              "nanmean", "nansum", "nanstd", "nanvar", "nanmedian",
              "nanmin", "nanmax", "nanprod", "percentile", "quantile",
              "average", "ptp", "argmin", "argmax", "nanargmin",
              "nanargmax")
    for rn in REDUCE:
        orig = getattr(np, rn, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def rmk(orig=orig):
            def w(a, *args, **kw):
                r = orig(a, *args, **kw)
                try:
                    srcs = _prov_tags_of(a)
                    if not srcs:
                        return r
                    npmod = _prov_sys.modules.get("numpy")
                    if npmod is not None and isinstance(r, npmod.ndarray):
                        return _prov_as_traced_array(r, srcs)
                    return _prov_wrap_scalar(r, srcs)
                except Exception:
                    return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        try:
            setattr(np, rn, rmk())
        except Exception:
            pass



# Claude Science SDK fragment: runtime provenance instrumentation \u2014 HARVEST (3/3).
# Writer-side patchers (matplotlib, json, pickle, open, \u2026), the
# _PROV_PATCHERS dispatch table, and the __import__ hook install.
# Concatenated AFTER _prov_core.py + _prov_wraps.py by inline-workers.mjs.
#
# ruff: noqa: F821

def _prov_patch_matplotlib(mod):
    # Patched on import of matplotlib.pyplot (that's what user code imports).
    try:
        from matplotlib.axes import Axes
        from matplotlib.figure import Figure
    except Exception:
        return
    # Axes plotting methods: harvest tags from positional/kw data args,
    # accumulate on the Axes itself. Figure.savefig unions across fig.axes.
    PLOTTERS = (
        "plot", "scatter", "bar", "barh", "hist", "imshow", "pcolor",
        "pcolormesh", "contour", "contourf", "fill_between", "errorbar",
        "pie", "stackplot", "hist2d", "hexbin", "boxplot", "violinplot",
        "stem",
    )
    for m in PLOTTERS:
        orig = getattr(Axes, m, None)
        if orig is None or getattr(orig, "_operon_prov", False):
            continue

        def mk(orig=orig):
            def w(self, *a, **kw):
                r = orig(self, *a, **kw)
                try:
                    # Harvest positional AND every kwarg (iteration-3 gap:
                    # \`color=_ProvStr(...)\`, \`s=\`, \`label=\` etc. are
                    # data-flow inputs to the figure). _prov_tags_of walks
                    # lists/tuples/dicts \u226464, so \`ax.bar([0],[v])\` is
                    # covered without the np.asarray wrap.
                    srcs = _prov_tags_of(a) | _prov_tags_of(
                        list(kw.values()))
                    if srcs:
                        cur = getattr(self, "_operon_src", None) or set()
                        self._operon_src = set(cur) | set(srcs)
                except Exception:
                    pass
                return r
            w._operon_prov = True
            w.__wrapped__ = orig
            return w
        try:
            setattr(Axes, m, mk())
        except Exception:
            pass

    orig_save = getattr(Figure, "savefig", None)
    if orig_save and not getattr(orig_save, "_operon_prov", False):
        def savefig(self, fname, *a, **kw):
            r = orig_save(self, fname, *a, **kw)
            try:
                srcs = set()
                for ax in getattr(self, "axes", ()) or ():
                    s = getattr(ax, "_operon_src", None)
                    if s:
                        srcs |= set(s)
                _prov_record_write(fname, srcs)
            except Exception:
                pass
            return r
        savefig._operon_prov = True
        savefig.__wrapped__ = orig_save
        Figure.savefig = savefig
    # Axes reuse (3447902390): ax.clear()/cla() reset matplotlib's own
    # artist state but NOT arbitrary instance attrs, so _operon_src
    # monotonically accumulates across a \`for ...: ax.clear(); ax.plot();
    # fig.savefig()\` loop and later saves over-attribute. Wrap clear/cla
    # (and Figure.clf/clear) to drop the tag set.
    for cls, meths in ((Axes, ("clear", "cla")), (Figure, ("clf", "clear"))):
        for m in meths:
            corig = getattr(cls, m, None)
            if corig is None or getattr(corig, "_operon_prov", False):
                continue

            def cmk(corig=corig, is_fig=(cls is Figure)):
                def w(self, *a, **kw):
                    try:
                        if is_fig:
                            for ax in getattr(self, "axes", ()) or ():
                                if hasattr(ax, "_operon_src"):
                                    delattr(ax, "_operon_src")
                        elif hasattr(self, "_operon_src"):
                            delattr(self, "_operon_src")
                    except Exception:
                        pass
                    return corig(self, *a, **kw)
                w._operon_prov = True
                w.__wrapped__ = corig
                return w
            try:
                setattr(cls, m, cmk())
            except Exception:
                pass


def _prov_patch_yaml(ymod):
    # 3447965497: PyYAML's SafeRepresenter dispatches on EXACT type
    # (type(data).__mro__[0]) \u2014 so a _ProvStr leaf from the json.load
    # leaf-wrap lane raises RepresenterError under yaml.safe_dump. Register
    # the base-type representers for the three static _Prov* scalar classes
    # on both SafeDumper and Dumper so artifact-JSON \u2192 yaml round-trips.
    # Other strict \`type(x) is str\` consumers on artifact-JSON leaves
    # remain a documented tradeoff (leaf-wrap is what gives runtime recall
    # through json destructuring); escape hatch is OPERON_PROVENANCE_OFF=1.
    try:
        pairs = (
            (_ProvStr, "represent_str"),
            (_ProvInt, "represent_int"),
            (_ProvFloat, "represent_float"),
        )
        for dumper_name in ("SafeDumper", "Dumper"):
            D = getattr(ymod, dumper_name, None)
            if D is None:
                continue
            for cls, repname in pairs:
                rep = getattr(D, repname, None)
                if rep is not None and cls not in getattr(
                        D, "yaml_representers", {}):
                    D.add_representer(cls, rep)
    except Exception:
        pass


def _prov_patch_json(jmod):
    orig_load = jmod.load
    if not getattr(orig_load, "_operon_prov", False):
        def load(fp, *a, **kw):
            r = orig_load(fp, *a, **kw)
            try:
                vid = _prov_vid_of_path(getattr(fp, "name", None))
                if vid:
                    return _prov_wrap_container(r, {vid})
            except Exception:
                pass
            return r
        load._operon_prov = True
        load.__wrapped__ = orig_load
        jmod.load = load
    orig_loads = jmod.loads
    if not getattr(orig_loads, "_operon_prov", False):
        def loads(s, *a, **kw):
            r = orig_loads(s, *a, **kw)
            try:
                t = getattr(s, "_prov_tags", None)
                if t:
                    return _prov_wrap_container(r, t)
            except Exception:
                pass
            return r
        loads._operon_prov = True
        loads.__wrapped__ = orig_loads
        jmod.loads = loads
    orig_dump = jmod.dump
    if not getattr(orig_dump, "_operon_prov", False):
        def dump(obj, fp, *a, **kw):
            r = orig_dump(obj, fp, *a, **kw)
            try:
                _prov_record_write(getattr(fp, "name", None),
                                   _prov_tags_of(obj))
            except Exception:
                pass
            return r
        dump._operon_prov = True
        dump.__wrapped__ = orig_dump
        jmod.dump = dump


def _prov_patch_pickle(pmod):
    if not getattr(pmod.load, "_operon_prov", False):
        orig = pmod.load

        def load(fp, *a, **kw):
            r = orig(fp, *a, **kw)
            try:
                vid = _prov_vid_of_path(getattr(fp, "name", None))
                if vid:
                    _prov_tag(r, {vid})
            except Exception:
                pass
            return r
        load._operon_prov = True
        load.__wrapped__ = orig
        pmod.load = load
    if not getattr(pmod.dump, "_operon_prov", False):
        orig_d = pmod.dump

        def dump(obj, fp, *a, **kw):
            r = orig_d(obj, fp, *a, **kw)
            try:
                _prov_record_write(getattr(fp, "name", None),
                                   _prov_tags_of(obj))
            except Exception:
                pass
            return r
        dump._operon_prov = True
        dump.__wrapped__ = orig_d
        pmod.dump = dump


def _prov_patch_anndata(ad):
    for r in ("read_h5ad", "read", "read_csv", "read_loom", "read_zarr"):
        if hasattr(ad, r):
            setattr(ad, r, _prov_wrap_reader(getattr(ad, r), 0, "filename"))
    try:
        A = ad.AnnData
    except Exception:
        return
    _prov_wrap_method_writer(A, "write", 0, "filename")
    _prov_wrap_method_writer(A, "write_h5ad", 0, "filename")


def _prov_patch_scanpy(sc):
    for r in ("read", "read_h5ad", "read_10x_h5", "read_10x_mtx"):
        if hasattr(sc, r):
            setattr(sc, r, _prov_wrap_reader(getattr(sc, r), 0, "filename"))


def _prov_patch_PIL(mod):
    # mod is the PIL.Image SUBMODULE; open is module-level. (3447867046:
    # \`mod.Image\` is the Image CLASS, which has no .open -- wrapping it
    # silently no-ops.)
    try:
        if hasattr(mod, "open"):
            mod.open = _prov_wrap_reader(mod.open, 0, "fp")
    except Exception:
        pass


def _prov_patch_builtins_open():
    orig = _prov_builtins.open
    if getattr(orig, "_operon_prov", False):
        return

    class _ProvFile:
        """Thin proxy: .read() \u2192 _ProvStr/_ProvList[bytes] when the path is
        seeded; .write(data) records _prov_record_write(path, tags_of(data)).
        Delegates everything else. Used only when the path is seeded (read)
        or mode is write \u2014 untagged reads and non-write opens are untouched."""
        __slots__ = ("_fh", "_vid", "_wpath", "_wtags")

        def __init__(self, fh, vid=None, wpath=None, truncating=False):
            object.__setattr__(self, "_fh", fh)
            object.__setattr__(self, "_vid", vid)
            object.__setattr__(self, "_wpath", wpath)
            object.__setattr__(self, "_wtags", set())
            # 3447979449: a "w"/"x" open truncates at OPEN time \u2014 that IS
            # the last-writer boundary. Clear any stale _prov_written
            # entry here (once per handle; covers zero-write truncation,
            # writelines-only overwrites, and avoids per-write realpath
            # cost). Append mode ("a") doesn't truncate \u2014 prior bytes
            # remain on disk, so prior attribution must be PRESERVED
            # through this handle's writes (\uD83D\uDFE1 3448009015): seed _wtags
            # from the existing entry so the per-handle record is
            # \`prior \u222A new\`, not a replace.
            if wpath:
                try:
                    if truncating:
                        _prov_record_write(wpath, ())
                    else:
                        # \uD83D\uDFE1 3448765261 / \uD83D\uDFE1 3448796170: seed ONLY from the
                        # absolutized realpath \u2014 never the raw \`wpath\`
                        # (a bare-relative \`wpath\` can alias an
                        # unrelated file's as-written key). realpath
                        # resolves against cwd so it uniquely identifies
                        # the file on disk. Basename keying was dropped
                        # outright (ic 4765227282).
                        rp = _prov_os.path.realpath(wpath)
                        if rp in _prov_written:
                            self._wtags.update(_prov_written[rp])
                except Exception:
                    pass

        def read(self, *a, **kw):
            r = self._fh.read(*a, **kw)
            if self._vid and isinstance(r, str):
                return _ProvStr(r, {self._vid})
            if self._vid:
                _prov_tag(r, {self._vid})
            return r

        def write(self, data):
            try:
                t = _prov_tags_of(data)
                if t:
                    self._wtags |= t
                    # Eager-record only on a TAGGED write (3447979449):
                    # untagged trailing writes (\`json.dump(obj,f);
                    # f.write("\\n")\`) and append-mode writes must not pop
                    # attribution the dump-wrapper or a prior cell already
                    # set. The stale-entry clear for truncating modes
                    # happened once at __init__.
                    _prov_record_write(self._wpath, self._wtags)
            except Exception:
                pass
            return self._fh.write(data)

        def writelines(self, lines):
            # Stream (room #prov-shim-stress): don't list()-materialize a
            # generator. One pass writes + harvests; on error mid-stream
            # re-raise (can't replay a consumed iterator).
            try:
                t = set()
                for ln in lines:
                    self._fh.write(ln)
                    t |= _prov_tags_of(ln)
                if t:
                    self._wtags |= t
                    _prov_record_write(self._wpath, self._wtags)
            except Exception:
                raise
            return None

        def close(self):
            return self._fh.close()

        def __enter__(self):
            self._fh.__enter__()
            return self

        def __exit__(self, *a):
            return self._fh.__exit__(*a)

        def __iter__(self):
            v = self._vid
            for line in self._fh:
                yield _ProvStr(line, {v}) if (v and isinstance(line, str)) \\
                    else line

        def __next__(self):
            # 3447929913: \`next(open(artifact))\` header-skip idiom \u2014
            # dunders are type-looked-up, so __getattr__ doesn't cover it.
            line = next(self._fh)
            v = self._vid
            return _ProvStr(line, {v}) if (v and isinstance(line, str)) \\
                else line

        def __getattr__(self, name):
            return getattr(object.__getattribute__(self, "_fh"), name)

    # room #prov-shim-stress: one-line ABC virtual-subclass registration
    # so \`isinstance(open(p), io.IOBase)\` passes \u2014 several libs gate on
    # that before accepting a file-like.
    try:
        import io as _io
        _io.IOBase.register(_ProvFile)
    except Exception:
        pass

    def open_(file, mode="r", *a, **kw):
        fh = orig(file, mode, *a, **kw)
        try:
            if isinstance(mode, str):
                if any(c in mode for c in "wxa"):
                    return _ProvFile(
                        fh, wpath=file, truncating="a" not in mode)
                vid = _prov_vid_of_path(file)
                if vid:
                    _prov_tag(fh, {vid})
                    return _ProvFile(fh, vid=vid)
        except Exception:
            pass
        return fh
    open_._operon_prov = True
    open_.__wrapped__ = orig
    _prov_builtins.open = open_


def _prov_patch_orjson(mod):
    # orjson.dumps rejects str/int/float subclasses (room #prov-shim-
    # stress \u2014 only serializer break of 12 tested; fastapi/pydantic-v2
    # path). Wrap dumps to thread a default= that unwraps _Prov* to the
    # base type; compose with any user-supplied default.
    orig = getattr(mod, "dumps", None)
    if orig is None or getattr(orig, "_operon_prov", False):
        return
    OPT_NON_STR = getattr(mod, "OPT_NON_STR_KEYS", 0)

    def _unwrap_keys(o, cap):
        # ic 4765227282 \uD83D\uDFE02: _ProvStr from the pandas scalar-getter wrap
        # used as a dict KEY \u2014 orjson's exact-type check rejects it and
        # never calls default= for keys. Coerce ONLY str-subclass keys to
        # plain str (bounded walk); leave int/None/etc. alone so the
        # user's own type errors surface unchanged. Falls back to
        # OPT_NON_STR_KEYS past the cap (widens acceptance, but only on
        # a call that was already failing).
        if cap[0] <= 0:
            return o
        if isinstance(o, dict):
            cap[0] -= len(o)
            return {(str(k) if type(k) is not str and isinstance(k, str)
                     else k): _unwrap_keys(v, cap) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            cap[0] -= len(o)
            # Plain tuple() \u2014 namedtuples reject the single-gen-arg ctor
            # (ic 4770232531); JSON output is identical either way.
            t = list if isinstance(o, list) else tuple
            return t(_unwrap_keys(v, cap) for v in o)
        return o

    def dumps(obj, default=None, option=None):
        def _d(o):
            t = getattr(o, "_prov_tags", None)
            if t is not None:
                for base in (float, int, str):
                    if isinstance(o, base):
                        return base(o)
            if default is not None:
                return default(o)
            raise TypeError
        kw = {"option": option} if option is not None else {}
        try:
            return orig(obj, default=_d, **kw)
        except TypeError as e:
            if "key must be str" not in str(e).lower():
                raise
            cap = [_PROV_JSON_LEAF_CAP]
            o2 = _unwrap_keys(obj, cap)
            if cap[0] <= 0:
                kw["option"] = (option or 0) | OPT_NON_STR
            return orig(o2, default=_d, **kw)
    dumps._operon_prov = True
    dumps.__wrapped__ = orig
    mod.dumps = dumps


_PROV_PATCHERS = {
    "pandas": _prov_patch_pandas,
    "numpy": _prov_patch_numpy,
    "matplotlib.pyplot": _prov_patch_matplotlib,
    "json": _prov_patch_json,
    "yaml": _prov_patch_yaml,
    "orjson": _prov_patch_orjson,
    "pickle": _prov_patch_pickle,
    "anndata": _prov_patch_anndata,
    "scanpy": _prov_patch_scanpy,
    "PIL.Image": _prov_patch_PIL,
    # h5py is deliberately NOT patched (3447867048): h5py.File is a class,
    # and rebinding it to a function breaks isinstance/subclass/class-attr
    # uses in user code and in anndata/scanpy internals. The File object has
    # no dict .attrs so the wrap would be near-zero value anyway; h5ad
    # reads are covered via the anndata/scanpy patchers.
    "scipy.io": lambda m: setattr(
        m, "loadmat", _prov_wrap_reader(m.loadmat, 0, "file_name")
    ) if hasattr(m, "loadmat") else None,
    "torch": lambda m: setattr(
        m, "load", _prov_wrap_reader(m.load, 0, "f")
    ) if hasattr(m, "load") else None,
}


def _prov_apply(name):
    if name in _prov_patched or name not in _PROV_PATCHERS:
        return
    mod = _prov_sys.modules.get(name)
    if mod is None:
        return
    # __import__ fires on INNER recursive imports of a package from inside
    # its own __init__.py (e.g. pandas submodules do \`import pandas\`). At
    # that point sys.modules["pandas"] is partially loaded (no read_csv yet)
    # -- patching would be a no-op and _prov_patched would mark it done. The
    # importlib _initializing flag is True exactly during that window.
    spec = getattr(mod, "__spec__", None)
    if spec is not None and getattr(spec, "_initializing", False):
        return
    _prov_patched.add(name)
    try:
        _PROV_PATCHERS[name](mod)
    except Exception:
        pass


if not _PROV_OFF:
    # Patch anything already imported (json/pickle are stdlib, often loaded).
    for _n in list(_PROV_PATCHERS):
        _prov_apply(_n)
    _prov_patch_builtins_open()

    # __import__ hook: after the real import, apply any pending patcher.
    # Cheaper than a full MetaPathFinder/Loader wrapper and handles \`from X
    # import Y\` (fromlist) and submodule imports uniformly.
    _prov_real_import = _prov_builtins.__import__

    def _prov_import(name, globals=None, locals=None, fromlist=(), level=0):
        m = _prov_real_import(name, globals, locals, fromlist, level)
        try:
            # ic 4765227282: key on the top-level package regardless of
            # dotted form, and pass sys.modules[top] (not \`m\`, which for
            # \`import pandas.testing\` is the submodule). \`_prov_apply\`
            # reads from sys.modules so the second arm below is the same
            # lookup; keep both arms keyed on dotted patcher names
            # (matplotlib.pyplot) too.
            top = name.split(".", 1)[0]
            if top in _PROV_PATCHERS:
                _prov_apply(top)
            if name != top and name in _PROV_PATCHERS:
                _prov_apply(name)
            # \`from matplotlib import pyplot\` -> name="matplotlib",
            #   fromlist=("pyplot",) -> sys.modules has the dotted key.
            if fromlist:
                for f in fromlist:
                    dotted = f"{name}.{f}"
                    if dotted in _PROV_PATCHERS:
                        _prov_apply(dotted)
        except Exception:
            pass
        return m

    _prov_builtins.__import__ = _prov_import


# Attach the query surface onto host for in-kernel introspection; the
# TS side queries via a bare __operon_runtime_inputs__() eval so neither is
# load-bearing for the pipeline.
host._provenance = type("ns", (), {  # noqa: F821
    "path_to_vid": _prov_path_to_vid,
    "written": _prov_written,
    "tags_of": staticmethod(_prov_tags_of),
    "inputs_for": staticmethod(__operon_runtime_inputs__),
    "off": _PROV_OFF,
})()


# ---- host.artifact_path hook ---------------------------------------------
# sdk/artifacts.py assigned host.artifact_path = _op_artifact_path before
# this fragment loads. Wrap it so every runtime-resolved path registers into
# _prov_path_to_vid (the {{artifact:}} pre-exec path is seeded separately by
# the TS side via __operon_prov_seed).
try:
    _prov_orig_ap = host.artifact_path  # noqa: F821

    def _prov_artifact_path(version_id):
        p = _prov_orig_ap(version_id)
        if not _PROV_OFF:
            try:
                __operon_prov_seed({str(version_id): p})
            except Exception:
                pass
        return p

    _prov_artifact_path.__doc__ = _prov_orig_ap.__doc__
    host.artifact_path = _prov_artifact_path  # noqa: F821
except Exception:
    pass
`,maO=`#!/usr/bin/env Rscript
#
# R kernel worker subprocess for persistent R execution.
#
# This script runs as a long-lived subprocess, maintaining state in the
# global environment across multiple code executions. Communication is
# via JSON over stdin/stdout.
#
# Protocol:
# - Reads JSON requests from stdin (one per line)
# - Writes JSON responses to stdout (one per line)
# - Maintains global environment across executions
#
# Request format:
#     {"id": "uuid", "code": "R code here"}
#
# Response format:
#     {"id": "uuid", "stdout": "...", "stderr": "...", "error": null|"error message"}

# <OPERON_SDK>
# Host-callback protocol (mid-execution RPC to the host):
#     kernel -> host: {"type": "host_call", "id": "uuid", "method": "...", "args": [...]}
#     host -> kernel: {"type": "host_response", "id": "uuid", "data": ...} | {..., "error": "..."}
#
# Host calls reach real fd 1 by temporarily popping the execute-loop's
# output sink() so user code can synchronously query the host during eval().
# </OPERON_SDK>

# Secrets are stripped from environment before any user code runs. Even if
# env sanitization ran before subprocess launch, that is not relied upon.
# The canonical secret list is passed via OPERON_SECRET_VARS by the parent process
# (sourced from gateway.sandbox.env_security.KERNEL_SECRET_VARS).
.secret_vars <- Sys.getenv("OPERON_SECRET_VARS", "")
if (nchar(.secret_vars) > 0L) {
  for (.k in strsplit(.secret_vars, ",")[[1L]]) {
    Sys.unsetenv(.k)
  }
  rm(.k)
}
Sys.unsetenv("OPERON_SECRET_VARS")
rm(.secret_vars)

# Maximum output size to prevent memory issues (1MB)
MAX_OUTPUT_SIZE <- 1024L * 1024L

truncate_output <- function(text, max_size = MAX_OUTPUT_SIZE) {
  if (nchar(text) > max_size) {
    paste0(
      substr(text, 1, max_size),
      sprintf("\\n... (truncated, %d bytes omitted)", nchar(text) - max_size)
    )
  } else {
    text
  }
}

# Ensure jsonlite is available
if (isFALSE(requireNamespace("jsonlite", quietly = TRUE))) {
  # Write error as raw JSON (can't use jsonlite yet)
  cat('{"id":"startup","stdout":"","stderr":"","error":"jsonlite package is not installed. Install it with: install.packages(\\'jsonlite\\')"}\\n', file = stdout())
  flush(stdout())
  quit(status = 1)
}

library(jsonlite, quietly = TRUE)

# \u2500\u2500\u2500 dyn.load guard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Runtime guard against loading attacker-written shared libraries. The host
# passes writable bind-mount roots via OPERON_WRITABLE_ROOTS; dyn.load of any
# path under those roots is refused. Installed AFTER jsonlite loads so its
# own .so (under the RO conda overlay) passes. OPERON_DLOPEN_EXEMPT carves out
# the frame venv / R-libs \u2014 installed packages legitimately load bundled .so
# from there. When OPERON_WRITABLE_ROOTS is absent (e.g. VM-backed hosts), no
# wrap is installed. Entire block is wrapped in local() so .operon_orig_dyn_load
# and the root lists are scoped \u2014 user code (eval'd in .GlobalEnv) can't reach
# the unwrapped function via ls(all.names=TRUE).
local({
  writable_roots <- Filter(
    nzchar,
    strsplit(Sys.getenv("OPERON_WRITABLE_ROOTS", ""), ":", fixed = TRUE)[[1L]]
  )
  dlopen_exempt <- Filter(
    nzchar,
    strsplit(Sys.getenv("OPERON_DLOPEN_EXEMPT", ""), ":", fixed = TRUE)[[1L]]
  )
  Sys.unsetenv("OPERON_WRITABLE_ROOTS")
  Sys.unsetenv("OPERON_DLOPEN_EXEMPT")
  if (length(writable_roots) == 0L) return(invisible())
  writable_roots <- sub("/+$", "", writable_roots)
  dlopen_exempt <- sub("/+$", "", dlopen_exempt)
  orig_dyn_load <- base::dyn.load
  wrapped <- function(x, ...) {
    real <- tryCatch(normalizePath(x, mustWork = FALSE), error = function(e) x)
    for (root in dlopen_exempt) {
      if (identical(real, root) || startsWith(real, paste0(root, "/"))) {
        return(orig_dyn_load(x, ...))
      }
    }
    for (root in writable_roots) {
      if (identical(real, root) || startsWith(real, paste0(root, "/"))) {
        stop(sprintf(
          "Refusing to dyn.load shared library from writable path: %s", real
        ), call. = FALSE)
      }
    }
    orig_dyn_load(x, ...)
  }
  tryCatch(
    unlockBinding("dyn.load", baseenv()),
    error = function(e) NULL
  )
  tryCatch(
    assign("dyn.load", wrapped, envir = baseenv()),
    error = function(e) NULL
  )
  tryCatch(lockBinding("dyn.load", baseenv()), error = function(e) NULL)
})

# \u2500\u2500\u2500 Install-intent hook \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Wrap install.packages / BiocManager::install / remotes::install_github to
# append NDJSON entries to OPERON_R_OPLOG_PATH. freezeToYaml in the TS export
# layer reads these to build a portable environment.yml. Without this hook,
# R packages installed inside the session are invisible to env export (R has
# no PEP 376 REQUESTED analogue, and install.packages() doesn't touch
# conda-meta/history).
.operon_oplog_path <- Sys.getenv("OPERON_R_OPLOG_PATH", "")

# <OPERON_SDK>
# Host-call write path: sink-pop instead of opening a second fd.
#
# The execute loop captures user-code stdout via an explicit sink() on a
# textConnection (see .handle_request below). To write a host_call line to
# the REAL process stdout mid-eval, .host_call() temporarily pops that sink
# with sink(), writes via cat()/stdout(), then restores sink(.capture_con).
#
# This replaces the earlier /dev/stdout / /proc/self/fd/1 re-open approach
# (727d8de \u2192 662d6a4): in the desktop VM the vsock-backed fd 1 can't be
# re-opened by path at all (EACCES on every mode), but the already-open
# stdout() connection works fine \u2014 Python's sys.__stdout__ succeeds for the
# same reason. Sink-pop reaches the live connection without any re-open.
#
# KNOWN LIMITATION: if user code pushes its own sink() on top of ours,
# .host_call()'s single sink() pop removes the USER's sink (not ours), the
# write lands in our capture buffer, and readLines() blocks. We accept this
# \u2014 unwinding the full sink stack and restoring user connections isn't
# feasible (R exposes sink.number() but not the connection stack). Document
# and move on; nested sink() inside host$*() is an unusual pattern.
.capture_con <- NULL  # set by .handle_request each turn; NULL between turns

# .emit_stdout_chunk: fire-and-forget stdout streaming to the host.
# Sink-pop writes a {"type":"stdout_chunk","data":...} JSON line to real
# stdout(), then restores the capture sink. Host's _readProtocolResponse
# forwards these to the UI live. Unlike .host_call this is one-way \u2014 no
# stdin read, no blocking. Shares the same nested-sink limitation.
#
# Must call base::cat / base::flush explicitly: user-facing \`cat\` is
# shadowed in .GlobalEnv (see "Per-print streaming" below) with a wrapper
# that calls .flush_stdout_stream(). Resolving \`cat\` from .GlobalEnv here
# would re-enter the shadow and, because this function pops the sink before
# writing, every chunk line would itself trigger a no-op flush \u2014 wasted
# work at best and, with the wrong ordering, an unbounded recursion.
.emit_stdout_chunk <- function(text) {
  if (!nzchar(text)) return(invisible())
  msg <- tryCatch(
    toJSON(list(type = "stdout_chunk", data = text),
           auto_unbox = TRUE, null = "null"),
    error = function(e) NULL
  )
  if (is.null(msg)) return(invisible())  # encoding failure: best-effort, skip
  had_sink <- sink.number() > 0L
  if (had_sink) sink()
  base::cat(msg, "\\n", sep = "")
  base::flush(stdout())
  if (had_sink && !is.null(.capture_con)) sink(.capture_con)
  invisible()
}

# .flush_stdout_stream: emit any newly-captured lines since the last flush.
# textConnectionValue() returns ALL accumulated *complete* lines (a trailing
# partial line without "\\n" is excluded until terminated \u2014 see ?textConnection);
# we track a running index to find the delta.
#
# Called from two granularities:
#   1. After each top-level expression in the eval loop (coarse).
#   2. From the .GlobalEnv print/cat/writeLines shadows (fine) \u2014 so a single
#      long-running expression (the common \`for (...) { print(...); Sys.sleep(1) }\`
#      case) still streams each line as it's produced.
.stream_emitted_len <- 0L
.stream_emitted_bytes <- 0L
.stream_flushing <- FALSE  # re-entrancy guard for the shadow \u2192 flush \u2192 cat cycle
.STREAM_CAP_BYTES <- 10L * 1024L * 1024L  # mirrors Python's _StreamingStdout
.flush_stdout_stream <- function() {
  if (is.null(.capture_con)) return(invisible())
  if (.stream_flushing) return(invisible())
  .stream_flushing <<- TRUE
  on.exit(.stream_flushing <<- FALSE, add = TRUE)
  if (.stream_emitted_bytes >= .STREAM_CAP_BYTES) return(invisible())
  lines <- tryCatch(textConnectionValue(.capture_con), error = function(e) character(0))
  n <- length(lines)
  if (n > .stream_emitted_len) {
    new_lines <- lines[(.stream_emitted_len + 1L):n]
    text <- paste0(paste(new_lines, collapse = "\\n"), "\\n")
    n_bytes <- nchar(text, type = "bytes")
    remaining <- .STREAM_CAP_BYTES - .stream_emitted_bytes
    if (n_bytes > remaining) {
      # Byte-accurate trim: slice the raw vector then drop a trailing partial
      # codepoint. (substr(text,1L,remaining) is char-indexed \u2192 up to 4\xD7
      # overshoot on multi-byte UTF-8; #3175983463.)
      head <- tryCatch(
        {
          raw <- charToRaw(text)[seq_len(remaining)]
          h <- rawToChar(raw)
          Encoding(h) <- "UTF-8"
          while (is.na(nchar(h, type = "chars", allowNA = TRUE))) {
            raw <- raw[-length(raw)]
            h <- rawToChar(raw)
            Encoding(h) <- "UTF-8"
          }
          h
        },
        error = function(e) ""
      )
      text <- paste0(
        head,
        "\\n\u2026(live stream truncated at 10 MB; full output in tool_result)\\n"
      )
      .stream_emitted_bytes <<- .STREAM_CAP_BYTES
    } else {
      .stream_emitted_bytes <<- .stream_emitted_bytes + n_bytes
    }
    .emit_stdout_chunk(text)
    .stream_emitted_len <<- n
  }
  invisible()
}

# Per-print streaming: shadow the common stdout writers in .GlobalEnv so a
# SINGLE long-running expression streams as it prints, not only once it
# returns. The eval loop flushes between top-level expressions, but the
# overwhelmingly common R idiom is one expression that does all the work \u2014
# \`for (i in 1:n) { print(i); Sys.sleep(1) }\` parses to ONE statement, so
# the per-expression flush fires once, at the end, and nothing streams.
#
# R has no per-write hook equivalent to Python's file-like stdout object
# (textConnection is opaque; sink() redirection is C-level), so shadowing
# the call sites is the available lever. .GlobalEnv is where user code
# evaluates (see eval(..., envir = .GlobalEnv) in .handle_request), so any
# direct \`print()\` / \`cat()\` / \`writeLines()\` \u2014 including inside closures
# and anonymous functions the user defines at the top level \u2014 resolves to
# these wrappers. Package-internal calls resolve to base:: via their own
# namespace and are unaffected; that's intentional, it keeps the shadows
# from amplifying a chatty package's internal prints into thousands of WS
# frames.
#
# Recursion is blocked two ways: .emit_stdout_chunk()/.host_call() use
# base::cat / base::flush explicitly, and .flush_stdout_stream() has a
# re-entrancy guard (.stream_flushing).
local({
  mk <- function(name) {
    orig <- get(name, envir = baseenv())
    function(...) {
      r <- orig(...)
      tryCatch(.flush_stdout_stream(), error = function(e) NULL)
      invisible(r)
    }
  }
  for (fn in c("print", "cat", "writeLines")) {
    assign(fn, mk(fn), envir = globalenv())
  }
})

# .host_call: synchronous RPC to the host, usable inside eval().
# Pops the output sink, writes host_call JSON to real stdout(), restores
# the sink, then blocks reading input_con for the host_response. Closes over
# input_con (assigned further down, before the repeat loop \u2014 R's lexical
# scoping resolves it at call time).
.host_call_seq <- 0L
.host_call <- function(method, args) {
  # Monotonic counter, not sample.int() \u2014 drawing from the global RNG
  # advances .Random.seed and silently breaks seed-based reproducibility.
  # Python uses uuid4() (os.urandom). Both sides now discard id-mismatched
  # replies (see the loop below / sdk/base.py) so a stale reply left on
  # stdin by an interrupted prior host_call doesn't cross-wire; entropy is
  # still not load-bearing since ids are per-call-unique by construction.
  .host_call_seq <<- .host_call_seq + 1L
  call_id <- paste0(format(Sys.time(), "%s"), "-", .host_call_seq)
  # jsonlite::toJSON emits Inf/NaN/NA as quoted strings ("Inf","NaN","NA") \u2014
  # valid JSON, so the host can always parse it (unlike Python's json.dumps
  # which emits bare \`Infinity\` and deadlocks; see sdk/base.py:_host_call).
  # Downstream handlers may still reject the string values, but the protocol
  # layer stays unblocked.
  req <- toJSON(
    list(type = "host_call", id = call_id, method = method, args = as.list(args)),
    auto_unbox = TRUE, null = "null"
  )
  # Sink-pop write. sink.number() counts the output sink stack (message
  # sinks are separate and don't interfere with cat()). base:: prefix:
  # the .GlobalEnv \`cat\` shadow would re-enter .flush_stdout_stream() here,
  # which is safe (re-entrancy guarded) but wasteful mid-RPC.
  had_sink <- sink.number() > 0L
  if (had_sink) sink()
  base::cat(req, "\\n", sep = "")
  base::flush(stdout())
  if (had_sink && !is.null(.capture_con)) sink(.capture_con)
  # Discard id-mismatched replies \u2014 an interrupt during a prior host_call's
  # read can leave that call's reply on stdin. Bounded so a host bug
  # (missing id) surfaces as an error rather than a hang.
  resp <- NULL
  for (i in seq_len(8L)) {
    resp_line <- readLines(con = input_con, n = 1L, warn = FALSE)
    if (length(resp_line) == 0L) {
      stop("host_call: stdin closed (host terminated?)")
    }
    # Parse failures count toward the same bounded budget (PR #2753
    # finding 3369788526, mirroring the Python SDK fix for 3369738624):
    # a non-JSON line must be a discard, not a jsonlite lexical error
    # escaping into user R code.
    resp <- tryCatch(
      fromJSON(resp_line, simplifyVector = FALSE),
      error = function(e) NULL
    )
    # is.list() mirrors the Python twin's isinstance(resp, dict) gate
    # (finding 3369848485): a valid-JSON scalar parses to an atomic
    # vector, and \`$\` on an atomic vector is an error \u2014 the guard's own
    # exempt class. A list is never NULL, so is.list subsumes !is.null.
    if (is.list(resp) && identical(resp$id, call_id)) break
    resp <- NULL
  }
  if (is.null(resp)) {
    stop(sprintf(
      "host_call '%s': no matching reply id after 8 reads (protocol desync)",
      method
    ))
  }
  if (!is.null(resp$error)) {
    stop(sprintf("host_call '%s' failed: %s", method, resp$error))
  }
  resp$data
}

# host SDK \u2014 injected into .GlobalEnv so user code can call
# host$lineage("<version_id>") (legacy alias: operon$...). Lazy-fetches via host-callback, caches
# per version_id. Extension pattern: add a function here that delegates to
# .host_call("method_name", list(args)), then add a case in the host's
# createHostCallHandler switch.
host <- local({
  .lineage_cache <- new.env(parent = emptyenv())
  env <- new.env(parent = emptyenv())
  env$lineage <- function(version_id) {
    if (!is.character(version_id) || length(version_id) != 1L
        || !nzchar(version_id)) {
      stop("host$lineage: version_id must be a single non-empty character string")
    }
    version_id <- tolower(version_id)
    if (!exists(version_id, envir = .lineage_cache, inherits = FALSE)) {
      res <- .host_call("get_lineage", list(version_id))
      # Mirror of base.py's skip-when-pending (3385954746): a response with
      # extraction_pending=TRUE has incomplete inputs \u2014 caching it would pin
      # the stale snapshot for the whole session and make the documented
      # paced re-read (poll periodically \u2014 retries are ~30s apart and
      # bounded, 3386767475) a silent no-op on R.
      if (!(is.list(res) && isTRUE(res$extraction_pending))) {
        assign(version_id, res, envir = .lineage_cache)
      }
      return(res)
    }
    get(version_id, envir = .lineage_cache, inherits = FALSE)
  }
  env$clear_lineage_cache <- function() {
    rm(list = ls(.lineage_cache), envir = .lineage_cache)
  }
  env$lineage_graph <- function(version_id, direction = "up",
                                max_depth = NULL, max_nodes = NULL) {
    # Lineage DAG topology (nodes + edges, slim metadata) in one host call \u2014
    # zero LLM extraction. Use BEFORE per-node host$lineage() walks: the
    # per-node call does a full host-side extraction each time. Never cached
    # (topology changes as new versions land).
    if (!is.character(version_id) || length(version_id) != 1L
        || !nzchar(version_id)) {
      stop("host$lineage_graph: version_id must be a single non-empty character string")
    }
    if (!direction %in% c("up", "down")) {
      stop("host$lineage_graph: direction must be 'up' or 'down'")
    }
    opts <- list(direction = direction)
    if (!is.null(max_depth)) opts$max_depth <- as.integer(max_depth)
    if (!is.null(max_nodes)) opts$max_nodes <- as.integer(max_nodes)
    .host_call("get_lineage_topology", list(tolower(version_id), opts))
  }
  env$query <- function(sql, params = list(), limit = NULL, df = FALSE) {
    # query_db is gated to the \`repl\` tool (OPERON_PERMIT only). R has no
    # repl-kernel variant, so this is unreachable by design \u2014 fail with an
    # explicit redirect rather than a generic host-call RuntimeError.
    stop(paste0(
      "host$query() is only available via the \`repl\` tool (Python). ",
      "Run the query there and write results to a file in your workspace ",
      "(e.g. ./handoff/*.csv), then read it here."
    ))
  }
  env$llm <- function(prompt, system = NULL, model = NULL, max_tokens = NULL) {
    # Sample from the Anthropic API via the host's LLM client. Single-turn
    # text completion; blocks until response arrives. Returns a list with
    # $text, $model, $usage, $stop_reason ("max_tokens" means truncated).
    # \`system\` (character, optional) is wrapped by the host in the same
    # safeguards envelope as custom agent instructions and appended AFTER
    # the host's own system floor \u2014 it never speaks with harness authority.
    if (!is.null(system) && (!is.character(system) || length(system) != 1L)) {
      stop("host$llm: system must be a single character string or NULL")
    }
    if (!is.character(prompt) || length(prompt) != 1L || !nzchar(prompt)) {
      stop("host$llm: prompt must be a single non-empty character string")
    }
    if (!is.null(max_tokens) && (!is.numeric(max_tokens)
                                 || length(max_tokens) != 1L
                                 || max_tokens < 1
                                 || max_tokens != as.integer(max_tokens))) {
      stop("host$llm: max_tokens must be a single positive integer or NULL")
    }
    .host_call("llm", list(list(
      prompt = prompt, system = system, model = model, max_tokens = max_tokens
    )))
  }
  env$current_model <- function() .host_call("current_model", list())
  env$list_models <- function() .host_call("list_models", list())
  # C8 \u2014 Python-only methods: stub with a helpful error instead of the
  # default NULL / "attempt to apply non-function" that R gives on env$foo().
  .py_only <- function(name) function(...) stop(sprintf(
    "host$%s() is Python-only \u2014 switch to the Python kernel.", name
  ))
  .operon_only <- function(name) function(...) stop(sprintf(
    "host$%s() is only available via the \`repl\` tool \u2014 re-run there.",
    name
  ))
  env$artifacts <- .py_only("artifacts")
  # Removed back-compat alias \u2014 teaching stub so an R user gets a one-line
  # migration instead of a bare "object not found". The message INTENTIONALLY
  # diverges from Python's (which says "use host.llm([...])"): R's
  # host$llm has no list/batch form \u2014 batch is Python-only, so the R text
  # must not advertise it. Do NOT "re-sync" the two messages.
  env$llm_batch <- function(...) stop(
    "host$llm_batch was removed, and the list/batch form is ",
    "Python-only \u2014 use host$llm(prompt) for single requests here, or ",
    "switch to the Python kernel for batched fan-out ",
    "(host.llm([...], max_concurrency=N))."
  )
  env$frames <- .operon_only("frames")
  env$children <- .operon_only("children")
  env$delegate <- .operon_only("delegate")
  # #2659 scan 4441418742: same redirect as delegate/children \u2014 without the
  # stub, host$delegation_stats() fell through to the generic S3 "host
  # has no method" error instead of the structured redirect the Python
  # analysis kernel gives. stop() is the error channel here (never
  # cat/print \u2014 worker-internal output leaks into cell output).
  env$delegation_stats <- .operon_only("delegation_stats")
  env$get_user_email <- .operon_only("get_user_email")
  env$credentials <- .py_only("credentials")
  env$view_image <- .py_only("view_image")
  # artifact_path: runtime version_id \u2192 filesystem path. R equivalent of
  # {{artifact:VID}} markers when the id is only known at runtime.
  #   df <- read.csv(host$artifact_path(vid))
  env$artifact_path <- function(version_id) {
    if (!is.character(version_id) || length(version_id) != 1L ||
        is.na(version_id) || !nzchar(version_id)) {
      stop("host$artifact_path: version_id must be a non-empty string")
    }
    .host_call("artifact_path", list(version_id))
  }
  # artifact_marker: the literal marker string, for embedding in generated
  # HTML/markdown that the renderer resolves LATER. Split so this source file
  # carries no literal marker prefix (pre-exec resolver scans user code).
  env$artifact_marker <- function(version_id) {
    if (!is.character(version_id) || length(version_id) != 1L ||
        is.na(version_id) || !nzchar(version_id)) {
      stop("host$artifact_marker: version_id must be a non-empty string")
    }
    paste0("{", "{", "artifact:", version_id, "}", "}")
  }
  class(env) <- "operon_sdk"
  env
})
# M12: host$typo returns NULL by default (env lookup miss), which then
# fails cryptically as "attempt to apply non-function". S3 $ method gives a
# helpful error naming available methods instead.
\`$.operon_sdk\` <- function(x, name) {
  if (exists(name, envir = x, inherits = FALSE)) return(get(name, envir = x))
  stop(sprintf("host has no method '%s'. Available: %s",
               name, paste(ls(x), collapse = ", ")))
}
assign("host", host, envir = .GlobalEnv)
# Legacy alias: pre-rename transcripts and lineage replay code say \`operon$...\`.
# Environments are reference objects \u2014 both names are the SAME env.
assign("operon", host, envir = .GlobalEnv)
# </OPERON_SDK>

.operon_log_install <- function(operation, packages, result = "success",
                                extra = list()) {
  if (.operon_oplog_path == "") return(invisible())
  entry <- modifyList(
    list(
      timestamp = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      operation = operation,
      packages = as.list(as.character(packages)),
      result = result
    ),
    extra
  )
  tryCatch(
    cat(
      toJSON(entry, auto_unbox = TRUE),
      "\\n",
      file = .operon_oplog_path,
      append = TRUE,
      sep = ""
    ),
    error = function(e) invisible()  # never break user code on log failure
  )
  invisible()
}

# install.packages() converts failures to *warnings* and returns normally,
# so tryCatch(error=) doesn't fire. Verify via installed.packages() instead.
.operon_check_installed <- function(pkgs) {
  installed <- tryCatch(
    rownames(installed.packages()),
    error = function(e) character(0)
  )
  if (all(as.character(pkgs) %in% installed)) "success" else "error"
}

# Wrap utils::install.packages (always available).
local({
  .orig <- utils::install.packages
  .wrapped <- function(pkgs, ...) {
    on.exit(.operon_log_install(
      "r_cran_install", pkgs, result = .operon_check_installed(pkgs)
    ))
    .orig(pkgs, ...)
  }
  unlockBinding("install.packages", asNamespace("utils"))
  assign("install.packages", .wrapped, envir = asNamespace("utils"))
  lockBinding("install.packages", asNamespace("utils"))
  # Also shadow in .GlobalEnv \u2014 most user code calls the unqualified name,
  # which resolves via the search path (globalenv before utils namespace).
  assign("install.packages", .wrapped, envir = .GlobalEnv)
})

# Shadow q()/quit(): in non-interactive Rscript they call .Internal(quit())
# \u2014 straight to C-level process termination, no condition raised, nothing
# tryCatch can intercept. REPL muscle memory in the kernel terminal would
# kill the worker and silently wipe .GlobalEnv (bughunter 3359240335 \u2014 F2
# parity with kernel_worker.py's _OperonQuitter; this shadow likewise never
# touches stdin). The .handle_request error arm converts the stop() into an
# ordinary cell error. Installed AFTER the startup jsonlite check above,
# which legitimately needs the real quit().
#
# Rebinding happens in baseenv (unlockBinding pattern, same as the
# install.packages wrap above) rather than .GlobalEnv only: a .GlobalEnv
# shadow is bypassed by \`base::q()\`, wiped by \`rm(list = ls())\`, and
# skipped entirely by R's call-lookup when the user binds a non-function
# \`q\` (bughunter 3359485780). Both environments get the shadow \u2014 baseenv
# is the containment, .GlobalEnv keeps \`?q\`-style introspection honest.
local({
  .msg <- paste0(
    "q()/quit() is disabled here \u2014 this terminal shares the agent's ",
    "live kernel. Kernels are stopped from the UI, not from code."
  )
  # Honest messaging for programmatic callers (bughunter 3359747065): a
  # sourced pipeline's \`quit(save = "no", status = 1)\` or optparse's
  # usage-failure \`quit(status = 1)\` is not REPL muscle memory \u2014 echo the
  # requested status instead of blaming terminal typing, and tell the
  # caller how to signal failure without killing the kernel. (No
  # sys.nframe() gating: cell code is eval'd deep inside .handle_request's
  # frames, so frame depth cannot distinguish top-level typing here.)
  # Containment is unchanged either way \u2014 the worker must never die.
  # Status validation (#2599 r2 3359942442): coerce defensively \u2014
  # suppressWarnings kills the "NAs introduced by coercion" leak for
  # quit(status = "foo"); zero-length (NULL) and NA coerce to NA and take
  # the generic message (never stop(character(0)) \u2014 an EMPTY error);
  # non-integer numerics truncate like base::quit would. Status 0 \u2014
  # however spelled (0, 0L, 0.5\u21920, "0") \u2014 is the clean-exit case and gets
  # the REPL framing.
  .shadow <- function(save = "default", status = 0, runLast = TRUE) {
    .st <- tryCatch(
      suppressWarnings(as.integer(status)[1L]),
      error = function(e) NA_integer_
    )
    if (length(.st) == 0L) .st <- NA_integer_
    if (!is.na(.st) && .st != 0L) {
      stop(sprintf(paste0(
        "quit(status = %d) blocked \u2014 this kernel stays alive across ",
        "cells (it shares the agent's live session). Signal failure ",
        "with stop() or a non-zero return value instead."
      ), .st), call. = FALSE)
    }
    stop(.msg, call. = FALSE)
  }
  for (.name in c("q", "quit")) {
    unlockBinding(.name, baseenv())
    assign(.name, .shadow, envir = baseenv())
    lockBinding(.name, baseenv())
    assign(.name, .shadow, envir = .GlobalEnv)
  }
})

# BiocManager and remotes may not be loaded at boot. setHook fires when they
# are, at which point we wrap their install functions too.
setHook(packageEvent("BiocManager", "onLoad"), function(...) {
  .orig <- get("install", envir = asNamespace("BiocManager"))
  .wrapped <- function(pkgs = character(), ...) {
    on.exit(.operon_log_install(
      "r_bioc_install", pkgs, result = .operon_check_installed(pkgs)
    ))
    .orig(pkgs, ...)
  }
  unlockBinding("install", asNamespace("BiocManager"))
  assign("install", .wrapped, envir = asNamespace("BiocManager"))
  lockBinding("install", asNamespace("BiocManager"))
})

setHook(packageEvent("remotes", "onLoad"), function(...) {
  .orig <- get("install_github", envir = asNamespace("remotes"))
  .wrapped <- function(repo, ...) {
    # For GitHub installs, extract bare package name for the installed check
    pkg_name <- sub("^[^/]+/", "", sub("@.*$", "", repo))
    on.exit(.operon_log_install(
      "r_github_install", repo,
      result = .operon_check_installed(pkg_name),
      extra = list(github_ref = repo)
    ))
    .orig(repo, ...)
  }
  unlockBinding("install_github", asNamespace("remotes"))
  assign("install_github", .wrapped, envir = asNamespace("remotes"))
  lockBinding("install_github", asNamespace("remotes"))
})
# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

# Per-request handler. Runs in its own function environment so bookkeeping
# vars (request_id, code, parsed, i, result, etc.) do NOT pollute .GlobalEnv.
# User code still evaluates in .GlobalEnv via eval(..., envir = .GlobalEnv).
# Without this isolation, user code referencing common names like \`i\`, \`code\`,
# \`result\` would collide with handler internals.
.handle_request <- function(line) {
  request <- tryCatch(
    fromJSON(line, simplifyVector = FALSE),
    error = function(e) NULL
  )

  if (is.null(request)) {
    error_response <- toJSON(
      list(id = "unknown", stdout = "", stderr = "", error = paste("Invalid JSON request:", line)),
      auto_unbox = TRUE
    )
    cat(error_response, "\\n", sep = "", file = stdout())
    flush(stdout())
    return(invisible())
  }

  request_id <- if (is.null(request$id)) "unknown" else request$id
  code <- if (is.null(request$code)) "" else request$code

  stdout_output <- ""
  stderr_output <- ""
  error_output <- NULL
  # TRUE only when the SIGINT interrupt handler actually fired \u2014 round-
  # tripped to the host so a user Ctrl-C persists as exit_status
  # "cancelled", not "error". Mirrors kernel_worker.py's _sigint_delivered
  # (post-merge bughunter 3358904687: R never got the Python-side
  # \`interrupted\` plumbing, so every interrupted R terminal cell rendered
  # as a crashed cell).
  was_interrupted <- FALSE
  parsed_for_trace <- NULL
  error_lineno <- NULL
  # deparse(conditionCall(e)) of the failing call \u2014 lap-7 3383399765/78:
  # the bare conditionMessage can't couple an error to the call that
  # raised it; the call object can. NULL when R doesn't attach one (e.g.
  # top-level "attempt to apply non-function" signals the evaluator's
  # own call \u2014 the consumer must treat junk/absent calls as no-signal).
  error_call <- NULL
  cur_expr_idx <- 0L

  # The {...} block passed to tryCatch is a promise evaluated in THIS
  # function's environment, so plain <- assigns here. Using <<- would
  # skip this frame and write to .GlobalEnv (scope pollution). Only the
  # error=function(e){...} closure below and the module-level .capture_con
  # genuinely need <<-.
  tryCatch(
    {
      parsed <- parse(text = code, keep.source = TRUE)
      parsed_for_trace <- parsed

      if (length(parsed) > 0L) {
        # Explicit output sink (not capture.output()) so .host_call() can
        # sink()-pop to reach real stdout() mid-eval, then sink(.capture_con)
        # to restore capture. The message sink stays a capture.output() \u2014
        # it's a separate stack (type="message") and .host_call() doesn't
        # touch it. textConnection(NULL,"w") buffers internally;
        # textConnectionValue() harvests the lines.
        .capture_con <<- textConnection(NULL, "w")
        .stream_emitted_len <<- 0L
        .stream_emitted_bytes <<- 0L
        sink(.capture_con)
        tryCatch(
          {
            stderr_output <- capture.output(
              {
                n_expr <- length(parsed)
                if (n_expr > 1L) {
                  for (i in seq_len(n_expr - 1L)) {
                    cur_expr_idx <- i
                    eval(parsed[[i]], envir = .GlobalEnv)
                    .flush_stdout_stream()
                  }
                }
                cur_expr_idx <- n_expr
                result <- withVisible(eval(parsed[[n_expr]], envir = .GlobalEnv))
                if (result$visible) {
                  print(result$value)
                }
                .flush_stdout_stream()
              },
              type = "message"
            )
          },
          finally = {
            # Stream any stdout produced before an error \u2014 without this, an
            # eval() throw drops everything printed since the last
            # per-expression flush. Must run while .capture_con is still live.
            # Guarded: .emit_stdout_chunk's cat()/flush() can throw on a
            # broken pipe (host shutdown); an error here would skip the
            # sink()/close() cleanup below and corrupt the next turn.
            tryCatch(.flush_stdout_stream(), error = function(e) NULL)
            # Always pop + harvest, even if eval() threw \u2014 guards against a
            # stuck sink leaking into the next turn. sink.number() check is
            # defensive (would be 0 if .host_call() popped but couldn't
            # restore).
            if (sink.number() > 0L) sink()
            # textConnectionValue() only returns COMPLETE lines \u2014 a final
            # line not terminated by "\\n" (\`cat(42)\`) stays in the
            # connection's internal buffer and would be silently dropped
            # (empty stdout, exit 0). isIncomplete() reports exactly that
            # unflushed partial line; terminate it so the harvest includes
            # it. Complete/empty output \u2192 FALSE \u2192 no spurious empty line.
            # Guarded: a throw here would mask eval()'s error and skip
            # close() below.
            # base:: prefix (same rule as .emit_stdout_chunk / .host_call):
            # the unqualified \`cat\` resolves to the .GlobalEnv streaming
            # shadow, which would re-enter .flush_stdout_stream() with the
            # sink already popped and emit the partial line as a spurious
            # late stdout_chunk. It also keeps the harvest immune to user
            # code rebinding \`cat\` \u2014 a throw from a broken rebind would be
            # swallowed by this tryCatch and silently re-drop the line.
            tryCatch(
              if (base::isIncomplete(.capture_con)) {
                base::cat("\\n", file = .capture_con)
              },
              error = function(e) NULL
            )
            stdout_output <- textConnectionValue(.capture_con)
            close(.capture_con)
            .capture_con <<- NULL
          }
        )
      }
    },
    error = function(e) {
      error_output <<- conditionMessage(e)
      cl <- conditionCall(e)
      if (!is.null(cl)) {
        dc <- tryCatch(
          base::substr(base::paste(base::deparse(cl), collapse = " "), 1L, 200L),
          error = function(...) NULL
        )
        if (!is.null(dc)) error_call <<- dc
      }
      if (cur_expr_idx > 0L && !is.null(parsed_for_trace)) {
        ln <- tryCatch(
          # srcrefs live on the expression VECTOR, not its elements \u2014
          # parsed[[i]] drops them (always NULL). getSrcref(parsed)[[i]]
          # is the working idiom (\uD83D\uDD34 4663213644: error_lineno had never
          # shipped non-null on the R wire since 04d0076ff4).
          getSrcLocation(
            getSrcref(parsed_for_trace)[[cur_expr_idx]], "line", first = TRUE
          ),
          error = function(...) NULL
        )
        if (!is.null(ln)) error_lineno <<- as.integer(ln)
      }
    },
    # host.exec_interrupt(exec_id) \u2192 SIGINT the cell. In non-interactive
    # Rscript, SIGINT raises an \`interrupt\` condition (NOT caught by
    # error=...) which would terminate the process \u2014 losing .GlobalEnv
    # (provider_params, dataframes, model fits). Catch it here so the
    # worker loop survives and returns a normal response with partial
    # stdout + an interrupt marker. Mirrors kernel_worker.py's
    # \`except KeyboardInterrupt:\` (#1539 r3 3231544587).
    interrupt = function(i) {
      # NOTE \u2014 honest deviation from kernel_worker.py (bughunter
      # 3359240359): Python gates \`interrupted\` on _sigint_delivered, set
      # only inside the actual signal handler, so a user-raised
      # KeyboardInterrupt stays an ordinary error. R has no SIGINT handler
      # hook to gate on \u2014 tryCatch's interrupt arm fires for ANY condition
      # of class "interrupt", including package-signaled ones
      # (rlang::interrupt(), signalCondition(...)). Those rare self-
      # signaled interrupts therefore persist as "cancelled" here, and the
      # message deliberately avoids claiming a SIGINT was delivered.
      error_output <<- "Interrupted"
      was_interrupted <<- TRUE
    }
  )

  # Response-build + write guarded separately (#1539 r6 3232472682):
  # a SIGINT landing during truncate_output / toJSON / cat after the inner
  # tryCatch returned would otherwise escape to the outer repeat's handler
  # (which swallows silently) \u2014 host's _readProtocolResponse would block
  # forever. On interrupt here, best-effort minimal fallback so the host
  # unblocks; namespace survives.
  tryCatch(
    {
      stdout_text <- truncate_output(paste(stdout_output, collapse = "\\n"))
      stderr_text <- truncate_output(paste(stderr_output, collapse = "\\n"))

      response <- list(
        id = request_id,
        stdout = stdout_text,
        stderr = stderr_text,
        interrupted = was_interrupted,
        trace = list(
          error_lineno = error_lineno,
          error_call = error_call
        )
      )
      if (is.null(error_output)) {
        response$error <- NULL
      } else {
        response$error <- error_output
      }

      json_response <- toJSON(response, auto_unbox = TRUE, null = "null")
      cat(json_response, "\\n", sep = "", file = stdout())
      flush(stdout())
    },
    interrupt = function(i) {
      tryCatch(
        {
          # Attribution comes from the CELL bracket, not from this late
          # SIGINT: the cell may have completed or errored normally before
          # the signal landed in toJSON/cat (bughunter 3359240348 \u2014
          # Python's discipline: late SIGINTs are attribution-neutral, so
          # a completed cell must not be relabelled "cancelled" and a
          # stop() error must not be clobbered).
          fb <- list(
            id = request_id,
            stdout = truncate_output(paste(stdout_output, collapse = "\\n")),
            stderr = truncate_output(paste(stderr_output, collapse = "\\n")),
            error = error_output,
            interrupted = was_interrupted,
            trace = list(error_lineno = error_lineno, error_call = error_call)
          )
          if (is.null(error_output)) fb$error <- NULL
          cat(toJSON(fb, auto_unbox = TRUE, null = "null"),
              "\\n", sep = "", file = stdout())
          flush(stdout())
        },
        error = function(e) NULL,
        interrupt = function(i2) NULL
      )
    }
  )
}

# Main loop: read requests from stdin, dispatch to handler.
# NOTE: Must use file("stdin") instead of stdin() because when running via
# Rscript, stdin() returns a connection to the script file itself, not the
# process's actual standard input pipe.
#
# KNOWN LIMITATION (codon 187054f2 port): the Python worker moves protocol
# pipes off fd 0/1 (dup to non-inheritable high fds, then dup2 /dev/null\u21920
# and 2\u21921) so a user subprocess inheriting fd 0 can't block on the command
# pipe and one inheriting fd 1 can't inject into the result stream. Base R
# has no dup/dup2/fdopen, and the desktop VM's vsock-backed stdio cannot be
# re-opened via /dev/fd/N (see the sink-pop note above \u2014 EACCES on every
# mode), so the bash-level redirect + file("/dev/fd/N") approach isn't
# portable here. The fd-1 inject case is absorbed by the host's discard-
# non-object / id-mismatch loop (base.ts _readProtocolResponse) ONLY when
# the stray write is newline-terminated; a non-terminated write (e.g.
# system("printf foo")) prefixes the next response line and loses it to
# the parse-fail discard \u2014 same timeout-bounded outcome as the fd-0 wedge,
# which remains live for R cells that system() a pathless stdin reader
# without input= \u2014 rare in practice, bounded by execute()'s timeout.
input_con <- file("stdin", "r")

repeat {
  # Outer interrupt guard (#1539 r3 3231544598): a SIGINT that lands while
  # parked at readLines() or mid-.handle_request-response-write (i.e. after
  # the inner tryCatch returned) would otherwise propagate out of the repeat
  # and terminate the process. Swallow and continue.
  tryCatch(
    {
      line <- readLines(con = input_con, n = 1L, warn = FALSE)
      if (length(line) == 0L) break
      if (nchar(trimws(line)) == 0L) next
      .handle_request(line)
    },
    interrupt = function(i) NULL
  )
}
`,caO=`# \u2500\u2500 Claude Science SDK replay shim (auto-generated at export) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# This notebook used the in-kernel \`host\` SDK (legacy name: \`operon\`)
# during its original run. Responses were recorded and are replayed here so
# the notebook runs standalone. Do not reorder or remove \`host.*\`/\`operon.*\`
# calls without updating operon_tape.json \u2014 replay is sequential.
import json as _json, os as _os, sys as _sys
_OPERON_TAPE = _json.load(open(_os.path.join(_os.path.dirname(__file__) if "__file__" in dir() else ".", "operon_tape.json")))
# Tape methods Opus commonly drops from extracted_code (discovery/no-op
# probes). _next() skips past these on mismatch instead of erroring.
_OPERON_SKIPPABLE = frozenset({"list_artifacts", "artifacts", "current_model", "list_models"})
class _OperonTapeError(RuntimeError):
    # A host call that FAILED during the live run (error-typed tape entry).
    # Distinct from the drift RuntimeError so accessors that deliberately
    # swallow recorded failures (credentials) don't also swallow drift.
    pass
class _OperonReplay:
    def __init__(self): self._i = 0
    def _next(self, m):
        if self._i >= len(_OPERON_TAPE):
            raise RuntimeError(f"host-SDK replay: tape exhausted at call {self._i} ({m!r}). The notebook made more host.*/operon.* calls than were recorded.")
        rec = _OPERON_TAPE[self._i]
        # Check BEFORE consuming: a method mismatch must not advance the
        # tape position, or every subsequent SDK call is off by one
        # and the whole notebook cascade-breaks instead of just this cell.
        # \`raise\`, not \`assert\` \u2014 assert is stripped under python -O,
        # which would silently return the wrong entry's data.
        #
        # Tape-skip for Opus-dropped discovery calls (stress-test D3):
        # extracted_code routinely omits \`host.artifacts()\` /
        # \`host.list_models()\` probes that the live run recorded. PEEK
        # past those (local \`j\`, not \`self._i\`) so a skip-then-drift leaves
        # the cursor untouched \u2014 the skipped entries may belong to a LATER
        # cell, and consuming them would cascade (finding 3438978179).
        j = self._i
        while rec["method"] != m and rec["method"] in _OPERON_SKIPPABLE:
            j += 1
            if j >= len(_OPERON_TAPE):
                raise RuntimeError(f"host-SDK replay: tape exhausted at call {j} ({m!r})")
            rec = _OPERON_TAPE[j]
        if rec["method"] != m:
            raise RuntimeError(f"host-SDK replay drift at step {j}: recorded {rec['method']!r}, requested {m!r}")
        # Matched \u2014 commit: warn for skipped entries, then advance cursor.
        for k in range(self._i, j):
            print(f"host-SDK replay: skipping tape entry {k} "
                  f"({_OPERON_TAPE[k]['method']!r}) \u2014 not in extracted_code", file=_sys.stderr)
        self._i = j + 1
        if rec.get("error"): raise _OperonTapeError(rec["error"])
        return rec["data"]
    class _L:
        # Mirror live _LineageAccessor: cache by lowercased vid so repeated
        # access consumes ONE tape step (live makes one host-call, so the
        # tape has one entry \u2014 without caching, replay would drift).
        def __init__(s): s._c = {}
        def __getitem__(s, k):
            # Arg validation mirrors live _LineageAccessor.__getitem__: a
            # client-side-rejected call recorded no tape entry, so raise
            # WITHOUT consuming (\uD83D\uDFE1 3456767435).
            if not isinstance(k, str):
                raise TypeError(
                    "host.lineage[...]: version_id must be a str (UUID), "
                    f"got {type(k).__name__}"
                )
            if not k:
                raise ValueError(
                    "host.lineage[...]: version_id must be a non-empty str"
                )
            k = k.lower()
            if k in s._c: return s._c[k]
            r = _replay._next("get_lineage")
            # Mirror live (sdk/base.py, #2941): a pending response stays
            # uncached so the documented poll re-read consumes the tape's
            # SECOND get_lineage entry instead of cache-hitting past it
            # and colliding the next SDK call (scanner 3406244163).
            if not (isinstance(r, dict) and r.get("extraction_pending")):
                s._c[k] = r
            return r
        def __contains__(s, k): return str(k).lower() in s._c
        def clear(s): s._c.clear()
        def graph(s, version_id, direction="up", max_depth=None, max_nodes=None):
            # host.lineage.graph() routes over the "get_lineage_topology"
            # wire live (base.py _LineageAccessor) \u2014 map the accessor
            # sub-method to the recorded name or replay drifts. Arg
            # validation mirrors live: a client-side-rejected call
            # recorded no tape entry, so raise WITHOUT consuming
            # (\uD83D\uDFE1 3456599969; same invariant as llm/_llm_offense).
            # max_depth/max_nodes accepted positionally so a live
            # positional call (\`graph(vid, "down", 5)\` \u2014 one tape entry)
            # binds here too; int() coercion mirrored so a bad value
            # raises BEFORE _next (\uD83D\uDFE1 3456661579).
            if not isinstance(version_id, str) or not version_id:
                raise TypeError(
                    "host.lineage.graph(...): version_id must be a non-empty "
                    f"str (UUID), got {type(version_id).__name__}"
                )
            if direction not in ("up", "down"):
                raise ValueError(
                    f"host.lineage.graph(...): direction must be 'up' or 'down', got {direction!r}"
                )
            if max_depth is not None: int(max_depth)
            if max_nodes is not None: int(max_nodes)
            return _replay._next("get_lineage_topology")
    lineage = _L()
    class _C:
        # Mirror _CredentialsAccessor so tape entries (error-typed per
        # exportBundle.ts assembleReplayTape) are consumed, not skipped \u2014
        # otherwise __getattr__ below yields a lambda and .get() raises
        # AttributeError before _next(), drifting every subsequent step.
        # _next() raises _OperonTapeError on an error-typed entry; swallow
        # ONLY that (not the drift RuntimeError) so later SDK calls
        # in the SAME cell still consume their tape entries (user sees
        # KeyError at point-of-use) while live/replay drift still
        # propagates loudly.
        def list(s):
            try: return _replay._next("credentials_list")
            except _OperonTapeError: return []
        def get(s, name):
            try: return _replay._next("credentials_get")
            except _OperonTapeError: return {}
        def __repr__(s):
            # Live __repr__ issues a credentials_list host-call \u2014 consume
            # the matching tape entry to stay in sync.
            try: _replay._next("credentials_list")
            except Exception: pass
            return "<host.credentials (replay)>"
    credentials = _C()
    class _Q:
        # Mirror live _QueryAccessor: callable (query_db wire) with a
        # .schema() sub-method on the "query_schema" wire \u2014 a bare method
        # can't carry .schema, and an unmapped accessor name drifts the
        # tape (review 3398748874).
        def __call__(s, sql, params=None, limit=None, df=False, scope="project"):
            # Arg validation mirrors live _QueryAccessor.__call__: a
            # client-side-rejected call recorded no tape entry, so raise
            # WITHOUT consuming (\uD83D\uDFE1 3456720679).
            if not isinstance(sql, str):
                raise TypeError(f"host.query: sql must be a str, got {type(sql).__name__}")
            if not sql.strip():
                raise ValueError("host.query: sql must be a non-empty str")
            if params is not None and not isinstance(params, (list, tuple)):
                raise TypeError(
                    f"host.query: params must be a list or tuple, got "
                    f"{type(params).__name__}. (dicts iterate keys, strings "
                    f"iterate chars \u2014 both produce silent wrong results.)"
                )
            if limit is not None and (
                not isinstance(limit, int) or isinstance(limit, bool) or limit < 1
            ):
                raise TypeError(f"host.query: limit must be a positive int or None, got {limit!r}")
            if not isinstance(df, bool):
                raise TypeError(f"host.query: df must be a bool, got {type(df).__name__}")
            if scope not in ("project", "global"):
                raise ValueError(f"host.query: scope must be 'project' or 'global', got {scope!r}")
            r = _replay._next("query_db")
            if df:
                try:
                    import pandas as _pd
                    return _pd.DataFrame(r["rows"], columns=r["columns"])
                except ImportError: pass
            return r
        def schema(s):
            return _replay._next("query_schema")
    query = _Q()
    class _Rt:
        # host.routine.{configure,status,done} route over distinct
        # "routine_<method>" wires \u2014 the __getattr__ fallback returns a
        # lambda for "routine" whose .configure AttributeErrors BEFORE
        # consuming, drifting the cursor (\uD83D\uDD34 3462176190). Mirror the live
        # accessor so each call consumes its own tape entry.
        # \uD83D\uDFE1 3462565474: signatures + arg validation mirror routine.py so a
        # client-side-rejected call (which recorded no tape entry) raises
        # WITHOUT consuming \u2014 same invariant as _L/_Q/artifact_path.
        # Ant-only in live; external tapes never carry these (wire names
        # are composed at call time so the ant-only literal sentinels stay
        # out of external-build binaries \u2014 leak-check 83037465630).
        def _call(s, method):
            # r14 \uD83D\uDFE1: mirror routine.py _op_routine_call \u2014 live wraps an
            # {error}-only dict in RuntimeError, so replay must too or
            # \`try: host.routine.status() except RuntimeError\` diverges.
            r = _replay._next("routine_" + method)
            if isinstance(r, dict) and "error" in r and len(r) == 1:
                raise RuntimeError(f"host.routine.{method}: {r['error']}")
            return r
        def configure(s, every_minutes, *, on_tick, label=None):
            if isinstance(every_minutes, bool) or not isinstance(every_minutes, int):
                raise TypeError(
                    "host.routine.configure: every_minutes must be an int "
                    f"(minutes, 5\u20131440), got {type(every_minutes).__name__}"
                )
            if not (5 <= every_minutes <= 1440):
                raise ValueError(
                    "host.routine.configure: every_minutes must be between "
                    f"5 and 1440 (inclusive), got {every_minutes!r}"
                )
            if not isinstance(on_tick, str) or not on_tick.strip():
                raise TypeError(
                    "host.routine.configure: on_tick must be a non-empty "
                    f"str, got {on_tick!r}"
                )
            if len(on_tick) > 2000:
                raise ValueError(
                    "host.routine.configure: on_tick must be \u2264 2000 chars, "
                    f"got {len(on_tick)}"
                )
            if label is not None:
                if not isinstance(label, str):
                    raise TypeError(
                        "host.routine.configure: label must be a str or "
                        f"None, got {type(label).__name__}"
                    )
                if len(label) > 120:
                    raise ValueError(
                        "host.routine.configure: label must be \u2264 120 "
                        f"chars, got {len(label)}"
                    )
            return s._call("configure")
        def status(s):
            return s._call("status")
        def done(s, had_work, summary=""):
            if not isinstance(had_work, bool):
                raise TypeError(
                    "host.routine.done: had_work must be a bool, got "
                    f"{type(had_work).__name__}"
                )
            if not isinstance(summary, str):
                raise TypeError(
                    "host.routine.done: summary must be a str, got "
                    f"{type(summary).__name__}"
                )
            if len(summary) > 500:
                raise ValueError(
                    "host.routine.done: summary must be \u2264 500 chars, got "
                    f"{len(summary)}"
                )
            return s._call("done")
        def __repr__(s): return "<host.routine (replay shim)>"
    routine = _Rt()
    def _llm_offense(self, req):
        # None | "system" | "role" | "shape" \u2014 first offense in live
        # _llm_req_guard's classification, so the no-flagged-entry raise
        # below can use the SAME wording live uses (shape mistakes must
        # not read as policy violations). A STRING \`system\` is not an
        # offense \u2014 live dispatches it (host SG-wraps).
        s = req.get("system")
        if s is not None and not isinstance(s, str):
            return "system"
        msgs = req.get("messages")
        if isinstance(msgs, (list, tuple)):
            for m in msgs:
                if not isinstance(m, dict) or not isinstance(
                        m.get("role"), str):
                    return "shape"
                if m.get("role") not in ("user", "assistant"):
                    return "role"
        return None
    def _llm_legacy_or_raise(self, wire, kind, label=""):
        # PRE-#2957 sessions dispatched system-bearing calls and recorded
        # a tape entry; assembleReplayTape flags those \`legacy_system\`
        # (refusal rows from forged wires are excluded at export). A
        # flagged next entry on the matching wire \u2192 consume it (old tape,
        # old behavior). Otherwise raise like live (new tape: live
        # recorded nothing), wording per live's classification.
        # FLAG PRESENCE WINS for era-ambiguous shapes: validations like
        # system=""/max_tokens=0/model=" " only landed mid-history
        # (#2693-era M4/M15 guards) \u2014 tapes recorded before them carry
        # REAL flagged entries for such calls, so re-running any
        # client-side validation before this peek would orphan the
        # flagged entry and drift every later call. Only shapes that
        # never dispatched in ANY era (signature conflicts \u2014 list/dict +
        # top-level kwargs, prompt collision, max_concurrency misuse,
        # non-dict list entries) may raise unconditionally; they pass
        # wire=None or raise before calling here.
        # wire=None: the call raised pre-dispatch in BOTH eras (e.g.
        # list/dict + top-level system kwarg) \u2014 no entry exists in any
        # tape, so skip the peek and go straight to the live raise.
        if wire is not None and self._i < len(_OPERON_TAPE):
            rec = _OPERON_TAPE[self._i]
            if rec.get("method") == wire and rec.get("legacy_system"):
                return self._next(wire)
        if kind == "shape":
            raise TypeError(
                f"host.llm: {label}messages entries must be "
                f"{{'role', 'content'}} dicts with role 'user' or "
                f"'assistant'"
            )
        if kind == "role":
            raise TypeError(
                f"host.llm: {label}messages role must be 'user' or "
                f"'assistant' \u2014 use the top-level \`system\` field instead"
            )
        raise TypeError(
            f"host.llm: {label}system must be a str or None"
        )
    def llm(self, request=None, system=None, model=None, max_tokens=None,
            max_concurrency=None, **k):
        # Mirror the live dispatch (base.py): list form and any single
        # request using tools/tool_choice/images/messages/temperature go
        # over the "llm_batch" wire; plain text stays on "llm". Without
        # this, replaying a notebook that used either new form trips the
        # _next method-drift check.
        # A STRING \`system\` dispatches live (host SG-wraps); a non-string
        # \`system\` raises a type error pre-dispatch. Non-string \`system\`,
        # messages-role, and shape offenses raised in SOME eras but
        # dispatched in others \u2014 legacy_system-flagged tape entries tell
        # the shim which (see _llm_legacy_or_raise).
        # Signature-level conflicts (list/dict + top-level kwargs, prompt
        # collision, max_concurrency misuse, non-dict list entries) raised
        # pre-dispatch in EVERY era \u2014 they raise here unconditionally.
        if system is not None and not isinstance(system, str):
            return self._llm_legacy_or_raise(None, "system")
        if isinstance(request, (list, tuple)):
            if (system is not None or model is not None
                    or max_tokens is not None or k):
                raise TypeError(
                    "host.llm: when passing a list of requests, put "
                    "per-request options inside each request dict"
                )
            if max_concurrency is not None and (
                    not isinstance(max_concurrency, int)
                    or isinstance(max_concurrency, bool)
                    or max_concurrency < 1):
                raise TypeError(
                    f"host.llm: max_concurrency must be a positive int "
                    f"or None, got {max_concurrency!r}"
                )
            # Live host.llm([]) short-circuits to [] without recording
            # a tape entry \u2014 consuming one here would drift the tape.
            if not request:
                return []
            kind = None
            label = ""
            for i, r in enumerate(request):
                if isinstance(r, str):
                    continue
                if not isinstance(r, dict):
                    raise TypeError(
                        f"host.llm: requests[{i}] must be a dict or a "
                        f"prompt str, got {type(r).__name__}"
                    )
                if kind is None:
                    kind = self._llm_offense(r)
                    if kind:
                        label = f"requests[{i}]: "
            if kind:
                return self._llm_legacy_or_raise("llm_batch", kind, label)
            return self._next("llm_batch")
        if max_concurrency is not None:
            raise TypeError(
                "host.llm: max_concurrency only applies when passing a "
                "list of requests"
            )
        if isinstance(request, dict):
            if (system is not None or model is not None
                    or max_tokens is not None or k):
                raise TypeError(
                    "host.llm: pass options inside the request dict OR "
                    "as keyword arguments, not both"
                )
            _req = dict(request)
        elif isinstance(request, str) or request is None:
            _req = dict(k)
            if isinstance(request, str):
                if "prompt" in _req:
                    raise TypeError(
                        "host.llm: prompt given both positionally and "
                        "as a keyword"
                    )
                _req["prompt"] = request
            if system is not None:
                _req["system"] = system
            if model is not None:
                _req["model"] = model
            if max_tokens is not None:
                _req["max_tokens"] = max_tokens
        else:
            raise TypeError(
                f"host.llm: expected a prompt str, a request dict, or a "
                f"list of request dicts; got {type(request).__name__}"
            )
        extended = any(_req.get(x) is not None for x in
                       ("tools", "tool_choice", "images", "messages",
                        "temperature"))
        kind = self._llm_offense(_req)
        if kind:
            # Old serial entries carry the "llm" method; old extended-form
            # entries the "llm_batch" method \u2014 match live's old dispatch.
            out = self._llm_legacy_or_raise(
                "llm_batch" if extended else "llm", kind)
            if not extended:
                return out
            r = out[0] if isinstance(out, list) and out else {}
            if isinstance(r, dict) and "error" in r and "text" not in r:
                raise RuntimeError(f"host.llm: {r['error']}")
            return r
        _req.pop("system", None)
        if extended:
            out = self._next("llm_batch")
            r = out[0] if isinstance(out, list) and out else {}
            if isinstance(r, dict) and "error" in r and "text" not in r:
                raise RuntimeError(f"host.llm: {r['error']}")
            return r
        return self._next("llm")
    def llm_batch(self, requests, max_concurrency=8):
        # Kept for HISTORICAL TAPES only \u2014 the live operon.llm_batch alias
        # was removed in #2963 (it now raises a teaching AttributeError
        # pointing at operon.llm), but notebooks exported before the
        # removal recorded real llm_batch calls; this shim method lets
        # those tapes replay. Signature mirrors the REMOVED live alias
        # EXACTLY (no **kwargs: an unexpected kwarg TypeErrors naturally,
        # recording nothing). max_concurrency is forwarded so the
        # list-lane validation in llm() sees it \u2014 dropping it would let
        # operon.llm_batch(reqs, max_concurrency=0) bypass the guard and
        # consume an unrecorded entry. The alias raised TypeError on
        # non-list input BEFORE any host call (no tape entry), so mirror
        # that rather than delegating a non-list into a _next() that
        # would consume an unrelated entry.
        if not isinstance(requests, (list, tuple)):
            raise TypeError(
                f"host.llm_batch: requests must be a list, got "
                f"{type(requests).__name__}"
            )
        return self.llm(list(requests), max_concurrency=max_concurrency)
    def current_model(self):      return self._next("current_model")
    def list_models(self):        return self._next("list_models")
    def artifacts(self, *a, **k): return self._next("list_artifacts")
    def artifact_path(self, version_id):
        # Validation mirrors live (artifacts.py _op_artifact_path): a
        # client-side-rejected call recorded no tape entry, so raise
        # WITHOUT consuming (\uD83D\uDFE1 3456599969).
        if not isinstance(version_id, str) or not version_id:
            raise TypeError(
                "host.artifact_path: version_id must be a non-empty str, got "
                f"{type(version_id).__name__}"
            )
        return self._next("artifact_path")
    def view_image(self, source=None, *a, **k):
        # Pure-Python PIL helper \u2014 the live run records NO tape entry for
        # PIL/path inputs and one artifact_path entry for a version_id
        # input. Without this mirror, __getattr__ would pop an unrelated
        # entry and drift every subsequent call. The saved crop files
        # already exist in the exported bundle from the live run.
        import re as _re
        if isinstance(source, str) and _re.fullmatch(r"[0-9a-fA-F-]{36}", source):
            # Consume-and-discard: swallow _OperonTapeError (an error-typed
            # artifact_path entry from the deriver when the vid wasn't
            # collected as a bundle input \u2014 finding 3438978167). Drift
            # RuntimeError still propagates.
            try: self._next("artifact_path")
            except _OperonTapeError: pass
        return {"source": "replay", "original_size": (0, 0), "crop": None,
                "output_size": (0, 0), "saved_to": "<replay>"}
    def artifact_marker(self, version_id):
        # Pure string formatter, no host call, no tape entry.
        if not isinstance(version_id, str) or not version_id:
            raise TypeError(
                "host.artifact_marker: version_id must be a non-empty str, "
                f"got {type(version_id).__name__}"
            )
        return "{" + "{" + "artifact:" + version_id + "}" + "}"
    def capabilities(self):
        # Pure-Python in the live SDK (no tape entry). The live table is
        # dynamic (depends on which kernel fragments were loaded), which
        # the shim can't know \u2014 report what this shim mirrors. If a
        # notebook branches differently than it did live, the resulting
        # method/tape mismatch is contained to that one cell by _next's
        # check-before-consume; it cannot cascade-drift the tape.
        _m = ("query", "llm", "llm_batch", "current_model", "list_models",
              "frames", "children", "delegate", "mcp", "lineage",
              "artifacts", "credentials", "app")
        return {**{c: True for c in _m},
                **{c: False for c in ("agents", "skills", "compute",
                                      "exec_peek", "exec_interrupt")}}
    def frames(self, *a, **k):    return self._next("list_frames")
    def children(self, *a, **k):  return self._next("list_running_children")
    def delegate(self, request=None, task=None, name=None,
                 context_summary=None, profile=None, output_schema=None,
                 model=None, max_concurrency=None):
        # Mirror the live three-shape dispatch (supervision.py): the tape
        # records one "delegate" entry per non-empty host_call and its
        # value is always a list. Live unwraps to out[0] for the single
        # str/dict/kwargs forms and short-circuits an empty list without
        # recording \u2014 __getattr__ fallthrough would return the raw list
        # (single-form TypeError on ["response"]) or consume an unrelated
        # entry (empty-list drift).
        if isinstance(request, (list, tuple)):
            if not request:
                return []
            return self._next("delegate")
        out = self._next("delegate")
        return out[0] if isinstance(out, list) and out else {}
    def mcp(self, *a, **k):
        r = self._next("mcp")
        if isinstance(r, str) and r and r[0] in "{[":
            try: return _json.loads(r)
            except _json.JSONDecodeError: pass
        return r
    def app(self, server):
        _n = self._next
        class _A:
            def tools(s): return _n("app_tools_list")
            def __getattr__(s, n):
                if n.startswith("_"): raise AttributeError(n)
                return lambda *a, **k: _n("app_tool")
        return _A()
    def __getattr__(self, name):
        # Fallback for unmirrored host_call methods; skip _-names so
        # ipython/pickle probes don't pop tape entries. The fallback
        # delegates directly to _next(): its skip-past-_OPERON_SKIPPABLE +
        # drift error already cover the "pure-Python, recorded nothing"
        # case without advancing the cursor (finding 4765218668 \u2014 the
        # former local peek here didn't apply the skip and so errored
        # early for unmirrored calls behind a discovery entry).
        if name.startswith("_"): raise AttributeError(name)
        return lambda *a, **k: self._next(name)
# Module-private singleton: the nested _L/_C accessors reach it via this
# name so a replayed cell rebinding \`host\` (a very common variable) or
# \`operon\` can't break later SDK replay calls.
_replay = _OperonReplay()
host = _replay
# Both spellings bind the same replay object: exported cell code may use
# either, depending on when the notebook was recorded.
operon = _replay
# Register so \`import host\`/\`import operon\` / \`from \u2026 import X\` in
# extracted_code is a no-op that resolves to this shim (stress-test D3a:
# Opus emits \`import operon\` which otherwise raises ModuleNotFoundError
# before any tape drift is even visible). __getattr__ above handles
# \`from \u2026 import X\`. BOTH entries are live \u2014 exported transcripts span
# the rename.
_sys.modules["host"] = _replay
_sys.modules["operon"] = _replay
`,laO=`# \u2500\u2500 Claude Science SDK replay shim (auto-generated at export) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
.operon_tape <- jsonlite::fromJSON("operon_tape.json", simplifyVector = FALSE)
.operon_i <- 0L
.operon_skippable <- c("list_artifacts", "artifacts", "current_model", "list_models")
.operon_next <- function(m) {
  if (.operon_i + 1L > length(.operon_tape)) stop(sprintf("host-SDK replay: tape exhausted at call %d (%s)", .operon_i, m))
  rec <- .operon_tape[[.operon_i + 1L]]
  # Check BEFORE advancing: a drift stop() caught by tryCatch()/knitr
  # error=TRUE must not leave the tape off by one for every later call.
  # Tape-skip for Opus-dropped discovery calls (stress-test D3) \u2014 PEEK past
  # skippable entries via local \`j\` so a skip-then-drift leaves the cursor
  # untouched (finding 3438978179).
  j <- .operon_i
  while (rec$method != m && rec$method %in% .operon_skippable) {
    j <- j + 1L
    if (j + 1L > length(.operon_tape)) stop(sprintf("host-SDK replay: tape exhausted at call %d (%s)", j, m))
    rec <- .operon_tape[[j + 1L]]
  }
  if (rec$method != m) stop(sprintf("host-SDK replay drift at step %d: recorded %s, requested %s", j, rec$method, m))
  if (j > .operon_i) for (k in seq.int(.operon_i, j - 1L)) {
    message(sprintf("host-SDK replay: skipping tape entry %d (%s) \u2014 not in extracted_code", k, .operon_tape[[k + 1L]]$method))
  }
  .operon_i <<- j + 1L
  if (!is.null(rec$error)) stop(rec$error)
  rec$data
}
host <- local({
  env <- new.env(parent = emptyenv())
  # Mirror live SDK: cache by lowercased vid so repeated access consumes
  # ONE tape step (live makes one host-call \u2192 tape has one entry).
  .lineage_cache <- new.env(parent = emptyenv())
  env$lineage <- function(version_id) {
    # Arg validation mirrors live: a client-side-rejected call recorded no
    # tape entry, so stop() WITHOUT consuming (\uD83D\uDFE1 3456767435).
    if (!is.character(version_id) || length(version_id) != 1L
        || !nzchar(version_id)) {
      stop("host$lineage: version_id must be a single non-empty character string")
    }
    vid <- tolower(version_id)
    if (exists(vid, envir = .lineage_cache, inherits = FALSE)) {
      return(get(vid, envir = .lineage_cache, inherits = FALSE))
    }
    r <- .operon_next("get_lineage")
    # Mirror live (#2941): pending responses stay uncached so a poll
    # re-read consumes the tape's second entry (scanner 3406244163).
    if (!(is.list(r) && isTRUE(r$extraction_pending))) {
      assign(vid, r, envir = .lineage_cache)
    }
    r
  }
  env$clear_lineage_cache <- function() {
    rm(list = ls(.lineage_cache), envir = .lineage_cache)
  }
  # Live R host$query is a pure stop() redirect (query_db is repl-tool
  # Python-only) \u2014 it records NO tape entry, so consuming one here would
  # drift-stop on replay (scanner 3406325633). Mirror the live redirect.
  env$query <- function(sql, params=list(), limit=NULL, df=FALSE) {
    stop(paste0(
      "host$query() is only available via the \`repl\` tool (Python). ",
      "Run the query there and write results to a file in your workspace ",
      "(e.g. ./handoff/*.csv), then read it here."
    ))
  }
  env$llm <- function(prompt, system = NULL, model = NULL, max_tokens = NULL) {
    # prompt/max_tokens validation mirrors the worker in BOTH eras \u2014
    # calls failing these stop()ed live BEFORE .host_call (no tape entry)
    # and must stop here too, never consume. Pre-#2957 the worker ran
    # these checks first (system was unvalidated); post-#2957 it checks
    # system first \u2014 either way a failing call records nothing, so
    # validating before the system branch keeps both eras aligned (the
    # error TEXT can differ from the new worker when both prompt and
    # system are bad; both sides raise without consuming).
    if (!is.character(prompt) || length(prompt) != 1L || !nzchar(prompt)) {
      stop("host$llm: prompt must be a single non-empty character string")
    }
    if (!is.null(max_tokens) && (!is.numeric(max_tokens)
                                 || length(max_tokens) != 1L
                                 || max_tokens < 1
                                 || max_tokens != as.integer(max_tokens))) {
      stop("host$llm: max_tokens must be a single positive integer or NULL")
    }
    # A string \`system\` dispatches live (host SG-wraps) \u2014 consume the next
    # entry. Non-string \`system\` raises live in every era; no tape entry
    # to peek.
    if (!is.null(system) && (!is.character(system) || length(system) != 1L)) {
      stop("host$llm: system must be a single character string or NULL")
    }
    .operon_next("llm")
  }
  env$current_model <- function() .operon_next("current_model")
  env$list_models <- function() .operon_next("list_models")
  # host$lineage_graph routes over the "get_lineage_topology" wire live \u2014
  # without the explicit mapping the $.operon_replay fallback requests
  # "lineage_graph" and drift-stops (review 3398748874). Arg validation
  # mirrors the live worker: a client-side-rejected call recorded no tape
  # entry, so the shim must also stop() WITHOUT consuming (\uD83D\uDFE1 3456548628).
  # No \`...\` (\uD83D\uDFE1 3457204609): live has explicit max_depth/max_nodes (no
  # catch-all), so a typo'd kwarg is an R unused-argument error BEFORE the
  # host-call \u2014 shim must match so the bad call doesn't consume.
  env$lineage_graph <- function(version_id, direction = "up",
                                max_depth = NULL, max_nodes = NULL) {
    if (!is.character(version_id) || length(version_id) != 1L
        || !nzchar(version_id)) {
      stop("host$lineage_graph: version_id must be a single non-empty character string")
    }
    if (!direction %in% c("up", "down")) {
      stop("host$lineage_graph: direction must be 'up' or 'down'")
    }
    if (!is.null(max_depth)) as.integer(max_depth)
    if (!is.null(max_nodes)) as.integer(max_nodes)
    .operon_next("get_lineage_topology")
  }
  env$artifact_path <- function(version_id) {
    if (!is.character(version_id) || length(version_id) != 1L ||
        is.na(version_id) || !nzchar(version_id)) {
      stop("host$artifact_path: version_id must be a non-empty string")
    }
    .operon_next("artifact_path")
  }
  # artifact_marker is a PURE-CLIENT helper live (no .host_call, no tape
  # entry) \u2014 mirror it or a replayed call falls through to .operon_next
  # and drift-stops (scanner 3406244156); same reason the Python shim
  # mirrors it as a pure formatter.
  env$artifact_marker <- function(version_id) {
    if (!is.character(version_id) || length(version_id) != 1L ||
        is.na(version_id) || !nzchar(version_id)) {
      stop("host$artifact_marker: version_id must be a non-empty string")
    }
    paste0("{", "{", "artifact:", version_id, "}", "}")
  }
  env$artifacts <- function(...) stop("host$artifacts() is Python-only")
  env$frames <- function(...) stop("host$frames() is only available via the \`repl\` tool \u2014 re-run there.")
  env$children <- function(...) stop("host$children() is only available via the \`repl\` tool \u2014 re-run there.")
  # Same non-tape-consuming stop() stubs as the live worker's
  # .py_only/.operon_only table \u2014 without these a replayed call falls
  # through to \`$.operon_replay\` and consumes the next tape entry, drifting
  # every subsequent step (scanner 3415277245).
  env$delegate <- function(...) stop("host$delegate() is only available via the \`repl\` tool \u2014 re-run there.")
  env$delegation_stats <- function(...) stop("host$delegation_stats() is only available via the \`repl\` tool \u2014 re-run there.")
  env$get_user_email <- function(...) stop("host$get_user_email() is only available via the \`repl\` tool \u2014 re-run there.")
  env$credentials <- function(...) stop("host$credentials() is Python-only")
  env$routine <- function(...) stop("host$routine is Python-only (replay stub; no live-R equivalent)")
  env$view_image <- function(...) stop("host$view_image() is Python-only")
  env$llm_batch <- function(...) stop(
    "host$llm_batch was removed, and the list/batch form is ",
    "Python-only \u2014 use host$llm(prompt) for single requests here, or ",
    "switch to the Python kernel for batched fan-out ",
    "(host.llm([...], max_concurrency=N))."
  )
  class(env) <- "operon_replay"
  env
})
# Fallback for host_call methods not explicitly mirrored above \u2014 the tape
# contains every host_call the live run made, so consume the next record
# rather than NULL + drift on the call after.
\`$.operon_replay\` <- function(x, name) {
  if (exists(name, envir = x, inherits = FALSE)) get(name, envir = x)
  else function(...) .operon_next(name)
}
# Both spellings bind the same replay env: exported cell code may use either.
operon <- host
`;import{createHash as _xw}from"crypto";import*as Xx from"fs";import*as iQ_ from"os";import*as OK from"path";import{fileURLToPath as Oxw}from"url";function nQ_(){try{let O=y1().privateTempRoot?.()??iQ_.tmpdir();return Xx.mkdtempSync(OK.join(O,`operon-trace-${process.pid}-`))}catch{return null}}function UM(O,z){if(!O)return;try{if(!Xx.lstatSync(O).isDirectory())return}catch{return}try{if(z)Xx.unlinkSync(z)}catch{}try{Xx.rmdirSync(O)}catch{}}function sQ_(O){try{return Xx.openSync(O,Xx.constants.O_RDWR|Xx.constants.O_CREAT|Xx.constants.O_EXCL|Xx.constants.O_NOFOLLOW,384)}catch{return null}}function KC(O){if(O===null)return;try{Xx.closeSync(O)}catch{}}function Rm(){if(wd_!=null)return wd_;let O=zxw();if(O!=null)wd_=O;return O}function zxw(){if(y1().platform()!=="darwin")return null;let O=rB.darwin;if(!O)return null;let z=O.rel(iQ_.arch()),w=[],W=J_().assets?.root;if(W)w.push(OK.join(W,z));let G=Oxw(import.meta.url);if(!G.includes("$bunfs"))w.push(OK.resolve(OK.dirname(G),"..","..","assets",z));for(let x of w)try{let Y=Xx.realpathSync.native(x);if(!Xx.statSync(Y).isFile())continue;let K=J_().assets?.nativeAssetHashes?.[z];if(K){let y=_xw("sha256").update(Xx.readFileSync(Y)).digest("hex");if(y!==K.toLowerCase())return console.warn(`[writeTrace] ${Y}: sha256 ${y.slice(0,12)}\u2026 \u2260 embedded `+`baseline ${K.slice(0,12)}\u2026 \u2014 shim corrupted/tampered; `+"falling back to fswatch/scan."),null}return Y}catch{}return null}function dQ_(O){return`'${O.replace(/'/g,"'\\''")}'`}function wxw(O){if(!O.startsWith("/"))return null;let z=OK.normalize(O).replace(/\/+$/,""),w=[];while(z!=="/"&&z!=="."){let W=OK.dirname(z);try{let G=OK.join(Xx.realpathSync(W),OK.basename(z),...w);return G===O?null:G}catch{w.unshift(OK.basename(z)),z=W}}return null}function Dm(O){if(!O)return"";let z=new Set,w=[],W=(q)=>{if(!q.startsWith("/")||q.includes(":")||q.includes(`
`))return;let Z=q.replace(/\/+$/,"")||"/";if(Z==="/"||z.has(Z))return;z.add(Z),w.push(Z)};for(let q of O.readRoots??[]){W(q);let Z=wxw(q);if(Z!==null)W(Z);for(let X of[q,Z]){let Q=X&&/^\/private(\/(?:tmp|var|etc)\/.*)$/.exec(X);if(Q)W(Q[1])}}let G=30,x=4000;if(w.length>G)console.warn(`[writeTrace] ${w.length} read roots > shim cap ${G}; dropping extras`),w.length=G;while(w.join(":").length>=x&&w.length>1)w.pop();let Y=w.length?`  export OPERON_TRACE_READ_ROOTS=${dQ_(w.join(":"))}
`:"",{envVar:K,uname:y}=rB.darwin??{envVar:"LD_PRELOAD",uname:"Linux"};return`
# Write-trace shim (per-cell file-output detection + read grounding).
# Records are untrusted hints; the host containment-gates everything
# (cellOutputDetection.ts).
if [ "$(uname)" = "${y}" ] && [ -f ${dQ_(O.shimPath)} ]; then
  export OPERON_WRITE_TRACE=${dQ_(O.logPath)}
${Y}  export ${K}=${dQ_(O.shimPath)}"\${${K}:+:$${K}}"
fi
`}var rB,wd_;