var x$z=S(()=>{Rx();iO();sl();P39=v.object({every_minutes:v.number().int(),on_tick:v.string().min(1).max(2000),label:v.string().max(120).nullish()}),b39=v.object({had_work:v.boolean(),summary:v.string().max(500).default("")})});function Y$z(O,z){if(O.length===0)return null;let w=new Map(z.map((q)=>[q.name,q])),W=O.filter((q)=>w.has(q.name)),G=O.filter((q)=>!w.has(q.name));if(W.length===0){let q=G.length===1,Z=G.map((X)=>`\`${X.name}\``).join(", ");return{attachment:`[System] <skill_discovery signal="user_message" source="referenced" status="unavailable">
The user referenced ${q?"this skill":"these skills"} (${Z}), which ${q?"is":"are"} not available to this agent. Use \`search_skills\` to find an alternative, or proceed without ${q?"it":"them"}.
</skill_discovery>`,matched:[]}}let x=W.length===1,Y=W.map((q)=>`- ${OZ(q.name)} \u2014 ${OZ(q.description||w.get(q.name).description)}`),K=G.length>0?`
(Referenced but not available to this agent: ${G.map((q)=>`\`${q.name}\``).join(", ")}.)`:"";return{attachment:`[System] <skill_discovery signal="user_message" source="referenced">
The user referenced ${x?"this skill":"these skills"}. Load ${x?"it":"each"} with the \`skill\` tool before proceeding:
${Y.join(`
`)}${K}
</skill_discovery>`,matched:W.map((q)=>q.name)}}