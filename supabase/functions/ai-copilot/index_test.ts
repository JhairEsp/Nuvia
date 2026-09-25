// Aisladas: todas las peticiones interceptadas, sin Supabase ni Groq reales.
type Handler = (req: Request, info: Deno.ServeHandlerInfo) => Response | Promise<Response>;
let handler: Handler;
const serve = Deno.serve;
Deno.serve = ((fn: Handler) => { handler = fn; return {}; }) as typeof Deno.serve;
if(Deno.env.get("AI_TEST_ENTRYPOINT")==="dashboard")await import("../../dashboard/ai-copilot.ts");else await import("./index.ts"); Deno.serve = serve;
const bid = "b0000000-0000-0000-0000-000000000001";
const userId = "a0000000-0000-0000-0000-000000000001";
const assert = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type":"application/json" } });
async function exercise(options: { method?: string; invalidAuth?: boolean; denied?: boolean; missingSecret?: boolean; unknownTool?: boolean; toolDenied?: boolean; insights?: boolean; huggingface?:boolean; providerStatus?:number; fallback?:boolean; backupStatus?:number } = {}) {
 Deno.env.set("AI_FALLBACK_PROVIDER",options.fallback?"groq":"none");
 Deno.env.set("AI_PROVIDER",options.huggingface?"huggingface":"groq");Deno.env.delete("HF_TOKEN");if(options.huggingface&&!options.missingSecret)Deno.env.set("HF_TOKEN","hf-server-only");
 Deno.env.set("SUPABASE_URL", "https://unit.invalid"); Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
 if(options.missingSecret) Deno.env.delete("GROQ_API_KEY"); else Deno.env.set("GROQ_API_KEY", "server-secret-test");
 const original = globalThis.fetch; const calls: Array<{ path:string; host:string; body:any; authorization:string|null }> = []; let round=0;
 globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input,init); const url = new URL(req.url); const text = await req.text(); const body=text?JSON.parse(text):null;
  calls.push({path:url.pathname,host:url.hostname,body,authorization:req.headers.get("authorization")});
  if(url.pathname==="/auth/v1/user") return options.invalidAuth ? json({message:"invalid JWT",code:"bad_jwt"},401) : json({id:userId,email:"unit@unit.invalid",aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{}});
  if(url.pathname==="/rest/v1/rpc/require_plan_capability") return options.denied ? json({message:"Sin permiso",code:"42501"},403) : json(null);
  if(url.pathname.startsWith("/rest/v1/rpc/ai_tool_")) return options.toolDenied ? json({message:"Sin permiso",code:"42501"},403) : json({revenue:40});
  if(url.pathname==="/rest/v1/ai_insights") return json(null,201);
  if(url.hostname==="api.groq.com"||url.hostname==="router.huggingface.co") {
   if(options.backupStatus&&url.hostname==="api.groq.com")return json({error:"backup unavailable"},options.backupStatus);
   if(options.providerStatus&&(!options.fallback||url.hostname==="router.huggingface.co"))return json({error:"Provider private body must not leak"},options.providerStatus);
   round++;
   if(options.insights) return json({choices:[{message:{content:JSON.stringify({insights:[{type:"ALERT",severity:"info",title:"Revisar ventas",body:"Ingresos registrados: S/40"}]})}}]});
   if(round===1) return json({choices:[{message:{role:"assistant",content:null,tool_calls:[{id:"call-1",type:"function",function:{name:options.unknownTool?"admin_save_plan":"ai_tool_revenue",arguments:JSON.stringify({p_business_id:"foreign-business",p_from:"2026-09-01T00:00:00Z",p_to:"2026-09-24T00:00:00Z",sql:"delete from plans"})}}]}}]});
   return json({choices:[{message:{content:"Respuesta basada en datos autorizados"}}]});
  }
  throw new Error(`Petición no interceptada: ${url}`);
 }) as typeof fetch;
 try {
  const method=options.method??"POST";
  const req=new Request("https://local.invalid/ai-copilot",{method,headers:{Authorization:"Bearer user-jwt","Content-Type":"application/json"},body:method==="POST"?JSON.stringify({business_id:bid,action:options.insights?"insights":"chat",message:"Ingresos"}):undefined});
  const response=await handler(req,{} as Deno.ServeHandlerInfo);
  return {status:response.status,headers:response.headers,body:response.status===204?null:await response.json(),calls};
 } finally { globalThis.fetch=original; }
}
Deno.test("IA OPTIONS permite CORS sin llamadas",async()=>{const r=await exercise({method:"OPTIONS"});assert(r.status===204&&r.calls.length===0&&r.headers.has("Access-Control-Allow-Origin"),"CORS");});
Deno.test("IA rechaza método no permitido",async()=>{const r=await exercise({method:"GET"});assert(r.status===405&&r.calls.length===0,"método");});
Deno.test("IA rechaza token inválido antes de tools/proveedor",async()=>{const r=await exercise({invalidAuth:true});assert(r.status===401&&r.calls.length===1,"Auth");});
Deno.test("IA tenant/RBAC/capacidad denegados no llaman al proveedor",async()=>{const r=await exercise({denied:true});assert(r.status===403&&!r.calls.some(c=>c.path.includes("chat/completions")),"Capacidad");});
Deno.test("IA sin secreto informa 503 sin cifras ficticias",async()=>{const r=await exercise({missingSecret:true});assert(r.status===503&&!r.body.answer&&!r.calls.some(c=>c.path.includes("chat/completions")),"Configuración");});
Deno.test("IA ignora tenant y parámetros inyectados por el modelo",async()=>{const r=await exercise();const call=r.calls.find(c=>c.path.endsWith("ai_tool_revenue"));assert(r.status===200&&call?.body.p_business_id===bid&&!('sql' in call.body)&&call.authorization==="Bearer user-jwt","JWT y allowlist parámetros");assert(r.calls.find(c=>c.path.includes("chat/completions"))?.authorization==="Bearer server-secret-test","Secreto en servidor");});
Deno.test("IA no invoca herramientas fuera de allowlist",async()=>{const r=await exercise({unknownTool:true});assert(r.status===200&&!r.calls.some(c=>c.path.endsWith("admin_save_plan")),"Tool desconocida");});
Deno.test("IA comunica denegación de datos, no cero ni métricas privilegiadas",async()=>{const r=await exercise({toolDenied:true});const prompts=r.calls.filter(c=>c.path.includes("chat/completions"));const tool=prompts[1].body.messages.find((m:any)=>m.role==="tool");assert(JSON.parse(tool.content).error&&r.status===200,"Permiso datos");});
Deno.test("IA insights persiste con JWT y negocio autorizado",async()=>{const r=await exercise({insights:true});const save=r.calls.find(c=>c.path.endsWith("ai_insights"));assert(r.status===200&&r.body.created===1&&save?.body[0].business_id===bid&&save.authorization==="Bearer user-jwt","Persistencia");});

