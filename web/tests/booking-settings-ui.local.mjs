// Aisladas: APIs Supabase y Storage interceptadas, nunca usa datos remotos.
import { chromium } from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1365,height:1000}});
const bid='b0000000-0000-0000-0000-000000000001',uid='a0000000-0000-0000-0000-000000000002',loc='11000000-0000-0000-0000-000000000001',cid='c0000000-0000-0000-0000-000000000001',eid='e0000000-0000-0000-0000-000000000001';
const plan={id:'f0000000-0000-0000-0000-000000000001',code:'BUSINESS',name:'Business',price_monthly:299,is_active:true,limits:{max_employees:null,max_monthly_appointments:null,max_storage_mb:10240,max_branches:null},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:true}};
const business={id:bid,name:'Negocio QR local',slug:'negocio-qr',type:'SALON',status:'ACTIVE',currency:'PEN',timezone:'America/Lima'};
const loc2='11000000-0000-0000-0000-000000000002';
let hours=[],rules={business_id:bid,slot_minutes:30,min_lead_minutes:1440,cancel_window_hours:12,rebooking_days:28},failHours=false,failRules=false,failHoursRead=false,failRulesRead=false;
let points=320,lifetime=420,employee={id:eid,business_id:bid,location_id:loc,full_name:'Ana Pérez',role_label:'Stylist',commission_rate:10,show_on_website:true,active:true,employee_services:[]},qrs=[],sales=[],txs=[],uploads=[],failQr=false,failSale=false,failEmployee=false,arrayAccount=false,png;
const calls=[];
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();let data=[];
 if(url.pathname.startsWith('/storage/')){
  if(req.method()==='POST'){uploads.push(decodeURIComponent(url.pathname));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:url.pathname.replace('/storage/v1/object/','')})});}
  return route.fulfill({status:200,contentType:'image/png',body:png||Buffer.alloc(0)});
 }
 const body=req.postData()?req.postDataJSON():null;calls.push({name,body,url:req.url(),method:req.method()});
 const reject=()=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Rechazo de prueba del servidor'})});
 if(url.pathname.startsWith('/auth/'))data={id:uid,email:'unit@local.invalid',aud:'authenticated',role:'authenticated'};
 else if(name==='save_branch'){
  if(failHours)return reject();assert.equal(body.p_business_id,bid);assert.equal(body.p_data.hours.length,7);
  hours=[...hours.filter(h=>h.location_id!==body.p_id),...body.p_data.hours.map(h=>({...h,location_id:body.p_id}))];data=body.p_id;
 }
 else if(name==='business_hours'){
  if(failHoursRead&&url.searchParams.get('select')?.includes('location_id'))return reject();
  data=hours;
 }
 else if(name==='business_settings'){
  if(req.method()==='POST'){if(failRules)return reject();assert.equal(body.business_id,bid);rules={...rules,...body};data=[{business_id:bid}];}
  else {if(failRulesRead)return reject(); data=[rules];}
 }
 else if(name==='get_payment_qrs')data=qrs;
 else if(name==='save_payment_qr'){if(failQr)return reject();assert.equal(body.p_business_id,bid);const row={method:body.p_method,storage_path:body.p_storage_path,holder:body.p_holder};qrs=[...qrs.filter(q=>q.method!==row.method),row];data=row;}
 else if(name==='remove_payment_qr'){qrs=qrs.filter(q=>q.method!==body.p_method);data=null;}
 else if(name==='save_team_member'){if(failEmployee)return reject();assert.equal(body.p_business_id,bid);employee={...employee,...body.p_data};data=eid;}
 else if(name==='create_branch_sale'){
  if(failSale)return reject();assert.equal(body.p_customer_id,cid);assert.equal(body.p_payments[0].method,'YAPE');assert.equal(body.p_payments[0].amount,80);
  points+=80;lifetime+=80;data='s1';sales.push({id:'s1',business_id:bid,location_id:loc,customer_id:cid,status:'PAID',total:80,subtotal:80,created_at:new Date().toISOString(),sale_items:[],payments:[{method:'YAPE',amount:80}]});txs.push({id:'t1',type:'EARN',points:80,reason:'Compra POS',created_at:new Date().toISOString(),loyalty_accounts:{customer_id:cid}});
 }
 else if(name==='get_plan_usage')data={capabilities:{planId:plan.id,code:'BUSINESS',name:'Business',priceMonthly:299,maxWorkers:null,maxMonthlyAppointments:null,maxStorageMb:10240,maxBranches:null,website:true,loyalty:true,aiCopilot:true,whatsapp:true,multiBranch:true},usage:{workers:1,appointments:0,storageBytes:0,branches:1},timezone:'America/Lima',periodStart:'2026-09-01',periodEnd:'2026-10-01'};
 else if(name==='get_plan_catalog')data=[plan];
 else if(name==='users')data=[{id:uid,email:'unit@local.invalid',full_name:'Admin UI',platform_role:'USER'}];
 else if(name==='business_users')data=[{business_id:bid,role_code:'BUSINESS_ADMIN',status:'ACTIVE'}];
 else if(name==='role_permissions')data=['settings.manage','sales.manage','sales.view','team.manage','team.view','clients.view','loyalty.manage','website.manage'].map(permission_key=>({permission_key}));
 else if(name==='businesses')data=[business];
 else if(name==='locations')data=[{id:loc,business_id:bid,name:'Principal',address:'Dirección original',city:'Lima',phone:'999111222',active:true,is_default:true},{id:loc2,business_id:bid,name:'Otra sucursal',active:true,is_default:false}].filter(b=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+b.id);
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
let passes=0;const pass=label=>{passes++;console.log('PASS: '+label);};
try {
 await go('settings');await page.getByText(/No hay horarios guardados para esta sucursal/).waitFor();
 assert.equal(await page.getByRole('checkbox',{name:/^Abierto /}).count(),7);
 assert.equal(await page.getByLabel('Anticipación mínima (min)',{exact:true}).inputValue(),'1440');
 await page.getByText(/Servicios sin profesional habilitado: Corte prueba/).waitFor();
 pass('Ajustes lee reglas guardadas, muestra siete días sin inventar horarios y advierte servicios sin profesional');
 await page.getByRole('checkbox',{name:'Abierto Lunes',exact:true}).check();
 await page.getByLabel('Apertura Lunes',{exact:true}).fill('09:00');await page.getByLabel('Cierre Lunes',{exact:true}).fill('08:00');
 await page.getByRole('button',{name:'Guardar horarios',exact:true}).click();await page.getByRole('alert').filter({hasText:'El cierre debe ser posterior'}).waitFor();
 assert.equal(calls.filter(c=>c.name==='save_branch').length,0);pass('Rechaza cierre anterior a apertura sin enviar cambios');
 await page.getByLabel('Cierre Lunes',{exact:true}).fill('18:00');failHours=true;
 await page.getByRole('button',{name:'Guardar horarios',exact:true}).click();await page.getByRole('alert').filter({hasText:'Rechazo de prueba'}).waitFor();
 assert.equal(hours.length,0);assert.equal(await page.getByLabel('Cierre Lunes',{exact:true}).inputValue(),'18:00');
 pass('Fallo de guardado no anuncia éxito, no pierde edición ni modifica datos');
 failHours=false;await page.getByRole('button',{name:'Guardar horarios',exact:true}).click();await page.getByText('Horarios guardados. Ya se usan en las reservas públicas.',{exact:true}).waitFor();
 const write=calls.filter(c=>c.name==='save_branch').at(-1).body;
 assert.equal(write.p_id,loc);assert.equal(write.p_data.address,'Dirección original');assert.equal(write.p_data.phone,'999111222');assert.equal(write.p_data.hours.length,7);
 assert.equal(hours.find(h=>h.weekday===1).open_time,'09:00');await page.reload();await page.getByLabel('Apertura Lunes',{exact:true}).waitFor();assert.equal(await page.getByLabel('Apertura Lunes',{exact:true}).inputValue(),'09:00');
 assert.equal(await page.getByText(/No hay horarios guardados para esta sucursal/).count(),0);
 pass('Guardar horarios llama RPC tenant/sucursal con siete días, preserva metadatos y persiste al recargar');
 await page.getByLabel('Anticipación mínima (min)',{exact:true}).fill('0');failRules=true;
 await page.getByRole('button',{name:'Guardar reglas',exact:true}).click();await page.getByRole('alert').filter({hasText:'Rechazo de prueba'}).waitFor();assert.equal(rules.min_lead_minutes,1440);
 failRules=false;await page.getByRole('button',{name:'Guardar reglas',exact:true}).click();await page.getByText('Reglas de reserva guardadas',{exact:true}).waitFor();
 assert.equal(rules.min_lead_minutes,0);assert.equal(rules.business_id,bid);await page.reload();await page.getByLabel('Anticipación mínima (min)',{exact:true}).waitFor();assert.equal(await page.getByLabel('Anticipación mínima (min)',{exact:true}).inputValue(),'0');
 pass('Reglas guardadas en business_settings, error honesto y anticipación 0 persiste tras recargar');
 // Historial con horario general: heredarlo, salvo cierre explícito de sucursal.
 hours.push({location_id:null,weekday:1,open_time:'08:00:00',close_time:'20:00:00',is_closed:false},{location_id:null,weekday:2,open_time:'10:00:00',close_time:'19:00:00',is_closed:false},{location_id:null,weekday:3,open_time:'09:00:00',close_time:'19:00:00',is_closed:false},{location_id:loc2,weekday:3,open_time:'00:00:00',close_time:'00:00:00',is_closed:true});
 await page.getByLabel('Sucursal de estos horarios',{exact:true}).selectOption(loc2);await page.getByLabel('Apertura Martes',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Apertura Lunes',{exact:true}).inputValue(),'08:00');assert.equal(await page.getByLabel('Apertura Martes',{exact:true}).inputValue(),'10:00');assert(!(await page.getByRole('checkbox',{name:'Abierto Miércoles',exact:true}).isChecked()));
 await page.getByLabel('Sucursal de estos horarios',{exact:true}).selectOption(loc);await page.getByLabel('Apertura Lunes',{exact:true}).waitFor();assert.equal(await page.getByLabel('Apertura Lunes',{exact:true}).inputValue(),'09:00');assert(!(await page.getByRole('checkbox',{name:'Abierto Martes',exact:true}).isChecked()));
 pass('Selector no mezcla sucursales; hereda horario general y respeta cierres explícitos');
 await go('settings/branches');await page.getByRole('button',{name:'Editar',exact:true}).nth(1).click();const modal=page.getByRole('dialog');await modal.getByLabel('Apertura Martes',{exact:true}).waitFor();assert.equal(await modal.getByLabel('Apertura Lunes',{exact:true}).inputValue(),'08:00');assert.equal(await modal.getByLabel('Apertura Martes',{exact:true}).inputValue(),'10:00');await modal.getByRole('button',{name:'Cerrar',exact:true}).click();
 pass('Editor de sucursales carga el mismo horario efectivo; ya no convierte herencia en todos cerrados');
 failHoursRead=true;failRulesRead=true;await go('settings');await page.getByRole('button',{name:'Reintentar horarios',exact:true}).waitFor();await page.getByRole('button',{name:'Reintentar reglas',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Guardar horarios',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Guardar reglas',exact:true}).count(),0);
 failHoursRead=false;failRulesRead=false;await page.getByRole('button',{name:'Reintentar horarios',exact:true}).click();await page.getByRole('button',{name:'Reintentar reglas',exact:true}).click();await page.getByLabel('Apertura Lunes',{exact:true}).waitFor();await page.getByLabel('Anticipación mínima (min)',{exact:true}).waitFor();
 pass('Fallo de lectura no permite sobrescribir datos; reintento recupera configuración');
 await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Horarios de atención',exact:true}).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.pgtest/booking-settings-mobile.png'});
 pass('Editor de horarios usable en móvil sin desbordamiento');
 await page.evaluate(async()=>{const {useSession}=await import('/src/store/session.ts');useSession.setState({permissionKeys:['team.view']});});
 assert(await page.getByRole('button',{name:'Guardar horarios',exact:true}).isDisabled());assert(await page.getByRole('button',{name:'Guardar reglas',exact:true}).isDisabled());
 pass('Sin settings.manage no hay botones de guardado habilitados');
 assert.deepEqual(errors,[]);pass('Sin errores React');console.log(`TOTAL: ${passes} PASS`);
} catch(e) {console.error(errors);console.error((await page.locator('body').innerText()).slice(-6000));throw e;} finally {await browser.close();}
