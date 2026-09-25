import type { PublicSite, WebsiteSectionType } from '../../types/domain';
export type TemplateKey = 'EDITORIAL' | 'STUDIO' | 'SERENE';
export const TEMPLATES = [
 { key:'EDITORIAL' as const, name:'Éditorial', subtitle:'La belleza está en los detalles.', description:'Composición de revista, tipografía elegante y tonos cálidos. Para salones, estética y pestañas.', accent:'#813c30', preset:'ELEGANT' as const, font:'serif', tags:'Salón · Estética · Pestañas' },
 { key:'STUDIO' as const, name:'Studio', subtitle:'Tu estilo. Tus reglas.', description:'Contrastes oscuros, títulos contundentes y acentos eléctricos. Para barberías y estudios creativos.', accent:'#d2ee87', preset:'DARK' as const, font:'sans', tags:'Barbería · Studio · Nails' },
 { key:'SERENE' as const, name:'Serene', subtitle:'Un momento solo para ti.', description:'Espacios abiertos, formas orgánicas y movimiento suave. Para spas, bienestar y cuidado personal.', accent:'#426653', preset:'SOFT' as const, font:'serif', tags:'Spa · Bienestar · Terapias' },
];
// Tres variantes por rubro; conservan las claves SQL y no crean planes/plantillas extra.
export const BARBER_TEMPLATES: typeof TEMPLATES = [
 {key:'EDITORIAL',name:'Clásica',subtitle:'El buen estilo no pasa de moda.',description:'Oficio de siempre, presencia inolvidable. Cuero, cobre y una composición editorial con carácter.',accent:'#d6ab73',preset:'ELEGANT',font:'serif',tags:'Barbería clásica · Cobre · Tradición'},
 {key:'STUDIO',name:'Urbana',subtitle:'Tu corte. Tus reglas.',description:'Tipografía de gran formato, contraste nocturno y movimiento. Para una barbería con actitud propia.',accent:'#d5f54a',preset:'DARK',font:'sans',tags:'Barbería urbana · Alto contraste · Actitud'},
 {key:'SERENE',name:'Caballeros',subtitle:'El detalle hace al caballero.',description:'Marfil, verde profundo y líneas precisas. Una experiencia de barbería sobria y contemporánea.',accent:'#254c44',preset:'SOFT',font:'serif',tags:'Barbería elegante · Marfil · Precisión'},
];
export function isBarberBusiness(type?:string) {
 const key=(type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
 return key==='BARBERSHOP'||key==='BARBERIA';
}
export const templatesForBusiness=(type?:string)=>isBarberBusiness(type)?BARBER_TEMPLATES:TEMPLATES;
export const SECTION_LABELS: Record<WebsiteSectionType,string> = { HERO:'Portada', SERVICES:'Servicios', ABOUT:'Sobre nosotros', GALLERY:'Galería', TEAM:'Equipo', PROMOTIONS:'Promociones', TESTIMONIALS:'Testimonios', LOCATION:'Ubicación y contacto', CTA:'Invitación a reservar', FOOTER:'Pie de página y redes' };
export const SECTION_TYPES = Object.keys(SECTION_LABELS) as WebsiteSectionType[];
export function businessCopy(type='OTHER') {
 const rubro=type.toUpperCase();
 if(isBarberBusiness(type))return {label:'Barbería',title:'El estilo que habla por ti.',subtitle:'Cortes, cuidado y detalles que hacen la diferencia. Tu próxima visita empieza aquí.',tag:'Precisión. Carácter. Estilo.',recommended:'STUDIO' as TemplateKey};
 if(/SPA|WELLNESS|MASSAGE|THERAP/.test(rubro))return {label:'Spa y bienestar',title:'Desconecta. Respira. Renueva.',subtitle:'Haz una pausa y elige el cuidado que necesitas. Un espacio para sentirte bien.',tag:'Tu bienestar, primero.',recommended:'SERENE' as TemplateKey};
 if(/NAIL/.test(rubro))return {label:'Nails',title:'Pequeños detalles. Mucha personalidad.',subtitle:'Encuentra tu próximo diseño y reserva un momento para ti.',tag:'Tu estilo, hasta las puntas.',recommended:'EDITORIAL' as TemplateKey};
 if(/LASH|BROW/.test(rubro))return {label:'Pestañas y cejas',title:'Una mirada que lo dice todo.',subtitle:'Realza tu expresión con una atención pensada para ti.',tag:'Belleza en cada detalle.',recommended:'EDITORIAL' as TemplateKey};
 return {label:/SALON|HAIR/.test(rubro)?'Salón de belleza':/ESTHET|AESTHET|SKIN/.test(rubro)?'Estética y cuidado':'Belleza y bienestar',title:'Tu mejor versión empieza aquí.',subtitle:'Descubre nuestros servicios y encuentra ese momento de cuidado que mereces.',tag:'El arte de cuidarte.',recommended:'EDITORIAL' as TemplateKey};
}
export function templateFor(site: PublicSite) {
 const templates=templatesForBusiness(site.business.type);
 return templates.find(t=>t.key===site.website.template_key) ?? templates.find(t=>site.branding.preset==='DARK'?t.key==='STUDIO':site.branding.preset==='SOFT'?t.key==='SERENE':t.key==='EDITORIAL')!;
}
type Defaults=Record<WebsiteSectionType,Record<string,unknown>>;
function genericDefaults(site:PublicSite):Defaults {
 const copy=businessCopy(site.business.type);
 return {
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
}
function barberDefaults(site:PublicSite,key:TemplateKey):Defaults {
 const base=genericDefaults(site),design=BARBER_TEMPLATES.find(t=>t.key===key)!;
 const subtitles:Record<TemplateKey,string>={EDITORIAL:'Cortes con carácter. Barbas con detalle. Tu próxima visita empieza en el sillón.',STUDIO:'Degradados, líneas y estilo propio. Descubre nuestros servicios y elige tu próximo corte.',SERENE:'Un corte cuidado. Una barba definida. Reserva un momento para renovar tu estilo.'};
 return {...base,
 HERO:{...base.HERO,eyebrow:'Barbería · Corte y carácter',title:design.subtitle,subtitle:subtitles[key],cta:'Reservar mi corte',image_alt:'Nuestra barbería',image_caption:'El oficio de crear estilo.'},
 SERVICES:{title:'Elige tu próximo corte.',subtitle:'Servicios y precios de nuestra barbería. Reserva el que va contigo.'},
 ABOUT:{title:'El oficio está en los detalles.',body:site.business.description||'Cada estilo tiene su carácter. Conoce nuestra barbería, elige tu servicio y reserva con nuestro equipo.',image_alt:'Nuestra barbería y equipo'},
 GALLERY:{...base.GALLERY,title:'Estilo que se ve.',subtitle:'Cortes, detalles y momentos de nuestra barbería.'},
 TEAM:{title:'Conoce a tus barberos.',subtitle:'Elige a quien le confías tu próximo corte.'},
 PROMOTIONS:{title:'Tu próximo corte, con algo más.',subtitle:'Descubre las promociones vigentes de la barbería.'},
 TESTIMONIALS:{title:'La voz de quienes vuelven.',subtitle:'Experiencias reales en nuestra barbería.'},
 LOCATION:{title:'Tu próximo corte empieza aquí.',subtitle:'Encuentra la barbería y prepara tu visita.'},
 CTA:{title:key==='STUDIO'?'Haz espacio para tu próximo corte.':'El estilo empieza con una buena decisión.',body:'Elige tu servicio y reserva con nuestro equipo.',cta:'Reservar mi corte'},
 FOOTER:{text:'Barbería. Oficio. Estilo.'},
 };
}
export function completeDraft(site: PublicSite): PublicSite {
 const defaults=isBarberBusiness(site.business.type)?barberDefaults(site,templateFor(site).key):genericDefaults(site);
 const sections=SECTION_TYPES.map((type,index)=>{
  const old=site.sections.find(x=>x.type===type);
  return {type,position:old?.position??index,active:old?.active??!['GALLERY','PROMOTIONS','TESTIMONIALS'].includes(type),content:{...defaults[type],...old?.content}};
 }).sort((a,b)=>a.position-b.position).map((s,position)=>({...s,position}));
 return {...site,sections};
}
export function applyTemplate(site: PublicSite,key: TemplateKey): PublicSite {
 const t=templatesForBusiness(site.business.type).find(x=>x.key===key)!;
 let completed=completeDraft(site);
 if(isBarberBusiness(site.business.type)) {
  const desired=barberDefaults(site,key);
  const known=[genericDefaults(site),genericDefaults({...site,business:{...site.business,type:'SALON'}}),...BARBER_TEMPLATES.map(t=>barberDefaults(site,t.key))];
  completed={...completed,sections:completed.sections.map(section=>{
   const content={...section.content};
   for(const [field,value] of Object.entries(desired[section.type])) {
    // Cambiar solo copy de fábrica reconocible, nunca fotos/arrays/contenido libre.
    if(typeof value!=='string')continue;
    if(section.type==='ABOUT'&&field==='body'&&site.business.description?.trim()&&content[field]===site.business.description)continue;
    if(content[field]===undefined||known.some(defaults=>defaults[section.type][field]===content[field]))content[field]=value;
   }
   return {...section,content};
  })};
 }
 return {...completed,branding:{...site.branding,preset:t.preset,colors:{primary:t.accent,button:t.accent},font_key:t.font},website:{...site.website,template_key:key}};
}
export const safeImage = (url: unknown) => typeof url==='string' && /^https?:\/\//i.test(url) ? url : '';
export const safeLink = (url: unknown) => typeof url==='string' && /^https?:\/\//i.test(url) ? url : undefined;
export function whatsappLink(phone:string) {
 let digits=phone.replace(/\D/g,''); if(digits.length===9&&digits.startsWith('9'))digits='51'+digits;
 return digits.length>=10&&digits.length<=15 ? `https://wa.me/${digits}` : undefined;
}
