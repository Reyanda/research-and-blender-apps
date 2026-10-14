var RpO=S(()=>{Dz();PJ();T0();zB();Xu();w3();Hz();hX_();Hu=i`${b.contextData} IS NOT NULL AND octet_length(${b.contextData}) >= ${lww}`,te=i`NOT EXISTS (
  SELECT 1 FROM frame_backfill_poison p WHERE p.frame_id = ${b.id} AND p.terminal = 1
)`,SpO=i`json_valid(${b.contextData}) AND (
  json_type(${b.contextData}, '$._messages') = 'array'
  OR json_type(${b.contextData}, '$._system') IS NOT NULL
  OR (
    json_type(${b.contextData}, '$._branch_meta.branches') = 'object'
    AND EXISTS (
      SELECT 1 FROM json_each(${b.contextData}, '$._branch_meta.branches') b
      WHERE b.type = 'object' AND json_type(b.value, '$.messages') = 'array'
    )
  )
  OR (
    ${b.parentFrameId} IS NOT NULL
    AND json_type(${b.contextData}, '$._original_input') IS NOT NULL
    AND json_type(${b.contextData}, '$._oi_divergent') IS NULL
  )
)`,Ec_=i`${Hu} AND ${SpO}`,pww=i`${Ec_} AND ${te}`,oww=i`${Hu} AND CASE WHEN ${te} THEN ${SpO} ELSE 0 END`;EpO=i`json_valid(${b.contextData}) AND (
  json_type(${b.contextData}, '$._messages') = 'array'
  OR json_type(${b.contextData}, '$._system') IS NOT NULL
  OR (
    json_type(${b.contextData}, '$._branch_meta.branches') = 'object'
    AND EXISTS (
      SELECT 1 FROM json_each(${b.contextData}, '$._branch_meta.branches') b
      WHERE b.type = 'object' AND json_type(b.value, '$.messages') = 'array'
    )
  )
)`,dww=i`${Hu} AND ${EpO} AND ${te}`,iww=i`${Hu} AND CASE WHEN ${te} THEN ${EpO} ELSE 0 END`;PX_=class PX_ extends Error{frameId;nextCursor;constructor(O,z,w){super(O!=null?`corruption-shaped per-frame error on frame ${O} \u2014 escalated to the corruption monitor`:"corruption-shaped window-scan error \u2014 escalated to the corruption monitor",{cause:w});this.frameId=O;this.nextCursor=z;this.name="BackfillCorruptionEscalation"}}});async function eww(O){let z=Date.now(),w=new Date,W=new Date(w.getTime()-fX_.contentSnapshotGraceMs),G=()=>v_(Xy(wY.createdAt,W),i`${wY.hash} NOT IN (
        SELECT ${V_.lineageSnapshotHash} FROM ${V_}
          WHERE ${V_.lineageSnapshotHash} IS NOT NULL
        UNION
        SELECT ${V_.envSnapshotHash} FROM ${V_}
          WHERE ${V_.envSnapshotHash} IS NOT NULL
      )`),x=0;for(;;){let C=await O.select({hash:wY.hash}).from(wY).where(G()).limit(uX_);if(C.length===0)break;let g=await O.delete(wY).where(v_(GO(wY.hash,C.map((F)=>F.hash)),G())).returning({hash:wY.hash});if(x+=g.length,C.length<uX_)break}let Y=new Date(w.getTime()-fX_.computeUsageMaxAgeMs),K=await O.delete(s_).where(v_(MW(s_.endedAt),Xy(s_.endedAt,Y))).returning({id:s_.id}),y=new Date(w.getTime()-fX_.supersededMemoryMaxAgeMs),q=await O.select({id:JO.id,supersededBy:JO.supersededBy,updatedAt:JO.updatedAt}).from(JO).where(MW(JO.supersededBy)),Z=new Set(q.filter((C)=>C.updatedAt&&C.updatedAt.getTime()<y.getTime()).map((C)=>C.id)),X=!0;while(X){X=!1;for(let C of q)if(C.supersededBy&&Z.has(C.supersededBy)&&!Z.has(C.id))Z.delete(C.supersededBy),X=!0}let Q=new Map(q.map((C)=>[C.id,C])),V=new Map;for(let C of Z)V.set(C,0);for(let C of Z){let g=Q.get(C)?.supersededBy;if(g&&Z.has(g))V.set(g,(V.get(g)??0)+1)}let N=[...Z].filter((C)=>V.get(C)===0),M=[];while(N.length){let C=N.shift();M.push(C);let g=Q.get(C)?.supersededBy;if(g&&Z.has(g)){let F=(V.get(g)??1)-1;if(V.set(g,F),F===0)N.push(g)}}if(M.length<Z.size){let C=new Set(M);for(let g of Z)if(!C.has(g))M.push(g)}let U=M.length?await O.transaction(async(C)=>{let g=0;for(let F=0;F<M.length;F+=uX_){let L=M.slice(F,F+uX_),j=await C.delete(JO).where(GO(JO.id,L)).returning({id:JO.id});g+=j.length}return g}):0,k=w.getTime()-fX_.resolvedQueuedIntentMaxAgeMs,J=await O.delete(pW).where(v_(GO(pW.state,["drained","retracted"]),MW(pW.resolvedAt),Xy(pW.resolvedAt,k))).returning({seq:pW.seq});return{contentSnapshots:x,computeUsage:K.length,memories:U,queuedIntents:J.length,durationMs:Date.now()-z}}function DpO(O,z,w,W){let G=async()=>{if(W?.())return;try{let K=await eww(O),y=await w?.sweep_orphaned_artifacts()??0;if(K.contentSnapshots+K.computeUsage+K.memories+K.queuedIntents+y>0)z.info(`[gc] swept ${K.contentSnapshots} content_snapshots, ${K.computeUsage} compute_usage, ${K.memories} memories, ${K.queuedIntents} resolved queued intents, ${y} orphaned artifacts in ${K.durationMs}ms`)}catch(K){z.warn({err:K},"[gc] sweep failed")}};setTimeout(()=>void G(),tww).unref();let Y=setInterval(()=>void G(),rww);return Y.unref(),Y}var fX_,rww=86400000,tww=300000,uX_=200;