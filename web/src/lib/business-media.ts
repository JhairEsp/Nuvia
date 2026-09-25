import { supabase } from './supabase';
export type QrMethod = 'YAPE'|'PLIN';
export interface PaymentQr { method:QrMethod; storage_path:string; holder:string; updated_at?:string }
export function mediaError(e:unknown):string {
 const error=e as {code?:string;message?:string};
 return error?.code==='PGRST202'?'Falta instalar VENTAS_Y_EQUIPO.sql (migración 05) después de EDITOR_WEB.sql.':error?.message||'No se pudo completar la operación.';
}
export async function validateImage(file:File,maxMB=10) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Selecciona una imagen JPG, PNG o WebP.');
 if(!file.size||file.size>maxMB*1024*1024)throw new Error(`La imagen debe pesar entre 1 byte y ${maxMB} MB.`);
 if(typeof createImageBitmap==='function'){
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('No se pudo leer esta imagen. Prueba con otro archivo.');});bitmap.close();
 }else await new Promise<void>((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve();};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo leer esta imagen.'));};img.src=url;});
}
export async function uploadBusinessImage(bid:string,file:File,kind:'yape'|'plin'|'team',employeeId?:string) {
 await validateImage(file,5);
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(bid)||kind==='team'&&!uuid.test(employeeId||''))throw new Error('Negocio o trabajador inválido.');
 const bucket=kind==='team'?'website-media':'brand-assets';
 const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 const path=`${bid.toLowerCase()}/${kind==='team'?`team/${employeeId}`:`payments/${kind}`}/${crypto.randomUUID()}.${ext[file.type]}`;
 const r=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'});if(r.error)throw r.error;
 return {path,url:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl};
}
export const qrUrl=(qr:PaymentQr)=>supabase.storage.from('brand-assets').getPublicUrl(qr.storage_path).data.publicUrl;
export async function getPaymentQrs(bid:string):Promise<PaymentQr[]> {
 const r=await supabase.rpc('get_payment_qrs',{p_business_id:bid});if(r.error)throw r.error;
 if(!Array.isArray(r.data))throw new Error('Respuesta de QR inválida.');return r.data;
}
export async function savePaymentQr(bid:string,qr:PaymentQr):Promise<PaymentQr> {
 const r=await supabase.rpc('save_payment_qr',{p_business_id:bid,p_method:qr.method,p_storage_path:qr.storage_path,p_holder:qr.holder});if(r.error)throw r.error;
 if(r.data?.storage_path!==qr.storage_path)throw new Error('No se recibió confirmación de guardado.');return r.data;
}
export async function removePaymentQr(bid:string,method:QrMethod) {
 const r=await supabase.rpc('remove_payment_qr',{p_business_id:bid,p_method:method});if(r.error)throw r.error;
}
