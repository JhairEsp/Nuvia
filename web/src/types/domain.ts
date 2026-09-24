/** Domain types — espejo del modelo de datos (supabase/migrations). §53 sin any. */

export type PlatformRole = "USER" | "SUPER_ADMIN";
export type BusinessRole =
  | "BUSINESS_ADMIN" | "RECEPTIONIST" | "BARBER" | "STYLIST" | "THERAPIST" | "CASHIER";
export type AppointmentStatus =
  | "PENDING" | "CONFIRMED" | "IN_SERVICE" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type PaymentMethod = "CASH" | "YAPE" | "PLIN" | "CARD" | "OTHER";
export type ThemePreset = "LUXURY" | "MODERN" | "MINIMAL" | "DARK" | "SOFT" | "ELEGANT";
export type WebsiteSectionType =
  | "HERO" | "SERVICES" | "ABOUT" | "GALLERY" | "TEAM"
  | "PROMOTIONS" | "TESTIMONIALS" | "LOCATION" | "CTA" | "FOOTER";
export type LoyaltyTier = "STARTER" | "SILVER" | "GOLD" | "VIP";
export type WaitlistStatus = "WAITING" | "MATCHED" | "BOOKED" | "CANCELLED";
export type SaleItemKind = "SERVICE" | "PRODUCT";

export interface User {
  id: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  avatarUrl?: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  currency: string;
  timezone: string;
}

export interface Membership {
  businessId: string;
  roleCode: BusinessRole;
  employeeId?: string;
}

export interface Service {
  locationId?: string;
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  category?: string;
  showOnWebsite: boolean;
  active: boolean;
  position?: number;
}

export interface Employee {
  locationId?: string;
  id: string;
  fullName: string;
  roleLabel: string;
  specialty: string;
  bio: string;
  photoUrl?: string;
  commissionRate: number;
  showOnWebsite: boolean;
  active?: boolean;
  serviceIds?: string[];
  schedule?: Record<number, { start: string; end: string } | null>; // 0=dom
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
  lastVisitAt?: string;
  avgRecurrenceDays?: number;
  tier: LoyaltyTier;
  points: number;
  referralCode?: string;
  birthDate?: string;
  whatsappOptIn?: boolean;
  notes?: CustomerNote[];
  photos?: CustomerPhoto[];
}

export interface CustomerNote { id: string; note: string; createdAt: string; by: string; }
export interface CustomerPhoto { id: string; kind: "BEFORE" | "AFTER" | "STYLE"; url?: string; note: string; takenAt: string; service?: string; }

export interface Appointment {
  locationId?: string;
  id: string;
  customerName: string;
  customerId: string;
  serviceName: string;
  employeeName: string;
  employeeId: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  price: number;
  source: string;
  notes?: string;
}

export interface WaitlistEntry {
  id: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  serviceId: string;
  employeeName?: string;
  preferredDate?: string;
  timeRange?: string;
  priority: number;
  status: WaitlistStatus;
  createdAt: string;
}

export interface Product {
  locationId?: string;
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  stockMin: number;
  active: boolean;
}

export interface SaleItem {
  id: string;
  kind: SaleItemKind;
  refId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
  employeeId?: string;
}

export interface Sale {
  locationId?: string;
  id: string;
  customerId?: string;
  customerName?: string;
  employeeId?: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  payments: Array<{ method: PaymentMethod; amount: number; reference?: string }>;
  createdAt: string;
  createdBy: string;
}

export interface Commission {
  id: string;
  employeeId: string;
  saleItemId: string;
  base: number;
  rate: number;
  amount: number;
  status: "PENDING" | "PAID";
  createdAt: string;
}

export interface LoyaltyTx {
  id: string;
  customerId: string;
  type: "EARN" | "REDEEM" | "ADJUST";
  points: number;
  reason: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  code: string;
  referrerName: string;
  referredName?: string;
  status: "PENDING" | "COMPLETED" | "REWARDED";
  rewardPoints: number;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  serviceId?: string;
  price?: number;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showOnWebsite: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  template: string;
  delayMinutes: number;
  isEnabled: boolean;
}

export interface WhatsAppMessage {
  id: string;
  customerName: string;
  toPhone: string;
  body: string;
  status: "QUEUED" | "SENT" | "FAILED";
  createdAt: string;
  ruleName?: string;
}

export interface Kpis {
  revenue: number;
  revenuePrev: number;
  appointments: number;
  appointmentsPrev: number;
  ticketAvg: number;
  ticketPrev: number;
  occupancy: number;
  occupancyPrev: number;
  newCustomers: number;
  paymentMix: Record<PaymentMethod, number>;
}

export interface AiInsight {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  cta?: string;
  status?: "NEW" | "ACTIONED" | "DISMISSED";
}

export interface AtRiskCustomer {
  id: string;
  name: string;
  daysOverdue: number;
  avgRecurrenceDays: number;
  totalSpent: number;
}

export interface PlatformKpis {
  activeBusinesses: number;
  suspendedBusinesses: number;
  newThisMonth: number;
  users: number;
  monthAppointments: number;
  processedSales: number;
  mrr: number;
  churn: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  detail: string;
  before?: string;
  after?: string;
  user: string;
  at: string;
}

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  maxEmployees: number | null;
  modules: string;
  active: boolean;
}

export interface PlatformBusiness {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED";
  users: number;
  mrr: number;
  createdAt?: string;
}

/** Snapshot del sitio público (website_releases.snapshot) */
export interface PublicSite {
  business: { name: string; slug: string; description: string; phone: string; whatsapp: string; email: string; address: string };
  branding: { preset: ThemePreset; colors: { primary?: string; button?: string }; font_key: string };
  website: { tagline: string; socials: { instagram?: string; tiktok?: string; facebook?: string }; map_query: string };
  sections: Array<{ type: WebsiteSectionType; position: number; active: boolean; content: Record<string, unknown> }>;
  services: Service[];
  team: Employee[];
  promotions: Array<{ name: string; description: string; price?: number; discount_percent: number }>;
  testimonials: Array<{ author_name: string; rating: number; content: string }>;
  hours: Array<{ weekday: number; open_time: string; close_time: string; is_closed: boolean }>;
}
