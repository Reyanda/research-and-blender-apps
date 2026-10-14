var yD=S(()=>{iO();w$();Nk();p6();LX();Uo();CC_();Jk();gC_();p2z((O)=>q9.getInstance().bumpDiskScan(O))});async function XJz(O,z,w){try{if(/["<>\n\r]/.test(O))return z;let W=GC(),G=(y)=>!y||!W||y===W,x=fV().filter((y)=>y.config.skillName===O&&(!y.config.hosted||y.config.managedFamily)&&G(y.config.registeredBy));if(x.length===0)return z;let Y=w?new v9(w):void 0,K=[];for(let{slug:y,config:q}of x){let Z;if(q.hosted)Z="(remote)";else{let X=await Y?.get(y);if(!X||X.state==="failed")continue;if(!G(X.registeredBy))continue;Z=X.state==="live"?"(local \u2014 live)":"(local \u2014 starts on demand)"}K.push(`<usage_details skill="${O}">
Endpoint "${y}" ${Z} is registered against this skill.
To dispatch to it, load the using-model-endpoint skill first.
</usage_details>`)}if(K.length===0)return z;return`${K.join(`
`)}

${z}`}catch{return z}}