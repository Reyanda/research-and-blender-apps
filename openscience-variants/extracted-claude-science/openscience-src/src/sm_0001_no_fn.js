var EA=S(()=>{/*!
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
 */iw=class iw extends Error{line;column;codeblock;constructor(O,z){let[w,W]=R_w(z.toml,z.ptr),G=D_w(z.toml,w,W);super(`Invalid TOML document: ${O}

${G}`,z);this.line=w,this.column=W,this.codeblock=G}}});function T_w(O,z){let w=0;while(O[z-++w]==="\\");return--w&&w%2}function wZ_(O,z=0,w=O.length){let W=O.indexOf(`
`,z);if(O[W-1]==="\r")W--;return W<=w?W:-1}function Af(O,z){for(let w=z;w<O.length;w++){let W=O[w];if(W===`
`)return w;if(W==="\r"&&O[w+1]===`
`)return w+1;if(W<" "&&W!=="\t"||W==="\x7F")throw new iw("control characters are not allowed in comments",{toml:O,ptr:z})}return O.length}function hZ(O,z,w,W){let G;while(!0){while((G=O[z])===" "||G==="\t"||!w&&(G===`
`||G==="\r"&&O[z+1]===`
`))z++;if(W||G!=="#")break;z=Af(O,z)}return z}function fuO(O,z,w,W,G=!1){if(!W)return z=wZ_(O,z),z<0?O.length:z;for(let x=z;x<O.length;x++){let Y=O[x];if(Y==="#")x=wZ_(O,x);else if(Y===w)return x+1;else if(Y===W||G&&(Y===`
`||Y==="\r"&&O[x+1]===`
`))return x}throw new iw("cannot find end of structure",{toml:O,ptr:z})}function WZ_(O,z){let w=O[z],W=w===O[z+1]&&O[z+1]===O[z+2]?O.slice(z,z+3):w;z+=W.length-1;do z=O.indexOf(W,++z);while(z>-1&&w!=="'"&&T_w(O,z));if(z>-1){if(z+=W.length,W.length>1){if(O[z]===w)z++;if(O[z]===w)z++}}return z}