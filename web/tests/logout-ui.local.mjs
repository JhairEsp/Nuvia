// Pruebas aisladas: interceptan Supabase; nunca cierran una sesión real.
import { chromium } from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
const uid='a0000000-0000-0000-0000-000000000001', bid='b0000000-0000-0000-0000-000000000001';
const plan={id:'f0000000-0000-0000-0000-000000000001',code:'STARTER',name:'Starter',description:'Negocio individual',price_monthly:79,is_active:true,limits:{max_employees:5,max_monthly_appointments:300,max_storage_mb:500,max_branches:1},modules:{website:true,loyalty:true,ai:true,whatsapp:true,multibranch:false}};
try {
 for (const test of [{admin:false,width:1365},{admin:false,width:390},{admin:true,width:1365},{admin:true,width:390},{admin:false,width:390,fail:true}]) {
  const context=await browser.newContext({viewport:{width:test.width,height:900}});
  let logoutCalls=0;
  await context.route('**/*.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),last=url.pathname.split('/').pop();let data=[];
   if(last==='logout') {
    logoutCalls++;assert.equal(url.searchParams.get('scope'),'local');
    await new Promise(resolve=>setTimeout(resolve,400));
    await route.fulfill({status:test.fail?500:200,contentType:'application/json',body:JSON.stringify(test.fail?{message:'Fallo aislado de cierre',code:'unexpected_failure'}:{})});return;
   }
   if(url.pathname.startsWith('/auth/'))data={id:uid,email:'test@unit.invalid',aud:'authenticated',role:'authenticated'};
   else if(last==='users')data=[{id:uid,email:'test@unit.invalid',full_name:'Prueba',platform_role:test.admin?'SUPER_ADMIN':'USER'}];
   else if(last==='business_users')data=test.admin?[]:[{business_id:bid,role_code:'BUSINESS_ADMIN',employee_id:null,status:'ACTIVE'}];
   else if(last==='businesses')data=[{id:bid,name:'Negocio de prueba',slug:'local',status:'ACTIVE',type:'SALON',currency:'PEN',timezone:'America/Lima',subscriptions:[],business_users:[]}];
   else if(last==='locations')data=[{id:'11000000-0000-0000-0000-000000000001',business_id:bid,name:'Principal',active:true,is_default:true}];
   else if(last==='plans'||last==='get_plan_catalog')data=[plan];
   else if(last==='get_plan_usage')data={capabilities:{planId:plan.id,code:'STARTER',name:'Starter',priceMonthly:79,subscriptionStatus:'ACTIVE',maxWorkers:5,maxMonthlyAppointments:300,maxStorageMb:500,maxBranches:1,website:true,loyalty:true,aiCopilot:true,whatsapp:true,multiBranch:false},usage:{workers:0,appointments:0,branches:1,storageBytes:0},periodStart:'2026-09-01T05:00:00Z',periodEnd:'2026-10-01T05:00:00Z',timezone:'America/Lima'};
   const count=Array.isArray(data)?data.length:1;
   if(req.headers().accept?.includes('vnd.pgrst.object')) data=Array.isArray(data)?data[0]??null:data;
   await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':count?`0-${count-1}/${count}`:'*/0'},body:req.method()==='HEAD'?'':JSON.stringify(data)});
  });
  const session={access_token:'test-token',refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'test@unit.invalid',aud:'authenticated',role:'authenticated'}};
  await context.addInitScript(value=>{if(!sessionStorage.getItem('test-seeded')){localStorage.setItem('beautyos-auth',JSON.stringify(value));sessionStorage.setItem('test-seeded','true');}},session);
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const path=test.admin?'/admin/plans':'/app/settings/plan';
  await page.goto(`http://localhost:5173/#${path}`);
  const button=page.locator('header').getByRole('button',{name:'Cerrar sesión',exact:true});await button.waitFor();
  const rect=await button.boundingBox();assert(rect&&rect.x>=0&&rect.x+rect.width<=test.width,'Botón visible sin desbordamiento');
  await button.click();
  const busy=page.locator('header').getByRole('button',{name:'Cerrando…',exact:true});await busy.waitFor();assert(await busy.isDisabled());
  if(test.fail){
   await page.getByText('No se pudo cerrar sesión. Revisa tu conexión e inténtalo nuevamente.',{exact:true}).waitFor();
   assert(page.url().endsWith(path));assert(await page.evaluate(()=>!!localStorage.getItem('beautyos-auth')));assert.equal(await page.getByText('Sesión cerrada',{exact:true}).count(),0);
  }else{
   await page.waitForURL('**/#/login');assert.equal(await page.evaluate(()=>localStorage.getItem('beautyos-auth')),null);
   await page.reload();await page.waitForURL('**/#/login');await page.goto(`http://localhost:5173/#${path}`);await page.waitForURL('**/#/login');
  }
  assert.equal(logoutCalls,1);assert.deepEqual(errors,[]);
  console.log(`PASS: ${test.admin?'Admin':'Negocio'} ${test.width}px · ${test.fail?'error sin falso éxito':'cierre, sesión eliminada y rutas protegidas'}`);
  await context.close();
 }
} finally { await browser.close(); }
