// Configuración EXCLUSIVA de servidor. Nunca aceptar endpoint/modelo/token del navegador.
export class AiProviderError extends Error { constructor(public status:number,message:string,public retryable=false){super(message);} }
export function aiConfiguration(env:(name:string)=>string|undefined=Deno.env.get.bind(Deno.env)) {
 const provider=env('AI_PROVIDER')||(env('HF_TOKEN')?'huggingface':env('GROQ_API_KEY')?'groq':'huggingface');
 let url:string,key:string|undefined,model:string;
 if(provider==='huggingface'){
  url='https://router.huggingface.co/v1/chat/completions';key=env('HF_TOKEN');model=env('HF_MODEL')||'Qwen/Qwen3-8B';
  if(!key)throw new AiProviderError(503,'Copiloto sin configurar: agrega HF_TOKEN en los secretos de ai-copilot. La API de Hugging Face tiene créditos y límites, no es ilimitada.');
 }else if(provider==='groq'){
  url='https://api.groq.com/openai/v1/chat/completions';key=env('GROQ_API_KEY');model=env('GROQ_MODEL')||'openai/gpt-oss-120b';
  if(!key)throw new AiProviderError(503,'Copiloto sin configurar: falta GROQ_API_KEY en los secretos del servidor.');
 }else if(provider==='self-hosted'){
  const endpoint=env('AI_BASE_URL'),secret=env('AI_API_KEY');
  if(!endpoint||!secret)throw new AiProviderError(503,'Faltan AI_BASE_URL y AI_API_KEY para el servidor de IA propio.');
  const parsed=new URL(endpoint);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw new AiProviderError(503,'AI_BASE_URL debe ser un endpoint HTTPS privado, sin credenciales en la URL.');
  url=endpoint.replace(/\/$/,'')+'/chat/completions';key=secret;model=env('AI_MODEL')||'Qwen/Qwen3-8B';
 }else throw new AiProviderError(503,'AI_PROVIDER no válido: huggingface, self-hosted o groq.');
 return {provider,url,key,model};
}
type Env=(name:string)=>string|undefined;
type Configuration=ReturnType<typeof aiConfiguration>;
export function createAiCaller(env:Env=Deno.env.get.bind(Deno.env)){
 const primary=aiConfiguration(env);
 const fallbackProvider=env('AI_FALLBACK_PROVIDER')??(primary.provider==='huggingface'&&env('GROQ_API_KEY')?'groq':primary.provider==='groq'&&env('HF_TOKEN')?'huggingface':'none');
 if(!['none','groq','huggingface','self-hosted'].includes(fallbackProvider)||fallbackProvider===primary.provider)throw new AiProviderError(503,'Configura una IA de respaldo distinta de la principal o AI_FALLBACK_PROVIDER=none.');
 let active=primary,usedFallback=false;
 const deadline=Date.now()+90000;
 async function request(config:Configuration,payload:Record<string,unknown>){
  const remaining=deadline-Date.now();
  if(remaining<=0)throw new AiProviderError(503,'La consulta alcanzó el tiempo máximo. Prueba una pregunta más específica.');
  let response:Response;
  try{response=await fetch(config.url,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({...payload,model:config.model,temperature:0.2,max_tokens:2048}),signal:AbortSignal.timeout(Math.min(fallbackProvider==='none'?45000:20000,remaining))});}
  catch{throw new AiProviderError(503,'El proveedor de IA no respondió a tiempo. Intenta de nuevo; no se generaron datos de respaldo.',true);}
  if(!response.ok){
   // Nunca devolver el body del proveedor ni secretos al cliente.
   if(response.status===429)throw new AiProviderError(429,'El proveedor de IA alcanzó su límite de solicitudes. Espera antes de reintentar; no es un servicio ilimitado.',true);
   if(response.status===402)throw new AiProviderError(503,'Se agotaron los créditos del proveedor de IA.',true);
   if([401,403].includes(response.status))throw new AiProviderError(503,'El proveedor rechazó el token o el acceso al modelo. Revisa los secretos y permisos de inferencia.');
   if([400,404,422].includes(response.status))throw new AiProviderError(503,'El modelo o proveedor no admite esta consulta. Verifica disponibilidad, herramientas (function calling) y JSON.');
   throw new AiProviderError(502,'El proveedor de IA está temporalmente no disponible.',response.status>=500);
  }
  let data;
  try{data=await response.json();}catch{throw new AiProviderError(502,'El proveedor devolvió una respuesta inválida.');}
  const message=data?.choices?.[0]?.message;
  if(!message||typeof message!=='object'||(!Array.isArray(message.tool_calls)&&typeof message.content!=='string'))throw new AiProviderError(502,'El proveedor devolvió una respuesta inválida.');
  if(message.tool_calls!=null&&(!Array.isArray(message.tool_calls)||message.tool_calls.some((call: {id?:unknown;function?:{name?:unknown;arguments?:unknown}})=>!call||typeof call.id!=='string'||typeof call.function?.name!=='string'||typeof call.function?.arguments!=='string')))throw new AiProviderError(502,'El proveedor devolvió herramientas inválidas.');
  if(typeof message.content==='string')message.content=message.content.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
  return message;
 }
 const call=async(payload:Record<string,unknown>)=>{
  try{return await request(active,payload);}
  catch(error){
   if(!(error instanceof AiProviderError)||!error.retryable)throw error;
   if(usedFallback)throw new AiProviderError(error.status,'La IA principal y la de respaldo no están disponibles. Intenta más tarde; no se inventaron datos.');
   if(fallbackProvider==='none')throw error;
   // Una única conmutación, sin recargar créditos ni cambiar de cuenta para eludir cuotas.
   active=aiConfiguration(name=>name==='AI_PROVIDER'?fallbackProvider:env(name));usedFallback=true;
   try{return await request(active,payload);}
   catch(backupError){
    if(backupError instanceof AiProviderError&&!backupError.retryable)throw new AiProviderError(backupError.status,`La IA principal falló y el respaldo requiere revisión: ${backupError.message}`);
    throw new AiProviderError(backupError instanceof AiProviderError?backupError.status:503,'La IA principal y la de respaldo no están disponibles. Intenta más tarde; no se inventaron datos.');
   }
  }
 };
 return Object.assign(call,{info:()=>({provider:active.provider,model:active.model,usedFallback})});
}
