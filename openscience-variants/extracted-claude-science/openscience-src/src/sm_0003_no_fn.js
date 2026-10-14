var Xu_=S(()=>{/*!
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
 */h_w=/^(\d{4}-\d{2}-\d{2})?[T ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|[-+]\d{2}:\d{2})?$/i;PF=class PF extends Date{#_=!1;#O=!1;#z=null;constructor(O){let z=!0,w=!0,W="Z";if(typeof O==="string"){let G=O.match(h_w);if(G){if(!G[1])z=!1,O=`0000-01-01T${O}`;if(w=!!G[2],w&&O[10]===" "&&(O=O.replace(" ","T")),G[2]&&+G[2]>23)O="";else if(W=G[3]||null,O=O.toUpperCase(),!W&&w)O+="Z"}else O=""}super(O);if(!isNaN(this.getTime()))this.#_=z,this.#O=w,this.#z=W}isDateTime(){return this.#_&&this.#O}isLocal(){return!this.#_||!this.#O||!this.#z}isDate(){return this.#_&&!this.#O}isTime(){return this.#O&&!this.#_}isValid(){return this.#_||this.#O}toISOString(){let O=super.toISOString();if(this.isDate())return O.slice(0,10);if(this.isTime())return O.slice(11,23);if(this.#z===null)return O.slice(0,-1);if(this.#z==="Z")return O;let z=+this.#z.slice(1,3)*60+ +this.#z.slice(4,6);return z=this.#z[0]==="-"?z:-z,new Date(this.getTime()-z*60000).toISOString().slice(0,-1)+this.#z}static wrapAsOffsetDateTime(O,z="Z"){let w=new PF(O);return w.#z=z,w}static wrapAsLocalDateTime(O){let z=new PF(O);return z.#z=null,z}static wrapAsLocalDate(O){let z=new PF(O);return z.#O=!1,z.#z=null,z}static wrapAsLocalTime(O){let z=new PF(O);return z.#_=!1,z.#z=null,z}}});function GZ_(O,z=0,w=O.length){let W=O[z]==="'",G=O[z++]===O[z]&&O[z]===O[z+1];if(G){if(w-=2,O[z+=2]==="\r")z++;if(O[z]===`
`)z++}let x=0,Y,K="",y=z;while(z<w-1){let q=O[z++];if(q===`
`||q==="\r"&&O[z]===`
`){if(!G)throw new iw("newlines are not allowed in strings",{toml:O,ptr:z-1})}else if(q<" "&&q!=="\t"||q==="\x7F")throw new iw("control characters are not allowed in strings",{toml:O,ptr:z-1});if(Y){if(Y=!1,q==="x"||q==="u"||q==="U"){let Z=O.slice(z,z+=q==="x"?2:q==="u"?4:8);if(!u_w.test(Z))throw new iw("invalid unicode escape",{toml:O,ptr:x});try{K+=String.fromCodePoint(parseInt(Z,16))}catch{throw new iw("invalid unicode escape",{toml:O,ptr:x})}}else if(G&&(q===`
`||q===" "||q==="\t"||q==="\r")){if(z=hZ(O,z-1,!0),O[z]!==`
`&&O[z]!=="\r")throw new iw("invalid escape: only line-ending whitespace may be escaped",{toml:O,ptr:x});z=hZ(O,z)}else if(q in uuO)K+=uuO[q];else throw new iw("unrecognized escape sequence",{toml:O,ptr:x});y=z}else if(!W&&q==="\\")x=z-1,Y=!0,K+=O.slice(y,x)}return K+O.slice(y,w-1)}function muO(O,z,w,W){if(O==="true")return!0;if(O==="false")return!1;if(O==="-inf")return-1/0;if(O==="inf"||O==="+inf")return 1/0;if(O==="nan"||O==="+nan"||O==="-nan")return NaN;if(O==="-0")return W?0n:0;let G=P_w.test(O);if(G||b_w.test(O)){if(f_w.test(O))throw new iw("leading zeroes are not allowed",{toml:z,ptr:w});O=O.replace(/_/g,"");let Y=+O;if(isNaN(Y))throw new iw("invalid number",{toml:z,ptr:w});if(G){if((G=!Number.isSafeInteger(Y))&&!W)throw new iw("integer value cannot be represented losslessly",{toml:z,ptr:w});if(G||W===!0)Y=BigInt(O)}return Y}let x=new PF(O);if(!x.isValid())throw new iw("invalid value",{toml:z,ptr:w});return x}var P_w,b_w,f_w,u_w,uuO;