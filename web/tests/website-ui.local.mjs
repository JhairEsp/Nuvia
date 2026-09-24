// Pruebas de interfaz aisladas. Supabase, Storage y mapa interceptados; no toca cuentas remotas.
import {chromium} from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const bid='b0000000-0000-0000-0000-000000000001',uid='a0000000-0000-0000-0000-000000000002';
const plan={id:'f0000000-0000-0000-0000-000000000001',code:'STARTER',name:'Starter',price_monthly:79,description:'Negocio individual',limits:{max_employees:5,max_monthly_appointments:300,max_storage_mb:500,max_branches:1},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:false}};
const business={id:bid,name:'Luma Atelier',slug:'luma-atelier',type:'SALON',status:'ACTIVE',description:'Tu espacio de belleza y cuidado.',phone:'999123456',whatsapp:'51999123456',address:'Av. del Parque 125, Lima',email:'hola@local.invalid',currency:'PEN',timezone:'America/Lima'};
const services=[{id:'s1',name:'Corte & styling',description:'Encuentra tu estilo.',duration_min:60,price:80},{id:'s2',name:'Color & gloss',description:'Un toque de luz.',duration_min:90,price:150}];
const team=[{id:'e1',full_name:'Profesional de prueba',role_label:'Estilista',active:true}];
let raw={business,branding:{preset:'MODERN',colors:{},font_key:'sans'},website:{template_key:null,tagline:'Un momento solo para ti',socials:{},map_query:''},sections:[],services,team,promotions:[],testimonials:[],hours:[{weekday:1,open_time:'09:00',close_time:'18:00',is_closed:false}]};
let revision=0,published=null,publishedAt=null,failSave=false,failPublish=false,uploadedPath='',png;
const calls=[];const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1512,height:1100}});
await context.route('https://maps.google.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<p>Mapa aislado</p>'}));
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let data=[];
 if(url.pathname.startsWith('/storage/')){
  if(req.method()==='POST'){uploadedPath=decodeURIComponent(url.pathname);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:uploadedPath.replace('/storage/v1/object/','')})});return;}
  await route.fulfill({status:200,contentType:'image/png',body:png||Buffer.alloc(0)});return;
 }
 const body=req.postData()?req.postDataJSON():null;calls.push({name,body});
 if(url.pathname.startsWith('/auth/'))data={id:uid,email:'unit@local.invalid',aud:'authenticated',role:'authenticated'};
 else if(name==='get_website_editor')data={draft:raw,revision,published_at:publishedAt,published_revision:published?.website?.draft_revision??null};
 else if(name==='save_website_draft'||name==='publish_website_draft'){
  if((name==='save_website_draft'&&failSave)||(name==='publish_website_draft'&&failPublish)){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Rechazo de prueba del servidor'})});return;}
  assert.equal(body.p_business_id,bid);assert.equal(body.p_expected_revision,revision);revision++;raw={...body.p_draft,business:{...body.p_draft.business,slug:business.slug},website:{...body.p_draft.website,draft_revision:revision},services,team};
  if(name==='publish_website_draft'){published=structuredClone(raw);publishedAt=new Date().toISOString();data={release_id:'r1',revision,slug:business.slug,published_at:publishedAt};}else data=revision;
 }
 else if(name==='get_public_site')data=published;
 else if(name==='get_plan_usage')data={capabilities:{planId:plan.id,code:plan.code,name:plan.name,priceMonthly:79,maxWorkers:5,maxMonthlyAppointments:300,maxStorageMb:500,maxBranches:1,website:true,loyalty:true,aiCopilot:true,whatsapp:true,multiBranch:false},usage:{workers:1,appointments:0,storageBytes:0,branches:1},timezone:'America/Lima',periodStart:'2026-09-01',periodEnd:'2026-10-01'};
 else if(name==='get_plan_catalog')data=[plan];
 else if(name==='users')data=[{id:uid,full_name:'Prueba local',email:'unit@local.invalid',platform_role:'USER'}];
 else if(name==='business_users')data=[{business_id:bid,role_code:'BUSINESS_ADMIN',employee_id:null,status:'ACTIVE'}];
 else if(name==='role_permissions')data=['website.manage','settings.manage','services.view','team.view'].map(permission_key=>({permission_key}));
 else if(name==='businesses')data=[business];
 else if(name==='locations')data=[{id:'loc1',business_id:bid,name:'Principal',active:true,is_default:true}];
 else if(name==='plans')data=[plan];
 const count=Array.isArray(data)?data.length:1;if(req.headers().accept?.includes('vnd.pgrst.object'))data=Array.isArray(data)?data[0]??null:data;
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':count?`0-${count-1}/${count}`:'*/0'},body:req.method()==='HEAD'?'':JSON.stringify(data)});
});
const session={access_token:'unit-token',refresh_token:'unit-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'unit@local.invalid',role:'authenticated',aud:'authenticated'}};
await context.addInitScript(value=>localStorage.setItem('beautyos-auth',JSON.stringify(value)),session);
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:5173/#/app/website');await page.getByRole('button',{name:'Elegir Éditorial'}).waitFor();assert.equal(await page.getByRole('button',{name:/Elegir (Éditorial|Studio|Serene)/}).count(),3);await page.screenshot({path:'.pgtest/website-templates.png',fullPage:true});console.log('PASS: selector inicial con exactamente tres plantillas');
 await page.getByRole('button',{name:'Elegir Éditorial'}).click();await page.getByLabel('Título de la sección',{exact:true}).fill('Tu nuevo momento empieza aquí');
 await page.getByRole('button',{name:'Previsualizar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Previsualización privada'});await dialog.frameLocator('iframe').getByRole('heading',{name:'Tu nuevo momento empieza aquí'}).waitFor();assert.equal(published,null);console.log('PASS: previsualizar muestra cambios sin guardar, sin publicar ni abrir URL equivocada');await dialog.frameLocator('iframe').locator('body').press('Escape');await dialog.waitFor({state:'hidden'});assert(await page.getByRole('button',{name:'Previsualizar',exact:true}).evaluate(el=>el===document.activeElement));
 await page.getByRole('button',{name:/Sobre nosotros/,exact:false}).first().click();await page.getByLabel('Tu historia').fill('Una historia editada de verdad.');
 await page.getByRole('button',{name:/Ubicación y contacto/}).first().click();await page.getByLabel('Referencia del mapa').fill('Miraflores, Lima');
 await page.getByRole('button',{name:/Pie de página y redes/}).first().click();await page.getByLabel('instagram',{exact:true}).fill('https://instagram.com/luma');
 await page.getByRole('button',{name:'Marca y apariencia',exact:true}).click();await page.getByLabel('Tipografía',{exact:true}).selectOption('sans');
 failSave=true;await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'Rechazo de prueba'}).waitFor();assert.equal(revision,0);assert.equal(raw.website.template_key,null);console.log('PASS: guardar rechazado no finge persistencia ni pierde cambios');
 failSave=false;await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByText('Borrador guardado. Tu página pública no cambió.',{exact:true}).waitFor();assert.equal(raw.branding.font_key,'sans');assert.equal(raw.website.map_query,'Miraflores, Lima');assert.equal(raw.website.socials.instagram,'https://instagram.com/luma');assert.equal(raw.sections.find(s=>s.type==='ABOUT').content.body,'Una historia editada de verdad.');assert.equal(published,null);console.log('PASS: texto, fuente, mapa y redes se guardan realmente en la RPC');
 await page.reload();await page.getByRole('button',{name:'Cambiar plantilla',exact:true}).waitFor();await page.getByLabel('Título de la sección',{exact:true}).waitFor();assert.equal(await page.getByLabel('Título de la sección',{exact:true}).inputValue(),'Tu nuevo momento empieza aquí');console.log('PASS: el borrador se conserva al recargar');
 png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=30;c.height=30;const ctx=c.getContext('2d');ctx.fillStyle='#b59d87';ctx.fillRect(0,0,30,30);return c.toDataURL('image/png').split(',')[1];}),'base64');
 await page.getByLabel('Cambiar imagen de portada',{exact:true}).setInputFiles({name:'portada.png',mimeType:'image/png',buffer:png});await page.getByAltText('Portada',{exact:true}).waitFor();assert(uploadedPath.includes(`/brand-assets/${bid}/website/cover/`));console.log('PASS: portada usa subida real del cliente Storage y prefijo del tenant');
 await page.getByLabel('Cambiar imagen de portada',{exact:true}).setInputFiles({name:'script.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByRole('alert').filter({hasText:'JPG, PNG o WebP'}).waitFor();console.log('PASS: archivo no admitido rechazado sin fingir subida');
 failPublish=true;await page.getByRole('button',{name:'Publicar cambios',exact:true}).click();await page.getByRole('alert').filter({hasText:'Rechazo de prueba'}).waitFor();assert.equal(published,null);assert.equal(await page.getByLabel('Enlace público').count(),0);console.log('PASS: publicación fallida no entrega URL ni marca la página publicada');
 failPublish=false;await page.getByRole('button',{name:'Publicar cambios',exact:true}).click();await page.getByLabel('Enlace público').waitFor();assert.equal(await page.getByLabel('Enlace público').inputValue(),'http://localhost:5173/#/b/luma-atelier');assert(published.branding.cover_url.includes('/brand-assets/'));console.log('PASS: publicar confirma release y muestra URL del despliegue con slug real');
 const publicPage=await context.newPage();await publicPage.goto('http://localhost:5173/#/b/luma-atelier');await publicPage.getByRole('heading',{name:'Tu nuevo momento empieza aquí'}).waitFor();assert.equal(await publicPage.locator('.nuvia-site').getAttribute('data-template'),'EDITORIAL');await publicPage.close();console.log('PASS: enlace público renderiza el snapshot publicado');
 for(const name of ['Studio','Serene']){await page.getByRole('button',{name:'Cambiar plantilla',exact:true}).click();await page.getByRole('button',{name:`Elegir ${name}`,exact:true}).click();await page.getByLabel('Título de la sección',{exact:true}).waitFor();assert.equal(await page.getByLabel('Título de la sección',{exact:true}).inputValue(),'Tu nuevo momento empieza aquí');const frame=page.frameLocator('iframe[title="Vista previa privada de tu página"]');await frame.locator(`.nuvia-site[data-template="${name.toUpperCase()}"]`).waitFor();}console.log('PASS: cambiar las tres plantillas cambia diseño y conserva contenido');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Celular',exact:true}).click();await page.screenshot({path:'.pgtest/website-editor-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));const frame=page.frameLocator('iframe[title="Vista previa privada de tu página"]');assert(await frame.locator('body').evaluate(el=>el.ownerDocument.documentElement.scrollWidth<=el.ownerDocument.defaultView.innerWidth));console.log('PASS: editor y renderer móvil sin desbordamiento horizontal');
 assert.deepEqual(errors,[]);console.log('PASS: sin errores de runtime');
}catch(e){console.error('runtime',errors);console.error((await page.locator('body').innerText()).slice(0,5000));throw e;}finally{await browser.close();}
