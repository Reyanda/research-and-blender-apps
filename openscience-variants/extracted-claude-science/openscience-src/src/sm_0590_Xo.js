var JK=S(()=>{Dz();Hz();oW()});import{Worker as Xfw}from"worker_threads";function Xo(O,z="i"){if(O.length>RG_)throw Error(`regex pattern too long (${O.length} > ${RG_} chars)`);if(/[gy]/.test(z))throw Error("stateful regex flags (g/y) are not supported by createSafeMatcher");try{new RegExp(O,z)}catch(V){throw Error(`invalid regex pattern: ${V instanceof Error?V.message:V}`)}let w=0,W=0,G=0,x=null,Y=0,K=!1,y,q=new Map,Z=(V)=>{if(x)return;x=V;for(let N of q.values())N({id:-1,err:V.message});q.clear(),y.terminate()},X=()=>{let V=++Y,N=new Xfw(Jfw,{eval:!0,workerData:{pattern:O,flags:z}});return N.unref(),N.on("message",(M)=>{if(V!==Y)return;let U=q.get(M.id);if(U)q.delete(M.id),U(M)}),N.on("error",(M)=>{if(V!==Y)return;Z(M instanceof Error?M:Error(String(M)))}),N.on("exit",(M)=>{if(V!==Y)return;if(!x)Z(Error(`regex worker exited unexpectedly (code ${M})`))}),N};y=X();async function Q(V,N){if(x)throw x;if(W>=FNz||G>=Nfw)throw Z(new DG_(FNz)),x;let M=w++,U=K?vNz:vNz+Ufw,k=await new Promise((J)=>{q.set(M,J);let C=setTimeout(()=>{if(q.delete(M))J("timeout")},U);y.postMessage({id:M,t:V,s:N});let g=q.get(M);q.set(M,(F)=>{clearTimeout(C),g(F)})});if(k==="timeout"){let J=y;if(y=X(),K=!1,J.terminate(),W+=U,G++,V==="tm")return N.map(()=>!1);return V==="e"?null:!1}if("err"in k)throw Error(k.err);return K=!0,W+=Math.max(k.ms,Mfw),k.r}return{async exec(V){let N=await Q("e",V);return N?{index:N[0],length:N[1]}:null},async test(V){return await Q("t",V)},async testMany(V){return await Q("tm",V)},get skipped(){return G},dispose(){if(!x)x=Error("disposed"),y.terminate()}}}var RG_=256,Qfw=200,Vfw=1000,Nfw=20,Mfw=0.04,kfw=5000,vNz,FNz,Ufw,DG_,Jfw=`
"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");
const re = new RegExp(workerData.pattern, workerData.flags);
parentPort.on("message", (m) => {
  const t0 = performance.now();
  try {
    if (m.t === "e") {
      const r = re.exec(m.s);
      parentPort.postMessage({ id: m.id, r: r ? [r.index, r[0].length] : null, ms: performance.now() - t0 });
    } else if (m.t === "tm") {
      parentPort.postMessage({ id: m.id, r: m.s.map((x) => re.test(x)), ms: performance.now() - t0 });
    } else {
      parentPort.postMessage({ id: m.id, r: re.test(m.s), ms: performance.now() - t0 });
    }
  } catch (e) {
    parentPort.postMessage({ id: m.id, err: String(e) });
  }
});
`;