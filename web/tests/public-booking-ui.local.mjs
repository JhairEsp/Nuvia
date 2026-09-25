// Solo pruebas: todas las llamadas Supabase interceptadas. No crea reservas remotas.
import { chromium } from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const service = (n, name, price, loc = 10) => ({ id: id(n), name, price, description: 'Servicio del catálogo actual', durationMin: 30, active: true, showOnWebsite: true, locationId: id(loc) });
const branches = [
 { id: id(10), name: 'Miraflores', address: 'Av. de prueba 123', timezone: 'America/Lima', services: [service(1, 'Corte express', 15), service(2, 'Asesoría', 0)], team: [{ id: id(20), fullName: 'Luis Pérez' }] },
 { id: id(11), name: 'Barranco', timezone: 'America/Lima', services: [service(3, 'Corte completo', 35, 11)], team: [{ id: id(21), fullName: 'Ana Torres' }] },
];
const snapshot = {
 business: { name: 'Barbería de prueba', slug: 'reserva-local', type: 'BARBERSHOP', phone: '999123456' },
 branding: { preset: 'MODERN', colors: {}, font_key: 'sans' }, website: { template_key: 'STUDIO' },
 sections: [{ type: 'HERO', position: 0, active: true, content: { title: 'Tu corte. Tu momento.' } }, { type: 'SERVICES', position: 1, active: true, content: { title: 'Servicios' } }], services: [], team: [],
};
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = []; let passed = 0;
const pass = label => { passed++; console.log(`PASS: ${label}`); };
async function setup(options = {}) {
 const state = { catalog: structuredClone(branches), catalogFail: false, availabilityFail: false, empty: false, booking: 'success', calls: [], ...options };
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo' });
 await context.route('**/*.supabase.co/**', async route => {
  const req = route.request(), endpoint = new URL(req.url()).pathname.split('/').pop();
  const body = req.postData() ? req.postDataJSON() : null;
  state.calls.push({ endpoint, body });
  const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const reject = message => respond({ code: 'P0001', message }, 400);
  if (endpoint === 'get_public_site') return respond(state.snapshot ?? snapshot);
  if (endpoint === 'get_public_branches') return state.catalogFail ? reject('Fallo de prueba') : respond(state.catalog);
  if (endpoint === 'get_public_availability') {
   if (state.availabilityFail) return reject('Fallo de disponibilidad');
   const employee = body.p_employee_id || (body.p_location_id === id(10) ? id(20) : id(21));
   const slots = state.empty ? [] : ['21:00', '21:00', '22:00'].map(time => ({ starts_at: `${body.p_date}T${time}:00-05:00`, location_id: body.p_location_id, employee_id: employee }));
   if (state.holdAvailability) { const release = await new Promise(resolve => { state.releaseAvailability = resolve; }); if (release) return respond(release); }
   return respond(slots);
  }
  if (endpoint === 'create_booking') {
   if (state.booking === 'conflict') return reject('Ese horario ya no está disponible en esta sucursal');
   if (state.booking === 'limit') return reject('Starter alcanzó su límite de citas. El negocio debe revisar su plan.');
   if (state.booking === 'network') return route.abort('failed');
   if (state.booking === 'null') return respond(null);
   if (state.holdBooking) await new Promise(resolve => { state.releaseBooking = resolve; });
   return respond({ appointment_id: id(99), total: 15, starts_at: body.p_start, ends_at: new Date(Date.parse(body.p_start) + 30 * 60000).toISOString() });
  }
  throw new Error(`Petición remota no prevista: ${endpoint}`);
 });
 const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
 // En Lima aún es 25, en el navegador (Tokio) ya es 26: hoy debe ser 25.
 await page.clock.install({ time: new Date('2026-09-26T01:00:00Z') });
 await page.goto('http://localhost:5173/#/b/reserva-local');
 const open = async (label = 'Reservar') => { await page.getByRole('button', { name: label, exact: true }).first().click(); await page.getByRole('dialog', { name: 'Reserva tu cita' }).waitFor(); };
 const dialog = page.getByRole('dialog');
 const choose = async () => { await dialog.getByRole('button', { name: /Corte express/ }).click(); await dialog.getByRole('button', { name: 'Continuar', exact: true }).click(); await dialog.getByRole('button', { name: '21:00', exact: true }).click(); await dialog.getByRole('button', { name: 'Continuar', exact: true }).click(); };
 const contact = async () => { await dialog.getByLabel('Nombre completo').fill('José Ramos'); await dialog.getByLabel('Teléfono o WhatsApp').fill('987 654 321'); await dialog.getByLabel('Nota para el negocio (opcional)', { exact: true }).fill('Prefiero tijera.'); await dialog.getByRole('button', { name: 'Continuar', exact: true }).click(); };
 return { state, context, page, open, dialog, choose, contact };
}
try {
 {
  const t = await setup(); const {page, dialog, state} = t;
  assert.equal(await page.getByText('Reservas próximamente').count(), 0);
  await t.open(); await t.choose();
  assert.equal(state.calls.find(c => c.endpoint === 'get_public_availability').body.p_date, '2026-09-25');
  await dialog.getByLabel('Nombre completo').fill('Li'); await dialog.getByLabel('Teléfono o WhatsApp').fill('abcdefghi');
  assert(await dialog.getByRole('button', {name:'Continuar',exact:true}).isDisabled());
  await t.contact();
  assert(await dialog.getByText(/21:00/).count());
  await page.screenshot({path:'.pgtest/booking-review-mobile.png', animations:'disabled'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  state.holdBooking = true;
  await dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).evaluate(el=>{el.click();el.click();});
  await dialog.getByRole('button',{name:'Registrando…',exact:true}).waitFor();
  assert(await dialog.getByRole('button',{name:'Cerrar reserva'}).isDisabled());
  await page.keyboard.press('Escape'); assert(await dialog.isVisible());
  while(!state.releaseBooking) await new Promise(r=>setTimeout(r,10));
  state.releaseBooking(); await page.getByRole('heading',{name:'¡Reserva registrada!'}).waitFor();
  assert.equal(state.calls.filter(c=>c.endpoint==='create_booking').length,1);
  const payload=state.calls.find(c=>c.endpoint==='create_booking').body;
  assert.deepEqual(payload,{p_slug:'reserva-local',p_service_ids:[id(1)],p_employee_id:null,p_location_id:id(10),p_start:'2026-09-26T02:00:00.000Z',p_name:'José Ramos',p_phone:'987654321',p_notes:'Prefiero tijera.'});
  assert(await dialog.getByText(/pendiente de confirmación/).count());
  assert(await dialog.getByText(new RegExp(id(99))).count());
  await dialog.getByRole('button',{name:'Listo',exact:true}).click(); await t.open();
  assert.equal(await dialog.getByRole('button',{name:/Corte express/}).getAttribute('aria-pressed'),'false');
  assert.equal(await dialog.getByRole('heading',{name:'¡Reserva registrada!'}).count(),0);
  pass('snapshot vacío: reserva sin cuenta, servicio S/15, hoy y hora Lima desde Tokio, teléfono validado, notas, RPC completo, éxito pendiente, doble clic bloqueado y reapertura limpia');
  await t.context.close();
 }
 {
  const t=await setup(); await t.open(); const {dialog,state}=t;
  await dialog.getByRole('button',{name:/Asesoría/}).click();
  assert.equal(await dialog.getByRole('button',{name:/Asesoría/}).getAttribute('aria-pressed'),'true');
  assert(!(await dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled()));
  await dialog.getByLabel('Sucursal',{exact:true}).selectOption(id(11));
  await dialog.getByRole('button',{name:/Corte completo/}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:/Asesoría/}).count(),0);
  assert(await dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled());
  await dialog.getByRole('button',{name:/Corte completo/}).click(); await dialog.getByLabel('Profesional',{exact:true}).selectOption(id(21));
  await dialog.getByRole('button',{name:'Continuar',exact:true}).click(); await dialog.getByRole('button',{name:'21:00',exact:true}).click();
  await dialog.getByRole('button',{name:'Atrás',exact:true}).click(); await dialog.getByLabel('Profesional',{exact:true}).selectOption('');
  await dialog.getByRole('button',{name:'Continuar',exact:true}).click();
  assert(await dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled());
  assert.equal(await dialog.getByRole('button',{name:'21:00',exact:true}).getAttribute('aria-pressed'),'false');
  assert(state.calls.some(c=>c.endpoint==='get_public_availability'&&c.body.p_location_id===id(11)&&c.body.p_employee_id===id(21)&&c.body.p_service_ids[0]===id(3)));
  pass('servicio gratuito seleccionable, cambio de sucursal reinicia servicios y profesional, cambio de profesional invalida horario');await t.context.close();
 }
 {
  const t=await setup({catalogFail:true}); await t.open(); await t.dialog.getByRole('alert').waitFor();
  assert.equal(await t.dialog.getByRole('button',{name:/Corte express/}).count(),0);
  t.state.catalogFail=false; await t.dialog.getByRole('button',{name:'Reintentar servicios'}).click(); await t.dialog.getByRole('button',{name:/Corte express/}).waitFor();
  pass('fallo de catálogo honesto, sin fallback obsoleto; reintento recupera servicios'); await t.context.close();
 }
 {
  const t=await setup({availabilityFail:true}); await t.open(); await t.dialog.getByRole('button',{name:/Corte express/}).click(); await t.dialog.getByRole('button',{name:'Continuar',exact:true}).click();
  await t.dialog.getByRole('button',{name:'Reintentar horarios'}).waitFor(); assert(await t.dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled());
  t.state.availabilityFail=false; t.state.empty=true; await t.dialog.getByRole('button',{name:'Reintentar horarios'}).click(); await t.dialog.getByText('No hay horarios disponibles para esta fecha.',{exact:true}).waitFor();
  t.state.empty=false; await t.dialog.getByRole('button',{name:'Actualizar horarios'}).click(); await t.dialog.getByRole('button',{name:'21:00',exact:true}).click();
  assert.equal(await t.dialog.getByRole('button',{name:'21:00',exact:true}).count(),1);
  // Late old-day response must never overwrite the chosen day's slots.
  t.state.holdAvailability=true; await t.dialog.getByLabel('O elige otra fecha').fill('2026-09-27');
  await t.dialog.getByText('Consultando horarios reales…').waitFor();
  assert.equal(await t.dialog.getByRole('button',{name:'21:00',exact:true}).count(),0);
  while(!t.state.releaseAvailability) await new Promise(r=>setTimeout(r,10));
  t.state.holdAvailability=false; await t.dialog.getByLabel('O elige otra fecha').fill('2026-09-28');
  await t.dialog.getByRole('button',{name:'21:00',exact:true}).waitFor();
  t.state.releaseAvailability([{starts_at:'2026-09-27T23:00:00-05:00',location_id:id(10),employee_id:id(20)}]);
  await t.page.waitForTimeout(100); assert.equal(await t.dialog.getByRole('button',{name:'23:00',exact:true}).count(),0);
  assert(await t.dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled());
  pass('error y vacío de disponibilidad diferenciados, reintento, horas deduplicadas, fechas posteriores, descarte de respuestas tardías'); await t.context.close();
 }
 for(const mode of ['conflict','limit','null','network']) {
  const t=await setup({booking:mode}); await t.open(); await t.choose(); await t.contact(); await t.dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).click();
  await t.dialog.getByRole('alert').waitFor(); assert.equal(await t.dialog.getByRole('heading',{name:'¡Reserva registrada!'}).count(),0);
  if(mode==='conflict') {
   await t.dialog.getByRole('heading',{name:'Elige fecha y hora'}).waitFor();
   await t.dialog.getByRole('button',{name:'22:00',exact:true}).click(); await t.dialog.getByRole('button',{name:'Continuar',exact:true}).click();
   assert.equal(await t.dialog.getByLabel('Nombre completo').inputValue(),'José Ramos');
   assert.equal(await t.dialog.getByLabel('Nota para el negocio (opcional)',{exact:true}).inputValue(),'Prefiero tijera.');
   await t.dialog.getByRole('button',{name:'Continuar',exact:true}).click(); t.state.booking='success'; await t.dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).click(); await t.page.getByRole('heading',{name:'¡Reserva registrada!'}).waitFor();
  } else if(mode==='null'||mode==='network') assert(await t.dialog.getByRole('button',{name:'Confirmar reserva',exact:true}).isDisabled());
  else assert(await t.dialog.getByRole('alert').getByText(/Starter alcanzó/).count());
  pass(`confirmación ${mode}: sin éxito falso${mode==='conflict'?', recupera otro horario conservando datos':mode==='null'||mode==='network'?', no reenvía ciegamente una reserva de resultado desconocido':''}`); await t.context.close();
 }
 {
  const stale={...snapshot,services:[{id:id(1),name:'Corte express',price:599,duration_min:99,active:true,show_on_website:true}]};
  const t=await setup({snapshot:stale}); await t.open('Reservar Corte express');
  const serviceButton=t.dialog.getByRole('button',{name:/Corte express/}); await serviceButton.waitFor();
  assert.equal(await serviceButton.getAttribute('aria-pressed'),'true'); assert(!(await serviceButton.innerText()).includes('599')); assert((await serviceButton.innerText()).includes('15'));
  pass('preselección de tarjeta publicada usa precio y duración actuales, no el snapshot'); await t.context.close();
 }
 for(const [label,catalog,expected] of [
  ['sin sucursales',[],'Sin sucursales disponibles para reservar'],
  ['sin servicios',[{...branches[0],services:[]}],'Esta sucursal aún no tiene servicios disponibles para reservar online.'],
  ['sin equipo',[{...branches[0],team:[]}],'Esta sucursal aún no tiene profesionales habilitados para reservas online.'],
 ]) {
  const t=await setup({catalog}); await t.open(); await t.dialog.getByText(expected,{exact:false}).waitFor();
  assert.equal(t.state.calls.filter(c=>c.endpoint==='create_booking').length,0);
  if(catalog.length) assert(await t.dialog.getByRole('button',{name:'Continuar',exact:true}).isDisabled());
  pass(`${label}: mensaje claro sin datos inventados`);await t.context.close();
 }
 assert.deepEqual(errors,[]); pass('sin errores React en todas las pruebas');
 console.log(`TOTAL: ${passed} PASS`);
} finally { await browser.close(); }
