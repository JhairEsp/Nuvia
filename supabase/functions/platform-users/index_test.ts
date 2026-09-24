// Pruebas aisladas: fetch sustituido, nunca contactan Supabase ni crean cuentas reales.
type ServeHandler = (req: Request, info: Deno.ServeHandlerInfo) => Response | Promise<Response>;
let handler: ServeHandler;
const originalServe = Deno.serve;
Deno.serve = ((fn: ServeHandler) => { handler = fn; return {}; }) as typeof Deno.serve;
await import("./index.ts");
Deno.serve = originalServe;
Deno.env.set("SUPABASE_URL", "https://unit-test.invalid");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
const actor = "a0000000-0000-0000-0000-000000000001";
const target = "a0000000-0000-0000-0000-000000000002";
const assert = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type Scenario = { lookupStatus?: number; unauthorized?: boolean; normal?: boolean; profileError?: boolean; action?: string; id?: string; invalidPassword?: boolean; method?: string };
async function exercise(s: Scenario) {
  const calls: string[] = []; const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const path = url.pathname; const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    if (path === "/auth/v1/user") return Promise.resolve(s.unauthorized ? response({ message: "invalid JWT", code: "bad_jwt" }, 401) : response({ id: actor, email: "admin@unit.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} }));
    if (path === "/rest/v1/users") return Promise.resolve(response({ platform_role: s.normal ? "USER" : "SUPER_ADMIN" }));
    if (path === "/rest/v1/rpc/admin_require_super") return Promise.resolve(response(null));
    if (path === "/rest/v1/roles") return Promise.resolve(response([{ code: "BUSINESS_ADMIN" }]));
    if (path === `/auth/v1/admin/users/${target}` && method === "GET" && s.lookupStatus) return Promise.resolve(response({ code: s.lookupStatus === 404 ? "user_not_found" : s.lookupStatus === 500 ? "unexpected_failure" : "not_admin", message: s.lookupStatus === 500 ? "Database error querying schema" : "Auth lookup rejected" }, s.lookupStatus));
    if (path === "/auth/v1/admin/users" || path === `/auth/v1/admin/users/${target}`) return Promise.resolve(response({ id: target, email: "person@unit.invalid", user_metadata: { full_name: "Before" } }));
    if (path === "/rest/v1/rpc/admin_save_user_profile") return Promise.resolve(s.profileError ? response({ message: "Perfil rechazado", code: "P0001" }, 400) : response(null));
    if (path === "/rest/v1/audit_logs") return Promise.resolve(response(null));
    throw new Error(`Unexpected request: ${method} ${path}`);
  }) as typeof fetch;
  try {
    const method = s.method ?? "POST";
    const req = new Request("https://local.invalid/platform-users", { method, headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ action: s.action ?? "create", id: s.id ?? target, data: { email: "person@unit.invalid", full_name: "Persona", platform_role: "USER", memberships: [], password: s.invalidPassword ? "123" : "long-password-2026" } }) : undefined });
    const result = await handler(req, {} as Deno.ServeHandlerInfo);
    return { status: result.status, calls, body: result.status === 204 ? null : await result.json() };
  } finally { globalThis.fetch = originalFetch; }
}
Deno.test("OPTIONS: CORS sin operaciones", async () => { const r = await exercise({ method: "OPTIONS" }); assert(r.status === 204 && r.calls.length === 0, "CORS"); });
Deno.test("Rechaza JWT inválido antes de usar Admin API", async () => { const r = await exercise({ unauthorized: true }); assert(r.status === 401 && !r.calls.some(c => c.includes("/admin/")), "Autenticación"); });
Deno.test("Rechaza usuario no Super Admin", async () => { const r = await exercise({ normal: true }); assert(r.status === 403 && !r.calls.some(c => c.includes("/admin/")), "Autorización"); });
Deno.test("Bloquea eliminación de cuenta propia", async () => { const r = await exercise({ action: "delete", id: actor }); assert(r.status === 409 && !r.calls.some(c => c.includes("/admin/")), "Autoeliminación"); });
Deno.test("Valida contraseña antes de crear cuenta", async () => { const r = await exercise({ invalidPassword: true }); assert(r.status === 400 && !r.calls.some(c => c.includes("/admin/")), "Password"); });
Deno.test("Crea vía Auth API y guarda perfil por RPC", async () => { const r = await exercise({}); assert(r.status === 200 && r.body.ok && r.calls.includes("POST /auth/v1/admin/users") && r.calls.includes("POST /rest/v1/rpc/admin_save_user_profile"), "Create"); });
Deno.test("Compensa alta si falla perfil", async () => { const r = await exercise({ profileError: true }); assert(r.status === 409 && r.calls.includes(`DELETE /auth/v1/admin/users/${target}`), "Rollback create"); });
Deno.test("Edita cuenta y perfil", async () => { const r = await exercise({ action: "update" }); assert(r.status === 200 && r.calls.includes(`PUT /auth/v1/admin/users/${target}`), "Update"); });
Deno.test("Compensa correo si falla perfil", async () => { const r = await exercise({ action: "update", profileError: true }); assert(r.status === 409 && r.calls.filter(c => c === `PUT /auth/v1/admin/users/${target}`).length === 2, "Rollback update"); });
Deno.test("Elimina vía Auth API y registra actor", async () => { const r = await exercise({ action: "delete" }); assert(r.status === 200 && r.calls.includes(`DELETE /auth/v1/admin/users/${target}`) && r.calls.includes("POST /rest/v1/audit_logs"), "Delete"); });

for (const action of ["delete", "update"]) {
  for (const status of [404, 500, 403]) {
    Deno.test(`${action}: distingue fallo de Auth ${status} y no modifica datos`, async () => {
      const r = await exercise({ action, lookupStatus: status });
      assert(r.status === (status === 404 ? 404 : 502), "HTTP correcto");
      assert(r.body.code === (status === 404 ? "AUTH_USER_NOT_FOUND" : status === 500 ? "AUTH_LOOKUP_FAILED" : "AUTH_ADMIN_ACCESS_DENIED"), "Diagnóstico correcto");
      assert(!r.calls.some(c => c.startsWith("DELETE ") || c.startsWith("PUT ") || c.includes("admin_save_user_profile")), "No debe escribir ante fallo de consulta");
      if (status === 500) assert(r.body.error.includes("Database error querying schema"), "Conservar causa original");
    });
  }
}
