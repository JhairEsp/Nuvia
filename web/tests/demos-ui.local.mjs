// Demos aisladas: cualquier llamada de red a Supabase se bloquea y hace fallar el test.
import {chromium} from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1512,height:1100},locale:'es-PE'});
const requests=[],errors=[];
await context.route('**/*.supabase.co/**',async route=>{requests.push({url:route.request().url(),method:route.request().method()});await route.abort();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const go=async path=>{await page.goto('http://localhost:5173/#'+path);};
const nav=name=>page.getByRole('navigation',{name:'Navegación de la demo'}).getByRole('button',{name,exact:true});
let passed=0;const pass=label=>{passed++;console.log('PASS: '+label);};
try{
 await go('/login');await page.getByRole('link',{name:'Abrir demo de barbería'}).waitFor();await page.getByRole('link',{name:'Abrir demo de estética'}).waitFor();
 const afterLogin=await page.evaluate(()=>{const form=document.querySelector('form').getBoundingClientRect();const demos=document.querySelector('.login-demos').getBoundingClientRect();return demos.top>=form.bottom;});assert(afterLogin);
 await page.screenshot({path:'.pgtest/demos-login-desktop.png',fullPage:true,animations:'disabled'});
 pass('Dos accesos debajo del formulario, sin necesidad de cuenta');
 for(const [slug,label,name,service,price] of [['barberia','barbería','Distrito 01','Corte clásico',35],['estetica','estética','Alma Estética','Limpieza facial',120]]){
  await go('/login');await page.getByRole('link',{name:'Abrir demo de '+label}).click();
  await page.getByRole('heading',{level:1}).waitFor();assert((await page.locator('.nd-business').innerText()).includes(name));
  assert.equal(await page.locator('.nd-kpi').nth(0).locator('strong').innerText(),'6');
  const sessionBefore=await page.evaluate(async()=>{const {useSession}=await import('/src/store/session.ts');const {useDB}=await import('/src/store/db.ts');return {user:useSession.getState().user,businessId:useDB.getState().businessId,stored:localStorage.getItem('beautyos-auth')};});
  assert.equal(sessionBefore.user,null);
  await page.screenshot({path:`.pgtest/demo-${slug}-desktop.png`,fullPage:true,animations:'disabled'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  pass(`${label}: resumen diferenciado, seis citas ficticias, sin cuenta`);
  await nav('Página web').click();await page.getByRole('button',{name:'Reservar',exact:true}).first().waitFor();
  if(slug==='barberia')assert.equal(await page.locator('.nw-barber').count(),1);else {assert.equal(await page.locator('.nw-barber').count(),0);await page.locator('#nw-HERO img.nw-cover').evaluate(img=>img.decode());assert(await page.locator('#nw-HERO img.nw-cover').evaluate(img=>img.naturalWidth>0));}
  await page.screenshot({path:`.pgtest/demo-${slug}-web.png`,fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:`Reservar ${service}`,exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Prueba la reserva online'});await modal.waitFor();
  await modal.getByLabel('Nombre de ejemplo',{exact:true}).fill('Presentación demo');
  assert((await modal.getByLabel('Servicio',{exact:true}).inputValue()).startsWith('demo-'+slug+'-service-0'));
  assert(await modal.getByRole('button',{name:'Añadir cita de demostración'}).isDisabled());
  const chosenTime=await modal.getByRole('button',{name:/^\d\d:\d\d$/}).first().innerText();
  await modal.getByRole('button',{name:chosenTime,exact:true}).click();
  await modal.getByRole('button',{name:'Añadir cita de demostración'}).focus();await page.keyboard.press('Tab');assert.equal(await modal.getByRole('button',{name:'Cerrar',exact:true}).evaluate(el=>el===document.activeElement),true);
  await modal.getByRole('button',{name:'Añadir cita de demostración'}).evaluate(el=>{el.click();el.click();});
  await page.getByRole('status').getByText(/Cita demo añadida/).waitFor();
  await page.getByRole('button',{name:'Presentación demo',exact:true}).waitFor();
  pass(`${label}: reserva web simulada se incorpora a la agenda local, sin RPC`);
  await nav('Resumen').click();assert.equal(await page.locator('.nd-kpi').nth(0).locator('strong').innerText(),'7');
  const oldRevenue=await page.locator('.nd-kpi').nth(1).locator('strong').innerText();
  await nav('Ventas').click();await page.getByRole('button',{name:'Registrar venta demo de Presentación demo',exact:true}).click();
  await page.getByRole('status').getByText(/Sin cobro real/).waitFor();assert.equal(await page.getByRole('button',{name:'Registrar venta demo de Presentación demo',exact:true}).count(),0);
  await nav('Resumen').click();assert.notEqual(await page.locator('.nd-kpi').nth(1).locator('strong').innerText(),oldRevenue);
  await nav('Clientes').click();await page.getByRole('textbox',{name:'Buscar cliente demo'}).fill('Presentación demo');await page.locator('.nd-client').click();
  await page.getByRole('dialog',{name:'Presentación demo'}).getByText(new RegExp(`^${price} puntos demo`)).waitFor();
  await page.getByRole('dialog',{name:'Presentación demo'}).getByRole('button',{name:'Cerrar',exact:true}).click();
  pass(`${label}: venta demo única actualiza resumen, historial y puntos; búsqueda funciona`);
  await nav('Agenda').click();
  const cancellable=page.getByRole('button',{name:/^Cancelar cita demo de /}).first();const cancelledName=(await cancellable.getAttribute('aria-label')).replace('Cancelar cita demo de ','');
  await cancellable.click();await page.getByRole('status').getByText(/Cita demo cancelada/).waitFor();
  const cancelled=page.locator('.nd-appointment').filter({has:page.getByRole('button',{name:cancelledName,exact:true})});await cancelled.getByText('Cancelada',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Cancelar cita demo de Presentación demo',exact:true}).count(),0);
  pass(`${label}: cancelación local y protección de cita demo ya pagada`);
  await page.getByRole('button',{name:'Reiniciar demo',exact:true}).click();await page.getByRole('dialog',{name:'¿Empezar de nuevo?'}).getByRole('button',{name:'Sí, reiniciar demo'}).click();
  await page.getByRole('status').getByText(/Demo reiniciada/).waitFor();assert.equal(await page.locator('.nd-kpi').nth(0).locator('strong').innerText(),'6');
  const sessionAfter=await page.evaluate(async()=>{const {useSession}=await import('/src/store/session.ts');const {useDB}=await import('/src/store/db.ts');return {user:useSession.getState().user,businessId:useDB.getState().businessId,stored:localStorage.getItem('beautyos-auth')};});
  assert.deepEqual(sessionAfter,sessionBefore);pass(`${label}: reinicio sin tocar sesión, storage Auth ni store real`);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`.pgtest/demo-${slug}-mobile.png`,fullPage:true,animations:'disabled'});
  for(const tab of ['Resumen','Agenda','Clientes','Servicios y equipo','Ventas','Página web']){
   await nav(tab).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${slug}/${tab}: overflow`);
  }
  await page.getByRole('button',{name:'Reservar',exact:true}).first().click();await page.getByRole('dialog').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`.pgtest/demo-${slug}-booking-mobile.png`,animations:'disabled'});
  await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});await nav('Resumen').click();assert.equal(await page.locator('.nd-kpi').first().evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  pass(`${label}: seis pantallas y reserva en móvil sin overflow, reduced motion respetado`);
  await page.setViewportSize({width:1512,height:1100});
 }
 await go('/demo/barberia');await page.getByRole('link',{name:'Ver demo de estética'}).click();await page.getByText('Alma Estética',{exact:true}).first().waitFor();assert.equal(await page.locator('.nd-kpi').nth(0).locator('strong').innerText(),'6');pass('Cambiar rubro inicia datos propios, sin mezclar demos');
 await go('/app/calendar');await page.getByRole('heading',{name:'Inicia sesión'}).waitFor();assert(page.url().includes('/login'));pass('Explorar demo no permite entrar a rutas privadas sin login');
 await go('/demo/inexistente');await page.getByRole('heading',{name:'Inicia sesión'}).waitFor();pass('Ruta demo inválida vuelve al login');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.pgtest/demos-login-mobile.png',fullPage:true,animations:'disabled'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);pass('CERO llamadas Supabase y CERO errores React en todo el recorrido');
 console.log(`TOTAL: ${passed} PASS`);
}catch(error){console.error(error);console.error('Errors:',errors,'Network:',requests);console.error((await page.locator('body').innerText()).slice(-4000));await page.screenshot({path:'.pgtest/demo-failure.png',fullPage:true});throw error;}finally{await browser.close();}
