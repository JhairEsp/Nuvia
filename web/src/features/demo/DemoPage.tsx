import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Gift, Bot, MessageCircle, HardDrive, Check, CheckCircle2, Clock3, Globe, LayoutDashboard, Plus, RotateCcw, Scissors, Search, ShoppingBag, Sparkles, Users, Wallet, X } from 'lucide-react';
import BrandMark from '../../components/BrandMark';
import { Modal } from '../../components/ui/overlay';
import SiteRenderer from '../website/SiteRenderer';
import { money } from '../../lib/format';
import { DEMOS, demoServices, demoSite, demoToday, type DemoAppointment, type DemoKind } from './data';
import barberArt from '../website/assets/barber-chair.webp';
import spaArt from './assets/estetica.webp';
import './demo.css';
import { DEMO_STARTER, type DemoView } from './starter-plan';
import { availableDemoSlots, createDemoState, demoReducer, demoPoints, monthlyAppointments } from './starter-state';
import { StarterSummary, StarterPlan, DemoTeamAdd, DemoLoyalty, DemoCopilot, DemoWhatsApp } from './StarterFeatures';

type View = DemoView;
const NAV = [ ['overview','Resumen',LayoutDashboard], ['agenda','Agenda',CalendarDays], ['clients','Clientes',Users], ['services','Servicios y equipo',Scissors], ['sales','Ventas',ShoppingBag], ['website','Página web',Globe], ['loyalty','Fidelización',Gift], ['ai','Copiloto IA',Bot], ['whatsapp','WhatsApp',MessageCircle], ['plan','Plan y almacenamiento',HardDrive] ] as const;
const minutes = (time: string) => { const [h,m]=time.split(':').map(Number); return h!*60+m!; };
const dayLabel = (day: string) => new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
const initials = (name: string) => name.split(' ').slice(0,2).map(n=>n[0]).join('');
export default function DemoPage() {
 const {kind}=useParams();
 return kind==='barberia'||kind==='estetica' ? <DemoWorkspace key={kind} kind={kind}/> : <Navigate to="/login" replace/>;
}
function DemoWorkspace({kind}:{kind:DemoKind}) {
 const config=DEMOS[kind], barber=kind==='barberia';
 const [today]=useState(demoToday);
 const services=useMemo(()=>demoServices(kind),[kind]);
 const [demo,dispatch]=useReducer(demoReducer,{kind,today},createDemoState);
 const appointments=demo.appointments;
 const site=useMemo(()=>{const base=demoSite(kind);return {...base,team:demo.workers.map((fullName,i)=>({...base.team[0]!,id:`demo-${kind}-employee-${i}`,fullName}))};},[kind,demo.workers]);
 const [params,setParams]=useSearchParams();
 const view: View=NAV.some(([key])=>key===params.get('view'))?params.get('view') as View:'overview';
 const navigate=(next:View)=>{setParams(next==='overview'?{}:{view:next});setNotice('');dispatch({type:'CLEAR_ERROR'});window.scrollTo({top:0,behavior:'instant'});};
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [agendaDay,setAgendaDay]=useState(today);
 const [customer,setCustomer]=useState<string|null>(null);
 const [booking,setBooking]=useState(false);
 const [source,setSource]=useState<'Agenda'|'Web'>('Agenda');
 const [newName,setNewName]=useState('Cliente de ejemplo');
 const [newService,setNewService]=useState(services[0]!.id);
 const [newEmployee,setNewEmployee]=useState<string>(demo.workers[0]!);
 const [newDay,setNewDay]=useState(today);
 const [newTime,setNewTime]=useState('');
 const [reset,setReset]=useState(false);
 const bookingSubmitted=useRef(false);
 const modalOpen=booking||!!customer||reset;
 useEffect(()=>{
  if(!modalOpen)return;
  const opener=document.activeElement as HTMLElement|null;
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const dialog=()=>document.querySelector<HTMLElement>('.nuvia-demo .nd-modal[role=dialog]');
  const frame=requestAnimationFrame(()=>{const node=dialog();(node?.querySelector<HTMLElement>('input')??node?.querySelector<HTMLElement>('button'))?.focus();});
  const trap=(event:KeyboardEvent)=>{
   if(event.key!=='Tab')return;
   const node=dialog();const items=[...(node?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')??[])].filter(el=>el.offsetParent!==null);
   const first=items[0],last=items[items.length-1];if(!first||!last)return;
   if(!node?.contains(document.activeElement)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();first.focus();}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  };
  document.addEventListener('keydown',trap);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',trap);document.body.style.overflow=previousOverflow;if(opener?.isConnected)opener.focus({preventScroll:true});};
 },[modalOpen]);
 const serviceFor=(id:string)=>services.find(s=>s.id===id)!;
 const active=appointments.filter(a=>a.status!=='CANCELLED');
 const paid=appointments.filter(a=>a.paid);
 const revenue=paid.reduce((sum,a)=>sum+serviceFor(a.serviceId).price,0);
 const clients=[...new Set([...config.customers,...appointments.map(a=>a.customer)])];
 const dayAppointments=appointments.filter(a=>a.day===agendaDay).sort((a,b)=>a.time.localeCompare(b.time));
 const selectedService=serviceFor(newService);
 const slots=availableDemoSlots(demo,newService,newEmployee,newDay);
 const monthFull=monthlyAppointments(demo,newDay)>=DEMO_STARTER.maxMonthlyAppointments;
 const openBooking=(origin:'Agenda'|'Web',serviceId=services[0]!.id)=>{
  bookingSubmitted.current=false;setSource(origin);setNewService(serviceId);setNewName('Cliente de ejemplo');setNewDay(today);setNewEmployee(demo.workers[0]!);setNewTime('');setBooking(true);
 };
 const registerDemoBooking=()=>{
  if(bookingSubmitted.current||!newName.trim()||newDay<today||monthFull||!slots.includes(newTime))return;
  bookingSubmitted.current=true;
  dispatch({type:'ADD_APPOINTMENT',appointment:{id:`demo-new-${crypto.randomUUID()}`,customer:newName.trim(),serviceId:newService,employee:newEmployee,day:newDay,time:newTime,status:'CONFIRMED',source,paid:false}});
  setAgendaDay(newDay);setBooking(false);setParams({view:'agenda'});window.scrollTo({top:0,behavior:'instant'});setNotice('Cita demo añadida a esta agenda. No se creó una reserva real.');
 };
 const charge=(id:string)=>{
  const a=appointments.find(item=>item.id===id);if(!a||a.paid||a.status==='CANCELLED')return;
  dispatch({type:'PAY',id});
  setNotice(`Venta demo de ${money(serviceFor(a.serviceId).price)} registrada. Sin cobro real; revisa el resumen y los puntos del cliente.`);
 };
 useEffect(()=>{const previous=document.title;document.title=`Demo ${config.label} · Nuvia`;return()=>{document.title=previous;};},[config.label]);
 const appointmentRows=(list:DemoAppointment[],compact=false)=>list.length?<div className="nd-appointments">{list.map(a=><div className="nd-appointment" key={a.id}>
  <div className="nd-time">{a.time}<small>{serviceFor(a.serviceId).durationMin} min</small></div>
  <span className="nd-avatar">{initials(a.customer)}</span>
  <div className="nd-appointment-person"><button onClick={()=>setCustomer(a.customer)}>{a.customer}</button><small>{serviceFor(a.serviceId).name} · {a.employee}</small></div>
  <span className={`nd-status nd-status-${a.status.toLowerCase()}`}>{a.status==='COMPLETED'?'Atendida':a.status==='CANCELLED'?'Cancelada':'Confirmada'}</span>
  {!compact&&<div className="nd-row-actions"><span>{money(serviceFor(a.serviceId).price)}</span>{!a.paid&&a.status!=='CANCELLED'&&<button aria-label={`Cancelar cita demo de ${a.customer}`} onClick={()=>{dispatch({type:'CANCEL',id:a.id});setNotice('Cita demo cancelada. Se liberó su horario en esta demostración.');}}><X size={16}/></button>}</div>}
 </div>)}</div>:<p className="nd-empty">No hay citas demo para este día. Crea una con «Nueva cita demo».</p>;
 return <div className={`nuvia-demo nd-${kind}`}>
  <aside className="nd-sidebar">
   <Link to="/login" className="nd-brand"><BrandMark/><span>Nuvia<span className="nd-brand-small">TU NEGOCIO, EN ARMONÍA</span></span></Link>
   <div className="nd-business"><span className="nd-business-monogram">{config.initials}</span><div><strong>{config.name}</strong><small>{config.label} · Negocio ficticio</small></div></div>
   <span className="nd-nav-label">TU ESPACIO DE TRABAJO</span>
   <nav aria-label="Navegación de la demo">{NAV.map(([key,label,Icon])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}><Icon size={19}/>{label}{view===key&&<span className="nd-nav-dot"/>}</button>)}</nav>
   <div className="nd-sidebar-bottom"><div><Sparkles size={20}/><strong>Starter en acción</strong><p>Web, fidelización, Copiloto IA y WhatsApp. Una sucursal, todo conectado en esta demo.</p></div><Link to={`/demo/${barber?'estetica':'barberia'}`}>Ver demo de {barber?'estética':'barbería'} <ArrowUpRight size={16}/></Link><Link to="/login"><ArrowLeft size={15}/>Volver al login</Link></div>
  </aside>
  <div className="nd-workspace">
   <div className="nd-demo-banner"><span><i/> DEMOSTRACIÓN INTERACTIVA</span><p>Datos ficticios · Sin reservas ni cobros reales</p><button onClick={()=>setReset(true)}><RotateCcw size={14}/>Reiniciar demo</button></div>
   <header className="nd-topbar"><div><span className="nd-breadcrumb">{config.name} / </span><strong>{NAV.find(([key])=>key===view)?.[1]}</strong></div><div className="nd-topbar-right"><span className="nd-date">{dayLabel(today)}</span><span className="nd-profile">{barber?'MR':'VP'}</span><Link to="/login" className="nd-mobile-exit" aria-label="Volver al login"><ArrowLeft size={19}/></Link></div></header>
   <main className={view==='website'?'nd-main nd-main-website':'nd-main'}>
    {demo.error&&<div className="nd-notice nd-error" role="alert">{demo.error}<button aria-label="Cerrar error demo" onClick={()=>dispatch({type:'CLEAR_ERROR'})}><X size={17}/></button></div>}
    {notice&&<div className="nd-notice" role="status"><CheckCircle2 size={19}/>{notice}<button aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}
    {view==='overview'&&<>
     <section className="nd-welcome"><div><span className="nd-eyebrow">EL PULSO DE TU NEGOCIO</span><h1>{config.greeting}</h1><p>{config.subtitle}</p></div><button className="nd-primary" onClick={()=>openBooking('Agenda')}><Plus size={17}/>Nueva cita demo</button></section>
     <section className="nd-kpis" aria-label="Indicadores de demostración">{[[CalendarDays,'Citas de hoy',active.filter(a=>a.day===today).length,'Agenda de ejemplo'],[Wallet,'Ventas registradas',money(revenue),'Solo ventas simuladas'],[Users,'Clientes',clients.length,'Perfiles de demostración'],[Globe,'Reservas desde la web',active.filter(a=>a.source==='Web').length,'Conectadas a esta demo']].map(([Icon,label,value,detail],i)=>{const MetricIcon=Icon as typeof CalendarDays;return <article className="nd-kpi" key={i}><div><span>{String(label)}</span><MetricIcon size={18}/></div><strong>{String(value)}</strong><small>{String(detail)}</small></article>;})}</section>
     <StarterSummary state={demo} navigate={navigate}/>
     <div className="nd-overview-grid">
      <section className="nd-card nd-today"><div className="nd-section-title"><div><span className="nd-eyebrow">CADA CITA, BAJO CONTROL</span><h2>Tu agenda de hoy</h2></div><button className="nd-text-button" onClick={()=>navigate('agenda')}>Ver agenda <ArrowUpRight size={17}/></button></div>{appointmentRows(appointments.filter(a=>a.day===today).sort((a,b)=>a.time.localeCompare(b.time)).slice(0,6),true)}<div className="nd-card-foot"><span className="nd-live-dot"/>Agenda y web, en un mismo lugar.</div></section>
      <section className="nd-feature"><div className="nd-feature-text"><span className="nd-eyebrow">TU NEGOCIO TAMBIÉN BRILLA ONLINE</span><h2>{barber?'Mucho más que un buen corte.':'Una experiencia que empieza antes de la cita.'}</h2><p>Descubre la página de {config.name} y prueba una reserva de demostración.</p><button onClick={()=>navigate('website')}>Visitar página demo <ArrowUpRight size={17}/></button></div><img src={barber?barberArt:spaArt} alt={barber?'Ilustración decorativa de un sillón de barbería':'Composición ilustrativa de cuidado personal'}/></section>
     </div>
     <div className="nd-bottom-grid"><section className="nd-card"><div className="nd-section-title"><div><span className="nd-eyebrow">UNA VISTA CLARA</span><h2>Tu semana, de un vistazo</h2></div><span className="nd-soft-tag">Serie ilustrativa</span></div><div className="nd-chart" role="img" aria-label="Gráfico ilustrativo de ventas de seis días y ventas registradas en esta demo"><div className="nd-chart-bars">{[.45,.63,.39,.84,.7,.94,Math.min(1,Math.max(.12,revenue/(barber?300:700)))].map((height,i)=><div key={i}><div style={{height:`${height*100}%`}}/><span>{i===6?'Demo':['Lun','Mar','Mié','Jue','Vie','Sáb'][i]}</span></div>)}</div></div></section><section className="nd-card nd-tour"><span className="nd-eyebrow">UN RECORRIDO PARA TU PRESENTACIÓN</span><h2>De la reserva a la venta.</h2>{([['01','Reserva desde la página','website'],['02','Organiza la atención','agenda'],['03','Registra una venta demo','sales']] as const).map(([number,title,next])=><button key={number} onClick={()=>navigate(next)}><span>{number}</span><strong>{title}</strong><ArrowRight size={17}/></button>)}</section></div>
    </>}
    {view==='agenda'&&<><div className="nd-page-title"><div><span className="nd-eyebrow">TIEMPO PARA LO QUE IMPORTA</span><h1>Agenda</h1><p>Crea y cancela citas ficticias. Los cambios solo viven en esta demo.</p></div><button className="nd-primary" onClick={()=>openBooking('Agenda')}><Plus size={17}/>Nueva cita demo</button></div><div className="nd-toolbar"><label>Fecha <input type="date" value={agendaDay} onChange={e=>e.target.value&&setAgendaDay(e.target.value)}/></label><span>{dayAppointments.filter(a=>a.status!=='CANCELLED').length} citas hoy · {monthlyAppointments(demo,agendaDay)}/{DEMO_STARTER.maxMonthlyAppointments} en este mes · Lima</span></div><section className="nd-card"><div className="nd-section-title"><h2>{dayLabel(agendaDay)}</h2><span className="nd-soft-tag">{demo.workers.length}/{DEMO_STARTER.maxWorkers} profesionales</span></div>{appointmentRows(dayAppointments)}</section></>}
    {view==='clients'&&<><div className="nd-page-title"><div><span className="nd-eyebrow">PERSONAS, NO SOLO CITAS</span><h1>Clientes</h1><p>Perfiles ficticios con historial y puntos de demostración.</p></div><label className="nd-search"><Search size={17}/><input aria-label="Buscar cliente demo" placeholder="Buscar cliente…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="nd-client-grid">{clients.filter(name=>name.toLowerCase().includes(query.toLowerCase())).map(name=>{const purchases=paid.filter(a=>a.customer===name);const spent=purchases.reduce((sum,a)=>sum+serviceFor(a.serviceId).price,0);return <button className="nd-card nd-client" key={name} onClick={()=>setCustomer(name)}><span className="nd-client-head"><span className="nd-avatar">{initials(name)}</span><ArrowUpRight size={19}/></span><h2>{name}</h2><span>Cliente de demostración</span><div><span><strong>{appointments.filter(a=>a.customer===name&&a.status!=='CANCELLED').length}</strong> citas</span><span><strong>{demoPoints(demo,name)}</strong> puntos demo</span></div></button>;})}</div>{!clients.some(name=>name.toLowerCase().includes(query.toLowerCase()))&&<p className="nd-empty">No hay clientes demo que coincidan con tu búsqueda.</p>}</>}
    {view==='services'&&<><div className="nd-page-title"><div><span className="nd-eyebrow">LO QUE HACE ÚNICO A TU NEGOCIO</span><h1>Servicios y equipo</h1><p>Catálogo ilustrativo de {config.name}. Prueba una cita con cualquiera de estos servicios.</p></div></div><div className="nd-service-grid">{services.map((s,i)=><article className="nd-card nd-service" key={s.id}><span className="nd-service-number">0{i+1}</span><h2>{s.name}</h2><p>{s.description}</p><span className="nd-duration"><Clock3 size={15}/>{s.durationMin} minutos</span><div><strong>{money(s.price)}</strong><button className="nd-text-button" onClick={()=>openBooking('Agenda',s.id)}>Probar cita <ArrowUpRight size={16}/></button></div></article>)}</div><div className="nd-section-title nd-team-title"><h2>Un equipo con talento</h2><span className="nd-soft-tag">Perfiles ficticios</span></div><DemoTeamAdd state={demo} dispatch={dispatch}/><div className="nd-team-grid">{demo.workers.map((name,i)=><article className="nd-card nd-team" key={name}><span className="nd-avatar">{initials(name)}</span><h2>{name}</h2><p>{barber?'Barbero':'Especialista en estética'}</p><span className="nd-status nd-status-confirmed">{i===0?'Atención personalizada':i===1?'Detalle y precisión':'Cuidado y bienestar'}</span></article>)}</div></>}
    {view==='sales'&&<><div className="nd-page-title"><div><span className="nd-eyebrow">CADA ATENCIÓN CUENTA</span><h1>Ventas</h1><p>Simula una venta y observa cómo cambian el resumen y los puntos del cliente. No se mueve dinero.</p></div><span className="nd-sales-total">Total demo<strong>{money(revenue)}</strong></span></div><section className="nd-card"><div className="nd-section-title"><h2>Atenciones por registrar</h2><span className="nd-soft-tag">Simulación · sin pasarela de pago</span></div><div className="nd-sales-list">{active.filter(a=>!a.paid).map(a=><div className="nd-sale" key={a.id}><span className="nd-avatar">{initials(a.customer)}</span><div><strong>{a.customer}</strong><small>{serviceFor(a.serviceId).name} · {a.day}</small></div><strong>{money(serviceFor(a.serviceId).price)}</strong><button className="nd-primary" onClick={()=>charge(a.id)} aria-label={`Registrar venta demo de ${a.customer}`}>Registrar venta demo</button></div>)}</div>{!active.some(a=>!a.paid)&&<p className="nd-empty">Todas las atenciones demo están registradas. Crea una nueva cita para seguir probando.</p>}</section><section className="nd-card nd-sales-history"><div className="nd-section-title"><h2>Ventas de demostración</h2><span>{paid.length} registradas</span></div>{paid.map(a=><div className="nd-sale" key={a.id}><CheckCircle2 size={21}/><div><strong>{a.customer}</strong><small>{serviceFor(a.serviceId).name}</small></div><strong>{money(serviceFor(a.serviceId).price)}</strong><span className="nd-soft-tag">Simulada</span></div>)}</section></>}
    {view==='website'&&<><div className="nd-website-toolbar"><div><Globe size={18}/><span>Página de ejemplo · {config.name}</span></div><button onClick={()=>navigate('agenda')}>Ver agenda demo <ArrowRight size={16}/></button></div><div className="nd-website-note">Prueba «Reservar»: la cita se añade únicamente a la agenda de esta demo. No se envían mensajes ni se realizan reservas reales.</div><SiteRenderer site={site} onBook={s=>openBooking('Web',s?.id)}/></>}
    {view==='loyalty'&&<DemoLoyalty state={demo} dispatch={dispatch}/>}
    {view==='ai'&&<DemoCopilot state={demo} dispatch={dispatch} navigate={navigate}/>}
    {view==='whatsapp'&&<DemoWhatsApp state={demo} dispatch={dispatch}/>}
    {view==='plan'&&<StarterPlan state={demo} dispatch={dispatch} navigate={navigate}/>}
    <footer className="nd-footer"><span>Nuvia · Menos tareas. Más negocio.</span><span>Los cambios se reinician al salir o recargar.</span></footer>
   </main>
  </div>
  <Modal open={booking} onClose={()=>setBooking(false)} labelledBy="demo-booking-title" className="nd-modal max-h-[90vh] overflow-y-auto">
   <span className="nd-soft-tag">DEMO · No genera una reserva real</span><h2 id="demo-booking-title">{source==='Web'?'Prueba la reserva online':'Nueva cita demo'}</h2><p>Usa un nombre ficticio. No ingreses datos personales.</p>
   {monthFull&&<p className="nd-quota-warning" role="alert">Starter permite {DEMO_STARTER.maxMonthlyAppointments} citas en el mes seleccionado. Elige otro mes o cancela una cita demo no atendida para liberar cupo.</p>}
   <form onSubmit={e=>{e.preventDefault();registerDemoBooking();}} className="nd-demo-form">
    <label>Nombre de ejemplo<input required maxLength={80} value={newName} onChange={e=>setNewName(e.target.value)}/></label>
    <label>Servicio<select aria-label="Servicio" value={newService} onChange={e=>{setNewService(e.target.value);setNewTime('');}}>{services.map(s=><option key={s.id} value={s.id}>{s.name} · {money(s.price)}</option>)}</select></label>
    <div className="nd-form-grid"><label>Profesional<select aria-label="Profesional" value={newEmployee} onChange={e=>{setNewEmployee(e.target.value);setNewTime('');}}>{demo.workers.map(name=><option key={name}>{name}</option>)}</select></label><label>Fecha<input type="date" required min={today} value={newDay} onChange={e=>{setNewDay(e.target.value);setNewTime('');}}/></label></div>
    <fieldset><legend>Hora de ejemplo · Lima</legend><div className="nd-slot-grid">{slots.map(time=><button key={time} type="button" aria-pressed={newTime===time} onClick={()=>setNewTime(time)}>{time}</button>)}</div>{!slots.length&&<p>No quedan horas demo para este profesional. Elige otro o cambia de fecha.</p>}</fieldset>
    <div className="nd-booking-total"><span>{selectedService.durationMin} min · Importe ilustrativo</span><strong>{money(selectedService.price)}</strong></div>
    <div className="nd-demo-submit"><button className="nd-primary" type="submit" disabled={!newName.trim()||!newDay||newDay<today||monthFull||!slots.includes(newTime)}><Check size={17}/>Añadir cita de demostración</button></div>
   </form>
  </Modal>
  <Modal open={!!customer} onClose={()=>setCustomer(null)} labelledBy="demo-customer-title" className="nd-modal max-h-[85vh] overflow-y-auto"><span className="nd-soft-tag">Perfil ficticio</span><h2 id="demo-customer-title">{customer}</h2><p>{demoPoints(demo,customer??'')} puntos demo · 1 punto por sol de venta simulada, menos los canjes demo.</p><h3 className="nd-customer-history-title">Historial de demostración</h3>{appointments.filter(a=>a.customer===customer).map(a=><div className="nd-customer-history" key={a.id}><div><strong>{serviceFor(a.serviceId).name}</strong><small>{dayLabel(a.day)} · {a.time}</small></div><span>{a.status==='CANCELLED'?'Cancelada':a.paid?'Atendida':'Confirmada'}</span></div>)}</Modal>
  <Modal open={reset} onClose={()=>setReset(false)} labelledBy="demo-reset-title" className="nd-modal"><span className="nd-soft-tag">Solo esta demostración</span><h2 id="demo-reset-title">¿Empezar de nuevo?</h2><p>Se restablecerán las citas, ventas, equipo, archivos, puntos, conversación y mensajes ficticios de {config.name}. No afecta a ninguna cuenta real.</p><div className="nd-reset-actions"><button className="nd-primary" onClick={()=>{dispatch({type:'RESET'});setAgendaDay(today);setQuery('');setCustomer(null);setBooking(false);setReset(false);setParams({});window.scrollTo({top:0,behavior:'instant'});setNotice('Demo reiniciada con los datos de ejemplo originales.');}}>Sí, reiniciar demo</button><button className="nd-secondary" onClick={()=>setReset(false)}>Seguir explorando</button></div></Modal>
 </div>;
}
