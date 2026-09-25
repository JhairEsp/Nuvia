import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/input';
import { usePermission, useSession } from '../../store/session';
import { getPaymentQrs, savePaymentQr, removePaymentQr, uploadBusinessImage, qrUrl, mediaError, type PaymentQr, type QrMethod } from '../../lib/business-media';
export default function PaymentQrSettings(){
 const bid=useSession(s=>s.businessId),allowed=usePermission('settings.manage');
 const [items,setItems]=useState<PaymentQr[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 const epoch=useRef(0);
 useEffect(()=>{const token=++epoch.current;setItems([]);setError('');setBusy('');setLoading(true);
  if(!bid||!allowed){setLoading(false);return;}
  void getPaymentQrs(bid).then(rows=>{if(token===epoch.current)setItems(rows);}).catch(e=>{if(token===epoch.current)setError(mediaError(e));}).finally(()=>{if(token===epoch.current)setLoading(false);});return()=>{epoch.current++;};
 },[bid,allowed,reload]);
 if(!allowed)return null;
 const change=(method:QrMethod,patch:Partial<PaymentQr>)=>setItems(rows=>{const row=rows.find(q=>q.method===method)||{method,storage_path:'',holder:''};return [...rows.filter(q=>q.method!==method),{...row,...patch}];});
 const upload=async(method:QrMethod,file?:File)=>{if(!bid||!file||busy)return;const token=epoch.current;setBusy(method);setError('');try{
  const r=await uploadBusinessImage(bid,file,method==='YAPE'?'yape':'plin');if(token!==epoch.current)return;change(method,{storage_path:r.path});toast.success('Imagen subida. Pulsa Guardar QR para usarla en Ventas.');
 }catch(e){if(token===epoch.current)setError(mediaError(e));}finally{if(token===epoch.current)setBusy('');}};
 const persist=async(method:QrMethod,remove=false)=>{if(!bid||busy)return;const token=epoch.current;setBusy(method);setError('');try{
  if(remove){await removePaymentQr(bid,method);if(token===epoch.current)setItems(rows=>rows.filter(q=>q.method!==method));}
  else{const qr=items.find(q=>q.method===method);if(!qr?.storage_path)throw new Error('Primero sube el QR del negocio.');await savePaymentQr(bid,qr);}
  if(token===epoch.current)toast.success(remove?'QR quitado de Ventas':'QR guardado para Ventas');
 }catch(e){if(token===epoch.current)setError(mediaError(e));}finally{if(token===epoch.current)setBusy('');}};
 return <Card><CardHeader><CardTitle>QR de cobro · Yape y Plin</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-caption text-muted">Sube el QR oficial de la cuenta de tu negocio, sin recortarlo. Se abrirá al elegir Yape o Plin en Ventas. Es una imagen pública: no subas claves, saldos ni documentos.</p>
  {error&&<div role="alert" className="text-danger text-caption">{error} <button onClick={()=>setReload(n=>n+1)} disabled={!!busy}>Reintentar carga</button></div>}
  {loading?<p>Cargando QR…</p>:<div className="grid sm:grid-cols-2 gap-4">{(['YAPE','PLIN'] as const).map(method=>{const qr=items.find(q=>q.method===method);return <fieldset key={method} disabled={!!busy} className="p-4 rounded-2xl border border-hairline space-y-3 min-w-0">
   <legend className="font-semibold px-1">{method==='YAPE'?'Yape':'Plin'}</legend>
   {qr?.storage_path?<img src={qrUrl(qr)} alt={`QR de ${method}`} className="w-full h-52 object-contain bg-white rounded-xl"/>:<div className="h-32 grid place-items-center bg-subtle rounded-xl text-muted text-caption">Sin QR configurado</div>}
   <Field label="Imagen QR"><input aria-label={`Subir QR ${method}`} type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-caption" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(method,file);}}/></Field>
   <p className="text-micro text-faint">JPG, PNG o WebP · máximo 5 MB</p>
   <Field label="Titular de la cuenta"><Input aria-label={`Titular ${method}`} maxLength={120} value={qr?.holder||''} onChange={e=>change(method,{holder:e.target.value})}/></Field>
   <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!qr?.storage_path||!!busy} onClick={()=>void persist(method)}>Guardar QR {method}</Button>{qr?.storage_path&&<Button variant="quiet" size="sm" disabled={!!busy} onClick={()=>void persist(method,true)}>Quitar QR {method}</Button>}</div>
  </fieldset>;})}</div>}
  <p className="text-micro text-faint">El QR no integra ni verifica pagos bancarios. Confirma cada abono en la cuenta. Reemplazar o quitar un QR no elimina automáticamente el archivo anterior de Storage.</p>
 </CardContent></Card>;
}
