var bt7=S(()=>{R7();YP_();xpG=new Set(["port","addressfamily","batchmode","connecttimeout","connectionattempts","controlmaster","controlpersist","serveraliveinterval","serveralivecountmax","tcpkeepalive","compression","passwordauthentication","pubkeyauthentication","kbdinteractiveauthentication","gssapiauthentication","preferredauthentications","identitiesonly","stricthostkeychecking","loglevel","requesttty","kexalgorithms","hostkeyalgorithms","ciphers","macs"]),YpG=/^~\/\.ssh\/id_(rsa|dsa|ecdsa|ed25519)(_sk)?$/,ht7={proxyjump:(O)=>({set:!0,hops:O.join(",").split(",").length}),proxycommand:()=>({set:!0}),identityfile:(O)=>({count:O.length,non_default:O.some((z)=>!YpG.test(z))}),identityagent:(O)=>({count:O.length}),certificatefile:(O)=>({count:O.length}),localforward:(O)=>({count:O.length}),remoteforward:(O)=>({count:O.length}),dynamicforward:(O)=>({count:O.length}),setenv:(O)=>({count:O.length})}});var ot7={};uO(ot7,{startSandboxOriginServer:()=>VpG,registerSandboxProxyRoute:()=>Df_,isForbiddenSource:()=>mt7,createSandboxOriginServer:()=>pt7,buildSandboxProxyHtml:()=>lt7,buildCspHeader:()=>ct7,CDN_ORIGINS:()=>nfO});import XpG from"net";function mt7(O){if(O.length>1024)return!0;if(/[;,'"@%]/.test(O))return!0;if(O==="*")return!0;if(/^[a-z][a-z0-9+.-]*:$/i.test(O))return!0;let z=O.replace(/^[a-z][a-z0-9+.-]*:\/\//i,"").toLowerCase();z=z.split(/[/?#]/)[0]??"";let w=z.match(/^\[([^\]]*)\]/);if(z=w?w[1]:z.replace(/:[\d*]+$/,""),z.length>1&&z.endsWith("."))z=z.slice(0,-1);if(z===""||z==="*")return!0;if(z.startsWith("*."))z=z.slice(2);if(z==="")return!0;if(XpG.isIP(z)===6)return!0;let W=Xm(z)??z;if(/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d/.test(W))return!0;return J0(z)}function ft7(O){if(typeof O!=="string")return[];return O.split(/\s+/).map((z)=>z.trim()).filter((z)=>z.length>0&&QpG.has(z.toLowerCase())&&!mt7(z))}function ct7(O){let z=nfO.join(" "),w=[z,...ft7(O.resourceSrc)].join(" "),W=[z,...ft7(O.connectSrc)].join(" "),G=O.selfOrigin?"'self' ":"";return[`default-src ${O.selfOrigin?"'self'":"'none'"}`,`script-src ${G}'unsafe-inline' 'unsafe-eval' blob: data: ${w}`,`style-src ${G}'unsafe-inline' ${w}`,`img-src ${G}data: blob: ${w}`,`connect-src ${G}${W}`,`font-src ${G}data: ${w}`,`media-src ${G}blob: data: ${w}`,`worker-src ${G}blob:`,"frame-src 'none'","form-action 'none'",`base-uri ${O.selfOrigin?"'self'":"'none'"}`,"object-src 'none'",`frame-ancestors ${O.frameAncestors.join(" ")}`].join("; ")}function lt7(O,z=null){let w=(W)=>JSON.stringify(W).replace(/</g,"\\u003c");return`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="referrer" content="no-referrer" />
    <meta name="color-scheme" content="light dark" />
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>MCP-UI Proxy</title>
    <style>
      html, body { margin: 0; height: 100vh; width: 100vw; }
      body { display: flex; flex-direction: column; }
      * { box-sizing: border-box; }
      iframe { background-color: transparent; border: 0px none transparent; padding: 0px; overflow: hidden; flex-grow: 1; }
    </style>
  </head>
  <body>
    <script>
      const inner = document.createElement('iframe');
      inner.style = 'width:100%; height:100%; border:none;';
      inner.setAttribute('sandbox', 'allow-scripts allow-forms');
      document.body.appendChild(inner);

      let parentOrigin = '*';
      const ALLOWED_PARENT_ORIGINS = ${w(O)};
      const WILDCARD_RE_SOURCE = ${w(z)};
      const wildcardRe = WILDCARD_RE_SOURCE ? new RegExp(WILDCARD_RE_SOURCE, 'i') : null;

      const isAllowedOrigin = function(origin) {
        if (ALLOWED_PARENT_ORIGINS.indexOf(origin) !== -1) return true;
        return wildcardRe !== null && wildcardRe.test(origin);
      };

      const buildAllowAttribute = function(permissions) {
        if (!permissions || typeof permissions !== 'object') return '';
        const mapping = { camera: 'camera', microphone: 'microphone', geolocation: 'geolocation', clipboardWrite: 'clipboard-write' };
        return Object.keys(permissions)
          .filter(function(key) { return mapping[key] && permissions[key] != null; })
          .map(function(key) { return mapping[key] + ' *'; })
          .join('; ');
      };

      // Parent-supplied sandbox tokens are CLAMPED to an allowlist (alo-ant
      // C1, ic 4827683118): this bridge document runs same-origin with its
      // server (the daemon itself on the main-port /_sandbox mount), and the
      // parent-origin allowlist includes wildcard reverse-proxy patterns \u2014
      // i.e. sibling workspace origins. A hostile allowlisted parent posting
      // sandbox-resource-ready with a same-origin grant would make the inner
      // srcdoc share the BRIDGE's origin (\u2192 daemon cookies/secret on the
      // main-port mount). Per the MCP-apps contract, every origin this
      // daemon serves is a SHARED proxy origin \u2192 the inner iframe is always
      // opaque; same-origin / top-navigation / sandbox-escape tokens are
      // never forwardable here (the M52 test pins their absence from this
      // document verbatim).
      const SAFE_SANDBOX_TOKENS = ['allow-scripts', 'allow-forms', 'allow-popups', 'allow-modals', 'allow-downloads', 'allow-pointer-lock', 'allow-presentation'];
      const clampSandbox = function(value) {
        if (typeof value !== 'string') return 'allow-scripts allow-forms';
        // An explicitly tighter request (fewer tokens, even none) is honored.
        return value.split(/\\s+/).filter(function(t) {
          return SAFE_SANDBOX_TOKENS.indexOf(t.toLowerCase()) !== -1;
        }).join(' ');
      };

      const handleParentMessage = function(data, onHandshake) {
        if (data && data.method === 'ui/notifications/sandbox-resource-ready') {
          const html = data.params && data.params.html;
          const permissions = data.params && data.params.permissions;
          const sandbox = data.params && data.params.sandbox;
          if (typeof html === 'string') {
            if (onHandshake) onHandshake();
            const allowValue = buildAllowAttribute(permissions);
            // fullscreen's Permissions-Policy default is 'self'; once the
            // inner is opaque-origin (M52) it must be delegated explicitly.
            inner.setAttribute('allow', allowValue ? 'fullscreen *; ' + allowValue : 'fullscreen *');
            inner.setAttribute('sandbox', clampSandbox(sandbox));
            inner.srcdoc = html;
          }
        } else {
          if (inner && inner.contentWindow) {
            inner.contentWindow.postMessage(data, '*');
          }
        }
      };

      window.addEventListener('message', function(event) {
        if (event.source === window.parent && isAllowedOrigin(event.origin)) {
          handleParentMessage(event.data, function() { parentOrigin = event.origin; });
        } else if (event.source === inner.contentWindow) {
          window.parent.postMessage(event.data, parentOrigin);
        }
      });

      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'ui/notifications/sandbox-proxy-ready',
        params: {}
      }, '*');
    </script>
  </body>
</html>
`}function Df_(O,z,w,W){let G=null;O.get(`${z}/mcp_apps`,(x,Y)=>{let K=w.value;if(!K){Y.code(503).send("sandbox origin not ready");return}if(K.allowedHosts){let X=(x.headers["x-forwarded-host"]?.split(",").map((Q)=>Q.trim()).find((Q)=>Q!==""&&yt(Q))||x.headers.host||"").toLowerCase();if(!K.allowedHosts.some((Q)=>Q.toLowerCase()===X)){Y.code(404).send("not found");return}}if(G===null)G=lt7(K.exactOrigins,K.wildcardRegexSource);let y=x.query,q=ct7({resourceSrc:y["resource-src"],connectSrc:y["connect-src"],frameAncestors:K.frameAncestors,selfOrigin:W});Y.header("Content-Security-Policy",q).header("Referrer-Policy","no-referrer").header("Cross-Origin-Resource-Policy","cross-origin").type("text/html; charset=utf-8").send(G)})}function pt7(O){let z=ut7.default({logger:!1,forceCloseConnections:!0});return Df_(z,"",{value:O},!0),z}async function VpG(O,z){let w=pt7(z);try{await w.listen({host:"127.0.0.1",port:O})}catch(x){if(x.code==="EADDRINUSE")await w.listen({host:"127.0.0.1",port:0});else throw x}let W=w.server.address(),G=typeof W==="object"&&W?W.port:Number(String(W));return{app:w,origin:`http://localhost:${G}`}}var ut7,nfO,QpG;