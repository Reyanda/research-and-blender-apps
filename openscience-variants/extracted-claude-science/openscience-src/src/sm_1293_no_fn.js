var c07=S(()=>{YP();Gs();GP();CU();rn();znW=W_(zLO(),1),wnW=W_(dn(),1),WnW=W_(i8_(),1);/*!
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
 */GnW=KN(),gLO={UPLOAD_MANY:"tm.upload_many",DOWNLOAD_MANY:"tm.download_many",UPLOAD_SHARDED:"tm.upload_sharded",DOWNLOAD_SHARDED:"tm.download_sharded"};eiW=new WeakSet,_nW=function(z={}){let w=!1,W=!1;for(let[G,x]of Object.entries(z))if(G.toLocaleLowerCase().trim()==="x-goog-api-client"){if(w=!0,!x.includes(gLO.UPLOAD_SHARDED))z[G]=`${x} gccl-gcs-cmd/${gLO.UPLOAD_SHARDED}`}else if(G.toLocaleLowerCase().trim()==="user-agent")W=!0;if(!w)z["x-goog-api-client"]=`${UU()} gccl/${GnW.version} gccl-gcs-cmd/${gLO.UPLOAD_SHARDED}`;if(!W)z["User-Agent"]=JU();return z},OnW=function(z,w){if(this.bucket.storage.retryOptions.autoRetry&&this.bucket.storage.retryOptions.retryableErrorFn(z))throw z;else w(z)}});