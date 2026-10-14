var Qu_=S(()=>{st();Xu_();EA();/*!
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
 */P_w=/^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/,b_w=/^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/,f_w=/^[+-]?0[0-9_]/,u_w=/^[0-9a-f]{2,8}$/i,uuO={b:"\b",t:"\t",n:`
`,f:"\f",r:"\r",e:"\x1B",'"':'"',"\\":"\\"}});function m_w(O,z,w){let W=O.slice(z,w),G=W.indexOf("#");if(G>-1)Af(O,G),W=W.slice(0,G);return[W.trimEnd(),G]}function at(O,z,w,W,G){if(W===0)throw new iw("document contains excessively nested structures. aborting.",{toml:O,ptr:z});let x=O[z];if(x==="["||x==="{"){let[y,q]=x==="["?luO(O,z,W,G):cuO(O,z,W,G);if(w){if(q=hZ(O,q),O[q]===",")q++;else if(O[q]!==w)throw new iw("expected comma or end of structure",{toml:O,ptr:q})}return[y,q]}let Y;if(x==='"'||x==="'"){Y=WZ_(O,z);let y=GZ_(O,z,Y);if(w){if(Y=hZ(O,Y),O[Y]&&O[Y]!==","&&O[Y]!==w&&O[Y]!==`
`&&O[Y]!=="\r")throw new iw("unexpected character encountered",{toml:O,ptr:Y});Y+=+(O[Y]===",")}return[y,Y]}Y=fuO(O,z,",",w);let K=m_w(O,z,Y-+(O[Y-1]===","));if(!K[0])throw new iw("incomplete key-value declaration: no value specified",{toml:O,ptr:z});if(w&&K[1]>-1)Y=hZ(O,z+K[1]),Y+=+(O[Y]===",");return[muO(K[0],O,z,G),Y]}