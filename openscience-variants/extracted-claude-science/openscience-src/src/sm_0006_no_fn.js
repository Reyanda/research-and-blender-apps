var Nu_=S(()=>{Qu_();Vu_();st();EA();/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */c_w=/^[a-zA-Z0-9-_]+[ \t]*$/});function puO(O,z,w,W){let G=z,x=w,Y,K=!1,y;for(let q=0;q<O.length;q++){if(q){if(G=K?G[Y]:G[Y]={},x=(y=x[Y]).c,W===0&&(y.t===1||y.t===2))return null;if(y.t===2){let Z=G.length-1;G=G[Z],x=x[Z].c}}if(Y=O[q],(K=Object.hasOwn(G,Y))&&x[Y]?.t===0&&x[Y]?.d)return null;if(!K){if(Y==="__proto__")Object.defineProperty(G,Y,{enumerable:!0,configurable:!0,writable:!0}),Object.defineProperty(x,Y,{enumerable:!0,configurable:!0,writable:!0});x[Y]={t:q<O.length-1&&W===2?3:W,d:!1,i:0,c:{}}}}if(y=x[Y],y.t!==W&&!(W===1&&y.t===3))return null;if(W===2){if(!y.d)y.d=!0,G[Y]=[];G[Y].push(G={}),y.c[y.i++]=y={t:1,d:!1,i:0,c:{}}}if(y.d)return null;if(y.d=!0,W===1)G=K?G[Y]:G[Y]={};else if(W===0&&K)return null;return[Y,G,y.c]}function rt(O,{maxDepth:z=1000,integersAsBigInt:w}={}){let W={},G={},x=W,Y=G;for(let K=hZ(O,0);K<O.length;){if(O[K]==="["){let y=O[++K]==="[",q=xZ_(O,K+=+y,"]");if(y){if(O[q[1]-1]!=="]")throw new iw("expected end of table declaration",{toml:O,ptr:q[1]-1});q[1]++}let Z=puO(q[0],W,G,y?2:1);if(!Z)throw new iw("trying to redefine an already defined table or value",{toml:O,ptr:K});Y=Z[2],x=Z[1],K=q[1]}else{let y=xZ_(O,K),q=puO(y[0],x,Y,0);if(!q)throw new iw("trying to redefine an already defined table or value",{toml:O,ptr:K});let Z=at(O,y[1],void 0,z,w);q[1][q[0]]=Z[0],K=Z[1]}if(K=hZ(O,K,!0),O[K]&&O[K]!==`
`&&O[K]!=="\r")throw new iw("each key-value declaration must be followed by an end-of-line",{toml:O,ptr:K});K=hZ(O,K)}return W}