import { supabase } from "./supabase";
import { platformFunctionError } from "./platform-errors";

export interface SubscriptionRecord { id: string; plan_id: string; status: string; created_at: string }
export interface BusinessRecord {
  id: string; name: string; slug: string; type: string; status: string;
  email: string | null; phone: string | null; whatsapp: string | null; address: string | null;
  description: string; subscriptions: SubscriptionRecord[];
}
export interface PlanRecord {
  id: string; code: string; name: string; description: string; price_monthly: number;
  currency: string; limits: Record<string, number | null>; modules: Record<string, boolean>; is_active: boolean;
}
export interface MemberRecord { business_id: string; role_code: string; status: string; employee_id: string | null }
export interface UserRecord { id: string; full_name: string; email: string; platform_role: "USER" | "SUPER_ADMIN"; business_users: MemberRecord[] }
export interface AdminOptions {
  businesses: { id: string; name: string }[];
  plans: { id: string; name: string; code: string; is_active: boolean }[];
  roles: { code: string; name: string }[];
  employees: { id: string; business_id: string; full_name: string }[];
}
export type Entity = "businesses" | "users" | "plans";
export const PAGE_SIZE = 20;

export function adminError(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e?.code === "PGRST202" || e?.code === "42883") return "Falta aplicar la actualización SQL de administración en Supabase.";
  if (e?.code === "23505") return "Ya existe un registro con ese correo, código o slug. Usa otro valor.";
  if (e?.code === "23503") return "El registro está relacionado con otros datos. Revisa sus asociaciones antes de eliminarlo.";
  return e?.message || "No se pudo completar la operación. Verifica tu conexión e inténtalo nuevamente.";
}

export async function listAdmin<T>(entity: Entity, page: number, search: string): Promise<{ rows: T[]; total: number }> {
  const columns = entity === "businesses" ? "*, subscriptions(id, plan_id, status, created_at)" : entity === "users" ? "*, business_users!business_users_user_id_fkey(business_id, role_code, status, employee_id)" : "*";
  let query = supabase.from(entity).select(columns, { count: "exact" }).order("created_at", { ascending: false }).order("id");
  const term = search.replace(/[^\p{L}\p{N}\s@._-]/gu, "").trim();
  if (term) {
    const fields = entity === "users" ? ["full_name", "email"] : entity === "plans" ? ["name", "code"] : ["name", "slug"];
    query = query.or(fields.map(f => `${f}.ilike.%${term}%`).join(","));
  }
  const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as T[], total: count ?? 0 };
}

async function allRows<T>(table: string, columns: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order(table === "roles" ? "code" : "id").range(offset, offset + 499);
    if (error) throw error;
    result.push(...(data ?? []) as unknown as T[]);
    if (!data || data.length < 500) return result;
  }
}
export async function adminOptions(): Promise<AdminOptions> {
  const [businesses, plans, roles, employees] = await Promise.all([
    allRows<AdminOptions["businesses"][number]>("businesses", "id,name"),
    allRows<AdminOptions["plans"][number]>("plans", "id,name,code,is_active"),
    allRows<AdminOptions["roles"][number]>("roles", "code,name"),
    allRows<AdminOptions["employees"][number]>("employees", "id,business_id,full_name"),
  ]);
  return { businesses, plans, roles, employees };
}
export async function saveAdmin(entity: "businesses" | "plans", id: string | null, data: unknown) {
  const { error } = await supabase.rpc(entity === "businesses" ? "admin_save_business" : "admin_save_plan", { p_id: id, p_data: data });
  if (error) throw error;
}
export async function deleteAdmin(entity: "businesses" | "plans", id: string) {
  const { error } = await supabase.rpc(entity === "businesses" ? "admin_delete_business" : "admin_delete_plan", { p_id: id });
  if (error) throw error;
}
const usersFunction = (import.meta.env.VITE_PLATFORM_USERS_FUNCTION as string | undefined)?.trim() || "platform-users";

export async function manageUser(action: "create" | "update" | "delete", id: string | null, data?: unknown) {
  const { data: result, error } = await supabase.functions.invoke(usersFunction, { body: { action, id, data } });
  if (error) {
    let message = `No se pudo contactar la función ${usersFunction}. Comprueba su despliegue y la conexión.`;
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      message = platformFunctionError(usersFunction, error.context.status, body);
    }
    throw new Error(message);
  }
  if (!result?.ok) throw new Error(result?.error ?? "No se pudo guardar la cuenta");
  return result as { ok: true; warning?: string };
}
