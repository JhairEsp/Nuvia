// Pruebas de interfaz aisladas. Supabase, Storage y mapa interceptados; no toca cuentas remotas.
import {chromium} from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const bid='b0000000-0000-0000-0000-000000000001',uid='a0000000-0000-0000-0000-000000000002';
const plan={id:'f0000000-0000-0000-0000-000000000001',code:'STARTER',name:'Starter',price_monthly:79,description:'Negocio individual',limits:{max_employees:5,max_monthly_appointments:300,max_storage_mb:500,max_branches:1},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:false}};
const business={id:bid,name:'Distrito 01',slug:'distrito-01',type:'BARBERSHOP',status:'ACTIVE',description:'Una barbería con historia propia.',phone:'999123456',whatsapp:'51999123456',address:'Av. del Parque 125, Lima',email:'hola@local.invalid',currency:'PEN',timezone:'America/Lima'};
const services=[{id:'s1',name:'Corte clásico',description:'Encuentra tu estilo.',duration_min:60,price:80},{id:'s2',name:'Perfilado de barba',description:'Un toque de luz.',duration_min:90,price:150}];
const team=[{id:'e1',full_name:'Profesional de prueba',role_label:'Estilista',active:true}];
let raw={business,branding:{preset:'MODERN',colors:{},font_key:'sans'},website:{template_key:null,tagline:'',socials:{},map_query:''},sections:[],services,team,promotions:[],testimonials:[],hours:[{weekday:1,open_time:'09:00',close_time:'18:00',is_closed:false}]};
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
 await page.goto('http://localhost:5173/#/app/website');
 for(const name of ['Clásica','Urbana','Caballeros'])await page.getByRole('button',{name:`Elegir ${name}`,exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/^Elegir /}).count(),3);
 assert.equal(await page.getByRole('button',{name:/^Elegir (Éditorial|Studio|Serene)$/}).count(),0);
 await page.locator('.we-barber-chooser .nw-barber-art img').first().evaluate(img=>img.decode());
 await page.screenshot({path:'.pgtest/barber-template-selector.png',fullPage:true});console.log('PASS: Barbería ofrece exactamente Clásica, Urbana y Caballeros con arte cargado');
 const pure=await page.evaluate(async()=>{
  const m=await import('/src/features/website/templates.ts');
  const others=['SALON','SPA','AESTHETICS','NAILS','LASHES','BROWS','MASSAGE','OTHER',''];
  return {others:others.every(type=>m.templatesForBusiness(type)===m.TEMPLATES),aliases:m.isBarberBusiness('Barbería')&&m.isBarberBusiness('BARBERSHOP')&&!m.isBarberBusiness('SALON'),keys:m.BARBER_TEMPLATES.map(t=>t.key)};
 });assert(pure.others&&pure.aliases);assert.deepEqual(pure.keys,['EDITORIAL','STUDIO','SERENE']);console.log('PASS: los demás rubros conservan sus plantillas y las claves SQL no cambian');
 const names=['Clásica','Urbana','Caballeros'],keys=['EDITORIAL','STUDIO','SERENE'],titles=['El buen estilo no pasa de moda.','Tu corte. Tus reglas.','El detalle hace al caballero.'];
 for(let i=0;i<3;i++){
  if(i)await page.getByRole('button',{name:'Cambiar plantilla',exact:true}).click();
  await page.getByRole('button',{name:`Elegir ${names[i]}`,exact:true}).click();
  const frame=page.frameLocator('iframe[title="Vista previa privada de tu página"]');
  await frame.getByRole('heading',{name:titles[i],exact:true}).waitFor();
  await frame.locator(`.nw-barber[data-template="${keys[i]}"]`).waitFor();
  assert.equal(await frame.locator('.nw-barber-ribbon').count(),1);
  const image=frame.locator('#nw-HERO .nw-barber-art img');await image.evaluate(img=>img.decode());
  await page.getByRole('button',{name:'Publicar cambios',exact:true}).click();await page.getByText('¡Tu página ya está publicada!',{exact:true}).waitFor();
  assert.equal(published.website.template_key,keys[i]);assert.equal(published.business.type,'BARBERSHOP');
  const pub=await context.newPage();await pub.goto('http://localhost:5173/#/b/distrito-01');await pub.getByRole('heading',{name:titles[i],exact:true}).waitFor();
  await pub.locator('#nw-HERO .nw-barber-art img').evaluate(img=>img.decode());
  assert.equal(await pub.locator('#nw-HERO .nw-barber-art img').evaluate(el=>getComputedStyle(el).animationName),'nw-barber-pan');
  assert.equal(await pub.locator('.nw-barber-ribbon>div').evaluate(el=>getComputedStyle(el).animationName),'nw-barber-marquee');
  await pub.screenshot({path:`.pgtest/barber-${keys[i].toLowerCase()}-desktop.png`,fullPage:true,animations:'disabled'});
  assert(await pub.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await pub.setViewportSize({width:390,height:844});assert(await pub.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await pub.screenshot({path:`.pgtest/barber-${keys[i].toLowerCase()}-mobile.png`,fullPage:true,animations:'disabled'});
  await pub.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await pub.locator('#nw-HERO .nw-barber-art img').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await pub.locator('.nw-barber-ribbon>div').evaluate(el=>getComputedStyle(el).animationName),'none');
  await pub.close();console.log(`PASS: ${names[i]} preview y publicación, arte, móvil sin overflow y reduced-motion`);
 }
 // Editar contenido propio; cambiar la plantilla no debe borrarlo.
 await page.getByLabel('Título de la sección',{exact:true}).fill('Mi barbería. Mi historia.');
 await page.getByRole('button',{name:'Cambiar plantilla',exact:true}).click();await page.getByRole('button',{name:'Elegir Clásica',exact:true}).click();
 assert.equal(await page.getByLabel('Título de la sección',{exact:true}).inputValue(),'Mi barbería. Mi historia.');
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByText('Borrador guardado. Tu página pública no cambió.',{exact:true}).waitFor();
 await page.reload();await page.getByLabel('Título de la sección',{exact:true}).waitFor();assert.equal(await page.getByLabel('Título de la sección',{exact:true}).inputValue(),'Mi barbería. Mi historia.');
 assert.equal(raw.branding.preset,'ELEGANT');assert.equal(published.website.template_key,'SERENE');console.log('PASS: cambio de diseño conserva texto propio y borrador sin publicar');
 // Pure preservation of customized image/order/visibility/descriptions.
 const preserved=await page.evaluate(async()=>{
  const m=await import('/src/features/website/templates.ts');
  const base={business:{type:'BARBERSHOP',description:'Mi descripción privada del local'},branding:{preset:'DARK',colors:{},font_key:'sans',cover_url:'https://unit.invalid/cover.jpg'},website:{template_key:'STUDIO'},sections:[{type:'HERO',position:3,active:true,content:{title:'Texto único',image_url:'https://unit.invalid/hero.jpg'}},{type:'GALLERY',position:0,active:false,content:{images:[{url:'https://unit.invalid/a.jpg',alt:'Foto propia'}]}}]};
  const result=m.applyTemplate(base,'SERENE');return result.sections.find(s=>s.type==='HERO').content.title==='Texto único'&&result.branding.cover_url===base.branding.cover_url&&result.sections.find(s=>s.type==='HERO').content.image_url===base.sections[0].content.image_url&&result.sections[0].type==='GALLERY'&&!result.sections[0].active&&result.sections.find(s=>s.type==='ABOUT').content.body===base.business.description;
 });assert(preserved);console.log('PASS: conserva portada propia, galería, orden, visibilidad y descripción');
 // Mismo editor con otro rubro: catálogo anterior, ninguna decoración de barbería.
 raw={...raw,business:{...business,type:'SPA'},website:{...raw.website,template_key:null},sections:[]};
 await page.reload();await page.getByRole('button',{name:'Elegir Serene',exact:true}).waitFor();assert.equal(await page.locator('.we-barber-chooser').count(),0);assert.equal(await page.getByRole('button',{name:/^Elegir /}).count(),3);
 await page.getByRole('button',{name:'Elegir Serene',exact:true}).click();assert.equal(await page.frameLocator('iframe').locator('.nw-barber').count(),0);console.log('PASS: Spa sigue usando Serene original, sin variante de barbería');
 assert.deepEqual(errors,[]);console.log('PASS: sin errores React');
}catch(e){console.error(errors);console.error((await page.locator('body').innerText()).slice(-3500));throw e;}finally{await browser.close();}
