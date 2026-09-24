import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Sin credenciales la app no tiene backend: falla ruidoso en desarrollo.
  console.error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en web/.env");
}

/** Cliente Supabase de Nuvia. Conserva la clave técnica histórica para no perder sesiones existentes. */
export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "anon-missing",
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: "beautyos-auth" } },
);

