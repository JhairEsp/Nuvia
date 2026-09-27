// Reducer de presentación, sin imports de red, Auth, stores o APIs. Nunca es una frontera de seguridad real.
import { DEMOS, demoServices, initialAppointments, type DemoKind, type DemoAppointment } from './data';
import { DEMO_STARTER, DEMO_STORAGE_LIMIT, DEMO_REWARD_COST } from './starter-plan';
export type DemoFile = { id: string; name: string; size: number; type: string; builtin?: boolean };
export type DemoRedemption = { id: string; customer: string; points: number; reward: string };
export type DemoMessage = { id: string; customer: string; text: string; status: 'QUEUED_DEMO' };
export type DemoChat = { id: string; question: string; answer: string };
export type DemoState = {
 kind: DemoKind; today: string; appointments: DemoAppointment[]; workers: string[]; files: DemoFile[];
 redemptions: DemoRedemption[]; messages: DemoMessage[]; chat: DemoChat[]; automations: Record<'reminder'|'followup'|'return',boolean>;
 error: string;
};
export type DemoAction =
 | { type: 'RESET' | 'CLEAR_ERROR' }
 | { type: 'ADD_APPOINTMENT'; appointment: DemoAppointment }
 | { type: 'PAY' | 'CANCEL' | 'REMOVE_FILE' | 'REMOVE_MESSAGE'; id: string }
 | { type: 'ADD_WORKER'; name: string }
 | { type: 'ADD_FILES'; files: DemoFile[] }
 | { type: 'REDEEM'; id: string; customer: string }
 | { type: 'QUEUE'; id: string; customer: string; text: string }
 | { type: 'ASK'; id: string; question: string }
 | { type: 'AUTOMATION'; key: keyof DemoState['automations']; enabled: boolean };
