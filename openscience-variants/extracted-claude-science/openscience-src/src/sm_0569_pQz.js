var rwO=S(()=>{N0z();P0z();HQz();AQz();iO();Cz();k2();qY();hQz();uQz=new Set});import{createHash as $Hw,randomBytes as cQz}from"crypto";function pQz(){let z=Date.now()-lQz*1000;for(let[w,W]of oW_)if(W.created_at<z)oW_.delete(w)}function oQz(O){let z=O;for(let w=0;z instanceof Error&&w<8;w++){if(z instanceof up)return!0;z=z.cause}return!1}async function lR(O){let z=O.replace(/\/$/,""),w=[`${z}/.well-known/oauth-authorization-server`,`${z}/.well-known/openid-configuration`],W=!1;for(let x of w){let Y;try{let K=await RG(x,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(30000)});if(W=!0,!K.ok)continue;if(Y=await K.json(),!Y.authorization_endpoint||!Y.token_endpoint)continue}catch{continue}return SHw(Y,O),Y}let G=`OAuth metadata discovery failed for ${O}`;throw W?new up(G):Error(G)}function TU_(O){return new URL(O).href.replace(/\/$/,"")}function SHw(O,z){if(process.env.OPERON_OAUTH_ALLOW_CROSS_ORIGIN_ENDPOINTS==="1"){console.warn("[oauth] OPERON_OAUTH_ALLOW_CROSS_ORIGIN_ENDPOINTS=1 \u2014 skipping "+`RFC 8414 / mix-up validation for ${z}. UNSAFE.`);return}let w=g$(z),W=(K)=>{throw new up(`OAuth metadata rejected for ${w.origin}: ${K}`)};if(typeof O.issuer!=="string"||!O.issuer)return W("missing issuer");let G;try{G=TU_(O.issuer)}catch{return W(`unparsable issuer ${JSON.stringify(O.issuer)}`)}if(G!==TU_(z))return W(`issuer ${JSON.stringify(O.issuer)} does not match authorization-server URL ${JSON.stringify(z)} (RFC 8414 \xA73.3)`);let x=(K,y)=>{if(y==null||y==="")return;if(typeof y!=="string")return W(`${K} is not a string`);let q;try{q=new URL(y)}catch{return W(`${K} is not a valid URL: ${JSON.stringify(y)}`)}if(q.protocol!=="https:")return W(`${K} must be https`);if(q.origin!==w.origin)return W(`${K} origin ${q.origin} \u2260 authorization-server origin `+`${w.origin} \u2014 cross-origin OAuth endpoints are blocked (M30)`)},Y=O;for(let K of["authorization_endpoint","token_endpoint","registration_endpoint","revocation_endpoint","introspection_endpoint"])x(K,Y[K])}function dQz(O,z){if(O==null||O==="")return null;if(process.env.OPERON_OAUTH_ALLOW_CROSS_ORIGIN_ENDPOINTS==="1")return null;try{if(typeof O==="string"&&TU_(O)===TU_(z))return null}catch{}return"Authorization server mismatch (iss)"}function iQz(){let O=cQz(32).toString("base64url"),z=$Hw("sha256").update(O).digest("base64url");return[O,z]}async function nQz(O,z,w=`${Lw} MCP Client`){let W=await RG(O,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({client_name:w,redirect_uris:[z],grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_method:"none"}),signal:AbortSignal.timeout(30000)});if(!W.ok)throw Error(`Client registration failed: ${W.status} ${await W.text()}`);return await W.json()}function sQz(O,z,w){pQz();let W=cQz(32).toString("base64url");return oW_.set(W,{mcp_server_id:O,user_id:z,code_verifier:w,created_at:Date.now()}),W}function aQz(O){pQz();let z=oW_.get(O);if(!z)return null;if(oW_.delete(O),z.created_at<Date.now()-lQz*1000)return null;return{mcp_server_id:z.mcp_server_id,user_id:z.user_id,code_verifier:z.code_verifier}}async function rQz(O,z,w,W,G,x){let Y=new URLSearchParams({grant_type:"authorization_code",code:z,code_verifier:w,client_id:W,redirect_uri:G});if(x)Y.set("resource",x);let K=await RG(O,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:Y,signal:AbortSignal.timeout(30000)});if(!K.ok)throw Error(`Token exchange failed: ${K.status} ${await K.text()}`);return await K.json()}function tQz(O,z,w,W,G,x,Y){let K;try{K=new URL(O).protocol}catch{throw Error(`OAuth authorization_endpoint is not a valid URL: ${O}`)}if(K!=="https:"&&K!=="http:")throw Error(`OAuth authorization_endpoint must be http(s), got ${K}`);let y=new URLSearchParams({response_type:"code",client_id:z,redirect_uri:w,state:W,code_challenge:G,code_challenge_method:"S256"});if(x&&x.length>0)y.set("scope",x.join(" "));if(Y)y.set("resource",Y);return`${O}?${y.toString()}`}function hU_(O){return String(O).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function O4z(O,z){return HHw.replaceAll("{{as_origin}}",()=>hU_(O)).replaceAll("{{authorize_url}}",()=>hU_(z))}var oW_,lQz=600,up,eQz=`<!DOCTYPE html>
<html>
<head><title>OAuth Success</title></head>
<body>
  <h1>Success!</h1>
  <p>You can close this window.</p>
  <script>
    if (window.opener) {
      // This page and the opener (the operon web app) are served from the
      // same daemon origin, so our own origin is the exact target \u2014 never
      // broadcast with '*': a popup opened by a different page on another
      // origin must not receive the server id.
      window.opener.postMessage({type: 'oauth-success', mcpServerId: '{{mcp_server_id}}'}, window.location.origin);
    }
    setTimeout(() => window.close(), 1000);
  </script>
</body>
</html>`,_4z=`<!DOCTYPE html>
<html>
<head><title>OAuth Error</title></head>
<body>
  <h1>Error</h1>
  <p>{{error_message}}</p>
  <p>You can close this window.</p>
</body>
</html>`,HHw=`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Authorize MCP server</title>
<style>body{font:14px system-ui;max-width:480px;margin:4em auto;padding:0 1em}
a.btn{display:inline-block;padding:.6em 1.2em;background:#2563eb;color:#fff;
text-decoration:none;border-radius:6px}code{background:#eee;padding:2px 6px;
border-radius:4px}</style></head><body>
<h2>Authorize connector</h2>
<p>You are about to sign in with <b><code>{{as_origin}}</code></b> to authorize
this MCP connector. If this origin is not what you expected, close this window.</p>
<p><a class="btn" rel="noopener noreferrer" href="{{authorize_url}}">Continue to {{as_origin}}</a></p>
</body></html>`;