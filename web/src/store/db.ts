/**
 * 🗄️ Store de dominio sobre Supabase real (sin mocks).
 * Misma interfaz que usan las pantallas: estado camelCase + acciones optimistas
 * que escriben en PostgREST/RPCs (RLS protege cada fila por negocio).
 */
import { create } from "zustand";
import { useCapabilities } from "./capabilities";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { saveAdmin } from "../lib/platform-admin";
import type {
  AiInsight, Appointment, AppointmentStatus, AtRiskCustomer, AuditEntry, Business, Commission,
  Customer, CustomerNote, CustomerPhoto, Employee, Kpis, LoyaltyTx, LoyaltyTier, PaymentMethod,
  PlanRow, PlatformBusiness, PlatformKpis, Product, Promotion, PublicSite, Referral, Sale, SaleItem,
  Service, ThemePreset, WaitlistEntry, WebsiteSectionType, WhatsAppMessage, AutomationRule,
} from "../types/domain";

export const uid = (): string => crypto.randomUUID();
const n = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const s = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

/* ── Filas (snake_case, lo que devuelve PostgREST) ───────────────────────── */
type ServiceRow = { location_id?: string; id: string; name: string; description: string | null; duration_min: number; price: number; category: string | null; category_id: string | null; show_on_website: boolean; active: boolean; position: number | null; category_ref?: { name: string } | null };
type EmployeeRow = { location_id?: string; id: string; full_name: string; role_label: string; specialty: string | null; bio: string | null; photo_url: string | null; commission_rate: number; show_on_website: boolean; active: boolean; employee_services?: { service_id: string }[] };
type CustomerRow = { id: string; full_name: string; phone: string; visit_count: number; total_spent: number; last_visit_at: string | null; avg_recurrence_days: number | null; referral_code: string | null; birth_date: string | null; whatsapp_opt_in: boolean; notes_summary: string | null; loyalty_accounts?: { points: number; tier: string }[]; customer_notes?: NoteRow[]; customer_photos?: PhotoRow[] };
type NoteRow = { id: string; note: string; created_at: string };
type PhotoRow = { id: string; kind: string; storage_path: string; notes: string; taken_at: string };
type ApptRow = {
  location_id?: string;
  id: string; customer_id: string; employee_id: string | null; status: string; source: string;
  scheduled_start: string; scheduled_end: string; price_total: number; notes: string | null;
  customers?: { full_name: string } | null; employees?: { full_name: string } | null;
  appointment_items?: { service_id: string; unit_price: number; duration_min: number; services?: { name: string } | null }[];
};
type WaitRow = { id: string; customer_id: string; service_id: string; employee_id: string | null; preferred_date: string | null; time_start: string | null; time_end: string | null; priority: number; status: string; created_at: string; customers?: { full_name: string } | null; services?: { name: string } | null; employees?: { full_name: string } | null };
type ProductRow = { location_id?: string; id: string; name: string; sku: string; category: string; price: number; cost: number; stock: number; stock_min: number; active: boolean };
type SaleRow = { location_id?: string; id: string; customer_id: string | null; employee_id: string | null; subtotal: number; discount_total: number; total: number; created_at: string; created_by: string | null; customers?: { full_name: string } | null; sale_items?: SaleItemRow[]; payments?: PayRow[] };
type SaleItemRow = { id: string; item_type: string; service_id: string | null; product_id: string | null; description: string; qty: number; unit_price: number; discount: number; total: number; employee_id: string | null };
type PayRow = { method: string; amount: number; reference: string | null };
type CommRow = { id: string; employee_id: string; sale_item_id: string | null; base_amount: number; rate: number; amount: number; status: string; created_at: string };
type LoyaltyRow = { id: string; type: string; points: number; reason: string; created_at: string; loyalty_accounts?: { customer_id: string } | null };
type RefRow = { id: string; code: string; referrer_customer_id: string; referred_customer_id: string | null; status: string; reward_points: number };
type PromoRow = { id: string; name: string; description: string; service_id: string | null; price: number | null; discount_percent: number; starts_at: string; ends_at: string; is_active: boolean; show_on_website: boolean };
type RuleRow = { id: string; name: string; trigger_event: string; channel: string; template: string; delay_minutes: number; is_enabled: boolean };
type MsgRow = { id: string; to_phone: string; body: string; status: string; created_at: string; customers?: { full_name: string } | null; automation_rules?: { name: string } | null };
type InsightRow = { id: string; type: string; severity: string; title: string; body: string; status: string; created_at: string };
type SectionRow = { type: string; position: number; active: boolean; content: Record<string, unknown> };
type HoursRow = { weekday: number; open_time: string; close_time: string; is_closed: boolean };

