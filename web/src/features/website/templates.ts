import type { PublicSite, WebsiteSectionType } from '../../types/domain';
export type TemplateKey = 'EDITORIAL' | 'STUDIO' | 'SERENE';
export const TEMPLATES = [
 { key:'EDITORIAL' as const, name:'Éditorial', subtitle:'La belleza está en los detalles.', description:'Composición de revista, tipografía elegante y tonos cálidos. Para salones, estética y pestañas.', accent:'#813c30', preset:'ELEGANT' as const, font:'serif', tags:'Salón · Estética · Pestañas' },
 { key:'STUDIO' as const, name:'Studio', subtitle:'Tu estilo. Tus reglas.', description:'Contrastes oscuros, títulos contundentes y acentos eléctricos. Para barberías y estudios creativos.', accent:'#d2ee87', preset:'DARK' as const, font:'sans', tags:'Barbería · Studio · Nails' },
 { key:'SERENE' as const, name:'Serene', subtitle:'Un momento solo para ti.', description:'Espacios abiertos, formas orgánicas y movimiento suave. Para spas, bienestar y cuidado personal.', accent:'#426653', preset:'SOFT' as const, font:'serif', tags:'Spa · Bienestar · Terapias' },
];
export const SECTION_LABELS: Record<WebsiteSectionType,string> = { HERO:'Portada', SERVICES:'Servicios', ABOUT:'Sobre nosotros', GALLERY:'Galería', TEAM:'Equipo', PROMOTIONS:'Promociones', TESTIMONIALS:'Testimonios', LOCATION:'Ubicación y contacto', CTA:'Invitación a reservar', FOOTER:'Pie de página y redes' };
export const SECTION_TYPES = Object.keys(SECTION_LABELS) as WebsiteSectionType[];
export function businessCopy(type='OTHER') {
 const rubro=type.toUpperCase();
 if(/BARBER/.test(rubro))return {label:'Barbería',title:'El estilo que habla por ti.',subtitle:'Cortes, cuidado y detalles que hacen la diferencia. Tu próxima visita empieza aquí.',tag:'Precisión. Carácter. Estilo.',recommended:'STUDIO' as TemplateKey};
 if(/SPA|WELLNESS|MASSAGE|THERAP/.test(rubro))return {label:'Spa y bienestar',title:'Desconecta. Respira. Renueva.',subtitle:'Haz una pausa y elige el cuidado que necesitas. Un espacio para sentirte bien.',tag:'Tu bienestar, primero.',recommended:'SERENE' as TemplateKey};
 if(/NAIL/.test(rubro))return {label:'Nails',title:'Pequeños detalles. Mucha personalidad.',subtitle:'Encuentra tu próximo diseño y reserva un momento para ti.',tag:'Tu estilo, hasta las puntas.',recommended:'EDITORIAL' as TemplateKey};
 if(/LASH|BROW/.test(rubro))return {label:'Pestañas y cejas',title:'Una mirada que lo dice todo.',subtitle:'Realza tu expresión con una atención pensada para ti.',tag:'Belleza en cada detalle.',recommended:'EDITORIAL' as TemplateKey};
 return {label:/SALON|HAIR/.test(rubro)?'Salón de belleza':/ESTHET|AESTHET|SKIN/.test(rubro)?'Estética y cuidado':'Belleza y bienestar',title:'Tu mejor versión empieza aquí.',subtitle:'Descubre nuestros servicios y encuentra ese momento de cuidado que mereces.',tag:'El arte de cuidarte.',recommended:'EDITORIAL' as TemplateKey};
}
export function templateFor(site: PublicSite) {
 return TEMPLATES.find(t=>t.key===site.website.template_key) ?? TEMPLATES.find(t=>site.branding.preset==='DARK'?t.key==='STUDIO':site.branding.preset==='SOFT'?t.key==='SERENE':t.key==='EDITORIAL')!;
}
export function completeDraft(site: PublicSite): PublicSite {
 const copy=businessCopy(site.business.type);
 const defaults: Record<WebsiteSectionType,Record<string,unknown>> = {
  HERO:{eyebrow:copy.label,title:copy.title,subtitle:copy.subtitle,cta:'Reservar mi cita',cta_enabled:true,image_alt:'Nuestro espacio'},
  SERVICES:{title:'Encuentra tu próximo ritual.',subtitle:'Elige tu servicio. Nosotros cuidamos los detalles.'},
  ABOUT:{title:'Más que una visita. Un momento para ti.',body:site.business.description||'Un espacio para cuidar de ti, a tu ritmo. Descubre nuestros servicios y elige tu próximo momento de bienestar.',image_alt:'Nuestro equipo y espacio'},
  GALLERY:{title:'Así se vive nuestro espacio.',subtitle:'Conoce nuestro trabajo.',images:[]},
  TEAM:{title:'Las manos detrás de tu estilo.',subtitle:'Conoce a nuestro equipo.'},
  PROMOTIONS:{title:'Un motivo más para volver.',subtitle:'Nuestras promociones vigentes.'},
  TESTIMONIALS:{title:'Lo que dicen nuestros clientes.',subtitle:'Experiencias compartidas.'},
  LOCATION:{title:'Nos encantará verte.',subtitle:'Encuéntranos y agenda tu próxima visita.'},
  CTA:{title:copy.tag,body:'Reserva tu cita y déjanos cuidar de ti.',cta:'Quiero reservar'},
  FOOTER:{text:'Tu espacio de belleza y bienestar.'},
 };
 const sections=SECTION_TYPES.map((type,index)=>{
  const old=site.sections.find(x=>x.type===type);
  return {type,position:old?.position??index,active:old?.active??!['GALLERY','PROMOTIONS','TESTIMONIALS'].includes(type),content:{...defaults[type],...old?.content}};
 }).sort((a,b)=>a.position-b.position).map((s,position)=>({...s,position}));
 return {...site,sections};
}
export function applyTemplate(site: PublicSite,key: TemplateKey): PublicSite {
 const t=TEMPLATES.find(x=>x.key===key)!;
 return {...completeDraft(site),branding:{...site.branding,preset:t.preset,colors:{primary:t.accent,button:t.accent},font_key:t.font},website:{...site.website,template_key:key}};
}
export const safeImage = (url: unknown) => typeof url==='string' && /^https?:\/\//i.test(url) ? url : '';
export const safeLink = (url: unknown) => typeof url==='string' && /^https?:\/\//i.test(url) ? url : undefined;
export function whatsappLink(phone:string) {
 let digits=phone.replace(/\D/g,''); if(digits.length===9&&digits.startsWith('9'))digits='51'+digits;
 return digits.length>=10&&digits.length<=15 ? `https://wa.me/${digits}` : undefined;
}
