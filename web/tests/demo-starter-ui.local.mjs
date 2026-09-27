// Solo demos: bloquear cualquier petición Supabase. No se usan cuentas ni datos remotos.
import {chromium} from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1512,height:1100},locale:'es-PE'});
const requests=[],errors=[];await context.route('**/*.supabase.co/**',r=>{requests.push(r.request().url());return r.abort();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const nav=name=>page.getByRole('navigation',{name:'Navegación de la demo'}).getByRole('button',{name,exact:true});
let passes=0;const pass=label=>{passes++;console.log('PASS: '+label);};
try{
 await page.goto('http://localhost:5173/#/login');await page.getByRole('link',{name:'Abrir demo de barbería'}).waitFor();
 assert((await page.locator('.login-demo-plan').innerText()).includes('5 trabajadores'));assert((await page.locator('.login-demo-plan').innerText()).includes('300 citas/mes'));assert((await page.locator('.login-demo-plan').innerText()).includes('500 MB'));pass('Login presenta Starter y las cuatro funciones en ambas demos');
 const pure=await page.evaluate(async()=>{
  const m=await import('/src/features/demo/starter-state.ts');const p=await import('/src/features/demo/starter-plan.ts');const d=await import('/src/features/demo/data.ts');
  const results=[];const check=(b,name)=>{if(!b)throw new Error(name);results.push(name);};
  check(p.DEMO_STARTER.maxWorkers===5&&p.DEMO_STARTER.maxMonthlyAppointments===300&&p.DEMO_STARTER.maxStorageMb===500&&!p.DEMO_STARTER.multiBranch&&p.DEMO_STARTER.maxBranches===1,'Snapshot Starter exacto: 5 / 300 / 500, una sucursal');
  for(const kind of ['barberia','estetica']){
   const base=m.createDemoState({kind,today:'2030-06-10'}),svc=d.demoServices(kind)[0];let state=base;
   state=m.demoReducer(state,{type:'ADD_WORKER',name:'Cuarto demo'});state=m.demoReducer(state,{type:'ADD_WORKER',name:'Quinto demo'});check(state.workers.length===5,kind+': permite quinto trabajador');
   const sixth=m.demoReducer(state,{type:'ADD_WORKER',name:'Sexto demo'});check(sixth.workers.length===5&&sixth.error.includes('5 trabajadores'),kind+': rechaza sexto también en reducer');
   const template={...base.appointments[2],day:'2030-06-10',time:'09:00',serviceId:svc.id,employee:base.workers[0],paid:false};
   const full={...base,appointments:Array.from({length:300},(_,i)=>({...template,id:'filled-'+i}))};
   const extra={...template,id:'extra',time:'18:00',customer:'Otra persona demo'};
   check(m.demoReducer(full,{type:'ADD_APPOINTMENT',appointment:extra}).appointments.length===300,'Cita 301 bloqueada '+kind);
   const canceled=m.demoReducer(full,{type:'CANCEL',id:'filled-0'});check(m.monthlyAppointments(canceled,'2030-06-10')===299,'Cancelada no atendida libera cupo '+kind);
   const recovered=m.demoReducer(canceled,{type:'ADD_APPOINTMENT',appointment:extra});check(m.monthlyAppointments(recovered,'2030-06-10')===300&&recovered.appointments.length===301,'Reutiliza cupo sin borrar históricos '+kind);
   const future=m.demoReducer(full,{type:'ADD_APPOINTMENT',appointment:{...extra,day:'2030-07-10'}});check(m.monthlyAppointments(future,'2030-07-10')===1&&m.monthlyAppointments(future,'2030-06-10')===300,'Mes siguiente independiente '+kind);
   const complete=m.demoReducer(base,{type:'CANCEL',id:base.appointments[0].id});check(complete.appointments[0].paid&&complete.appointments[0].status==='COMPLETED','No libera cita ya atendida '+kind);
   const byteLimit=p.DEMO_STORAGE_LIMIT-m.demoStorageBytes(base);
   const exact=m.demoReducer(base,{type:'ADD_FILES',files:[{id:'exact',name:'capacidad.png',size:byteLimit,type:'image/png'}]});check(m.demoStorageBytes(exact)===p.DEMO_STORAGE_LIMIT,'Permite exactamente 500 MB '+kind);
   const overflow=m.demoReducer(exact,{type:'ADD_FILES',files:[{id:'excess',name:'extra.png',size:1,type:'image/png'}]});check(overflow.files.length===2&&overflow.error.includes('500 MB'),'Rechaza un byte sobre 500 MB '+kind);
   const freed=m.demoReducer(exact,{type:'REMOVE_FILE',id:'exact'});check(m.demoStorageBytes(freed)===m.demoStorageBytes(base),'Quitar archivo libera capacidad '+kind);
   check(m.demoReducer(base,{type:'ADD_FILES',files:[{id:'invalid',name:'negativo.png',size:-1,type:'image/png'}]}).files.length===1,'Rechaza tamaño negativo '+kind);
   const who=base.appointments[0].customer,initial=m.demoPoints(base,who);let reward=m.demoReducer(base,{type:'REDEEM',id:'reward',customer:who});
   check(m.demoPoints(reward,who)===initial-p.DEMO_REWARD_COST,'Canje descuenta exactamente puntos '+kind);
   reward=m.demoReducer(reward,{type:'REDEEM',id:'reward',customer:who});check(reward.redemptions.length===1,'Doble confirmación del canje es idempotente '+kind);
   for(let i=0;i<20;i++)reward=m.demoReducer(reward,{type:'REDEEM',id:'try-'+i,customer:who});check(m.demoPoints(reward,who)>=0,'Nunca deja saldo negativo '+kind);
   let queued=m.demoReducer(base,{type:'QUEUE',id:'queue',customer:who,text:'Mensaje demo'});queued=m.demoReducer(queued,{type:'QUEUE',id:'queue',customer:who,text:'Mensaje demo'});check(queued.messages.length===1&&queued.messages[0].status==='QUEUED_DEMO','Cola idempotente, nunca SENT '+kind);
   const before=m.demoAiAnswer(base,'Resume mi negocio'),paid=m.demoReducer(base,{type:'PAY',id:base.appointments[2].id});check(m.demoAiAnswer(paid,'Resume mi negocio')!==before,'Copiloto guiado usa ventas actuales '+kind);
   const reset=m.demoReducer({...paid,workers:state.workers,files:exact.files,redemptions:reward.redemptions,messages:queued.messages,chat:[{id:'c',question:'q',answer:'a'}]},{type:'RESET'});check(JSON.stringify(reset)===JSON.stringify(base),'Reinicio completo y aislado '+kind);
  }
  return results;
 });for(const label of pure)pass('Reglas: '+label);
 for(const [kind,first,balance] of [['barberia','Lucas Torres',35],['estetica','Mariana Torres',120]]){
  await page.goto('http://localhost:5173/#/demo/'+kind);await nav('Fidelización').waitFor();await nav('Copiloto IA').waitFor();await nav('WhatsApp').waitFor();
  await page.locator('.nd-starter-summary').waitFor();assert((await page.locator('.nd-starter-summary').innerText()).includes('Sin multisucursal'));
  await nav('Plan y almacenamiento').click();await page.getByRole('heading',{name:'Plan Starter',exact:true}).waitFor();
  for(const text of ['Hasta 5 trabajadores','300 citas mensuales','500 MB de almacenamiento','Multisucursal: no incluido'])await page.getByText(text,{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Nueva sucursal|Crear sucursal|Cambiar sucursal/}).count(),0);
  await page.screenshot({path:`.pgtest/starter-${kind}-plan.png`,fullPage:true,animations:'disabled'});pass(kind+': plan completo y ninguna acción de multisucursal');
  await page.getByLabel('Añadir archivos a la demo',{exact:true}).setInputFiles({name:'prueba-demo.png',mimeType:'image/png',buffer:Buffer.alloc(2048,1)});
  await page.getByText('prueba-demo.png',{exact:true}).waitFor();assert((await page.locator('.nd-files-list').innerText()).includes('No subido'));
  await page.getByRole('button',{name:'Quitar archivo demo prueba-demo.png',exact:true}).click();assert.equal(await page.getByText('prueba-demo.png',{exact:true}).count(),0);pass(kind+': alta/baja de metadatos de archivos sin subir contenido');
  await nav('Servicios y equipo').click();
  for(const name of ['Cuarto de ejemplo','Quinto de ejemplo']){await page.getByLabel('Nombre ficticio del trabajador',{exact:true}).fill(name);await page.getByRole('button',{name:'Añadir trabajador demo',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();}
  assert(await page.getByRole('button',{name:'Añadir trabajador demo',exact:true}).isDisabled());await page.getByText(/Llegaste al límite de 5 trabajadores/).waitFor();
  await page.getByRole('button',{name:'Probar cita',exact:true}).first().click();await page.getByRole('dialog').getByLabel('Profesional',{exact:true}).selectOption('Quinto de ejemplo');await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();pass(kind+': quinto trabajador disponible para citas, no permite sexto');
  await nav('Fidelización').click();await page.getByLabel('Cliente de fidelización',{exact:true}).selectOption(first);assert.equal(await page.getByTestId('demo-loyalty-balance').textContent(),`${balance}puntos demo`);
  await page.getByRole('button',{name:'Simular canje',exact:true}).click();await page.getByRole('button',{name:'Confirmar canje demo',exact:true}).evaluate(el=>{el.click();el.click();});
  assert.equal(await page.getByTestId('demo-loyalty-balance').textContent(),`${balance-25}puntos demo`);
  await nav('Clientes').click();await page.getByRole('textbox',{name:'Buscar cliente demo'}).fill(first);assert((await page.locator('.nd-client').innerText()).replace(/\s+/g,' ').includes(String(balance-25)+' puntos demo'));
  await page.locator('.nd-client').click();await page.getByRole('dialog').getByText(new RegExp('^'+(balance-25)+' puntos demo')).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  pass(kind+': canje real del estado demo, saldo e historial coherentes en Clientes');
  await nav('Copiloto IA').click();await page.getByRole('heading',{name:'Nuvia IA',exact:true}).waitFor();await page.getByRole('button',{name:'Resume mi negocio',exact:true}).click();
  await page.getByRole('log').getByText(/5 trabajadores/).waitFor();assert((await page.locator('.nd-ai-header').innerText()).includes('sin conexión a un modelo'));
  await page.getByLabel('Pregunta para Nuvia IA demo',{exact:true}).fill('¿Qué servicio se vende más?');await page.getByRole('button',{name:'Consultar Nuvia IA demo',exact:true}).click();await page.getByRole('log').getByText(/Las 2 ventas simuladas/).waitFor();
  await nav('Ventas').click();await page.getByRole('button',{name:/^Registrar venta demo de /}).first().click();await nav('Copiloto IA').click();await page.getByRole('button',{name:'¿Qué servicio se vende más?',exact:true}).click();await page.getByRole('log').getByText(/Las 3 ventas simuladas/).waitFor();pass(kind+': Nuvia IA conserva conversación y actualiza respuestas guiadas con las ventas demo');
  await page.screenshot({path:`.pgtest/starter-${kind}-ai.png`,fullPage:true,animations:'disabled'});
  await nav('WhatsApp').click();await page.getByRole('heading',{name:'WhatsApp',exact:true}).waitFor();
  await page.getByLabel('Plantilla de WhatsApp demo',{exact:true}).selectOption('followup');await page.getByLabel('Mensaje de WhatsApp demo',{exact:true}).fill('Mensaje de presentación. No enviar.');
  await page.getByRole('button',{name:'Añadir a cola demo',exact:true}).evaluate(el=>{el.click();el.click();});await page.getByText('En cola demo · No enviado',{exact:true}).waitFor();assert.equal(await page.getByText('En cola demo · No enviado',{exact:true}).count(),1);
  const follow=page.getByRole('switch',{name:'Automatización demo: Seguimiento de atención',exact:true});assert.equal(await follow.getAttribute('aria-checked'),'false');await follow.click();assert.equal(await follow.getAttribute('aria-checked'),'true');
  await nav('Resumen').click();await nav('WhatsApp').click();await page.getByText('En cola demo · No enviado',{exact:true}).waitFor();assert.equal(await page.getByText('En cola demo · No enviado',{exact:true}).count(),1);assert.equal(await follow.getAttribute('aria-checked'),'true');
  pass(kind+': WhatsApp prepara cola demo idempotente y mantiene automatizaciones sin enviar');
  await page.screenshot({path:`.pgtest/starter-${kind}-whatsapp.png`,fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  for(const label of ['Fidelización','Copiloto IA','WhatsApp','Plan y almacenamiento']){await nav(label).click();await nav(label).and(page.locator('[aria-current=page]')).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),kind+'/'+label+' overflow');}
  await page.screenshot({path:`.pgtest/starter-${kind}-mobile.png`,fullPage:true,animations:'disabled'});pass(kind+': los cuatro nuevos módulos funcionan en móvil sin overflow');
  await page.getByRole('button',{name:'Reiniciar demo',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Sí, reiniciar demo',exact:true}).click();
  await nav('WhatsApp').click();await page.getByText(/Todavía no hay mensajes en la cola demo/).waitFor();assert.equal(await follow.getAttribute('aria-checked'),'false');
  await nav('Fidelización').click();assert.equal(await page.getByTestId('demo-loyalty-balance').textContent(),`${balance}puntos demo`);await nav('Copiloto IA').click();await page.getByRole('heading',{name:'¿Qué te gustaría revisar?',exact:true}).waitFor();
  await nav('Plan y almacenamiento').click();assert.equal(await page.getByRole('progressbar',{name:'Trabajadores',exact:true}).getAttribute('aria-valuenow'),'3');pass(kind+': reiniciar restablece equipo, puntos, chat, mensajes y automatizaciones');
  await page.setViewportSize({width:1512,height:1100});
 }
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);pass('Cero peticiones Supabase, ningún envío/IA real ni errores React');
 console.log(`TOTAL: ${passes} PASS`);
}catch(e){console.error(e,errors,requests);console.error((await page.locator('body').innerText()).slice(-4000));await page.screenshot({path:'.pgtest/starter-demo-failure.png',fullPage:true});throw e;}finally{await browser.close();}