/* ── Mappers ─────────────────────────────────────────────────────────────── */
const toService = (r: ServiceRow): Service => ({
  locationId: r.location_id, id: r.id, name: r.name, description: s(r.description), durationMin: n(r.duration_min), price: n(r.price),
  category: r.category_ref?.name ?? r.category ?? undefined, showOnWebsite: r.show_on_website, active: r.active, position: r.position ?? 0,
});
const toEmployee = (r: EmployeeRow): Employee => ({
  locationId: r.location_id, id: r.id, fullName: r.full_name, roleLabel: s(r.role_label), specialty: s(r.specialty), bio: s(r.bio),
  photoUrl: r.photo_url ?? undefined, commissionRate: n(r.commission_rate), showOnWebsite: r.show_on_website,
  active: r.active, serviceIds: (r.employee_services ?? []).map((es) => es.service_id),
});
const toCustomer = (r: CustomerRow): Customer => {
  const acc = r.loyalty_accounts?.[0];
  return {
    id: r.id, fullName: r.full_name, phone: r.phone, visitCount: n(r.visit_count), totalSpent: n(r.total_spent),
    lastVisitAt: r.last_visit_at ?? undefined, avgRecurrenceDays: r.avg_recurrence_days ?? undefined,
    tier: (acc?.tier as LoyaltyTier) ?? "STARTER", points: n(acc?.points),
    referralCode: r.referral_code ?? undefined, birthDate: r.birth_date ?? undefined, whatsappOptIn: r.whatsapp_opt_in,
    notes: (r.customer_notes ?? []).map((x): CustomerNote => ({ id: x.id, note: x.note, createdAt: x.created_at, by: "Equipo" })),
    photos: (r.customer_photos ?? []).map((x): CustomerPhoto => ({ id: x.id, kind: (x.kind as CustomerPhoto["kind"]) ?? "STYLE", url: x.storage_path, note: x.notes, takenAt: x.taken_at })),
  };
};
const toAppt = (r: ApptRow): Appointment => ({
  locationId: r.location_id, id: r.id, customerId: r.customer_id, customerName: r.customers?.full_name ?? "Cliente",
  serviceName: (r.appointment_items ?? []).map((i) => i.services?.name ?? "Servicio").join(" + ") || "Servicio",
  employeeId: r.employee_id ?? "", employeeName: r.employees?.full_name ?? "Sin asignar",
  start: r.scheduled_start, end: r.scheduled_end, status: r.status as AppointmentStatus,
  price: n(r.price_total), source: r.source, notes: r.notes ?? undefined,
});
const toWait = (r: WaitRow): WaitlistEntry => ({
  id: r.id, customerId: r.customer_id, customerName: r.customers?.full_name ?? "Cliente",
  serviceId: r.service_id, serviceName: r.services?.name ?? "Servicio", employeeName: r.employees?.full_name ?? undefined,
  preferredDate: r.preferred_date ?? undefined,
  timeRange: r.time_start && r.time_end ? `${r.time_start.slice(0, 5)}–${r.time_end.slice(0, 5)}` : undefined,
  priority: n(r.priority), status: r.status as WaitlistEntry["status"], createdAt: r.created_at,
});
const toProduct = (r: ProductRow): Product => ({
  locationId: r.location_id, id: r.id, name: r.name, sku: s(r.sku), category: s(r.category), price: n(r.price), cost: n(r.cost),
  stock: n(r.stock), stockMin: n(r.stock_min), active: r.active,
});
const toSale = (r: SaleRow): Sale => ({
  locationId: r.location_id, id: r.id, customerId: r.customer_id ?? undefined, customerName: r.customers?.full_name ?? undefined,
  employeeId: r.employee_id ?? undefined, subtotal: n(r.subtotal), discountTotal: n(r.discount_total), total: n(r.total),
  createdBy: s(r.created_by), createdAt: r.created_at,
  items: (r.sale_items ?? []).map((i): SaleItem => ({
    id: i.id, kind: i.item_type === "PRODUCT" ? "PRODUCT" : "SERVICE",
    refId: i.service_id ?? i.product_id ?? undefined, description: s(i.description),
    qty: n(i.qty), unitPrice: n(i.unit_price), discount: n(i.discount), total: n(i.total), employeeId: i.employee_id ?? undefined,
  })),
  payments: (r.payments ?? []).map((p) => ({ method: p.method as PaymentMethod, amount: n(p.amount), reference: s(p.reference) || undefined })),
});
const toCommission = (r: CommRow): Commission => ({
  id: r.id, employeeId: r.employee_id, saleItemId: r.sale_item_id ?? "", base: n(r.base_amount),
  rate: n(r.rate), amount: n(r.amount), status: r.status === "PAID" ? "PAID" : "PENDING", createdAt: r.created_at,
});
const toLoyalty = (r: LoyaltyRow): LoyaltyTx => ({
  id: r.id, customerId: r.loyalty_accounts?.customer_id ?? "", type: r.type as LoyaltyTx["type"],
  points: n(r.points), reason: s(r.reason), createdAt: r.created_at,
});
const toPromo = (r: PromoRow): Promotion => ({
  id: r.id, name: r.name, description: s(r.description), serviceId: r.service_id ?? undefined,
  price: r.price == null ? undefined : n(r.price), discountPercent: n(r.discount_percent),
  startsAt: r.starts_at, endsAt: r.ends_at, isActive: r.is_active, showOnWebsite: r.show_on_website,
});
const toRule = (r: RuleRow): AutomationRule => ({
  id: r.id, name: r.name, trigger: r.trigger_event, channel: r.channel as AutomationRule["channel"],
  template: r.template, delayMinutes: n(r.delay_minutes), isEnabled: r.is_enabled,
});
const toMsg = (r: MsgRow): WhatsAppMessage => ({
  id: r.id, customerName: r.customers?.full_name ?? "Cliente", toPhone: r.to_phone, body: r.body,
  status: r.status as WhatsAppMessage["status"], createdAt: r.created_at, ruleName: r.automation_rules?.name ?? undefined,
});
const toInsight = (r: InsightRow): AiInsight => ({
  id: r.id, type: r.type, severity: (r.severity as AiInsight["severity"]) ?? "info",
  title: r.title, body: r.body, status: r.status as AiInsight["status"],
});

/** Snapshot publicado (website_releases.snapshot) → PublicSite de la UI. */
export function publicSiteFromSnapshot(snap: Record<string, unknown> | null): PublicSite | null {
  if (!snap) return null;
  const biz = (snap.business ?? {}) as Record<string, string>;
  const brand = (snap.branding ?? {}) as { preset?: string; colors?: Record<string, string>; font_key?: string };
  const web = (snap.website ?? {}) as { tagline?: string; socials?: Record<string, string>; map_query?: string };
  const list = (k: string): Record<string, unknown>[] => (Array.isArray(snap[k]) ? (snap[k] as Record<string, unknown>[]) : []);
  return {
    business: {
      name: s(biz.name), slug: s(biz.slug), description: s(biz.description), phone: s(biz.phone),
      whatsapp: s(biz.whatsapp), email: s(biz.email), address: s(biz.address),
    },
    branding: {
      preset: (brand.preset as ThemePreset) ?? "MODERN",
      colors: { primary: brand.colors?.primary, button: brand.colors?.button },
      font_key: brand.font_key ?? "sans",
    },
    website: {
      tagline: s(web.tagline),
      socials: (web.socials ?? (snap.socials as Record<string, string>) ?? {}),
      map_query: s(web.map_query ?? snap.map_query),
    },
    sections: list("sections").map((x) => ({
      type: s(x.type) as WebsiteSectionType, position: n(x.position), active: x.active !== false,
      content: (x.content ?? {}) as Record<string, unknown>,
    })),
    services: list("services").map((x) => toService({
      id: s(x.id), name: s(x.name), description: s(x.description), duration_min: n(x.duration_min),
      price: n(x.price), category: s(x.category) || null, category_id: null, show_on_website: true,
      active: true, position: null,
    })),
    team: list("team").map((x) => toEmployee({
      id: s(x.id), full_name: s(x.full_name), role_label: s(x.role_label), specialty: s(x.specialty),
      bio: s(x.bio), photo_url: (x.photo_url as string) ?? null, commission_rate: 0,
      show_on_website: true, active: true,
    })),
    promotions: list("promotions").map((x) => ({
      name: s(x.name), description: s(x.description),
      price: x.price == null ? undefined : n(x.price), discount_percent: n(x.discount_percent),
    })),
    testimonials: list("testimonials").map((x) => ({
      author_name: s(x.author_name), rating: n(x.rating) || 5, content: s(x.content),
    })),
    hours: list("hours").map((x) => ({
      weekday: n(x.weekday), open_time: s(x.open_time), close_time: s(x.close_time), is_closed: x.is_closed === true,
    })),
  };
}

