import { BRAND_NAME } from "./lib/brand";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import AppShell from "./app/AppShell";
import AdminShell from "./app/AdminShell";
import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import CalendarPage from "./features/calendar/CalendarPage";
import ClientsPage from "./features/clients/ClientsPage";
import ServicesPage from "./features/services/ServicesPage";
import TeamPage from "./features/team/TeamPage";
import SalesPage from "./features/sales/SalesPage";
import InventoryPage from "./features/inventory/InventoryPage";
import LoyaltyPage from "./features/loyalty/LoyaltyPage";
import WhatsAppPage from "./features/whatsapp/WhatsAppPage";
import AiPage from "./features/ai/AiPage";
import ReportsPage from "./features/reports/ReportsPage";
import WebsitePage from "./features/website/WebsitePage";
import PlanPage, { PlanCatalog } from "./features/settings/PlanPage";
import BranchesPage from "./features/settings/BranchesPage";
import SettingsPage from "./features/settings/SettingsPage";
import ReceptionPage from "./features/reception/ReceptionPage";
import AdminOverview from "./features/admin/AdminOverview";
import { AdminAudit, AdminBusinesses, AdminPlans, AdminUsers } from "./features/admin/AdminPages";
import LandingPage from "./features/landing/LandingPage";
import { useSession } from "./store/session";

function Splash() {
  return <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-body">{BRAND_NAME}…</div>;
}

/** Exige sesión: sin usuario manda al login guardando el destino. */
function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Defensa de navegación; los permisos de datos se aplican mediante RLS. */
function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  return user?.platformRole === "SUPER_ADMIN" ? <>{children}</> : <Navigate to="/app/dashboard" replace />;
}

/** Login solo para invitados: con sesión activa entra directo a la app. */
function RequireGuest({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const lastPath = useSession((s) => s.lastPath);
  if (!ready) return <Splash />;
  if (user) {
    const resume = user.platformRole === "SUPER_ADMIN" ? "/admin" : lastPath?.startsWith("/app/") ? lastPath : "/app/dashboard";
    return <Navigate to={resume} replace />;
  }
  return <>{children}</>;
}

/** Raíz inteligente: retoma la última pantalla si hay sesión; si no, al login. */
function SmartLanding() {
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const lastPath = useSession((s) => s.lastPath);
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  const resume = user.platformRole === "SUPER_ADMIN" ? "/admin" : lastPath?.startsWith("/app/") ? lastPath : "/app/dashboard";
  return <Navigate to={resume} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SmartLanding />} />
        <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />

        {/* Business Admin + Workers */}
        <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="loyalty" element={<LoyaltyPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="website" element={<WebsitePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/plan" element={<PlanPage />} />
          <Route path="settings/branches" element={<BranchesPage />} />
          <Route path="reception" element={<ReceptionPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Super Admin */}
        <Route path="/admin" element={<RequireAuth><RequireSuperAdmin><AdminShell /></RequireSuperAdmin></RequireAuth>}>
          <Route index element={<AdminOverview />} />
          <Route path="businesses" element={<AdminBusinesses />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Landing pública del negocio */}
        <Route path="/plans" element={<div className="max-w-5xl mx-auto p-8 space-y-6"><h1 className="text-title font-semibold">Planes {BRAND_NAME}</h1><PlanCatalog /></div>} />
        <Route path="/b/:slug" element={<LandingPage />} />

        {/* Cualquier otra ruta → raíz inteligente */}
        <Route path="*" element={<SmartLanding />} />
      </Routes>
      <Toaster position="bottom-right" theme="system" closeButton richColors />
    </HashRouter>
  );
}
