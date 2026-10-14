var tFO=S(()=>{SA_();GP();CU();IX7=W_(dn(),1);/*!
 * Copyright 2022 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */});var vU=R((RX7)=>{Object.defineProperty(RX7,"__esModule",{value:!0});RX7.callbackifyAll=RX7.callbackify=RX7.promisifyAll=RX7.promisify=void 0;function GiW(O,z){if(O.promisified_)return O;z=z||{};let w=Array.prototype.slice,W=function(){let G;for(G=arguments.length-1;G>=0;G--){let K=arguments[G];if(typeof K>"u")continue;if(typeof K!=="function")break;return O.apply(this,arguments)}let x=w.call(arguments,0,G+1),Y=Promise;if(this&&this.Promise)Y=this.Promise;return new Y((K,y)=>{x.push((...q)=>{let Z=w.call(q),X=Z.shift();if(X)return y(X);if(z.singular&&Z.length===1)K(Z[0]);else K(Z)}),O.apply(this,x)})};return W.promisified_=!0,W}RX7.promisify=GiW;function xiW(O,z){let w=z&&z.exclude||[];Object.getOwnPropertyNames(O.prototype).filter((x)=>{return!w.includes(x)&&typeof O.prototype[x]==="function"&&!/(^_|(Stream|_)|promise$)|^constructor$/.test(x)}).forEach((x)=>{let Y=O.prototype[x];if(!Y.promisified_)O.prototype[x]=RX7.promisify(Y,z)})}RX7.promisifyAll=xiW;function YiW(O){if(O.callbackified_)return O;let z=function(){if(typeof arguments[arguments.length-1]!=="function")return O.apply(this,arguments);let w=Array.prototype.pop.call(arguments);O.apply(this,arguments).then((W)=>{W=Array.isArray(W)?W:[W],w(null,...W)},(W)=>w(W))};return z.callbackified_=!0,z}RX7.callbackify=YiW;function KiW(O,z){let w=z&&z.exclude||[];Object.getOwnPropertyNames(O.prototype).filter((x)=>{return!w.includes(x)&&typeof O.prototype[x]==="function"&&!/^_|(Stream|_)|^constructor$/.test(x)}).forEach((x)=>{let Y=O.prototype[x];if(!Y.callbackified_)O.prototype[x]=RX7.callbackify(Y)})}RX7.callbackifyAll=KiW});import{EventEmitter as qiW}from"events";var PX7,IY;