/** Mensajes de Edge/gateway sin exponer cabeceras, tokens o errores crudos de red. */
const missing='La función ai-copilot no está desplegada en este proyecto Supabase (404). Guardar los secretos no la instala: despliega la función con ese nombre exacto.';
async function fromResponse(response:Response):Promise<string> {
 let body: {code?:string;error?:unknown;message?:string}={};
 try{body=await response.clone().json();}catch{/* Gateway puede responder sin JSON. */}
 if(response.status===404||body.code==='NOT_FOUND')return missing;
 if(typeof body.error==='string'&&body.error.trim())return body.error.slice(0,600);
 if(response.status===401)return 'Supabase rechazó la sesión del Copiloto (401). Vuelve a iniciar sesión. Si persiste, revisa la configuración JWT de ai-copilot; la función debe validar al usuario con Auth.';
 if(response.status===403)return 'No tienes permiso para usar el Copiloto de este negocio (403).';
 if(response.status===429)return 'El Copiloto alcanzó su límite de solicitudes. Espera antes de reintentar.';
 if(response.status>=500)return 'La función del Copiloto no pudo iniciarse o responder. Revisa los logs de ai-copilot en Supabase.';
 return `La solicitud al Copiloto fue rechazada (HTTP ${response.status}). Revisa el despliegue y la configuración de la función.`;
}
export async function aiInvocationError(error:unknown,probe?:()=>Promise<Response>):Promise<string>{
 const e=error as {context?:unknown;name?:string};
 if(e?.context instanceof Response)return fromResponse(e.context);
 // Un preflight OPTIONS 404 produce error de fetch y oculta la respuesta POST.
 // GET simple, sin JWT, apikey ni datos del negocio: solo comprueba si existe la ruta.
 if(probe){try{const response=await probe();if(response.status===404)return missing;}catch{/* Fallo de red/CORS: no afirmar que falta la función. */}}
 return 'No se pudo conectar con ai-copilot. Puede ser un problema de red o CORS: revisa conexión, URL del proyecto y logs de la función. Los secretos por sí solos no despliegan el código.';
}
