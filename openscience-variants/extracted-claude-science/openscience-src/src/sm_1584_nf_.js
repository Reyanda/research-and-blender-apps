var K_w=S(()=>{HA()});import*as Nq from"fs";import*as juO from"path";function nf_(){return juO.join(Hx(),"logs")}function vA(O,z,w){let W=z.find((G)=>G.startsWith("-")&&!w.includes(G));if(W===void 0)return;process.stderr.write(`Unknown argument: ${JSON.stringify(W).slice(0,80)}
`+(w.length?`'${gO} ${O}' flags: ${w.join(" ")}
`:`'${gO} ${O}' takes no flags.
`)+`Run '${gO} ${O} --help' for usage.
`),process.exit(4)}function FuO(O){return O?{Authorization:`Bearer ${O}`}:{}}async function LuO(O){return null}async function y_w(O){let z=`http://localhost:${O.port}/`;if(!O.sock)return z;let w=await fjO(O.sock,"/nonce","POST");if(!w)return process.stderr.write(`${gO}: could not reach daemon control socket \u2014 restart it with '${gO} stop && ${gO} serve'.
`),null;return`${z}?nonce=${w.nonce}`}async function q_w(){let O=Ox();if(!O||!await XN(O)){if(O)FZ();return process.stderr.write(`No daemon running. Start one with \`${gO} serve\`.
`),4}let z=await y_w(O);if(!z)return 1;if(process.stdout.write(z+`
`),O.sock)process.stderr.write(`(single-use, expires in 3 min \u2014 run again for another)
`);return 0}async function $uO(){let O=Ox();if(!O||!await XN(O)){if(O)FZ();return process.stderr.write(`No daemon running. Start one with \`${gO} serve\`.
`),4}let z=await y_w(O);if(!z)return 1;process.stderr.write(`Opening ${z}
`);try{return await Aq_(z),0}catch(w){return process.stderr.write(`Could not launch browser (${String(w)}). URL printed above.
`),4}}async function Z_w(){let O=Ox();if(!O&&ZI_()){process.stderr.write(`Daemon is booting; waiting...
`);let G=Date.now();while(!O&&Date.now()-G<5000)await new Promise((x)=>setTimeout(x,200)),O=Ox()}if(!O)return process.stderr.write(`No daemon running (no lockfile).
`),0;if(!await XN(O))return process.stderr.write(`Stale lockfile (pid ${O.pid} not serving on :${O.port}). Cleaning up.
`),FZ(),0;try{let G=await fetch(`http://127.0.0.1:${O.port}/daemon/frames`,{headers:FuO(await LuO(O)),signal:AbortSignal.timeout(2000)}),{frames:x}=await G.json();if(x.length>0)process.stderr.write(`Warning: ${x.length} session(s) are still running and will be cut off (they'll show as failed on the next start).
`)}catch{}let z=!1;try{let G=await fetch(`http://127.0.0.1:${O.port}/daemon/shutdown`,{method:"POST",headers:FuO(await LuO(O)),signal:AbortSignal.timeout(3000)});if(!G.ok)throw Error(`shutdown ${G.status}`)}catch{if(z=VI_(O.pid,"SIGTERM")==="refused",z)process.stderr.write(`Not killing pid ${O.pid} \u2014 it doesn't look like a Claude Science daemon (stale lockfile?).
`)}let w=Date.now();while(B1(O.pid)&&Date.now()-w<5000)await new Promise((G)=>setTimeout(G,100));if(B1(O.pid))z=VI_(O.pid,"SIGKILL")==="refused";if(Ox()?.pid===O.pid)FZ();return process.stderr.write(z?`Removed stale lockfile (pid ${O.pid} was not a Claude Science daemon; nothing killed).
`:`Daemon stopped (pid ${O.pid}).
`),0}async function X_w(){let O=Ox();if(!O)return process.stdout.write(JSON.stringify({running:!1})+`
`),0;let z=await XN(O);if(!z)FZ();let w=null;if(z)try{w=await(await fetch(`http://127.0.0.1:${O.port}/daemon/status`,{headers:FuO(await LuO(O)),signal:AbortSignal.timeout(2000)})).json()}catch{}if(w){let{pid:W,version:G,port:x,started_at:Y,...K}=w;w=K}return process.stdout.write(JSON.stringify({running:z,pid:O.pid,version:O.version,port:O.port,started_at:O.started_at,health:w},null,2)+`
`),0}async function Q_w(O){let z=O.includes("--tail"),w=Nq.existsSync(nf_())?Nq.readdirSync(nf_()).filter((K)=>K.startsWith("server-")).sort():[];if(w.length===0)return process.stderr.write(`No log files in ${nf_()}.
`),0;let W=juO.join(nf_(),w[w.length-1]);if(!z)return process.stdout.write(Nq.readFileSync(W,"utf-8")),0;process.stderr.write(`Tailing ${W} (Ctrl-C to stop)...
`);let G=Nq.statSync(W).size,x=()=>{let K=Nq.statSync(W).size;if(K>G){let y=Nq.openSync(W,"r"),q=Buffer.alloc(K-G);Nq.readSync(y,q,0,q.length,G),Nq.closeSync(y),process.stdout.write(q),G=K}};x();let Y=setInterval(x,500);return await new Promise((K)=>{process.on("SIGINT",()=>{clearInterval(Y),K()})}),0}