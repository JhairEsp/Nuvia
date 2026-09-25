import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BRAND_NAME } from '../../lib/brand';
import { publicSiteFromSnapshot } from '../../store/db';
import type { PublicSite, Service } from '../../types/domain';
import SiteRenderer from '../website/SiteRenderer';
import BookingDrawer from './BookingDrawer';

/** El público solo lee releases confirmados; el mismo renderer muestra el borrador privado. */
export default function LandingPage() {
 const {slug}=useParams();const [site,setSite]=useState<PublicSite|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [booking,setBooking]=useState(false);const [service,setService]=useState<Service|null>(null);
 useEffect(()=>{let alive=true;setLoading(true);setSite(null);setError('');setBooking(false);
  void (async()=>{try{const r=await supabase.rpc('get_public_site',{p_slug:slug||''});if(!alive)return;if(r.error)throw r.error;setSite(publicSiteFromSnapshot(r.data));}catch{if(alive)setError('No pudimos cargar esta página. Intenta nuevamente.');}finally{if(alive)setLoading(false);}})();
  return()=>{alive=false;};
 },[slug,retry]);
 useEffect(()=>{if(!site?.business.name)return;const previous=document.title;document.title=`${site.business.name} · ${BRAND_NAME}`;return()=>{document.title=previous;};},[site?.business.name]);
 if(loading)return <div className="min-h-screen bg-bg flex items-center justify-center text-muted">Cargando…</div>;
 if(error)return <div className="min-h-screen bg-bg flex flex-col gap-5 items-center justify-center p-8 text-center"><h1 className="text-title">No se pudo cargar la página</h1><p role="alert">{error}</p><button className="px-6 py-3 rounded-full bg-accent text-on-accent" onClick={()=>setRetry(x=>x+1)}>Reintentar</button></div>;
 if(!site||!site.sections.some(s=>s.active))return <div className="min-h-screen bg-bg flex flex-col gap-3 items-center justify-center p-8 text-center"><h1 className="text-title">{site?.business.name||'Página no disponible'}</h1><p className="text-muted">El negocio aún no tiene una página publicada disponible.</p></div>;
 return <><SiteRenderer key={slug} site={site} onBook={s=>{setService(s??null);setBooking(true);}}/><BookingDrawer open={booking} onClose={()=>setBooking(false)} presetService={service} slug={slug||''}/></>;
}
