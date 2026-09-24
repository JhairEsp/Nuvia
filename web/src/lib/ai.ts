/** Copiloto mediante Edge Function: sin claves privadas ni métricas simuladas en el navegador. */
import { supabase } from "./supabase";
import { useDB } from "../store/db";
export interface AiReply { answer: string; cta?: { label: string; href: string } }
async function invoke(payload: Record<string, unknown>) {
  const businessId = useDB.getState().businessId;
  if (!businessId) throw new Error("Selecciona un negocio");
  const { data, error } = await supabase.functions.invoke("ai-copilot", { body: { ...payload, business_id: businessId } });
  if (error) {
    let message = "No se pudo conectar con el Copiloto. Revisa el despliegue de ai-copilot y sus secretos.";
    if (error.context instanceof Response) {
      try { message = (await error.context.json()).error || message; } catch { /* Respuesta no JSON del gateway. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function askCopilot(message: string): Promise<AiReply> {
  try { const data = await invoke({ action: "chat", message }); return { answer: data?.answer || "No tengo datos suficientes." }; }
  catch (error) { return { answer: error instanceof Error ? error.message : "El servicio de IA no está disponible." }; }
}
export async function generateInsights(): Promise<number> {
  const data = await invoke({ action: "insights" });
  return Number(data?.created ?? 0);
}
