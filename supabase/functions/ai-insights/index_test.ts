// Job aislado: no envía solicitudes de red reales.
type Handler = (req: Request, info: Deno.ServeHandlerInfo) => Response | Promise<Response>;
let handler: Handler;
const serve = Deno.serve;
Deno.serve = ((fn: Handler) => { handler=fn; return {}; }) as typeof Deno.serve;
await import("./index.ts"); Deno.serve=serve;
const assert=(ok:unknown)=>{if(!ok)throw new Error("Job no cerrado correctamente");};
Deno.test("Job sin secreto queda cerrado",async()=>{
 Deno.env.delete("INSIGHTS_CRON_SECRET");const r=await handler(new Request("https://unit.invalid",{method:"POST"}),{} as Deno.ServeHandlerInfo);assert(r.status===403);
});
Deno.test("Job no admite token de usuario como secreto cron",async()=>{
 Deno.env.set("INSIGHTS_CRON_SECRET","private-cron");const r=await handler(new Request("https://unit.invalid",{method:"POST",headers:{Authorization:"Bearer user-jwt","x-cron-secret":"incorrect"}}),{} as Deno.ServeHandlerInfo);assert(r.status===403);
});
Deno.test("Job omite negocios cuyo RPC de capacidades está denegado",async()=>{
 Deno.env.set("INSIGHTS_CRON_SECRET","private-cron");Deno.env.set("SUPABASE_URL","https://unit.invalid");Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","server-service");
 const original=globalThis.fetch;const calls:string[]=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const req=new Request(input,init);const path=new URL(req.url).pathname;calls.push(path);
  if(path.endsWith("/businesses"))return new Response(JSON.stringify([{id:"b0000000-0000-0000-0000-000000000001",name:"Local"}]),{headers:{"Content-Type":"application/json"}});
  if(path.endsWith("/system_ai_metrics"))return new Response(JSON.stringify({message:"capacidad denegada",code:"42501"}),{status:403,headers:{"Content-Type":"application/json"}});
  throw new Error("Petición no permitida");}) as typeof fetch;
 try{const r=await handler(new Request("https://unit.invalid",{method:"POST",headers:{"x-cron-secret":"private-cron"}}),{} as Deno.ServeHandlerInfo);assert(r.status===200&&calls.length===2&&(await r.json()).created.length===0);}finally{globalThis.fetch=original;}
});
