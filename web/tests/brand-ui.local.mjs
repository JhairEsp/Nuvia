// Solo UI local, con Supabase interceptado. No modifica el backend remoto.
import { chromium } from '../../.cache/ui-tests/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext();
 await context.route('**/*.supabase.co/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  const data=name==='get_public_site'?{business:{name:'Salón de prueba',slug:'salon-prueba'},branding:{preset:'MODERN'},website:{socials:{}},sections:[{type:'FOOTER',position:0,active:true,content:{}}]}:[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1365,390]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:5173/#/login');
  await page.getByRole('heading',{name:'Inicia sesión'}).waitFor();
  await page.getByText('Nuvia',{exact:true}).filter({visible:true}).waitFor();
  assert((await page.title()).startsWith('Nuvia'));
  assert.equal(await page.locator('meta[name="application-name"]').getAttribute('content'),'Nuvia');
  assert(!(await page.locator('body').innerText()).includes('BeautyOS'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  console.log(`PASS: login Nuvia ${width}px, marca visible y metadatos correctos`);
 }
 const icon=await context.request.get('http://localhost:5173/favicon.svg');assert.equal(icon.status(),200);assert((await icon.text()).includes('<title>Nuvia</title>'));console.log('PASS: favicon Nuvia disponible');
 await page.goto('http://localhost:5173/#/plans');await page.getByRole('heading',{name:'Planes Nuvia'}).waitFor();console.log('PASS: catálogo con nueva marca');
 await page.goto('http://localhost:5173/#/b/salon-prueba');await page.getByText('Hecho con Nuvia',{exact:true}).waitFor();assert(!(await page.locator('body').innerText()).includes('BeautyOS'));console.log('PASS: sitio público acredita Nuvia, conservando el nombre del negocio');
 const source=readFileSync(new URL('../src/lib/supabase.ts',import.meta.url),'utf8');assert(source.includes('storageKey: "beautyos-auth"'));
 assert.equal(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).name,'nuvia-web');
 assert.deepEqual(errors,[]);console.log('PASS: paquete Nuvia, clave de sesión compatible y sin errores React');
 await context.close();
} finally { await browser.close(); }
