var M0_=S(()=>{uu=class uu extends Error{constructor(O){let z=typeof O==="string"?O:O.map((w)=>{if(w.type==="text")return w.text;return`[${w.type}]`}).join(" ");super(z);this.name="ToolError",this.content=O}}});var DoO=1e5,ToO=`You have been working on the task described above but have not yet completed it. Write a continuation summary that will allow you (or another instance of yourself) to resume work efficiently in a future context window where the conversation history will be replaced with this summary. Your summary should be structured, concise, and actionable. Include:
1. Task Overview
The user's core request and success criteria
Any clarifications or constraints they specified
2. Current State
What has been completed so far
Files created, modified, or analyzed (with paths if relevant)
Key outputs or artifacts produced
3. Important Discoveries
Technical constraints or requirements uncovered
Decisions made and their rationale
Errors encountered and how they were resolved
What approaches were tried that didn't work (and why)
4. Next Steps
Specific actions needed to complete the task
Any blockers or open questions to resolve
Priority order if multiple steps remain
5. Context to Preserve
User preferences or style requirements
Domain-specific details that aren't obvious
Any promises made to the user
Be concise but complete\u2014err on the side of including information that would prevent duplicate work or repeated mistakes. Write in a way that enables immediate resumption of the task.
Wrap your summary in <summary></summary> tags.`;function PoO(){let O,z;return{promise:new Promise((W,G)=>{O=W,z=G}),resolve:O,reject:z}}async function pWw(O,z=O.messages.at(-1)){if(!z||z.role!=="assistant"||!z.content||typeof z.content==="string")return null;let w=z.content.filter((G)=>G.type==="tool_use");if(w.length===0)return null;return{role:"user",content:await Promise.all(w.map(async(G)=>{let x=O.tools.find((Y)=>("name"in Y?Y.name:Y.mcp_server_name)===G.name);if(!x||!("run"in x))return{type:"tool_result",tool_use_id:G.id,content:`Error: Tool '${G.name}' not found`,is_error:!0};try{let Y=G.input;if("parse"in x&&x.parse)Y=x.parse(Y);let K=await x.run(Y);return{type:"tool_result",tool_use_id:G.id,content:K}}catch(Y){return{type:"tool_result",tool_use_id:G.id,content:Y instanceof uu?Y.content:`Error: ${Y instanceof Error?Y.message:String(Y)}`,is_error:!0}}}))}}var R__,mu,VB,C8,D__,_X,dJ,ZL,T__,hoO,$l_,h__;