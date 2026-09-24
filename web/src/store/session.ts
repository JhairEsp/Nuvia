import { useCapabilities } from "./capabilities";
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useDB } from "./db";
import type { Business, BusinessRole, Membership, PlatformRole, User } from "../types/domain";

interface SessionState {
  ready: boolean;
  signingOut: boolean;
  permissionKeys: string[];
  user: User | null;
  membership: Membership | null;
  business: Business | null;
  businessId: string | null;
  theme: "light" | "dark" | "system";
  paletteOpen: boolean;
  lastPath: string | null;
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setTheme: (t: "light" | "dark" | "system") => void;
  setPaletteOpen: (open: boolean) => void;
  setLastPath: (p: string) => void;
}

/* ── Mappers fila → dominio ─────────────────────────────────────────────── */
type UserRow = { id: string; full_name: string | null; email: string | null; platform_role: string | null; avatar_url?: string | null };
type BizRow = {
  id: string; name: string; slug: string; type: string; status: string; description: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; address: string | null;
  currency: string | null; timezone: string | null;
};
type MemberRow = { business_id: string; role_code: string; employee_id: string | null };

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email ?? "",
  fullName: r.full_name ?? r.email ?? "Usuario",
  platformRole: (r.platform_role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER") as PlatformRole,
  avatarUrl: r.avatar_url ?? undefined,
});

const toBusiness = (r: BizRow): Business => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  type: r.type,
  status: (r.status as Business["status"]) ?? "TRIAL",
  description: r.description ?? "",
  phone: r.phone ?? "",
  whatsapp: r.whatsapp ?? "",
  email: r.email ?? "",
  address: r.address ?? "",
  currency: r.currency ?? "PEN",
  timezone: r.timezone ?? "America/Lima",
});

const toMembership = (r: MemberRow): Membership => ({
  businessId: r.business_id,
  roleCode: r.role_code as BusinessRole,
  employeeId: r.employee_id ?? undefined,
});

/** Carga perfil + membresía + negocio del usuario autenticado y arranca el store. */
async function hydrate(authUserId: string): Promise<{ user: User; membership: Membership | null; business: Business | null; permissionKeys: string[] }> {
  const [{ data: u }, { data: m }] = await Promise.all([
    supabase.from("users").select("id, full_name, email, platform_role, avatar_url").eq("id", authUserId).maybeSingle(),
    supabase.from("business_users").select("business_id, role_code, employee_id, status").eq("user_id", authUserId).eq("status", "ACTIVE").limit(1),
  ]);
  const user = u ? toUser(u as UserRow) : { id: authUserId, email: "", fullName: "Usuario", platformRole: "USER" as PlatformRole };
  const memberRow = (m ?? [])[0] as (MemberRow & { status?: string }) | undefined;
  const membership = memberRow ? toMembership(memberRow) : null;
  let business: Business | null = null;
  if (membership) {
    const { data: b } = await supabase.from("businesses").select("*").eq("id", membership.businessId).maybeSingle();
    business = b ? toBusiness(b as BizRow) : null;
  }
  const permissions = membership ? await supabase.from("role_permissions").select("permission_key").eq("role_code", membership.roleCode) : null;
  const permissionKeys = (permissions?.data ?? []).map(r => r.permission_key as string);
  return { user, membership, business, permissionKeys };
}

export const useSession = create<SessionState>()((set, get) => ({
  ready: false,
  signingOut: false,
  permissionKeys: [],
  user: null,
  membership: null,
  business: null,
  businessId: null,
  theme: "system",
  paletteOpen: false,
  lastPath: null,

  restore: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const au = data.session?.user;
      if (!au) {
        set({ ready: true });
        return;
      }
      const h = await hydrate(au.id);
      set({ ...h, businessId: h.business?.id ?? null, ready: true });
      if (h.user.platformRole === "SUPER_ADMIN") void useDB.getState().loadPlatform();
      else if (h.business) void useDB.getState().load(h.business.id);
    } catch (e) {
      console.error("restore:", e);
      set({ ready: true });
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return error?.message ?? "No se pudo iniciar sesión";
    const h = await hydrate(data.user.id);
    set({ ...h, businessId: h.business?.id ?? null, ready: true });
    if (h.user.platformRole === "SUPER_ADMIN") await useDB.getState().loadPlatform();
    else if (h.business) await useDB.getState().load(h.business.id);
    return null;
  },

  signOut: async () => {
    if (get().signingOut) return;
    set({ signingOut: true });
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      clearSession();
    } finally {
      set({ signingOut: false });
    }
  },

  setTheme: (theme) => set({ theme }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setLastPath: (lastPath) => set({ lastPath }),
}));

// Restaurar sesión al cargar la app (sobrevive recargas)
void useSession.getState().restore();

/** Vacía los datos de la cuenta y descarta cargas pendientes al cerrar sesión. */
function clearSession() {
  useCapabilities.getState().clear();
  useDB.getState().clear();
  useSession.setState({ ready: true, permissionKeys: [], user: null, membership: null, business: null, businessId: null, lastPath: null, paletteOpen: false });
}

// También cubre el cierre de sesión comunicado desde otra pestaña.
supabase.auth.onAuthStateChange(event => {
  if (event === "SIGNED_OUT") clearSession();
});

/** UX gating (no seguridad — la seguridad real es RLS en Supabase). */
export function usePermission(key: string): boolean {
  return useSession(s => s.user?.platformRole === "SUPER_ADMIN" || s.permissionKeys.includes(key));
}

export type { BusinessRole };
