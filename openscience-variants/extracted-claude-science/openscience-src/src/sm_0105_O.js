var w3=S(()=>{Dz();T0();zB();xG();u1();Hz();se=(()=>{let O=Number(process.env.OPERON_MSG_JSON_ROW_CAP_BYTES);return Number.isFinite(O)&&O>0?O:2000000})(),NpO=i.raw(Tww);ae=(()=>{let O=Number(process.env.OPERON_FRAME_BLOB_CAP_BYTES);return Number.isFinite(O)&&O>0?O:2000000})();wL=(()=>{let{contextData:O,inputData:z,outputData:w,...W}=HJ(b);return W})(),JpO=vc_,hww={id:b.id,parentFrameId:b.parentFrameId,agentName:b.agentName,delegateName:b.delegateName,status:b.status,projectId:b.projectId,conversationType:b.conversationType,name:b.name,taskSummary:b.taskSummary,statusDescription:b.statusDescription,mentionedArtifactIds:b.mentionedArtifactIds,specialistsUsed:b.specialistsUsed,isHidden:b.isHidden},Sc_=new Set});import{createHash as vpO,randomUUID as FpO}from"crypto";async function LpO(O,z,w){let W=new NO(O),G=await O.selectDistinct({frameId:hx.frameId}).from(hx),x=0;for(let{frameId:Y}of G){if(w?.isActive(Y))continue;try{if(await WB(W,O,Y))x++}catch(K){(z??console).warn({err:K,frameId:Y},"[splice-era heal] per-frame failed \u2014 skipping")}}if(x>0)(z??console).info(`[splice-era heal] stitched ${x}/${G.length} frame(s) with compaction_archives back into frame_messages`);return{scanned:G.length,healed:x}}async function WB(O,z,w,W){let x=(await O.getFrameMessagesRange(w,0,1))[0];if(!x||!x._compact_boundary||x._compact_from_uuid)return!1;let Y=await O.getCompactionArchives(w);if(Y.length===0)return!1;if(Z8()&&!AJ(w)){let k=await z.all(i`SELECT json_array_length(context_data, '$._messages') AS n
          FROM frames
          WHERE id = ${w}
            AND context_data IS NOT NULL
            AND json_valid(context_data)
            AND json_type(context_data, '$._messages') = 'array'`);if((k.length?Number(Array.isArray(k[0])?k[0][0]:k[0].n):0)>0)return!1}let K=await O.getFrameMessages(w)??[],y=vpO("sha256").update(JSON.stringify(K)).digest("hex"),q=[];{let k=new Set;for(let J=!0,C=0;J&&C<=K.length;C++){J=!1;let g=new Set;for(let F=0;F<K.length;F++){let L=K[F]._uuid;if(L&&!k.has(F))g.add(L)}for(let F=0;F<K.length;F++){let L=K[F]._rolling_summary;if(!L||k.has(F))continue;let j=L.from_uuid;if(!j||!g.has(j))k.add(F),J=!0}}if(k.size>0){q.push(...[...k].sort((J,C)=>J-C));for(let J=q.length-1;J>=0;J--)K.splice(q[J],1)}}let Z=[];for(let k=0;k<Y.length;k++){let J=Y[k].messages??[],C=J[0]?._compact_boundary?1:0;for(let g=C;g<J.length;g++){let F=J[g];if(!F._uuid)F._uuid=FpO();Z.push(F)}}if(Z.length===0)return!1;let X=Z[0]._uuid,Q=Z[Z.length-1]._uuid,V=Z.length,N=(k)=>V+k-q.filter((J)=>J<k).length;for(let k=0;k<K.length;k++){let J=K[k];if(k===0&&J._compact_boundary&&!J._compact_from_uuid)J._compact_from_uuid=X,J._compact_to_uuid=Q;if(!J._uuid)J._uuid=FpO();Z.push(J)}let M=iZ(Z),U=await z.transaction(async(k)=>{let[J]=await k.select({status:b.status,lem:b.lastExtractMsgIdx,ckpt:i`json_extract(${b.contextData}, '$._last_checkpoint_idx')`,bkmk:i`json_extract(${b.contextData}, '$._last_bookmark_idx')`,goalIdx:i`json_extract(${b.contextData}, '$._goal_last_denial_msg_idx')`,pendingN:i`json_array_length(${b.contextData}, '$._pending_input_requests')`,legacyParkN:i`(json_type(${b.contextData}, '$._ask_user_payload') IS NOT NULL) + (json_type(${b.contextData}, '$._pending_access_request') IS NOT NULL)`,planKeyN:i`(json_type(${b.contextData}, '$._plan_artifact_id') IS NOT NULL) + (json_type(${b.contextData}, '$._plan_json') IS NOT NULL) + (json_type(${b.contextData}, '$._plan_steps') IS NOT NULL)`}).from(b).where(u(b.id,w));if(!W?.skipStatusGuard){let A=(J?.pendingN??0)>0||(J?.legacyParkN??0)>0,E=Pww.has(String(J?.status))&&(J?.planKeyN??0)===0,B=J?.status==="awaiting_user_response"&&!A;if(!E&&!B)return!1}let g=(await new NO(k).getFrameMessagesRange(w,0,1))[0];if(!g||!g._compact_boundary||g._compact_from_uuid)return!1;let F=await new NO(k).getFrameMessages(w)??[];if(vpO("sha256").update(JSON.stringify(F)).digest("hex")!==y)return!1;await O.writeFrameMessagesDelta(w,0,Z,k);let j=J?.ckpt!=null?i`, '$._last_checkpoint_idx', ${N(J.ckpt)}`:i``,$=J?.bkmk!=null?i`, '$._last_bookmark_idx', ${N(J.bkmk)}`:i``,H=J?.goalIdx!=null?i`, '$._goal_last_denial_msg_idx', ${N(J.goalIdx)}`:i``;await k.run(i`
      UPDATE frames
      SET
        context_data = json_set(
          json_remove(
            COALESCE(context_data, '{}'),
            '$._checkpoint_inflight_start',
            '$._checkpoint_rewinds'
          ),
          '$._message_count',      ${M._message_count},
          '$._user_message_count', ${M._user_message_count},
          '$._latest_tool_block',  json(${JSON.stringify(M._latest_tool_block)}),
          '$._context_used',       json(${JSON.stringify(M._context_used)})
          ${j}
          ${$}
          ${H}
        ),
        last_extract_msg_idx = ${J?.lem!=null?N(J.lem):null}
      WHERE id = ${w}
    `),await k.run(i`
      UPDATE notes
      SET target_message_index = target_message_index + ${V}
      WHERE target_frame_id = ${w} AND target_message_index IS NOT NULL
    `);for(let A=0;A<q.length;A++){let E=V+q[A]-A;await k.run(i`
        UPDATE notes
        SET target_message_index = target_message_index - 1
        WHERE target_frame_id = ${w}
          AND target_message_index > ${E}
      `)}return!0});if(U)nY(w);return U}var Pww;