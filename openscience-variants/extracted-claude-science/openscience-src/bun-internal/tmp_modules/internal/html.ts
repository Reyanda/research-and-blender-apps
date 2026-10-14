(function (){"use strict";// build/release/tmp_modules/internal/html.ts
var $, initial = performance.now(), argv = process.argv, path = @getInternalField(@internalModuleRegistry, 107) || @createInternalModuleById(107), env = Bun.env;
async function start() {
  let args = [], cwd = process.cwd(), hostname = "localhost", port = @undefined, enableConsoleLog = !1;
  for (let i = 1, argvLength = argv.length;i < argvLength; i++) {
    let arg = argv[i];
    if (!arg.endsWith(".html")) {
      if (arg.startsWith("--hostname=")) {
        if (hostname = arg.slice(11), hostname.includes(":")) {
          let [host, portString] = hostname.split(":");
          hostname = host, port = parseInt(portString, 10);
        }
      } else if (arg.startsWith("--port="))
        port = parseInt(arg.slice(7), 10);
      else if (arg.startsWith("--host=")) {
        if (hostname = arg.slice(7), hostname.includes(":")) {
          let [host, portString] = hostname.split(":");
          hostname = host, port = parseInt(portString, 10);
        }
      } else if (arg === "--console")
        enableConsoleLog = !0;
      else if (arg === "--no-console")
        enableConsoleLog = !1;
      if (arg === "--help")
        console.log(`
Bun v${Bun.version} (html)

Usage:
  bun [...html-files] [options]

Options:

  --port=<NUM>
  --host=<STR>, --hostname=<STR>
  --console # print console logs from browser
  --no-console # don't print console logs from browser
Examples:

  bun index.html
  bun ./index.html ./about.html --port=3000
  bun index.html --host=localhost:3000
  bun index.html --hostname=localhost:3000
  bun ./*.html
  bun index.html --console

This is a small wrapper around Bun.serve() that automatically serves the HTML files you pass in without
having to manually call Bun.serve() or write the boilerplate yourself. This runs Bun's bundler on
the HTML files, their JavaScript, and CSS, and serves them up. This doesn't do anything you can't do
yourself with Bun.serve().
`), process.exit(0);
      continue;
    }
    if (arg.includes("*") || arg.includes("**") || arg.includes("{")) {
      let glob = new Bun.Glob(arg);
      for (let file of glob.scanSync(cwd)) {
        let resolved = path.resolve(cwd, file);
        if (resolved.includes(path.sep + "node_modules" + path.sep))
          continue;
        try {
          resolved = Bun.resolveSync(resolved, cwd);
        } catch {
          resolved = Bun.resolveSync("./" + resolved, cwd);
        }
        if (resolved.includes(path.sep + "node_modules" + path.sep))
          continue;
        args.push(resolved);
      }
    } else {
      let resolved = arg;
      try {
        resolved = Bun.resolveSync(arg, cwd);
      } catch {
        resolved = Bun.resolveSync("./" + arg, cwd);
      }
      if (resolved.includes(path.sep + "node_modules" + path.sep))
        continue;
      args.push(resolved);
    }
    if (args.length > 1)
      args = [...new Set(args)];
  }
  if (args.length === 0)
    throw Error("No HTML files found matching " + JSON.stringify(Bun.main));
  args.sort((a, b) => {
    return a.localeCompare(b);
  });
  let needsPop = !1;
  if (args.length === 1)
    args.push(process.cwd()), needsPop = !0;
  let longestCommonPath = args.reduce((acc, curr) => {
    if (!acc)
      return curr;
    let i = 0;
    while (i < acc.length && i < curr.length && acc[i] === curr[i])
      i++;
    return acc.slice(0, i);
  });
  if (path.platform === "win32")
    longestCommonPath = longestCommonPath.replaceAll("\\", "/");
  if (needsPop)
    args.pop();
  let servePaths = args.map((arg) => {
    let isIndexHtml = path.basename(arg) === "index.html", servePath = arg;
    if (servePath.startsWith(longestCommonPath))
      servePath = servePath.slice(longestCommonPath.length);
    else {
      let relative = path.relative(longestCommonPath, servePath);
      if (!relative.startsWith(".."))
        servePath = relative;
    }
    if (isIndexHtml && servePath.length === 0)
      servePath = "/";
    else if (isIndexHtml)
      servePath = servePath.slice(0, -10);
    if (servePath.endsWith(".html"))
      servePath = servePath.slice(0, -5);
    if (servePath.endsWith("/"))
      servePath = servePath.slice(0, -1);
    if (servePath.startsWith("/"))
      servePath = servePath.slice(1);
    if (servePath === "/")
      servePath = "";
    return servePath;
  }), htmlImports = await @Promise.all(args.map((arg) => {
    return import(arg).then((m) => m.default);
  }));
  if (htmlImports.length === 1)
    servePaths[0] = "*";
  let staticRoutes = htmlImports.reduce((acc, htmlImport, index) => {
    let html = htmlImport, servePath = servePaths[index];
    return acc["/" + servePath] = html, acc;
  }, {});
  var server;
  getServer:
    try {
      server = Bun.serve({
        static: staticRoutes,
        development: env.NODE_ENV !== "production" ? {
          console: enableConsoleLog,
          hmr: @undefined
        } : !1,
        hostname,
        port,
        fetch(_req) {
          return new Response("Not found", { status: 404 });
        }
      });
      break getServer;
    } catch (error) {
      if (error?.code === "EADDRINUSE") {
        let defaultPort = port || parseInt(env.PORT || env.BUN_PORT || env.NODE_PORT || "3000", 10);
        for (let remainingTries = 5;remainingTries > 0; remainingTries--)
          try {
            server = Bun.serve({
              static: staticRoutes,
              development: env.NODE_ENV !== "production" ? {
                console: enableConsoleLog,
                hmr: @undefined
              } : !1,
              hostname,
              port: defaultPort++,
              fetch(_req) {
                return new Response("Not found", { status: 404 });
              }
            });
            break getServer;
          } catch (error2) {
            if (error2?.code === "EADDRINUSE")
              continue;
            throw error2;
          }
      }
      throw error;
    }
  let elapsed = (performance.now() - initial).toFixed(2), enableANSIColors = Bun.enableANSIColors;
  function printInitialMessage(isFirst) {
    let pathnameToPrint;
    if (servePaths.length === 1)
      pathnameToPrint = servePaths[0];
    else {
      let indexRoute = servePaths.find((a) => {
        return a === "index" || a === "" || a === "/";
      });
      pathnameToPrint = indexRoute !== @undefined ? indexRoute : servePaths[0];
    }
    if (pathnameToPrint ||= "/", pathnameToPrint === "*")
      pathnameToPrint = "/";
    if (enableANSIColors) {
      let topLine = `${server.development ? "\x1B[34;7m DEV \x1B[0m " : ""}\x1B[1;34m\x1B[5mBun\x1B[0m \x1B[1;34mv${Bun.version}\x1B[0m`;
      if (isFirst)
        topLine += ` \x1B[2mready in\x1B[0m \x1B[1m${elapsed}\x1B[0m ms`;
      console.log(topLine + `
`), console.log(`\x1B[1;34m\u279C\x1B[0m \x1B[36m${new URL(pathnameToPrint, server.url)}\x1B[0m`);
    } else {
      let topLine = `Bun v${Bun.version}`;
      if (isFirst) {
        if (server.development)
          topLine += " dev server";
        topLine += ` ready in ${elapsed} ms`;
      }
      console.log(topLine + `
`), console.log(`url: ${new URL(pathnameToPrint, server.url)}`);
    }
    if (htmlImports.length > 1 || servePaths[0] !== "" && servePaths[0] !== "*") {
      console.log(`
Routes:`);
      let pairs = [];
      for (let i = 0, length = servePaths.length;i < length; i++) {
        let route = servePaths[i], importPath = args[i];
        pairs.push({ route, importPath });
      }
      pairs.sort((a, b) => {
        if (b.route === "")
          return 1;
        if (a.route === "")
          return -1;
        return a.route.localeCompare(b.route);
      });
      for (let i = 0, length = pairs.length;i < length; i++) {
        let { route, importPath } = pairs[i], prefix = i === length - 1 ? "  \u2514\u2500\u2500 " : "  \u251C\u2500\u2500 ";
        if (enableANSIColors)
          console.log(`${prefix}\x1B[36m/${route}\x1B[0m \x1B[2m\u2192 ${path.relative(process.cwd(), importPath)}\x1B[0m`);
        else
          console.log(`${prefix}/${route} \u2192 ${path.relative(process.cwd(), importPath)}`);
      }
    }
    if (isFirst && process.stdin.isTTY)
      if (enableANSIColors)
        console.log(), console.log("\x1B[2mPress \x1B[2;36mh + Enter\x1B[39;2m to show shortcuts\x1B[0m");
      else
        console.log(), console.log("Press h + Enter to show shortcuts");
  }
  if (printInitialMessage(!0), process.stdin.isTTY)
    process.on("SIGINT", () => process.exit()), process.on("SIGHUP", () => process.exit()), process.on("SIGTERM", () => process.exit()), process.stdin.on("data", (data) => {
      switch (data.toString().toLowerCase().replaceAll(`\r
`, `
`)) {
        case "\x03":
        case `q
`:
          process.exit();
          break;
        case `c
`:
          console.clear(), printInitialMessage(!1);
          break;
        case `o
`:
          let url = server.url.toString();
          Bun.spawn(["open", url]).exited.catch(() => {});
          break;
        case `h
`:
          console.clear(), printInitialMessage(!1), console.log(`
  Shortcuts\x1B[2m:\x1B[0m
`), console.log("  \x1B[2m\u2192\x1B[0m   \x1B[36mc + Enter\x1B[0m   clear screen"), console.log("  \x1B[2m\u2192\x1B[0m   \x1B[36mo + Enter\x1B[0m   open in browser"), console.log(`  \x1B[2m\u2192\x1B[0m   \x1B[36mq + Enter\x1B[0m   quit (or Ctrl+C)
`);
          break;
      }
    });
}
$ = start;
return $})

