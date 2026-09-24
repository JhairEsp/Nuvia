// Pruebas UI AISLADAS: interceptan Supabase, no crean cuentas ni modifican el proyecto real.
// Dependencia local: npm install --prefix .cache/ui-tests playwright; npx playwright install chromium
import { chromium } from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
const bid='b0000000-0000-0000-0000-000000000001', uid='a0000000-0000-0000-0000-000000000001';
let businessPlan=false, superAdmin=false, workers=3;
const plans=[{id:'f0000000-0000-0000-0000-000000000001',code:'STARTER',name:'Starter',description:'Para negocios que están comenzando a digitalizar su operación.',price_monthly:79,is_active:true,limits:{max_employees:5,max_monthly_appointments:300,max_storage_mb:500,max_branches:1},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:false}},{id:'f0000000-0000-0000-0000-000000000002',code:'BUSINESS',name:'Business',description:'Para negocios que necesitan operar y crecer sin límites de trabajadores ni citas.',price_monthly:299,is_active:true,limits:{max_employees:null,max_monthly_appointments:null,max_storage_mb:10240,max_branches:null},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:true}}];
let branches=[{id:'11000000-0000-0000-0000-000000000001',business_id:bid,name:'Principal',active:true,is_default:true}];
let denyMessage = true;
const customer={id:'c0000000-0000-0000-0000-000000000001',business_id:bid,full_name:'Cliente UI',phone:'999123456',whatsapp_opt_in:true};
let messages=[];
let automation={id:'d0000000-0000-0000-0000-000000000001',business_id:bid,name:'Recordatorio',trigger_event:'REMINDER_24H',channel:'WHATSAPP',template:'Hola cliente',is_enabled:true,delay_minutes:0};
const calls=[];
const profile=()=>({id:uid,email:'test@unit.invalid',full_name:'Prueba UI',platform_role:superAdmin?'SUPER_ADMIN':'USER'});
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(), url=new URL(req.url()), last=url.pathname.split('/').pop(); calls.push({last,url:url.toString(),body:req.postDataJSON()});
 const p=businessPlan?plans[1]:plans[0]; let data=[];
 if(url.pathname.startsWith('/auth/')) data={id:uid,email:'test@unit.invalid',aud:'authenticated',role:'authenticated'};
 else if(url.pathname.includes('/rpc/')) {
  if(last==='get_plan_catalog')data=plans;
  else if(last==='get_plan_usage') data={capabilities:{planId:p.id,code:p.code,name:p.name,priceMonthly:p.price_monthly,subscriptionStatus:'ACTIVE',maxWorkers:p.limits.max_employees,maxMonthlyAppointments:p.limits.max_monthly_appointments,maxStorageMb:p.limits.max_storage_mb,maxBranches:p.limits.max_branches,website:true,loyalty:true,aiCopilot:true,whatsapp:true,multiBranch:businessPlan},usage:{workers,appointments:127,branches:branches.length,storageBytes:214*1048576},periodStart:'2026-09-01T05:00:00Z',periodEnd:'2026-10-01T05:00:00Z',timezone:'America/Lima'};
  else if(last==='get_branch_report_dates')data={branches:[]};
  else if(last==='admin_save_plan')data=req.postDataJSON().p_id;
  else if(last==='save_branch') {const f=req.postDataJSON().p_data;branches.push({id:'11000000-0000-0000-0000-000000000003',business_id:bid,...f,is_default:false});data=branches.at(-1).id;}
  else data=null;
 } else if(last==='customers')data=[customer];
 else if(last==='automation_rules') { if(req.method()==='PATCH') automation={...automation,...req.postDataJSON()}; data=[automation]; }
 else if(last==='whatsapp_messages') {
  if(req.method()==='POST') {
   if(denyMessage) { await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Prueba: mensaje rechazado por backend'})}); return; }
   messages.push({id:'d1000000-0000-0000-0000-000000000001',...req.postDataJSON(),created_at:new Date().toISOString(),customers:{full_name:customer.full_name}});
  }
  data=messages;
 } else if(last==='users')data=[profile()];
 else if(last==='business_users')data=superAdmin?[]:[{business_id:bid,role_code:'BUSINESS_ADMIN',employee_id:null,status:'ACTIVE'}];
 else if(last==='role_permissions')data=['reports.view','settings.manage','team.manage','team.view','calendar.manage','ai.use','whatsapp.manage'].map(permission_key=>({permission_key}));
 else if(last==='businesses')data=[{id:bid,name:'Negocio UI',slug:'negocio-ui',type:'SALON',status:'ACTIVE',currency:'PEN',timezone:'America/Lima',subscriptions:[{plan_id:p.id,status:'ACTIVE',created_at:'2026-09-01',id:'sub-test'}],business_users:[{count:1}]}];
 else if(last==='plans')data=plans;
 else if(last==='locations')data=branches;
 else if(last==='roles')data=[{code:'BUSINESS_ADMIN',name:'Administrador'}];
 const count=Array.isArray(data)?data.length:1;
 if(req.headers().accept?.includes('vnd.pgrst.object'))data=Array.isArray(data)?data[0]??null:data;
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':count?`0-${count-1}/${count}`:'*/0'},body:req.method()==='HEAD'?'':JSON.stringify(data)});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://localhost:5173/#/plans');await page.getByRole('button',{name:'Elegir Business'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Comenzar con Starter'}).count(),1);assert.equal(await page.getByText('Trabajadores ilimitados',{exact:true}).count(),1);
 assert.equal(await page.getByText('Copiloto IA',{exact:true}).count(),2);assert.equal(await page.getByText('Fidelización',{exact:true}).count(),2);assert.equal(await page.getByText('WhatsApp',{exact:true}).count(),2);
 console.log('PASS: pricing muestra dos planes y las mismas capacidades base');
 const session={access_token:'test-token',refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'test@unit.invalid',aud:'authenticated',role:'authenticated'}};
 await context.addInitScript(value=>localStorage.setItem('beautyos-auth',JSON.stringify(value)),session);
 await page.goto('http://localhost:5173/#/app/settings/plan');await page.reload();await page.getByText('3 / 5',{exact:true}).waitFor();await page.getByText('127 / 300',{exact:true}).waitFor();await page.getByText('214 MB / 500 MB',{exact:true}).waitFor();console.log('PASS: Mi plan muestra consumo entregado por backend');
 workers=5;await page.goto('http://localhost:5173/#/app/team');await page.reload();const add=page.getByRole('button',{name:'Nuevo trabajador'});await add.waitFor();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Nuevo trabajador'))?.disabled);await add.click();await page.getByText(/Has alcanzado el límite de 5 trabajadores/).waitFor();assert.equal(calls.filter(c=>c.last==='save_team_member').length,0);console.log('PASS: Starter advierte sexto trabajador sin simular guardado');
 await page.goto('http://localhost:5173/#/app/whatsapp');await page.getByRole('button',{name:'Mensaje rápido',exact:true}).click();await page.getByPlaceholder('Hola, ¿agendamos tu próxima visita?').fill('Mensaje de prueba local');await page.getByRole('button',{name:'Agregar a la cola',exact:true}).click();await page.getByText('Prueba: mensaje rechazado por backend',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),1);assert.equal(messages.length,0);console.log('PASS: WhatsApp no anuncia éxito ni cierra el formulario ante rechazo backend');
 denyMessage=false;await page.getByRole('button',{name:'Agregar a la cola',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('En cola',{exact:true}).waitFor();assert.equal(messages[0].status,'QUEUED');assert.equal(await page.getByText('Enviado',{exact:true}).count(),0);console.log('PASS: WhatsApp confirma cola persistida, no entrega externa');
 await page.getByRole('button',{name:'Plantilla',exact:true}).click();await page.getByRole('dialog').locator('textarea').fill('Plantilla guardada en backend');await page.getByRole('dialog').getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(automation.template,'Plantilla guardada en backend');console.log('PASS: plantilla WhatsApp persiste al guardar, no por pulsación');
 businessPlan=true;branches.push({id:'11000000-0000-0000-0000-000000000002',business_id:bid,name:'Centro',active:true,is_default:false});
 await page.goto('http://localhost:5173/#/app/settings/plan');await page.reload();await page.getByText('Ilimitados · 5 registrados',{exact:true}).waitFor();await page.getByText('Ilimitadas · 127 utilizadas',{exact:true}).waitFor();console.log('PASS: Business muestra ilimitados, no 50 ni 20000');
 await page.getByLabel('Sucursal',{exact:true}).selectOption(branches[1].id);
 await page.waitForFunction(()=>document.getElementById('branch-scope')?.value.endsWith('2'));
 await page.goto('http://localhost:5173/#/app/settings/branches');await page.getByRole('button',{name:'Nueva sucursal'}).click();await page.getByRole('dialog').getByLabel('Nombre',{exact:true}).fill('Norte');await page.getByRole('button',{name:'Guardar sucursal',exact:true}).click();await page.getByRole('heading',{name:'Norte',exact:true}).waitFor();assert(calls.some(c=>c.last==='save_branch'&&c.body.p_business_id===bid));console.log('PASS: Business crea sucursal usando RPC y refresca la lista');
 superAdmin=true;await page.goto('http://localhost:5173/?admin-test=1#/admin/plans');await page.getByRole('button',{name:'Editar Business',exact:true}).click();await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});const saved=calls.filter(c=>c.last==='admin_save_plan').at(-1);assert.equal(saved.body.p_data.limits.max_employees,null);assert.equal(saved.body.p_data.limits.max_monthly_appointments,null);assert.equal(saved.body.p_data.limits.max_branches,null);console.log('PASS: editor Super Admin preserva null y las capacidades');
 assert.deepEqual(errors,[]);console.log('PASS: sin errores de runtime React');
} catch (error) { console.error("UI errors:",errors); console.error(page.url(),(await page.locator("body").innerText()).slice(0,7000)); throw error; } finally {await browser.close();}