/* ── Helpers de gráficas (mismas formas que consume la UI) ───────────────── */
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function buildRevenueSeries(sales: Sale[]): Array<{ day: string; ingresos: number }> {
  const out: Array<{ day: string; ingresos: number }> = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const ingresos = sales.filter((v) => v.createdAt.slice(0, 10) === key).reduce((a, v) => a + v.total, 0);
    out.push({ day: DOW[d.getDay()] ?? "", ingresos: Math.round(ingresos) });
  }
  return out;
}
export function buildDemandSeries(appointments: Appointment[]): Array<{ dia: string; ocupacion: number }> {
  const week = [1, 2, 3, 4, 5, 6, 0]; // Lun→Dom
  const today = new Date();
  const counts = new Map<number, number>();
  appointments.forEach((a) => {
    const d = new Date(a.start);
    if ((today.getTime() - d.getTime()) / 86400000 > 56) return;
    counts.set(d.getDay(), (counts.get(d.getDay()) ?? 0) + 1);
  });
  const max = Math.max(1, ...counts.values());
  return week.map((dow) => ({ dia: DOW[dow] ?? "", ocupacion: Math.round(((counts.get(dow) ?? 0) / max) * 100) }));
}

/* ── KPIs ───────────────────────────────────────────────────────────────── */
export function todayAppointments(appts: Appointment[]): Appointment[] {
  const key = new Date().toISOString().slice(0, 10);
  return appts.filter((a) => a.start.slice(0, 10) === key).sort((x, y) => x.start.localeCompare(y.start));
}
export function computeKpis(db: { sales: Sale[]; appointments: Appointment[]; customers: Customer[]; employees: Employee[] }): Kpis {
  const now = Date.now();
  const day = 86400000;
  const inRange = (iso: string, from: number, to: number) => {
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };
  const cur: [number, number] = [now - 7 * day, now + day];
  const prev: [number, number] = [now - 14 * day, now - 7 * day];
  const sum = (sales: Sale[], r: [number, number]) => sales.filter((v) => inRange(v.createdAt, r[0], r[1]));
  const curSales = sum(db.sales, cur);
  const prevSales = sum(db.sales, prev);
  const rev = (xs: Sale[]) => xs.reduce((a, v) => a + v.total, 0);
  const curAppts = db.appointments.filter((a) => inRange(a.start, cur[0], cur[1]) && a.status !== "CANCELLED");
  const prevAppts = db.appointments.filter((a) => inRange(a.start, prev[0], prev[1]) && a.status !== "CANCELLED");
  const mix: Record<PaymentMethod, number> = { CASH: 0, YAPE: 0, PLIN: 0, CARD: 0, OTHER: 0 };
  curSales.forEach((v) => v.payments.forEach((p) => { mix[p.method] = (mix[p.method] ?? 0) + p.amount; }));
  const capacity = Math.max(1, db.employees.filter((e) => e.active !== false).length * 6 * 8 * 7);
  const booked = curAppts.reduce((a, v) => a + Math.max(0, (new Date(v.end).getTime() - new Date(v.start).getTime()) / 60000), 0);
  return {
    revenue: rev(curSales), revenuePrev: rev(prevSales),
    appointments: curAppts.length, appointmentsPrev: prevAppts.length,
    ticketAvg: curSales.length ? rev(curSales) / curSales.length : 0,
    ticketPrev: prevSales.length ? rev(prevSales) / prevSales.length : 0,
    occupancy: Math.min(100, Math.round((booked / capacity) * 100)),
    occupancyPrev: 0,
    newCustomers: db.customers.filter((c) => inRange(c.lastVisitAt ?? "", cur[0], cur[1])).length,
    paymentMix: mix,
  };
}

/* ── Store ──────────────────────────────────────────────────────────────── */
export const EMPTY_SITE: PublicSite = {
  business: { name: "", slug: "", description: "", phone: "", whatsapp: "", email: "", address: "" },
  branding: { preset: "MODERN", colors: {}, font_key: "sans" },
  website: { tagline: "", socials: {}, map_query: "" },
  sections: [], services: [], team: [], promotions: [], testimonials: [], hours: [],
};

interface DB {
  businessId: string | null;
  loading: boolean;
  business: Business;
  services: Service[];
  employees: Employee[];
  customers: Customer[];
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  products: Product[];
  sales: Sale[];
  commissions: Commission[];
  loyaltyTxs: LoyaltyTx[];
  referrals: Referral[];
  promos: Promotion[];
  automations: AutomationRule[];
  messages: WhatsAppMessage[];
  insights: AiInsight[];
  atRisk: AtRiskCustomer[];
  audit: AuditEntry[];
  site: PublicSite;
  publishedSnapshot: PublicSite | null;
  publishedAt: string | null;
  platform: { kpis: PlatformKpis; businesses: PlatformBusiness[]; plans: PlanRow[] };

