// Aisladas: APIs Supabase y Storage interceptadas, nunca usa datos remotos.
import { chromium } from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:1000}});
const bid='b0000000-0000-0000-0000-000000000001',uid='a0000000-0000-0000-0000-000000000002',loc='11000000-0000-0000-0000-000000000001',cid='c0000000-0000-0000-0000-000000000001',eid='e0000000-0000-0000-0000-000000000001';
const plan={id:'f0000000-0000-0000-0000-000000000001',code:'STARTER',name:'Starter',price_monthly:79,is_active:true,limits:{max_employees:5,max_monthly_appointments:300,max_storage_mb:500,max_branches:1},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:false}};
const business={id:bid,name:'Negocio QR local',slug:'negocio-qr',type:'SALON',status:'ACTIVE',currency:'PEN',timezone:'America/Lima'};
let points=320,lifetime=420,employee={id:eid,business_id:bid,location_id:loc,full_name:'Ana Pérez',role_label:'Stylist',commission_rate:10,show_on_website:true,active:true,employee_services:[]},qrs=[],sales=[],txs=[],uploads=[],failQr=false,failSale=false,failEmployee=false,arrayAccount=false,png;
const calls=[];
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let data=[];
 if(url.pathname.startsWith('/storage/')){
  if(req.method()==='POST'){uploads.push(decodeURIComponent(url.pathname));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:url.pathname.replace('/storage/v1/object/','')})});}
  return route.fulfill({status:200,contentType:'image/png',body:png||Buffer.alloc(0)});
 }
 const body=req.postData()?req.postDataJSON():null;calls.push({name,body});
 const reject=()=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Rechazo de prueba del servidor'})});
 if(url.pathname.startsWith('/auth/'))data={id:uid,email:'unit@local.invalid',aud:'authenticated',role:'authenticated'};
 else if(name==='get_payment_qrs')data=qrs;
 else if(name==='save_payment_qr'){if(failQr)return reject();assert.equal(body.p_business_id,bid);const row={method:body.p_method,storage_path:body.p_storage_path,holder:body.p_holder};qrs=[...qrs.filter(q=>q.method!==row.method),row];data=row;}
 else if(name==='remove_payment_qr'){qrs=qrs.filter(q=>q.method!==body.p_method);data=null;}
 else if(name==='save_team_member'){if(failEmployee)return reject();assert.equal(body.p_business_id,bid);employee={...employee,...body.p_data};data=eid;}
 else if(name==='create_branch_sale'){
  if(failSale)return reject();assert.equal(body.p_customer_id,cid);assert.equal(body.p_payments[0].method,'YAPE');assert.equal(body.p_payments[0].amount,80);
  points+=80;lifetime+=80;data='s1';sales.push({id:'s1',business_id:bid,location_id:loc,customer_id:cid,status:'PAID',total:80,subtotal:80,created_at:new Date().toISOString(),sale_items:[],payments:[{method:'YAPE',amount:80}]});txs.push({id:'t1',type:'EARN',points:80,reason:'Compra POS',created_at:new Date().toISOString(),loyalty_accounts:{customer_id:cid}});
 }
 else if(name==='get_plan_usage')data={capabilities:{planId:plan.id,code:'STARTER',name:'Starter',priceMonthly:79,maxWorkers:5,maxMonthlyAppointments:300,maxStorageMb:500,maxBranches:1,website:true,loyalty:true,aiCopilot:true,whatsapp:true,multiBranch:false},usage:{workers:1,appointments:0,storageBytes:0,branches:1},timezone:'America/Lima',periodStart:'2026-09-01',periodEnd:'2026-10-01'};
 else if(name==='get_plan_catalog')data=[plan];
 else if(name==='users')data=[{id:uid,email:'unit@local.invalid',full_name:'Admin UI',platform_role:'USER'}];
 else if(name==='business_users')data=[{business_id:bid,role_code:'BUSINESS_ADMIN',status:'ACTIVE'}];
 else if(name==='role_permissions')data=['settings.manage','sales.manage','sales.view','team.manage','team.view','clients.view','loyalty.manage','website.manage'].map(permission_key=>({permission_key}));
 else if(name==='businesses')data=[business];
 else if(name==='locations')data=[{id:loc,business_id:bid,name:'Principal',active:true,is_default:true}];
 else if(name==='plans')data=[plan];
 else if(name==='customers'){const acc={points,tier:'SILVER',lifetime_points:lifetime};data=[{id:cid,business_id:bid,full_name:'Cliente puntos',phone:'999123456',loyalty_accounts:arrayAccount?[acc]:acc}];}
 else if(name==='employees')data=[employee];
 else if(name==='services')data=[{id:'f2000000-0000-0000-0000-000000000001',business_id:bid,location_id:loc,name:'Corte prueba',price:80,duration_min:60,active:true,show_on_website:true}];
 else if(name==='sales')data=sales;
 else if(name==='loyalty_transactions')data=txs;
 const count=Array.isArray(data)?data.length:1;if(req.headers().accept?.includes('vnd.pgrst.object'))data=Array.isArray(data)?data[0]??null:data;
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':count?`0-${count-1}/${count}`:'*/0'},body:req.method()==='HEAD'?'':JSON.stringify(data)});
});
const session={access_token:'unit-token',refresh_token:'unit-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'unit@local.invalid',role:'authenticated',aud:'authenticated'}};
await context.addInitScript(value=>localStorage.setItem('beautyos-auth',JSON.stringify(value)),session);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const go=async path=>{await page.goto('http://localhost:5173/#/app/'+path);};
try{
 await go('loyalty');await page.getByText('320 puntos disponibles · 420 acumulados',{exact:true}).waitFor();console.log('PASS: saldo y nivel leen relación 1:1 como objeto, no muestran cero');
 arrayAccount=true;await page.reload();await page.getByText('320 puntos disponibles · 420 acumulados',{exact:true}).waitFor();arrayAccount=false;console.log('PASS: mapper también conserva compatibilidad con array');
 await go('settings');await page.getByLabel('Subir QR YAPE').waitFor();
 png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,200,200);x.fillStyle='black';x.fillRect(20,20,40,40);return c.toDataURL('image/png').split(',')[1];}),'base64');
 await page.getByLabel('Subir QR YAPE').setInputFiles({name:'qr.png',mimeType:'image/png',buffer:png});await page.getByRole('img',{name:'QR de YAPE',exact:true}).waitFor();assert(uploads[0].includes(`/brand-assets/${bid}/payments/yape/`));console.log('PASS: QR se sube desde Ajustes con ruta propia del tenant');
 await page.getByLabel('Titular YAPE').fill('Cuenta de mi negocio');failQr=true;await page.getByRole('button',{name:'Guardar QR YAPE',exact:true}).click();await page.getByRole('alert').filter({hasText:'Rechazo de prueba'}).waitFor();assert.equal(qrs.length,0);console.log('PASS: guardar QR rechazado no anuncia persistencia');
 failQr=false;await page.getByRole('button',{name:'Guardar QR YAPE',exact:true}).click();await page.getByText('QR guardado para Ventas',{exact:true}).waitFor();await page.reload();await page.getByLabel('Titular YAPE').waitFor();assert.equal(await page.getByLabel('Titular YAPE').inputValue(),'Cuenta de mi negocio');console.log('PASS: QR y titular persisten al recargar');
 await go('sales');await page.getByRole('button',{name:/Corte prueba/}).click();assert.equal(await page.getByLabel('Cliente de la venta').inputValue(),'');await page.getByRole('button',{name:/^Cobrar S/}).click();await page.getByText(/Selecciona un cliente o elige Venta sin cliente/).waitFor();assert.equal(calls.filter(c=>c.name==='create_branch_sale').length,0);console.log('PASS: POS no asigna ni pierde puntos por elegir cliente silenciosamente');
 await page.getByLabel('Cliente de la venta').selectOption(cid);await page.getByRole('button',{name:'Plin',exact:true}).click();await page.getByRole('dialog').getByText(/todavía no configuró el QR/).waitFor();await page.getByRole('dialog').getByLabel('Cerrar',{exact:true}).click();console.log('PASS: elegir Plin abre modal y explica QR faltante');
 await page.getByRole('button',{name:'Yape',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('img',{name:'Escanea el QR de YAPE'}).waitFor();await dialog.getByText('Titular: Cuenta de mi negocio',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:/Pago verificado/}).isEnabled(),false);assert.equal(sales.length,0);await page.screenshot({path:'.pgtest/business-yape-modal.png'});console.log('PASS: elegir Yape abre QR correcto con monto; mostrarlo no registra cobro');
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:/Pago verificado/}).click();await dialog.waitFor({state:'hidden'});failSale=true;await page.getByRole('button',{name:/^Cobrar S/}).click();await page.getByText('Rechazo de prueba del servidor',{exact:true}).waitFor();assert.equal(points,320);assert.equal(sales.length,0);console.log('PASS: venta fallida no suma puntos ni vacía ticket');
 failSale=false;await page.getByRole('button',{name:/^Cobrar S/}).click();await page.getByText(/Venta registrada/).waitFor();assert.equal(sales.length,1);await go('loyalty');await page.getByText('400 puntos disponibles · 500 acumulados',{exact:true}).waitFor();await page.getByText('+80',{exact:true}).waitFor();console.log('PASS: cobrar refresca saldo e historial real recibidos del backend');
 await go('team');await page.getByRole('button',{name:'Editar',exact:true}).click();const form=page.getByRole('dialog');await form.getByLabel('Subir foto del trabajador').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});await form.getByRole('img',{name:'Ana Pérez',exact:true}).waitFor();assert(uploads.at(-1).includes(`/website-media/${bid}/team/${eid}/`));console.log('PASS: trabajador registrado permite subir y previsualizar retrato');
 failEmployee=true;await form.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Rechazo de prueba del servidor',{exact:true}).waitFor();assert(!employee.photo_url);assert.equal(await form.count(),1);console.log('PASS: foto rechazada no finge guardado ni cierra formulario');
 failEmployee=false;await form.getByRole('button',{name:'Guardar',exact:true}).click();await form.waitFor({state:'hidden'});await page.getByRole('img',{name:'Ana Pérez',exact:true}).waitFor();assert(employee.photo_url?.includes('/team/'));await page.reload();await page.getByRole('img',{name:'Ana Pérez',exact:true}).waitFor();console.log('PASS: foto persiste tras guardar y recargar, visible en tarjeta');
 await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Quitar foto',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(employee.photo_url,null);console.log('PASS: quitar foto persiste sin borrar al trabajador');
 await page.setViewportSize({width:390,height:844});await go('settings');await page.getByLabel('Subir QR PLIN').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));const before=uploads.length;await page.getByLabel('Subir QR PLIN').setInputFiles({name:'mal.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByRole('alert').filter({hasText:'JPG'}).waitFor();assert.equal(uploads.length,before);console.log('PASS: ajustes móvil sin overflow y rechazo de SVG sin subir');
 await page.getByLabel('Subir QR PLIN').setInputFiles({name:'plin.png',mimeType:'image/png',buffer:png});await page.getByRole('img',{name:'QR de PLIN',exact:true}).waitFor();await page.getByRole('button',{name:'Guardar QR PLIN',exact:true}).click();await page.getByText('QR guardado para Ventas',{exact:true}).waitFor();assert.equal(qrs.length,2);await go('sales');await page.getByRole('button',{name:'Plin',exact:true}).click();await page.getByRole('dialog').getByRole('img',{name:'Escanea el QR de PLIN'}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));console.log('PASS: dos QR independientes; Plin se abre también en celular');
 assert.deepEqual(errors,[]);console.log('PASS: sin errores de runtime');
}catch(e){console.error('Runtime:',errors);console.error((await page.locator('body').innerText()).slice(-6000));throw e;}finally{await browser.close();}
