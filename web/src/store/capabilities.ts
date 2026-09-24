import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type PlanCode = "STARTER" | "BUSINESS";
export type NullableLimit = number | null;
export interface PlanCapabilities {
  planId: string; code: PlanCode; name: string; priceMonthly: number; subscriptionStatus: string;
  maxWorkers: NullableLimit; maxMonthlyAppointments: NullableLimit; maxStorageMb: number; maxBranches: NullableLimit;
  website: boolean; loyalty: boolean; aiCopilot: boolean; whatsapp: boolean; multiBranch: boolean;
}
export interface PlanUsage {
  capabilities: PlanCapabilities; periodStart: string; periodEnd: string; timezone: string;
  usage: { workers: number; appointments: number; branches: number; storageBytes: number };
}
export interface Branch { id: string; business_id: string; name: string; address: string | null; phone: string | null; city: string | null; active: boolean; is_default: boolean }
export interface CommercialPlan { id: string; code: PlanCode; name: string; description: string; price_monthly: number; limits: { max_employees: NullableLimit; max_monthly_appointments: NullableLimit; max_storage_mb: number; max_branches: NullableLimit; [key: string]: number | null }; modules: Record<string, boolean>; is_active: boolean }
export const FEATURE_LABELS = { website: "Página web", loyalty: "Fidelización", aiCopilot: "Copiloto IA", whatsapp: "WhatsApp", multiBranch: "Multisucursal" } as const;
export const limitText = (value: NullableLimit, unlimited = "Ilimitados") => value === null ? unlimited : value.toLocaleString("es-PE");
export const storageText = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toLocaleString("es-PE", { maximumFractionDigits: 1 })} GB` : `${(bytes / 1024 ** 2).toLocaleString("es-PE", { maximumFractionDigits: 1 })} MB`;
export function planError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code === "PGRST202") return "Falta instalar la migración de planes y sucursales en Supabase.";
  return e?.message || "No se pudo consultar el plan. Intenta nuevamente.";
}
interface State { businessId: string | null; current: PlanUsage | null; branches: Branch[]; catalog: CommercialPlan[]; error: string; loading: boolean; refresh: (bid: string) => Promise<void>; loadCatalog: () => Promise<void>; clear: () => void }
let generation = 0;
export const useCapabilities = create<State>((set, get) => ({
  businessId: null, current: null, branches: [], catalog: [], error: "", loading: false,
  clear() { generation++; set({ businessId: null, current: null, branches: [], error: "", loading: false }); },
  async refresh(bid) {
    const token = ++generation;
    set({ businessId: bid, loading: true, error: "", ...(get().businessId !== bid ? { current: null, branches: [] } : {}) });
    try {
      const [u, b] = await Promise.all([supabase.rpc("get_plan_usage", { p_business_id: bid }), supabase.from("locations").select("*").eq("business_id", bid).order("is_default", { ascending: false }).order("name")]);
      if (u.error) throw u.error; if (b.error) throw b.error;
      if (token === generation) set({ current: u.data as PlanUsage, branches: b.data as Branch[], loading: false });
    } catch (e) { if (token === generation) set({ current: null, branches: [], error: planError(e), loading: false }); }
  },
  async loadCatalog() {
    const { data, error } = await supabase.rpc("get_plan_catalog");
    if (error) throw new Error(planError(error));
    set({ catalog: (data ?? []) as CommercialPlan[] });
  },
}));