Deno.test("HF mantiene herramientas y JWT del usuario",async()=>{const r=await exercise({huggingface:true});const call=r.calls.find(c=>c.path.includes('chat/completions'));assert(r.status===200&&call?.authorization==='Bearer hf-server-only'&&call?.body.model==='Qwen/Qwen3-8B','Proveedor HF');assert(r.calls.find(c=>c.path.endsWith('ai_tool_revenue'))?.body.p_business_id===bid,'Tenant fijo');assert(!JSON.stringify(r.body).includes('hf-server-only'),'Sin secreto en cliente');});
Deno.test("HF sin token devuelve 503, sin fallback a Groq",async()=>{const r=await exercise({huggingface:true,missingSecret:true});assert(r.status===503&&r.body.error.includes('HF_TOKEN')&&!r.calls.some(c=>c.path.includes('chat/completions')),'Sin fallback');});
Deno.test("HF cuota agotada no devuelve respuesta ficticia ni llama otro proveedor",async()=>{const r=await exercise({huggingface:true,providerStatus:402});assert(r.status===503&&r.body.error.includes('créditos')&&!r.body.answer&&r.calls.filter(c=>c.path.includes('chat/completions')).length===1,'Cuota');});
Deno.test("HF 429 comunica límite sin reintento automático",async()=>{const r=await exercise({huggingface:true,providerStatus:429});assert(r.status===429&&r.body.error.includes('límite')&&!r.body.answer,'Rate limit');});
Deno.test("HF rechazo RBAC ocurre antes de proveedor",async()=>{const r=await exercise({huggingface:true,denied:true});assert(r.status===403&&!r.calls.some(c=>c.path.includes('chat/completions')),'RBAC HF');});

Deno.test("HF agota créditos y Groq responde con las mismas herramientas autorizadas",async()=>{const r=await exercise({huggingface:true,fallback:true,providerStatus:402});assert(r.status===200&&r.body.ai.provider==='groq'&&r.body.ai.usedFallback,'Respaldo');assert(r.calls.filter(c=>c.host==='router.huggingface.co').length===1,'No reintenta principal en cada ronda');assert(r.calls.filter(c=>c.host==='api.groq.com').length===2,'Herramientas y respuesta');const tool=r.calls.find(c=>c.path.endsWith('ai_tool_revenue'));assert(tool?.body.p_business_id===bid&&tool.authorization==='Bearer user-jwt','Tenant/JWT');assert(!JSON.stringify(r.body).includes('server-secret-test'),'Sin secretos');});
Deno.test("Con dos IAs un usuario sin permisos no llama ninguna",async()=>{const r=await exercise({huggingface:true,fallback:true,denied:true});assert(r.status===403&&!r.calls.some(c=>c.path.includes('chat/completions')),'RBAC sin bypass');});
Deno.test("Dos cuotas agotadas informan error sin respuesta inventada",async()=>{const r=await exercise({huggingface:true,fallback:true,providerStatus:402,backupStatus:429});assert(r.status===429&&!r.body.answer&&r.body.error.includes('respaldo'),'Error honesto');assert(r.calls.filter(c=>c.path.includes('chat/completions')).length===2,'Máximo dos intentos');});
