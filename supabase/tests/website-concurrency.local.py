"""Solo PostgreSQL LOCAL en 55432, base beautyos_plans_test. No usa DATABASE_URL."""
import json, subprocess, concurrent.futures, threading
P=['sudo','-u','postgres','psql','-h','/var/run/postgresql','-p','55432','-d','beautyos_plans_test','-v','ON_ERROR_STOP=1','-At']
bid='b0000000-0000-0000-0000-000000000001'
owner='a0000000-0000-0000-0000-000000000002'
draft={'business':{'name':'Publicación concurrente'},'branding':{'colors':{'primary':'#813c30','button':'#813c30'},'font_key':'serif'},'website':{'template_key':'EDITORIAL','socials':{}},'sections':[{'type':t,'position':i,'active':True,'content':{'title':'Título '+t}} for i,t in enumerate(['HERO','SERVICES','ABOUT','GALLERY','TEAM','PROMOTIONS','TESTIMONIALS','LOCATION','CTA','FOOTER'])]}
def sql(text):return subprocess.run(P,input=text,text=True,capture_output=True)
# SQL funcional hace rollback. Ejecutar sobre fixtures sin publicaciones previas.
r=sql(f"select coalesce((select draft_revision from public.business_website where business_id='{bid}'),0)")
assert r.returncode==0 and r.stdout.strip()=='0','Reconstruye la base local antes de repetir'
barrier=threading.Barrier(2)
def compete(i):
 barrier.wait()
 return sql(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);select public.publish_website_draft('{bid}',$draft${json.dumps(draft)}$draft$::jsonb,0);select pg_sleep(0.2);commit;")
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(compete,[0,1]))
assert sum(r.returncode==0 for r in results)==1,[(r.stdout,r.stderr) for r in results]
assert any('otra sesión' in r.stderr for r in results)
r=sql(f"select count(*) from public.website_releases where business_id='{bid}';select draft_revision from public.business_website where business_id='{bid}';")
assert r.stdout.strip().splitlines()==['1','1'],r.stdout
print('PASS: dos publicaciones simultáneas sobre la misma revisión producen un único release; la otra se rechaza sin sobrescribir')
