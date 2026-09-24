"""Solo PostgreSQL LOCAL con stubs. Nunca usa DATABASE_URL ni toca Supabase remoto.
Ejecutar después de .pgtest/rebuild-plans.sh. Dos conexiones reales compiten por el último cupo.
"""
import subprocess
from concurrent.futures import ThreadPoolExecutor

PSQL = ['sudo', '-u', 'postgres', 'psql', '-h', '/var/run/postgresql', '-p', '55432', '-d', 'beautyos_plans_test', '-v', 'ON_ERROR_STOP=1', '-At']
BID = 'b0000000-0000-0000-0000-000000000001'
OWNER = 'a0000000-0000-0000-0000-000000000002'
SUPER = 'a0000000-0000-0000-0000-000000000001'
CUSTOMER = 'c1000000-0000-0000-0000-000000000001'

def sql(query, check=True):
    r = subprocess.run(PSQL, input=query, text=True, capture_output=True)
    if check and r.returncode:
        raise RuntimeError(r.stderr)
    return r

def compete(query, expected):
    def run(i):
        return sql(f"begin; select set_config('request.jwt.claim.sub','{OWNER}',true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated; {query.format(i=i)}; select pg_sleep(0.2); commit;", False)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, range(2)))
    assert sum(r.returncode == 0 for r in results) == 1, [(r.returncode, r.stderr) for r in results]
    assert any(expected in r.stderr for r in results), [r.stderr for r in results]

sql(f"""
select set_config('request.jwt.claim.sub','{SUPER}',false);
insert into public.employees(business_id,full_name) select '{BID}','Concurrent base '||i from generate_series(1,4) i;
insert into public.customers(id,business_id,full_name,phone,referral_code) values('{CUSTOMER}','{BID}','Concurrent','999777666','CONCUR1');
insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end) select '{BID}','{CUSTOMER}',now(),now()+interval '1 hour' from generate_series(1,299);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
insert into storage.objects(bucket_id,name,metadata) values('brand-assets','{BID}/concurrent-base','{{"size":523239424}}');
insert into public.businesses(id,name,slug,status) values('b1000000-0000-0000-0000-000000000001','Concurrent branch','concurrent-branch','ACTIVE');
insert into public.business_users(business_id,user_id,role_code,status) values('b1000000-0000-0000-0000-000000000001','{OWNER}','BUSINESS_ADMIN','ACTIVE');
""")
compete(f"insert into public.employees(business_id,full_name) values('{BID}','Concurrent {{i}}')", 'límite de 5')
assert sql(f"select count(*) from public.employees where business_id='{BID}'").stdout.strip() == '5'
print('PASS: dos conexiones compiten por trabajador 5; nunca se crea el sexto')
compete(f"insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end) values('{BID}','{CUSTOMER}',now(),now()+interval '1 hour')", 'límite de 300')
assert sql(f"select count(*) from public.appointments where business_id='{BID}'").stdout.strip() == '300'
print('PASS: dos conexiones compiten por cita 300; nunca se crea la 301')
compete(f"insert into storage.objects(bucket_id,name,metadata) values('brand-assets','{BID}/file-{{i}}',jsonb_build_object('size',1048576))", 'almacenamiento')
assert sql(f"select sum((metadata->>'size')::bigint) from storage.objects where name like '{BID}/%'").stdout.strip() == '524288000'
print('PASS: dos conexiones compiten por último MB; no sobrepasan 500 MB')
compete("insert into public.locations(business_id,name,is_default) values('b1000000-0000-0000-0000-000000000001','Sucursal {i}',true)", 'múltiples sucursales')
assert sql("select count(*) from public.locations where business_id='b1000000-0000-0000-0000-000000000001'").stdout.strip() == '1'
print('PASS: dos conexiones compiten por primera sucursal Starter; solo una persiste')

sql(f"insert into public.loyalty_accounts(business_id,customer_id,points,lifetime_points) values('{BID}','{CUSTOMER}',100,100)")
compete(f"select public.adjust_loyalty_points('{BID}','{CUSTOMER}',-100,'Canje concurrente {{i}}')", 'Puntos insuficientes')
assert sql(f"select points from public.loyalty_accounts where customer_id='{CUSTOMER}'").stdout.strip() == '0'
print('PASS: dos canjes compiten por 100 puntos; solo uno persiste y nunca hay saldo negativo')
