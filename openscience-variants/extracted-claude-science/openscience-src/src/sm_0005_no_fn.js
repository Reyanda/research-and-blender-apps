var Vu_=S(()=>{Qu_();Nu_();st();EA();/*!
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
 */});function xZ_(O,z,w="="){let W=z-1,G=[],x=O.indexOf(w,z);if(x<0)throw new iw("incomplete key-value: cannot find end of key",{toml:O,ptr:z});do{let Y=O[z=++W];if(Y!==" "&&Y!=="\t")if(Y==='"'||Y==="'"){if(Y===O[z+1]&&Y===O[z+2])throw new iw("multiline strings are not allowed in keys",{toml:O,ptr:z});let K=WZ_(O,z);if(K<0)throw new iw("unfinished string encountered",{toml:O,ptr:z});W=O.indexOf(".",K);let y=O.slice(K,W<0||W>x?x:W),q=wZ_(y);if(q>-1)throw new iw("newlines are not allowed in keys",{toml:O,ptr:z+W+q});if(y.trimStart())throw new iw("found extra tokens after the string part",{toml:O,ptr:K});if(x<K){if(x=O.indexOf(w,K),x<0)throw new iw("incomplete key-value: cannot find end of key",{toml:O,ptr:z})}G.push(GZ_(O,z,K))}else{W=O.indexOf(".",z);let K=O.slice(z,W<0||W>x?x:W);if(!c_w.test(K))throw new iw("only letter, numbers, dashes and underscores are allowed in keys",{toml:O,ptr:z});G.push(K.trimEnd())}}while(W+1&&W<x);return[G,hZ(O,x+1,!0,!0)]}function cuO(O,z,w,W){let G={},x=new Set,Y;z++;while((Y=O[z++])!=="}"&&Y)if(Y===",")throw new iw("expected value, found comma",{toml:O,ptr:z-1});else if(Y==="#")z=Af(O,z);else if(Y!==" "&&Y!=="\t"&&Y!==`
`&&Y!=="\r"){let K,y=G,q=!1,[Z,X]=xZ_(O,z-1);for(let N=0;N<Z.length;N++){if(N)y=q?y[K]:y[K]={};if(K=Z[N],(q=Object.hasOwn(y,K))&&(typeof y[K]!=="object"||x.has(y[K])))throw new iw("trying to redefine an already defined value",{toml:O,ptr:z});if(!q&&K==="__proto__")Object.defineProperty(y,K,{enumerable:!0,configurable:!0,writable:!0})}if(q)throw new iw("trying to redefine an already defined value",{toml:O,ptr:z});let[Q,V]=at(O,X,"}",w-1,W);x.add(Q),y[K]=Q,z=V}if(!Y)throw new iw("unfinished table encountered",{toml:O,ptr:z});return[G,z]}function luO(O,z,w,W){let G=[],x;z++;while((x=O[z++])!=="]"&&x)if(x===",")throw new iw("expected value, found comma",{toml:O,ptr:z-1});else if(x==="#")z=Af(O,z);else if(x!==" "&&x!=="\t"&&x!==`
`&&x!=="\r"){let Y=at(O,z-1,"]",w-1,W);G.push(Y[0]),z=Y[1]}if(!x)throw new iw("unfinished array encountered",{toml:O,ptr:z});return[G,z]}var c_w;