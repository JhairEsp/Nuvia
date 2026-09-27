// Datos ficticios EXCLUSIVOS de /demo/*. Nunca se cargan en los stores o RPCs reales.
import type { PublicSite, Service } from '../../types/domain';
import { completeDraft } from '../website/templates';
import spaImage from './assets/estetica.webp';
export type DemoKind = 'barberia' | 'estetica';
export type DemoAppointment = { id: string; customer: string; serviceId: string; employee: string; day: string; time: string; status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'; source: 'Agenda' | 'Web'; paid: boolean };
export const demoToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const DEMOS = {
 barberia: { label: 'Barbería', name: 'Distrito 01', initials: 'D/01', tagline: 'Cortes con carácter. Gestión sin complicaciones.', greeting: 'Todo listo para un gran día.', subtitle: 'Menos pendientes. Más tiempo para hacer lo que mejor sabes.', team: ['Mateo Ríos', 'Nicolás Vega', 'Andrés León'], customers: ['Lucas Torres', 'Diego Flores', 'Gabriel Castro', 'Joaquín Soto', 'Bruno Vargas', 'Adrián Ruiz'], services: [ ['Corte clásico',35,30,'Precisión a tijera y un acabado a tu medida.'], ['Degradado + styling',45,45,'Líneas limpias, textura y tu propio estilo.'], ['Corte + barba',65,60,'Un ritual completo de corte y perfilado.'], ['Perfilado de barba',25,30,'Contornos definidos y cuidado de la barba.'] ] },
 estetica: { label: 'Estética', name: 'Alma Estética', initials: 'a.', tagline: 'El arte de cuidarte. La tranquilidad de gestionarlo todo.', greeting: 'Un día para cuidar y crecer.', subtitle: 'Cada cita es un momento de bienestar. Cada detalle, bajo control.', team: ['Valentina Paz', 'Camila Sol', 'Lucía Vidal'], customers: ['Mariana Torres', 'Sofía Flores', 'Valeria Castro', 'Isabella Soto', 'Renata Vargas', 'Daniela Ruiz'], services: [ ['Limpieza facial',120,60,'Limpieza y cuidado facial personalizado.'], ['Ritual hidratante',150,75,'Un momento de calma y cuidado para tu piel.'], ['Diseño de cejas',45,30,'Armonía y definición con un acabado natural.'], ['Masaje relajante',100,60,'Una pausa de bienestar y relajación.'] ] },
} as const;
export function demoServices(kind: DemoKind): Service[] {
 return DEMOS[kind].services.map(([name, price, durationMin, description], index) => ({ id: `demo-${kind}-service-${index}`, name, price, durationMin, description, active: true, showOnWebsite: true }));
}
export function initialAppointments(kind: DemoKind, today: string): DemoAppointment[] {
 const d = DEMOS[kind], services = demoServices(kind);
 return ['09:00','10:30','12:00','14:00','15:30','17:00'].map((time,i) => ({ id: `demo-${kind}-appointment-${i}`, customer: d.customers[i]!, serviceId: services[i % services.length]!.id, employee: d.team[i % d.team.length]!, day: today, time, status: i < 2 ? 'COMPLETED' : 'CONFIRMED', paid: i < 2, source: i % 2 ? 'Web' : 'Agenda' }));
}
export function demoSite(kind: DemoKind): PublicSite {
 const d=DEMOS[kind]; const barber=kind==='barberia';
 const demoImage=new URL(spaImage,window.location.origin).href;
 const site: PublicSite = { business: { name:d.name,slug:`demo-${kind}`,type:barber?'BARBERSHOP':'AESTHETICS',description:barber?'Cortes con intención, barbas cuidadas y tiempo para ti. Un concepto ficticio de barbería, creado para mostrar lo que puedes hacer con Nuvia.':'Un espacio para reconectar contigo. Rituales de cuidado y atención personalizada en un centro ficticio, creado para mostrar Nuvia.',phone:'',whatsapp:'',email:'',address:'' }, branding:{preset:barber?'DARK':'ELEGANT',colors:{primary:barber?'#d5f54a':'#813c30'},font_key:barber?'sans':'serif',cover_url:barber?undefined:demoImage},website:{template_key:barber?'STUDIO':'EDITORIAL',tagline:barber?'Corte. Carácter. Confianza.':'Tu piel. Tu calma. Tu momento.',socials:{},map_query:''},sections:[],services:demoServices(kind),team:d.team.map((fullName,i)=>({id:`demo-${kind}-employee-${i}`,fullName,roleLabel:barber?'Barbero':'Especialista en estética',specialty:barber?'Corte y cuidado personal':'Cuidado y bienestar',bio:'Perfil ficticio de demostración.',commissionRate:10,showOnWebsite:true,active:true})),promotions:[],testimonials:[],hours:[] };
 const completed=completeDraft(site);
 return {...completed,sections:completed.sections.map(s=>({...s,active:['HERO','SERVICES','ABOUT','TEAM','CTA','FOOTER'].includes(s.type),content:s.type==='HERO'?{...s.content,title:barber?'Tu corte. Tus reglas.':'Un momento solo para ti.',image_caption:barber?'Oficio y estilo · Negocio de demostración':'Imagen ilustrativa · Negocio de demostración'}:s.type==='ABOUT'&&!barber?{...s.content,image_url:demoImage,image_alt:'Composición ilustrativa de cuidado personal'}:s.type==='FOOTER'?{...s.content,text:'Negocio ficticio · Demostración de Nuvia. No se realizan reservas ni cobros reales.'}:s.content}))};
}