  locationId: string | null;
  setLocation: (id: string | null) => Promise<void>;
  load: (businessId: string) => Promise<void>;
  loadPlatform: () => Promise<void>;
  clear: () => void;
  // Citas
  createAppointment: (a: Omit<Appointment, "id">) => Promise<string>;
  reschedule: (id: string, startISO: string) => Promise<void>;
  setStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  // Clientes
  addCustomer: (c: Pick<Customer, "fullName" | "phone"> & Partial<Customer>) => string;
  addNote: (customerId: string, note: string) => void;
  addPhoto: (customerId: string, p: Omit<CustomerPhoto, "id">) => void;
  // Catálogo
  saveService: (svc: Service) => Promise<void>;
  removeService: (id: string) => void;
  saveEmployee: (e: Employee) => Promise<void>;
  saveProduct: (p: Product) => Promise<void>;
  adjustStock: (productId: string, type: "IN" | "OUT" | "ADJUSTMENT", qty: number) => Promise<void>;
  // Ventas
  createSale: (sale: Omit<Sale, "id" | "createdAt" | "subtotal" | "total"> & { items: SaleItem[] }) => Promise<string>;
  // Waitlist / recovery
  addWaitlist: (w: Omit<WaitlistEntry, "id" | "createdAt" | "status">) => void;
  bookWaitlist: (id: string) => void;
  removeWaitlist: (id: string) => void;
  // Fidelización / marketing
  addLoyalty: (customerId: string, points: number, reason: string) => Promise<void>;
  savePromo: (p: Promotion) => Promise<void>;
  togglePromo: (id: string) => Promise<void>;
  // Automatizaciones / WhatsApp
  toggleAutomation: (id: string) => Promise<void>;
  updateTemplate: (id: string, template: string) => Promise<void>;
  sendMessage: (customerName: string, phone: string, body: string) => Promise<void>;
  // IA
  dismissInsight: (id: string) => void;
  // Website
  updateSection: (type: string, content: Record<string, unknown>) => void;
  toggleSection: (type: string) => void;
  moveSection: (type: string, dir: -1 | 1) => void;
  setBranding: (preset?: string, colors?: { primary?: string; button?: string }) => void;
  publishSite: () => void;
  // Plataforma
  setBusinessStatus: (slug: string, status: PlatformBusiness["status"]) => Promise<void>;
  savePlan: (p: PlanRow) => Promise<void>;
}

const EMPTY_KPIS: PlatformKpis = { activeBusinesses: 0, suspendedBusinesses: 0, newThisMonth: 0, users: 0, monthAppointments: 0, processedSales: 0, mrr: 0, churn: 0 };