export function createDemoState({ kind, today }: { kind: DemoKind; today: string }): DemoState {
 return {kind,today,appointments:initialAppointments(kind,today),workers:[...DEMOS[kind].team],
  files:[{id:'demo-cover',name:kind==='barberia'?'portada-barberia.webp':'portada-estetica.webp',size:kind==='barberia'?131140:68254,type:'image/webp',builtin:true}],
  redemptions:[],messages:[],chat:[],automations:{reminder:true,followup:false,return:false},error:''};
}
export const monthlyAppointments = (state: DemoState, day: string) => state.appointments.filter(a=>a.day.slice(0,7)===day.slice(0,7)&&(a.status!=='CANCELLED'||a.paid)).length;
export const demoStorageBytes = (state: DemoState) => state.files.reduce((sum,f)=>sum+f.size,0);
export const demoClients = (state: DemoState) => [...new Set([...DEMOS[state.kind].customers,...state.appointments.map(a=>a.customer)])];
export const demoEarned = (state: DemoState, customer: string) => state.appointments.filter(a=>a.customer===customer&&a.paid).reduce((sum,a)=>sum+Math.floor(demoServices(state.kind).find(s=>s.id===a.serviceId)?.price??0),0);
export const demoPoints = (state: DemoState, customer: string) => demoEarned(state,customer)-state.redemptions.filter(r=>r.customer===customer).reduce((sum,r)=>sum+r.points,0);
export const demoReward = (kind: DemoKind) => kind==='barberia'?'Lavado de cortesía':'Mascarilla de cortesía';
const minutes = (time:string) => {const [h,m]=time.split(':').map(Number);return h!*60+m!;};
export function availableDemoSlots(state: DemoState, serviceId: string, employee: string, day: string) {
 const services=demoServices(state.kind),service=services.find(s=>s.id===serviceId);
 if(!service||!state.workers.includes(employee))return [];
 return Array.from({length:20},(_,i)=>`${String(9+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`).filter(time=>{
  const start=minutes(time),end=start+service.durationMin;
  return end<=19*60&&!state.appointments.some(a=>a.status!=='CANCELLED'&&a.day===day&&a.employee===employee&&minutes(a.time)<end&&minutes(a.time)+(services.find(s=>s.id===a.serviceId)?.durationMin??0)>start);
 });
}
export function demoAiAnswer(state: DemoState, question: string) {
 const q=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const config=DEMOS[state.kind],services=demoServices(state.kind),active=state.appointments.filter(a=>a.status!=='CANCELLED'),paid=state.appointments.filter(a=>a.paid);
 const amount=paid.reduce((sum,a)=>sum+(services.find(s=>s.id===a.serviceId)?.price??0),0);
 if(/recordatorio|mensaje|whatsapp/.test(q))return `Texto de ejemplo: «Hola, te esperamos en ${config.name} para tu próxima cita. Si necesitas cambiarla, avísanos. ¡Gracias por elegirnos!»\n\nPuedes preparar un recordatorio personalizado en WhatsApp. En esta demo solo queda en una cola local; no se envía.`;
 if(/llenar|promocion|campaña|campana|recuperar|fideliz/.test(q))return `Para esta presentación, combina tres acciones: comparte la página web de ${config.name}, prepara un seguimiento en WhatsApp y muestra la recompensa «${demoReward(state.kind)}» por ${DEMO_REWARD_COST} puntos demo.\n\nHay ${active.filter(a=>a.status==='CONFIRMED').length} citas demo confirmadas. Usa Agenda para explorar huecos por profesional. No he publicado campañas ni contactado clientes.`;
 if(/vende|vendido|ventas|servicio|ingreso/.test(q)){
  const ranked=services.map(s=>({...s,count:paid.filter(a=>a.serviceId===s.id).length})).sort((a,b)=>b.count-a.count);
  const best=ranked[0]!;
  return `Las ${paid.length} ventas simuladas suman S/ ${amount.toFixed(2)}. ${best.count?`Uno de los servicios con más ventas es ${best.name}, con ${best.count} atención(es) pagada(s).`:'Todavía no hay servicios vendidos.'}\n\nEste cálculo usa únicamente los datos actuales de la demo. Registra otra venta y vuelve a consultarme para ver el cambio.`;
 }
 if(/resum|negocio|hoy|agenda|citas|starter|plan/.test(q))return `${config.name} tiene ${active.filter(a=>a.day===state.today).length} citas demo activas hoy, ${state.workers.length} trabajadores y ${demoClients(state).length} clientes de ejemplo. Las ventas simuladas suman S/ ${amount.toFixed(2)}.\n\nStarter: ${state.workers.length}/${DEMO_STARTER.maxWorkers} trabajadores, ${monthlyAppointments(state,state.today)}/${DEMO_STARTER.maxMonthlyAppointments} citas del mes y ${DEMO_STARTER.maxStorageMb} MB. Incluye web, fidelización, Copiloto IA y WhatsApp; sin multisucursal.`;
 return 'En modo demo tengo respuestas guiadas, no una conexión a un modelo de IA. Prueba «Resume mi negocio», «¿Qué servicio se vende más?», «Ayúdame a llenar la agenda» o «Redacta un recordatorio». Solo analizaré los datos ficticios de esta demostración.';
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
 const reject=(error:string)=>({...state,error});
 switch(action.type){
  case 'RESET': return createDemoState(state);
  case 'CLEAR_ERROR': return {...state,error:''};
  case 'ADD_APPOINTMENT': {
   const a=action.appointment;
   if(state.appointments.some(item=>item.id===a.id))return state;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(a.day)||!Number.isFinite(Date.parse(`${a.day}T12:00:00Z`))||new Date(`${a.day}T12:00:00Z`).toISOString().slice(0,10)!==a.day||a.day<state.today)return reject('Elige una fecha válida desde hoy.');
   if(monthlyAppointments(state,a.day)>=DEMO_STARTER.maxMonthlyAppointments)return reject(`Starter permite ${DEMO_STARTER.maxMonthlyAppointments} citas al mes. Prueba otro mes o libera una cita demo no atendida. Business amplía este límite en negocios reales.`);
   if(!a.customer.trim()||a.customer.trim().length>80||!availableDemoSlots(state,a.serviceId,a.employee,a.day).includes(a.time))return reject('Revisa el nombre, el profesional y el horario de esta cita demo.');
   return {...state,error:'',appointments:[...state.appointments,{...a,customer:a.customer.trim(),status:'CONFIRMED',paid:false}]};
  }
  case 'PAY': return {...state,error:'',appointments:state.appointments.map(a=>a.id===action.id&&!a.paid&&a.status!=='CANCELLED'?{...a,paid:true,status:'COMPLETED'}:a)};
  case 'CANCEL': return {...state,error:'',appointments:state.appointments.map(a=>a.id===action.id&&!a.paid&&a.status!=='COMPLETED'?{...a,status:'CANCELLED'}:a)};
  case 'ADD_WORKER': {
   if(state.workers.length>=DEMO_STARTER.maxWorkers)return reject(`Starter permite hasta ${DEMO_STARTER.maxWorkers} trabajadores. Business permite un equipo mayor en negocios reales.`);
   const name=action.name.trim();
   if(name.length<2||name.length>80||state.workers.some(w=>w.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))return reject('Escribe un nombre de ejemplo distinto, entre 2 y 80 caracteres.');
   return {...state,error:'',workers:[...state.workers,name]};
  }
  case 'ADD_FILES': {
   if(!action.files.length)return state;
   if(action.files.some(f=>!f.name.trim()||!Number.isSafeInteger(f.size)||f.size<=0||!['image/jpeg','image/png','image/webp'].includes(f.type)))return reject('Usa imágenes JPG, PNG o WebP no vacías. Solo guardaremos el nombre y tamaño en esta demo.');
   const ids=new Set([...state.files,...action.files].map(f=>f.id));
   if(ids.size!==state.files.length+action.files.length)return reject('Este archivo ya está registrado en la demo.');
   if(demoStorageBytes(state)+action.files.reduce((sum,f)=>sum+f.size,0)>DEMO_STORAGE_LIMIT)return reject(`El plan Starter incluye ${DEMO_STARTER.maxStorageMb} MB. No hay espacio demo suficiente para estos archivos.`);
   return {...state,error:'',files:[...state.files,...action.files.map(f=>({...f,builtin:false}))]};
  }
  case 'REMOVE_FILE': return {...state,error:'',files:state.files.filter(f=>f.id!==action.id||f.builtin)};
  case 'REDEEM': {
   if(state.redemptions.some(r=>r.id===action.id))return state;
   if(!demoClients(state).includes(action.customer)||demoPoints(state,action.customer)<DEMO_REWARD_COST)return reject('Este cliente no tiene suficientes puntos demo para la recompensa.');
   return {...state,error:'',redemptions:[{id:action.id,customer:action.customer,points:DEMO_REWARD_COST,reward:demoReward(state.kind)},...state.redemptions]};
  }
  case 'QUEUE': {
   if(state.messages.some(m=>m.id===action.id))return state;
   if(!demoClients(state).includes(action.customer)||!action.text.trim()||action.text.length>1000)return reject('Selecciona un cliente ficticio y un mensaje de hasta 1000 caracteres.');
   return {...state,error:'',messages:[{id:action.id,customer:action.customer,text:action.text.trim(),status:'QUEUED_DEMO'},...state.messages]};
  }
  case 'REMOVE_MESSAGE': return {...state,error:'',messages:state.messages.filter(m=>m.id!==action.id)};
  case 'AUTOMATION': return {...state,error:'',automations:{...state.automations,[action.key]:action.enabled}};
  case 'ASK': {
   if(state.chat.some(m=>m.id===action.id)||!action.question.trim()||action.question.length>600)return state;
   return {...state,error:'',chat:[...state.chat,{id:action.id,question:action.question.trim(),answer:demoAiAnswer(state,action.question)}]};
  }
 }
}
