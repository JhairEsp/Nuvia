import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/ui/overlay';
import { Button } from '../../components/ui/button';
import { getPaymentQrs, mediaError, qrUrl, type PaymentQr, type QrMethod } from '../../lib/business-media';
import { money } from '../../lib/format';
export default function PaymentQrModal({bid,method,total,onClose,onVerified}:{bid:string;method:QrMethod;total:number;onClose:()=>void;onVerified:()=>void}){
 const opener=useRef(document.activeElement as HTMLElement|null);
 useEffect(()=>{const root=document.getElementById('root'),oldInert=root?.inert??false,overflow=document.body.style.overflow;if(root)root.inert=true;document.body.style.overflow='hidden';document.getElementById('qr-payment-title')?.closest('[role=dialog]')?.querySelector('button')?.focus();return()=>{if(root)root.inert=oldInert;document.body.style.overflow=overflow;if(opener.current?.isConnected)opener.current.focus();};},[]);
 const [qr,setQr]=useState<PaymentQr|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[checked,setChecked]=useState(false);
 useEffect(()=>{let alive=true;setLoading(true);setError('');setQr(null);setChecked(false);void getPaymentQrs(bid).then(rows=>{if(alive)setQr(rows.find(q=>q.method===method)||null);}).catch(e=>{if(alive)setError(mediaError(e));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[bid,method,reload]);
 return createPortal(<Modal open onClose={onClose} labelledBy="qr-payment-title" className="max-h-[90dvh] overflow-y-auto"><div className="space-y-4 text-center">
  <h2 id="qr-payment-title" className="text-title font-semibold">Cobrar con {method==='YAPE'?'Yape':'Plin'}</h2>
  <p className="text-[2rem] font-semibold num">{money(total)}</p>
  {loading?<p>Cargando QR del negocio…</p>:error?<div role="alert" className="text-danger text-caption">{error}<Button variant="quiet" onClick={()=>setReload(n=>n+1)}>Reintentar</Button></div>:qr?<><img src={qrUrl(qr)} alt={`Escanea el QR de ${method}`} className="mx-auto bg-white w-full max-w-72 h-72 object-contain rounded-xl" onError={()=>setError('No se pudo cargar la imagen del QR. Revisa la conexión o pide al administrador que la reemplace.')}/>{qr.holder&&<p className="font-semibold">Titular: {qr.holder}</p>}<p className="text-caption text-muted">Escanea y comprueba el titular y el importe antes de pagar.</p></>:<p className="text-caption text-muted">El administrador todavía no configuró el QR de {method}. Debe subirlo y guardarlo en Ajustes → QR de cobro.</p>}
  <p className="text-caption text-muted">Mostrar o escanear este QR no confirma el pago. Verifica el abono en la cuenta del negocio, no solo una captura del cliente.</p>
  <label className="flex items-start gap-2 text-left text-caption"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/><span>Verifiqué que el abono fue recibido en la cuenta del negocio.</span></label>
  <Button className="w-full" disabled={!checked||total<=0} onClick={onVerified}>Pago verificado · volver al ticket</Button>
  <p className="text-micro text-faint">La venta se registra al pulsar el botón de cobro del ticket.</p>
 </div></Modal>,document.body);
}
