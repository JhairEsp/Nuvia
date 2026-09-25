from pathlib import Path
src=Path('web/tests/business-media-ui.local.mjs').read_text()
base=src[:src.index('try{\n await go(')]
base=base.replace("let points=320", "const loc2='11000000-0000-0000-0000-000000000002';\nlet hours=[],rules={business_id:bid,slot_minutes:30,min_lead_minutes:1440,cancel_window_hours:12,rebooking_days:28},failHours=false,failRules=false,failHoursRead=false,failRulesRead=false;\nlet points=320")
base=base.replace("else if(name==='get_payment_qrs')", """else if(name==='save_branch'){
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
 else if(name==='get_payment_qrs')""")
base=base.replace("data=[{id:loc,business_id:bid,name:'Principal',active:true,is_default:true}]", "data=[{id:loc,business_id:bid,name:'Principal',address:'Dirección original',city:'Lima',phone:'999111222',active:true,is_default:true},{id:loc2,business_id:bid,name:'Otra sucursal',active:true,is_default:false}].filter(b=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+b.id)")
base=base.replace("const body=req.postData()?req.postDataJSON():null;calls.push({name,body});", "const body=req.postData()?req.postDataJSON():null;calls.push({name,body,url:req.url(),method:req.method()});")
base=base.replace("let points=320", "let points=320")
base=base.replace("code:'STARTER'", "code:'BUSINESS'").replace("name:'Starter'", "name:'Business'").replace("price_monthly:79", "price_monthly:299").replace("priceMonthly:79", "priceMonthly:299").replace("max_employees:5", "max_employees:null").replace("max_monthly_appointments:300", "max_monthly_appointments:null").replace("max_storage_mb:500", "max_storage_mb:10240").replace("max_branches:1", "max_branches:null").replace("multibranch:false", "multibranch:true").replace("multiBranch:false", "multiBranch:true").replace("maxWorkers:5", "maxWorkers:null").replace("maxMonthlyAppointments:300", "maxMonthlyAppointments:null").replace("maxStorageMb:500", "maxStorageMb:10240").replace("maxBranches:1", "maxBranches:null")
Path('web/tests/booking-settings-ui.local.mjs').write_text(base)
