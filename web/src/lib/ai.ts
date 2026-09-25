/** Copiloto mediante Edge Function: sin claves privadas ni métricas simuladas en el navegador. */
import { aiInvocationError } from "./ai-errors";
import { supabase } from "./supabase";
import { useDB } from "../store/db";
export interface AiReply { answer: string; ai?: { provider:string; model:string; usedFallback:boolean }; cta?: { label: string; href: string } }
async function invoke(payload: Record<string, unknown>) {
  const businessId = useDB.getState().businessId;
  if (!businessId) throw new Error("Selecciona un negocio");
  const { data, error } = await supabase.functions.invoke("ai-copilot", { body: { ...payload, business_id: businessId } });
  if (error) {
    throw new Error(await aiInvocationError(error,()=>fetch(`${String(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'')}/functions/v1/ai-copilot`,{method:'GET',credentials:'omit',signal:AbortSignal.timeout(5000)})));
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function askCopilot(message: string): Promise<AiReply> {
  try { const data = await invoke({ action: "chat", message }); return { answer: data?.answer || "No tengo datos suficientes.", ai:data?.ai }; }
  catch (error) { return { answer: error instanceof Error ? error.message : "El servicio de IA no está disponible." }; }
}
export async function generateInsights(): Promise<number> {
  const data = await invoke({ action: "insights" });
  return Number(data?.created ?? 0);
}