export const useDB = create<DB>()((set, get) => {
  let loadGeneration = 0;
  const locationForWrite = (existing?: string): string => {
    if (existing) return existing;
    const chosen = get().locationId;
    const branches = useCapabilities.getState().branches;
    const id = chosen ?? (branches.length === 1 ? branches[0]?.id : undefined);
    if (!id || !branches.some(b => b.id === id && b.active)) throw new Error("Selecciona una sucursal activa antes de registrar la operación.");
    return id;
  };
  const B = (): string => get().businessId ?? "";
  const fail = (e: unknown) => {
    console.error(e);
    toast.error("No se pudo guardar en Supabase", { description: s((e as { message?: string })?.message) });
  };
  /** Filas tipadas del boundary PostgREST (sin tipos generados). */
  const rows = <T,>(r: { data: unknown }): T[] => (Array.isArray(r.data) ? (r.data as T[]) : []);
  /** Paginación real de PostgREST; el límite de respuesta no es el límite comercial. */
  const allPages = async (query: () => any): Promise<{ data: unknown[]; error: null }> => {
    const data: unknown[] = [];
    for (let offset = 0; ; ) {
      const r = await query().range(offset, offset + 499);
      if (r.error) throw r.error;
      const batch = (r.data ?? []) as unknown[];
      data.push(...batch); offset += batch.length;
      if (!batch.length || (typeof r.count === "number" ? offset >= r.count : batch.length < 500)) return { data, error: null };
    }
  };
  /** Relectura ligera tras un write para mantener consistencia con triggers/RLS. */
  const refresh = () => { const id = B(); if (id) void get().load(id); };

  return {
    clear() { loadGeneration++; set(useDB.getInitialState()); },
    businessId: null,
    locationId: null,
    async setLocation(id) {
      const caps = useCapabilities.getState();
      if (id && !caps.branches.some(b => b.id === id)) throw new Error("Sucursal no autorizada");
      set({ locationId: id });
      const bid = get().businessId;
      if (bid) await get().load(bid);
    },
    loading: false,
    business: { id: "", name: "", slug: "", type: "OTHER", status: "TRIAL", description: "", phone: "", whatsapp: "", email: "", address: "", currency: "PEN", timezone: "America/Lima" },
    services: [], employees: [], customers: [], appointments: [], waitlist: [], products: [], sales: [],
    commissions: [], loyaltyTxs: [], referrals: [], promos: [], automations: [], messages: [], insights: [],
    atRisk: [], audit: [], site: EMPTY_SITE, publishedSnapshot: null, publishedAt: null,
    platform: { kpis: EMPTY_KPIS, businesses: [], plans: [] },

    async load(businessId) {
      const generation = ++loadGeneration;
      if (get().businessId !== businessId) set({ locationId: null,
        services: [], employees: [], customers: [], appointments: [], waitlist: [], products: [], sales: [], commissions: [], loyaltyTxs: [], referrals: [], promos: [], automations: [], messages: [], insights: [], atRisk: [], audit: [],
        site: EMPTY_SITE, publishedSnapshot: null, publishedAt: null,
        business: { id: businessId, name: "", slug: "", type: "OTHER", status: "TRIAL", description: "", phone: "", whatsapp: "", email: "", address: "", currency: "PEN", timezone: "America/Lima" },
      });
      set({ businessId, loading: true });
      await useCapabilities.getState().refresh(businessId);
      if (generation !== loadGeneration) return;
      const branches = useCapabilities.getState().branches;
      if (branches.length === 1) set({ locationId: branches[0]?.id ?? null });
      const locationId = get().locationId;
      const branchTables = new Set(["employees", "services", "appointments", "sales", "products", "commissions", "inventory_movements"]);
      const q = <T,>(table: string, cols: string) => {
        let query = supabase.from(table).select(cols, { count: "exact" }).eq("business_id", businessId);
        if (locationId && branchTables.has(table)) query = query.eq("location_id", locationId);
        if (locationId && table === "business_hours") query = query.or(`location_id.eq.${locationId},location_id.is.null`);
        return query;
      };
      try {
        const [
          bizR, svcR, empR, custR, apptR, waitR, prodR, saleR, commR, loyalR, refR,
          promoR, ruleR, msgR, insightR, sectR, hoursR, brandR, webR, relR, revR,
        ] = await Promise.all([
          supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
          allPages(() => q<ServiceRow>("services", "*, category_ref:service_categories(name)").order("position", { ascending: true }).order("id")), 
          allPages(() => q<EmployeeRow>("employees", "*, employee_services(service_id)").order("full_name").order("id")), 
          allPages(() => q<CustomerRow>("customers", "*, loyalty_accounts(points, tier), customer_notes(id, note, created_at), customer_photos(id, kind, storage_path, notes, taken_at)").order("full_name").order("id")), 
          allPages(() => q<ApptRow>("appointments", "*, customers(full_name), employees(full_name), appointment_items(service_id, unit_price, duration_min, services(name))").order("scheduled_start", { ascending: false }).order("id")), 
          q<WaitRow>("waitlist", "*, customers(full_name), services(name), employees(full_name)").order("created_at", { ascending: false }),
          allPages(() => q<ProductRow>("products", "*").order("name").order("id")), 
          allPages(() => q<SaleRow>("sales", "*, customers(full_name), sale_items(*), payments(method, amount, reference)").order("created_at", { ascending: false }).order("id")), 
          allPages(() => q<CommRow>("commissions", "*").order("created_at", { ascending: false }).order("id")), 
          allPages(() => q<LoyaltyRow>("loyalty_transactions", "*, loyalty_accounts(customer_id)").order("created_at", { ascending: false }).order("id")),
          q<RefRow>("referrals", "*").order("created_at", { ascending: false }),
          q<PromoRow>("promotions", "*").order("starts_at", { ascending: false }),
          q<RuleRow>("automation_rules", "*").order("name"),
          q<MsgRow>("whatsapp_messages", "*, customers(full_name), automation_rules(name)").order("created_at", { ascending: false }).limit(200),
          q<InsightRow>("ai_insights", "*").order("created_at", { ascending: false }).limit(50),
          q<SectionRow>("website_sections", "type, position, active, content").order("position"),
          q<HoursRow>("business_hours", "weekday, open_time, close_time, is_closed").order("weekday"),
          supabase.from("business_branding").select("*").eq("business_id", businessId).maybeSingle(),
          supabase.from("business_website").select("*").eq("business_id", businessId).maybeSingle(),
          supabase.from("website_releases").select("snapshot, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("reviews").select("author_name, rating, content").eq("business_id", businessId).eq("is_published", true),
        ]);

        if (generation !== loadGeneration) return;
        const services = rows<ServiceRow>(svcR).map(toService);
        const employees = rows<EmployeeRow>(empR).map(toEmployee);
        const customers = rows<CustomerRow>(custR).map(toCustomer);
        const appointments = rows<ApptRow>(apptR).map(toAppt);
        const sales = rows<SaleRow>(saleR).map(toSale);

        const brand = brandR.data as { preset?: string; colors?: Record<string, string>; font_key?: string } | null;
        const webw = webR.data as { tagline?: string; socials?: Record<string, string>; map_query?: string } | null;
        const bizRow = bizR.data as Record<string, string> | null;
        const pub = publicSiteFromSnapshot((relR.data as { snapshot: Record<string, unknown> } | null)?.snapshot ?? null);

        const site: PublicSite = {
          business: {
            name: bizRow?.name ?? "", slug: bizRow?.slug ?? "", description: bizRow?.description ?? "",
            phone: bizRow?.phone ?? "", whatsapp: bizRow?.whatsapp ?? "", email: bizRow?.email ?? "", address: bizRow?.address ?? "",
          },
          branding: {
            preset: (brand?.preset as ThemePreset) ?? "MODERN",
            colors: { primary: brand?.colors?.primary, button: brand?.colors?.button },
            font_key: brand?.font_key ?? "sans",
          },
          website: { tagline: webw?.tagline ?? "", socials: webw?.socials ?? {}, map_query: webw?.map_query ?? "" },
          sections: rows<SectionRow>(sectR).map((x) => ({
            type: x.type as WebsiteSectionType, position: n(x.position), active: x.active !== false,
            content: (x.content ?? {}) as Record<string, unknown>,
          })),
          services: services.filter((x) => x.showOnWebsite),
          team: employees.filter((x) => x.showOnWebsite),
          promotions: rows<PromoRow>(promoR).map(toPromo).filter((p) => p.showOnWebsite).map((p) => ({
            name: p.name, description: p.description, price: p.price, discount_percent: p.discountPercent,
          })),
          testimonials: rows<{ author_name: string; rating: number; content: string }>(revR).map((x) => ({
            author_name: x.author_name, rating: n(x.rating) || 5, content: x.content,
          })),
          hours: rows<HoursRow>(hoursR).map((x) => ({
            weekday: n(x.weekday), open_time: s(x.open_time), close_time: s(x.close_time), is_closed: x.is_closed === true,
          })),
        };

        // At-risk local (sin RPC: tolerancia 1.3× sobre la recurrencia promedio)
        const atRisk: AtRiskCustomer[] = customers
          .filter((c) => c.lastVisitAt && (c.avgRecurrenceDays ?? 21) > 0)
          .map((c) => {
            const days = Math.floor((Date.now() - new Date(c.lastVisitAt as string).getTime()) / 86400000);
            const avg = c.avgRecurrenceDays ?? 21;
            return { id: c.id, name: c.fullName, daysOverdue: days - avg, avgRecurrenceDays: avg, totalSpent: c.totalSpent };
          })
          .filter((c) => c.daysOverdue > (c.avgRecurrenceDays * 0.3))
          .sort((a, b) => b.daysOverdue - a.daysOverdue)
          .slice(0, 12);

        set({
          loading: false,
          business: get().business.id ? get().business : {
            id: businessId, name: site.business.name, slug: site.business.slug, type: "OTHER",
            status: "ACTIVE", description: site.business.description, phone: site.business.phone,
            whatsapp: site.business.whatsapp, email: site.business.email, address: site.business.address,
            currency: "PEN", timezone: "America/Lima",
          },
          services, employees, customers, appointments, sales, site, atRisk,
          waitlist: rows<WaitRow>(waitR).map(toWait),
          products: rows<ProductRow>(prodR).map(toProduct),
          commissions: rows<CommRow>(commR).map(toCommission),
          loyaltyTxs: rows<LoyaltyRow>(loyalR).map(toLoyalty),
          referrals: rows<RefRow>(refR).map((r) => ({
            id: r.id, code: r.code,
            referrerName: customers.find((c) => c.id === r.referrer_customer_id)?.fullName ?? "Cliente",
            referredName: customers.find((c) => c.id === r.referred_customer_id)?.fullName,
            status: r.status as Referral["status"], rewardPoints: n(r.reward_points),
          })),
          promos: rows<PromoRow>(promoR).map(toPromo),
          automations: rows<RuleRow>(ruleR).map(toRule),
          messages: rows<MsgRow>(msgR).map(toMsg),
          insights: rows<InsightRow>(insightR).map(toInsight),
          publishedSnapshot: pub,
          publishedAt: (relR.data as { created_at?: string } | null)?.created_at ?? null,
        });

        await get().loadPlatform();
      } catch (e) {
        set({ loading: false });
        fail(e);
      }
    },

    async loadPlatform() {
        const generation = ++loadGeneration;
        // Plataforma (vacía por RLS salvo SUPER_ADMIN)
        try {
          const [plR, pbR, auR, apR, saleR, userR] = await Promise.all([
            supabase.from("plans").select("*").order("price_monthly"),
            supabase.from("businesses").select("id, name, slug, status, created_at, subscriptions(id, plan_id, status, created_at), business_users(count)").order("created_at", { ascending: false }),
            supabase.from("audit_logs").select("*, actor:users!audit_logs_user_id_fkey(full_name,email)").order("created_at", { ascending: false }).limit(200),
            supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_start", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).lt("scheduled_start", new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()),
            supabase.from("sales").select("id", { count: "exact", head: true }),
            supabase.from("users").select("id", { count: "exact", head: true }),
          ]);
          if (generation !== loadGeneration) return;
          for (const result of [plR, pbR, auR, apR, saleR, userR]) if (result.error) throw result.error;
          const plans: PlanRow[] = ((plR.data ?? []) as { id: string; code: string; name: string; price_monthly: number; limits: Record<string, number>; modules: Record<string, boolean>; is_active: boolean }[]).map((p) => ({
            id: p.id, code: p.code, name: p.name, priceMonthly: n(p.price_monthly),
            maxEmployees: p.limits?.max_employees === null ? null : n(p.limits?.max_employees),
            modules: Object.entries(p.modules ?? {}).filter(([, v]) => v).map(([k]) => k).join(", "),
            active: p.is_active,
          }));
          const businesses: PlatformBusiness[] = ((pbR.data ?? []) as { id: string; name: string; slug: string; status: string; created_at: string; subscriptions: { id: string; plan_id: string; status: string; created_at: string }[]; business_users: { count: number }[] }[]).map((b) => {
            const sub = [...(b.subscriptions ?? [])].sort((a, z) => z.created_at.localeCompare(a.created_at) || z.id.localeCompare(a.id))[0];
            const plan = plans.find((p) => p.id === sub?.plan_id);
            return {
              id: b.id, name: b.name, slug: b.slug,
              plan: plan?.code ?? "Sin plan",
              status: (b.status as PlatformBusiness["status"]) ?? "TRIAL",
              users: n(b.business_users?.[0]?.count),
              mrr: sub?.status === "ACTIVE" ? plan?.priceMonthly ?? 0 : 0,
              createdAt: b.created_at,
            };
          });
          const mrr = businesses.reduce((a, b) => a + b.mrr, 0);
          const audit: AuditEntry[] = ((auR.data ?? []) as Record<string, unknown>[]).map((r) => ({
            id: s(r.id), action: s(r.action) || "UPDATE", entity: s(r.entity_table),
            detail: `${s(r.action)} · ${s(r.entity_table)} · ${s((r.after as Record<string, unknown> | null)?.name) || s((r.before as Record<string, unknown> | null)?.name) || s((r.after as Record<string, unknown> | null)?.email) || s((r.before as Record<string, unknown> | null)?.email) || s(r.entity_id)}`,
            before: r.before == null ? undefined : JSON.stringify(r.before),
            after: r.after == null ? undefined : JSON.stringify(r.after),
            user: s((r.actor as { full_name?: string } | null)?.full_name) || s((r.actor as { email?: string } | null)?.email) || "Sistema / cuenta eliminada",
            at: s(r.created_at),
          }));
          set({
            audit,
            platform: {
              plans, businesses,
              kpis: {
                activeBusinesses: businesses.filter((b) => b.status === "ACTIVE").length,
                suspendedBusinesses: businesses.filter((b) => b.status === "SUSPENDED").length,
                newThisMonth: businesses.filter((b) => b.createdAt && new Date(b.createdAt).getMonth() === new Date().getMonth() && new Date(b.createdAt).getFullYear() === new Date().getFullYear()).length,
                users: userR.count ?? 0,
                monthAppointments: apR.count ?? 0, processedSales: saleR.count ?? 0,
                mrr, churn: 0,
              },
            },
          });
        } catch (e) { console.warn("platform:", e); }
    },

    /* ── Citas ─────────────────────────────────────────────────────────── */
    async createAppointment(a) {
      const svc = get().services.find(x => x.name === a.serviceName && (!a.locationId || x.locationId === a.locationId));
      if (!svc) throw new Error("Selecciona un servicio válido de la sucursal");
      const bid = B();
      const { data, error } = await supabase.rpc("save_calendar_appointment", {
        p_business_id: bid, p_service_id: svc.id,
        p_data: { location_id: locationForWrite(a.locationId), customer_id: a.customerId, employee_id: a.employeeId || null,
          status: a.status, source: a.source === "LANDING" ? "LANDING" : a.source === "WHATSAPP" ? "WHATSAPP" : "WALK_IN",
          scheduled_start: a.start, scheduled_end: a.end, notes: a.notes ?? "" },
      });
      if (error) throw error;
      await get().load(bid);
      return data as string;
    },
    async reschedule(id, startISO) {
      const appt = get().appointments.find(x => x.id === id);
      if (!appt) throw new Error("Cita no encontrada");
      const dur = new Date(appt.end).getTime() - new Date(appt.start).getTime();
      const { error } = await supabase.from("appointments").update({ scheduled_start: startISO, scheduled_end: new Date(new Date(startISO).getTime() + dur).toISOString() }).eq("id", id).eq("business_id", B()).select("id").single();
      if (error) throw error;
      await get().load(B());
    },
    async setStatus(id, status) {
      let result;
      if (status === "CANCELLED") result = await supabase.rpc("cancel_appointment", { p_appointment_id: id, p_reason: "" });
      else if (status === "COMPLETED") result = await supabase.rpc("complete_appointment", { p_appointment_id: id });
      else result = await supabase.from("appointments").update({ status }).eq("id", id).eq("business_id", B()).select("id").single();
      if (result.error) throw result.error;
      await get().load(B());
    },

    /* ── Clientes ──────────────────────────────────────────────────────── */
    addCustomer(c) {
      const id = uid();
      const code = `${(c.fullName.match(/[A-Za-z]/g) ?? ["C"]).join("").toUpperCase().slice(0, 5) || "CLI"}-${Math.floor(100 + Math.random() * 899)}`;
      set((st) => ({ customers: [{ ...c, id, visitCount: 0, totalSpent: 0, tier: "STARTER", points: 0, referralCode: code, notes: [], photos: [] }, ...st.customers] }));
      void supabase.from("customers").insert({
        id, business_id: B(), full_name: c.fullName, phone: c.phone, referral_code: code,
        birth_date: c.birthDate ?? null, whatsapp_opt_in: c.whatsappOptIn ?? true,
      }).then(({ error }) => { if (error) { fail(error); refresh(); } });
      return id;
    },
    addNote(customerId, note) {
      void supabase.from("customer_notes").insert({ business_id: B(), customer_id: customerId, note }).then(({ error }) => {
        if (error) fail(error); else refresh();
      });
    },
    addPhoto(customerId, p) {
      void supabase.from("customer_photos").insert({
        business_id: B(), customer_id: customerId, kind: p.kind,
        storage_path: p.url ?? "", notes: p.note, taken_at: p.takenAt,
      }).then(({ error }) => { if (error) fail(error); else refresh(); });
    },

    /* ── Catálogo ──────────────────────────────────────────────────────── */
    async saveService(svc) {
      const { error } = await supabase.from("services").upsert({
        id: svc.id, business_id: B(), location_id: locationForWrite(svc.locationId), name: svc.name, description: svc.description,
        duration_min: svc.durationMin, price: svc.price, active: svc.active,
        show_on_website: svc.showOnWebsite, position: svc.position ?? 0,
      });
      if (error) throw error;
      await get().load(B());
    },
    removeService(id) {
      set((st) => ({ services: st.services.map((x) => (x.id === id ? { ...x, active: false } : x)) }));
      void supabase.from("services").update({ active: false }).eq("id", id).then(({ error }) => error && fail(error));
    },
    async saveEmployee(e) {
      const { error } = await supabase.rpc("save_team_member", { p_business_id: B(), p_id: e.id,
        p_data: { location_id: locationForWrite(e.locationId), full_name: e.fullName, role_label: e.roleLabel, specialty: e.specialty,
          bio: e.bio, commission_rate: e.commissionRate, show_on_website: e.showOnWebsite, active: e.active ?? true }, p_services: e.serviceIds ?? [] });
      if (error) throw error;
      await get().load(B());
    },
    async saveProduct(p) {
      const { error } = await supabase.from("products").upsert({
        id: p.id, business_id: B(), location_id: locationForWrite(p.locationId), name: p.name, sku: p.sku, category: p.category,
        price: p.price, cost: p.cost, stock: p.stock, stock_min: p.stockMin, active: p.active,
      });
      if (error) throw error;
      await get().load(B());
    },
    async adjustStock(productId, type, qty) {
      const { error } = await supabase.rpc("adjust_branch_stock", { p_product_id: productId, p_type: type, p_qty: qty });
      if (error) throw error;
      await get().load(B());
    },

    /* ── Ventas (POS) ──────────────────────────────────────────────────── */
    async createSale(sale) {
      const location_id = locationForWrite(sale.locationId);
      const { data, error } = await supabase.rpc("create_branch_sale", {
        p_business_id: B(), p_location_id: location_id, p_customer_id: sale.customerId || null,
        p_employee_id: sale.employeeId || null, p_discount: sale.discountTotal,
        p_items: sale.items, p_payments: sale.payments,
      });
      if (error) throw error;
      await get().load(B());
      return data as string;
    },

    /* ── Waitlist ──────────────────────────────────────────────────────── */
    addWaitlist(w) {
      const id = uid();
      const emp = get().employees.find((e) => e.fullName === w.employeeName);
      set((st) => ({ waitlist: [{ ...w, id, status: "WAITING", createdAt: new Date().toISOString() }, ...st.waitlist] }));
      void supabase.from("waitlist").insert({
        id, business_id: B(), customer_id: w.customerId, service_id: w.serviceId,
        employee_id: emp?.id ?? null, preferred_date: w.preferredDate ?? null,
        priority: w.priority,
      }).then(({ error }) => { if (error) { fail(error); refresh(); } });
    },
    bookWaitlist(id) {
      set((st) => ({ waitlist: st.waitlist.map((x) => (x.id === id ? { ...x, status: "BOOKED" } : x)) }));
      void supabase.from("waitlist").update({ status: "BOOKED" }).eq("id", id).then(({ error }) => error && fail(error));
    },
    removeWaitlist(id) {
      set((st) => ({ waitlist: st.waitlist.map((x) => (x.id === id ? { ...x, status: "CANCELLED" } : x)) }));
      void supabase.from("waitlist").update({ status: "CANCELLED" }).eq("id", id).then(({ error }) => error && fail(error));
    },

    /* ── Fidelización ──────────────────────────────────────────────────── */
    async addLoyalty(customerId, points, reason) {
      const bid = B();
      const r = await supabase.rpc("adjust_loyalty_points", { p_business_id: bid, p_customer_id: customerId, p_points: points, p_reason: reason });
      if (r.error) throw r.error;
      if (get().businessId === bid) await get().load(bid);
    },
    async savePromo(p) {
      const bid = B();
      const r = await supabase.from("promotions").upsert({
        id: p.id, business_id: bid, name: p.name, description: p.description, service_id: p.serviceId || null,
        price: p.price ?? null, discount_percent: p.discountPercent, starts_at: p.startsAt, ends_at: p.endsAt,
        is_active: p.isActive, show_on_website: p.showOnWebsite,
      }).select("id").single();
      if (r.error) throw r.error;
      if (get().businessId === bid) await get().load(bid);
    },
    async togglePromo(id) {
      const bid = B(); const p = get().promos.find(x => x.id === id);
      if (!p) throw new Error("Promoción no encontrada");
      const r = await supabase.from("promotions").update({ is_active: !p.isActive }).eq("business_id", bid).eq("id", id).select("id").single();
      if (r.error) throw r.error;
      if (get().businessId === bid) await get().load(bid);
    },

    /* ── WhatsApp ──────────────────────────────────────────────────────── */
    async toggleAutomation(id) {
      const bid = B();
      const r = get().automations.find((x) => x.id === id);
      if (!r) throw new Error("Automatización no encontrada");
      const result = await supabase.from("automation_rules").update({ is_enabled: !r.isEnabled }).eq("business_id", bid).eq("id", id).select("id").single();
      if (result.error) throw result.error;
      if (get().businessId === bid) await get().load(bid);
    },
    async updateTemplate(id, template) {
      const bid = B();
      if (!template.trim()) throw new Error("Escribe una plantilla");
      const result = await supabase.from("automation_rules").update({ template: template.trim() }).eq("business_id", bid).eq("id", id).select("id").single();
      if (result.error) throw result.error;
      if (get().businessId === bid) await get().load(bid);
    },
    async sendMessage(customerName, phone, body) {
      const bid = B();
      if (!phone.trim() || !body.trim()) throw new Error("El cliente necesita teléfono y el mensaje no puede estar vacío");
      const customer = get().customers.find(c => c.fullName === customerName && c.phone === phone);
      const result = await supabase.from("whatsapp_messages").insert({
        business_id: bid, customer_id: customer?.id ?? null, to_phone: phone.trim(), body: body.trim(), status: "QUEUED",
      }).select("id").single();
      if (result.error) throw result.error;
      if (get().businessId === bid) await get().load(bid);
    },

    /* ── IA ────────────────────────────────────────────────────────────── */
    dismissInsight(id) {
      set((st) => ({ insights: st.insights.map((x) => (x.id === id ? { ...x, status: "DISMISSED" } : x)) }));
      void supabase.from("ai_insights").update({ status: "DISMISSED", resolved_at: new Date().toISOString() }).eq("id", id).then(({ error }) => error && fail(error));
    },

    /* ── Website ───────────────────────────────────────────────────────── */
    updateSection(type, content) {
      set((st) => ({
        site: {
          ...st.site,
          sections: st.site.sections.map((x) => (x.type === type ? { ...x, content: { ...x.content, ...content } } : x)),
        },
      }));
      void (async () => {
        const cur = get().site.sections.find((x) => x.type === type);
        const { error } = await supabase.from("website_sections")
          .update({ content: cur?.content ?? content })
          .eq("business_id", B()).eq("type", type);
        if (error) { fail(error); refresh(); }
      })();
    },
    toggleSection(type) {
      const cur = get().site.sections.find((x) => x.type === type);
      set((st) => ({
        site: { ...st.site, sections: st.site.sections.map((x) => (x.type === type ? { ...x, active: !x.active } : x)) },
      }));
      void supabase.from("website_sections").update({ active: !(cur?.active ?? true) }).eq("business_id", B()).eq("type", type)
        .then(({ error }) => error && fail(error));
    },
    moveSection(type, dir) {
      const secs = [...get().site.sections].sort((a, b) => a.position - b.position);
      const i = secs.findIndex((x) => x.type === type);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= secs.length) return;
      const a = secs[i]; const b = secs[j];
      if (!a || !b) return;
      set((st) => ({
        site: { ...st.site, sections: st.site.sections.map((x) => (x.type === a.type ? { ...x, position: b.position } : x.type === b.type ? { ...x, position: a.position } : x)) },
      }));
      void (async () => {
        await supabase.from("website_sections").update({ position: b.position }).eq("business_id", B()).eq("type", a.type);
        await supabase.from("website_sections").update({ position: a.position }).eq("business_id", B()).eq("type", b.type);
      })();
    },
    setBranding(preset, colors) {
      set((st) => ({
        site: {
          ...st.site,
          branding: {
            preset: (preset as ThemePreset) ?? st.site.branding.preset,
            colors: { ...st.site.branding.colors, ...colors },
            font_key: st.site.branding.font_key,
          },
        },
      }));
      void supabase.from("business_branding").upsert({
        business_id: B(),
        preset: preset ?? get().site.branding.preset,
        colors: { ...get().site.branding.colors, ...colors },
        font_key: get().site.branding.font_key,
      }).then(({ error }) => error && fail(error));
    },
    publishSite() {
      const snapshot = JSON.parse(JSON.stringify(get().site)) as PublicSite;
      set({ publishedSnapshot: snapshot, publishedAt: new Date().toISOString() });
      void (async () => {
        const { error } = await supabase.rpc("publish_website", { p_business_id: B() });
        if (error) return fail(error);
        refresh();
      })();
    },

    /* ── Plataforma ────────────────────────────────────────────────────── */
    async setBusinessStatus(slug, status) {
      const { data, error } = await supabase.from("businesses").update({ status }).eq("slug", slug).select("id").single();
      if (error) throw error;
      if (!data) throw new Error("Negocio no encontrado");
      await get().loadPlatform();
    },
    async savePlan(p) {
      const { data: existing, error } = await supabase.from("plans").select("limits,modules,description").eq("id", p.id).maybeSingle();
      if (error) throw error;
      const modules: Record<string, boolean> = Object.fromEntries(Object.keys(existing?.modules ?? {}).map(k => [k, false]));
      p.modules.split(",").map(m => m.trim()).filter(Boolean).forEach(m => { modules[m] = true; });
      await saveAdmin("plans", existing ? p.id : null, {
        code: p.code, name: p.name, description: existing?.description ?? "", price_monthly: p.priceMonthly,
        limits: { ...existing?.limits, max_employees: p.maxEmployees }, modules, is_active: p.active,
      });
      await get().loadPlatform();
    },
  };
});
