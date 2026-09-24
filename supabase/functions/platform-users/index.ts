// Despliegue actual: `quick-service` (nombre original: `platform-users`). La clave administrativa vive SOLO aquí.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No confundir fallos del proveedor (p. ej. filas antiguas inválidas) con cuenta ausente.
function lookupFailure(error: { status?: number; code?: string; message: string }, id: string) {
  console.error("platform-users auth lookup", {
    user_id: id, status: error.status, code: error.code, message: error.message,
  });
  if (error.code === "user_not_found" || error.status === 404) {
    return reply(404, { code: "AUTH_USER_NOT_FOUND", user_id: id,
      error: `Authentication no encontró la cuenta con UID ${id}. Comprueba que coincida con el perfil en public.users. No se modificó ningún dato.` });
  }
  if (error.status === 401 || error.status === 403) {
    return reply(502, { code: "AUTH_ADMIN_ACCESS_DENIED", user_id: id,
      error: "Supabase rechazó el acceso administrativo a Authentication. Revisa SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL de esta función (solo en el servidor). No se modificó ningún dato." });
  }
  return reply(502, { code: "AUTH_LOOKUP_FAILED", user_id: id,
    error: `Authentication no pudo consultar la cuenta (HTTP ${error.status ?? "desconocido"}, código ${error.code ?? "sin código"}): ${error.message}. No se modificó ningún dato. Revisa los logs de Auth; esto no significa que la cuenta no exista.` });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Método no permitido" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Verificación remota del JWT; nunca confiar en metadata ni en el rol del body.
    const { data: auth, error: authError } = await caller.auth.getUser();
    if (authError || !auth.user) return reply(401, { error: "Sesión inválida. Inicia sesión nuevamente." });
    const { data: actor, error: actorError } = await caller.from("users").select("platform_role").eq("id", auth.user.id).single();
    if (actorError || actor?.platform_role !== "SUPER_ADMIN") return reply(403, { error: "Acceso exclusivo para Super Admin" });
    // También comprueba que la actualización SQL esté instalada antes de tocar Auth.
    const { error: setupError } = await caller.rpc("admin_require_super");
    if (setupError) return reply(503, { error: "Falta aplicar la actualización SQL de administración." });
    const raw = await req.text();
    if (raw.length > 32000) return reply(413, { error: "Solicitud demasiado grande" });
    let input;
    try { input = JSON.parse(raw); } catch { return reply(400, { error: "JSON inválido" }); }
    const { action, id, data } = input ?? {};
    if (!["create", "update", "delete"].includes(action)) return reply(400, { error: "Acción inválida" });
    if (action !== "create" && (typeof id !== "string" || !uuid.test(id))) return reply(400, { error: "UID inválido" });
    if (id === auth.user.id && (action === "delete" || data?.platform_role !== "SUPER_ADMIN")) return reply(409, { error: "No puedes eliminar tu cuenta ni quitarte el rol Super Admin." });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    if (action === "delete") {
      const { data: target, error: lookupError } = await admin.auth.admin.getUserById(id);
      if (lookupError) return lookupFailure(lookupError, id);
      if (!target.user) return reply(502, { error: "Authentication devolvió una respuesta vacía al consultar la cuenta. No se modificó ningún dato." });
      // GoTrue realiza el borrado de Auth; las FKs limpian perfil y membresías.
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return reply(409, { error: error.message });
      const { error: auditError } = await admin.from("audit_logs").insert({ user_id: auth.user.id, action: "DELETE", entity_table: "auth_account", entity_id: id, before: { email: target.user.email }, after: null });
      return reply(200, { ok: true, warning: auditError ? "Cuenta eliminada. No se pudo registrar el actor en la auditoría de Auth." : undefined });
    }
    if (!data || typeof data.full_name !== "string" || !data.full_name.trim() || data.full_name.length > 200 || typeof data.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !["USER", "SUPER_ADMIN"].includes(data.platform_role) || !Array.isArray(data.memberships) || data.memberships.length > 100) {
      return reply(400, { error: "Revisa nombre, correo, rol y membresías." });
    }
    const email = data.email.trim().toLowerCase();
    // Validar membresías antes de crear/cambiar una cuenta de acceso.
    const { data: roles, error: roleError } = await caller.from("roles").select("code");
    if (roleError) return reply(400, { error: roleError.message });
    const seen = new Set<string>();
    for (const m of data.memberships) {
      if (!m || !uuid.test(m.business_id ?? "") || seen.has(m.business_id) || !roles?.some(r => r.code === m.role_code) || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(m.status)) return reply(400, { error: "Membresía inválida o negocio duplicado." });
      seen.add(m.business_id);
      const { data: biz } = await caller.from("businesses").select("id").eq("id", m.business_id).maybeSingle();
      if (!biz) return reply(400, { error: "Negocio no encontrado" });
      if (m.employee_id) {
        if (!uuid.test(m.employee_id)) return reply(400, { error: "Trabajador inválido" });
        const { data: emp } = await caller.from("employees").select("id").eq("id", m.employee_id).eq("business_id", m.business_id).maybeSingle();
        if (!emp) return reply(400, { error: "El trabajador no pertenece al negocio" });
      }
    }
    const profile = { full_name: data.full_name.trim(), platform_role: data.platform_role, memberships: data.memberships };
    if (action === "create") {
      if (typeof data.password !== "string" || data.password.length < 12 || data.password.length > 128) return reply(400, { error: "Usa una contraseña de 12 a 128 caracteres." });
      const { data: created, error } = await admin.auth.admin.createUser({ email, password: data.password, email_confirm: true, user_metadata: { full_name: profile.full_name } });
      if (error || !created.user) return reply(400, { error: error?.message ?? "No se pudo crear la cuenta" });
      const { error: profileError } = await caller.rpc("admin_save_user_profile", { p_id: created.user.id, p_data: profile });
      if (profileError) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
        return reply(409, { error: rollbackError ? `Se creó la cuenta ${email}, pero no se asignaron permisos. Revisa Authentication (UID ${created.user.id}). ${profileError.message}` : profileError.message });
      }
      return reply(200, { ok: true, id: created.user.id });
    }
    const { data: previous, error: previousError } = await admin.auth.admin.getUserById(id);
    if (previousError) return lookupFailure(previousError, id);
    if (!previous.user) return reply(502, { error: "Authentication devolvió una respuesta vacía al consultar la cuenta. No se modificó ningún dato." });
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, { email, user_metadata: { ...previous.user.user_metadata, full_name: profile.full_name } });
    if (authUpdateError) return reply(400, { error: authUpdateError.message });
    const { error: profileError } = await caller.rpc("admin_save_user_profile", { p_id: id, p_data: profile });
    if (profileError) {
      // Auth y Postgres no comparten transacción: compensar si falla el perfil.
      const { error: rollbackError } = await admin.auth.admin.updateUserById(id, { email: previous.user.email, user_metadata: previous.user.user_metadata });
      return reply(409, { error: rollbackError ? `No se guardaron los permisos y no se pudo revertir el correo de Auth. Revisa la cuenta ${id}. ${profileError.message}` : profileError.message });
    }
    return reply(200, { ok: true, id });
  } catch (error) {
    // No registrar cuerpos: contienen contraseñas durante el alta.
    console.error("platform-users:", error instanceof Error ? error.name : "Error");
    return reply(500, { error: "No se pudo completar la operación de cuenta. Inténtalo nuevamente." });
  }
});
