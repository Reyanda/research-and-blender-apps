var Lb=S(()=>{HA();HA();iO();EU();gY_();LY_();JPO();de7();ae7();vb();re7();OA();W_w();Nb_();QN();K_w();or();V_w();wuO();mq_=class mq_ extends Error{};Jf=`${gO} \u2014 run Claude on your data, locally, in your browser

RUN IT
  ${gO} serve              Start the background program (the
                                       daemon) and open the web UI in your
                                       browser. Start here.
  ${gO} open               Open another browser tab on the running daemon
  ${gO} url                Print a login link to paste into a
                                       browser yourself (e.g. over SSH;
                                       single-use, ~3 min \u2014 run again for
                                       another)
  ${gO} status             Is it running? Print status as JSON
                                       (port, pid, version; always exits 0)
  ${gO} logs [--tail]      Show daemon logs
  ${gO} stop               Stop the daemon
${`
MAINTENANCE
  ${gO} update             Self-update. '--check' only reports;
                                       '--to <v>' installs a specific build
                                       (also how you roll back)
  ${gO} import <path>      Merge another data dir (or .db) into
                                       this one (writes here; back up first)

  Network grants ("approval cards") are managed in the web UI under
  Customize > Permissions; there is no CLI for them in this build.

EXAMPLES
  ${gO} serve                              # start + open the UI
  ${gO} open                               # lost the tab? reopen it
  ${gO} stop && ${gO} serve           # restart it
  ${gO} update --check                     # is there a newer build?
`}
Run '${gO} <cmd> --help' for that command's flags
(e.g. '${gO} serve --help').
Global flags (work on every command):
  --data-dir DIR     Where state is stored (default ~/.claude-science)
  --config FILE      Settings file (default ~/.claude-science/config.toml)
  --assets-root DIR  Serve the web UI from DIR (developer override)
  --version          Print the installed version
`,SuO=`${gO} serve \u2014 start the daemon and open the web UI

By default: listens on 127.0.0.1:8000, opens your browser at a
single-use login link, and keeps running in this terminal until you
press Ctrl-C (which stops it). One daemon per data-dir.

By default Claude runs in a sandbox: outbound network hosts and host
files need your approval \u2014 an approval card in the UI \u2014 before Claude
can reach them.

FLAGS
  --port N             Listen port (default 8000; 0 = pick a free port)
  --sandbox-port N     Separate port that serves HTML previews Claude
                       generates, kept apart so a previewed page can
                       never read your session. Usually leave it alone.
                       (default: port+1; 0 = pick a free port)
  --no-browser         Don't auto-open a browser (remote / no display);
                       print a login link any time with '${gO} url'
  --detached           Run in the background ('${gO} status' to
                       check it, '${gO} logs --tail' to watch)
  --no-auto-update     Don't check for or install updates in the background
                       (on by default; a new build runs after the next
                       restart). Use on pinned or IT-managed installs.${""}
  --base-path /PREFIX  Serve the UI under a URL prefix instead of /, for use
                       behind a reverse proxy (e.g. --base-path /bio \u2192
                       http://host/bio/). Leading slash, no trailing slash.
  --allow-origin URL   Accept WebSocket upgrades and browser writes (the
                       CSRF gate's Origin allowlist) from this extra Origin
                       \u2014 browsers connecting TO the UI, not an outbound
                       allowlist. NOT CORS reflection: cross-origin pages
                       still can't read responses \u2014 front the daemon with a
                       same-origin reverse proxy for that.
                       e.g. --allow-origin https://app.example.com
                       (exact match incl. scheme+port; repeat for more)
  --host HOST          Bind address (default 127.0.0.1). Any other value
                       exposes the UI to that network \u2014 prefer an SSH
                       tunnel or TLS proxy.
  --dangerously-no-sandbox
                       Disable the security sandbox. Claude gets full
                       $HOME read/write and unrestricted network \u2014 only
                       use in already-isolated environments (CI, containers)
  --dangerously-skip-approvals
                       Auto-approve every permission prompt daemon-wide (code
                       execution, network, files, tools). Questions Claude
                       asks you directly still appear. This removes every
                       check between Claude and your files and network \u2014 do
                       not use it on data or prompts you did not write.${""}

EXAMPLES
  ${gO} serve                           # laptop: start + open UI
  ${gO} serve --port 8080               # if 8000 is already taken
  ${gO} serve --no-browser --detached   # remote box over SSH
  ${gO} url                             # then print a login link

Global: --data-dir DIR  --config FILE  --assets-root DIR
`,k_w=`${gO} update \u2014 replace this binary with another build

Downloads the requested build, sha256-verifies it, and atomically swaps
it in place. A running daemon keeps the OLD code until you restart it
('${gO} stop && ${gO} serve') \u2014 update reminds you when that's needed.

FLAGS
  --check          Report whether an update is available; install nothing.
  --to <id>        Install a SPECIFIC build instead of the latest \u2014 this is
                   also how you ROLL BACK (return to an older build) after
                   a bad update. <id> is a version like 1.4.2 or an 8-hex
                   build sha like 3f9a01bc, depending on your release
                   channel ([update].channel in config.toml); the wrong
                   form is rejected with a hint.
  --version <id>   Deprecated alias for --to <id> (prints a warning).

The release channel comes from [update].channel in
~/.claude-science/config.toml.
Dev/source builds refuse 'update' (it would overwrite your source tree).

Examples:
  ${gO} update --check          # is there anything newer?
  ${gO} update                  # install the latest
  ${gO} update --to 1.4.2       # pin / roll back to 1.4.2
  ${gO} stop && ${gO} serve  # pick up the new build

Note: '${gO} --version' (no subcommand) prints the installed
version. To install a specific version, use 'update --to <id>'.

Global: --data-dir DIR  --config FILE
`,U_w=`${gO} import \u2014 merge another install's data into this one

USAGE
  ${gO} import <path>

<path> is either another Claude Science data directory (any prior
version's layout) or a single .db file. From a directory, every database
found is merged and artifacts/, tool-results/, compaction-history/ are
copied; a bare .db file is a database-only merge.

There is no undo or --dry-run \u2014 back up this data dir first. Safe to
re-run: a partial failure resumes where it left off. Takes no flags.

Examples:
  ${gO} import ~/.claude-science-old
  ${gO} import /backups/operon-cli.db   # the .db inside a data dir

Global: --data-dir DIR  --config FILE
`,J_w=`${gO} logs \u2014 show the daemon's log file

Prints the newest server-*.log from <data-dir>/logs/ (default
~/.claude-science/logs/). With --tail, keeps following it as the
daemon writes \u2014 the usual pairing with '${gO} serve --detached'.

FLAGS
  --tail   Follow the file live, like 'tail -f' (Ctrl-C to stop).
           Default: print the whole file and exit.

Examples:
  ${gO} logs            # dump the latest log and exit
  ${gO} logs --tail     # watch a backgrounded daemon

Global: --data-dir DIR  --config FILE
`,C_w=`${gO} status \u2014 print daemon status as JSON

Reports running/pid/version/port/started_at plus the daemon's live
health payload (uptime, active sessions) when one is up. Takes no
flags. Always exits 0 \u2014 gate scripts on '.running'.

Examples:
  ${gO} status                   # is it running? what port?
  ${gO} status | jq .running     # scripting: just true/false
  ${gO} status | jq .port        # scripting: just the port

Global: --data-dir DIR  --config FILE
`,g_w=`${gO} stop \u2014 stop the running daemon

Asks the daemon to shut down gracefully, waits up to 5s, then
force-kills. Warns first when sessions are still running (they are cut
off and show as failed on the next start). Takes no flags. Exits 0 when
there is nothing to stop, so it is always safe to re-run. Leftover
lock files from a crash are cleaned up.

Examples:
  ${gO} stop
  ${gO} stop && ${gO} serve  # restart after an update

Global: --data-dir DIR  --config FILE
`,v_w=`${gO} open \u2014 open a browser tab on the running daemon

Creates a fresh single-use login link from the running daemon and opens
it in your default browser. Takes no flags. Needs a running daemon
(if none, exits 4 \u2014 start one with '${gO} serve').

Examples:
  ${gO} open

Global: --data-dir DIR  --config FILE
`,F_w=`${gO} url \u2014 print a fresh login link for the running daemon

Prints the URL alone on stdout (single-use, expires in ~3 minutes; run
again for another). Takes no flags. Needs a running daemon (if none,
exits 4 \u2014 start one with '${gO} serve').

Examples:
  ${gO} url
  URL=$(${gO} url)      # stdout carries only the URL

Global: --data-dir DIR  --config FILE
`,L_w=Object.assign(Object.create(null),{update:k_w,import:U_w,logs:J_w,status:C_w,stop:g_w,open:v_w,url:F_w,...{}}),uq_=new Set(["--config","--data-dir","--assets-root"]),j_w=`${gO} \u2014 run Claude on your data, locally, in your browser

Most people start with '${gO} serve': it runs the daemon and opens the
web UI in your browser.

`;mix={ensureEncryptionKeys:HuO,HELP_SHORT:Jf,HELP_SERVE:SuO,HELP_PROMPT:DoG,HELP_COMPUTE:ToG,HELP_UPDATE:k_w,HELP_IMPORT:U_w,HELP_LOGS:J_w,HELP_STATUS:C_w,HELP_STOP:g_w,HELP_OPEN:v_w,HELP_URL:F_w,HELP_ALLOW:hoG,HELP_LIST:PoG,SUB_HELP:L_w,NOARGS_OFFER:j_w};loG().catch((O)=>{process.stderr.write(O instanceof mq_?`${gO}: ${O.message}
`:`[claude-science] fatal: ${O.stack??O}
`),process.exit(gA.SERVER)})});Lb();export{N_w as parsePort,loG as main,M_w as buildSettings,foG as buildFlavor,uoG as buildChannel,mix as _test,mq_ as CliError,gO as CLI_BIN};
