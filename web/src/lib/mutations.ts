import { toast } from "sonner";
import { planError } from "../store/capabilities";
/** No anunciar éxito antes de que el backend confirme la operación. */
export async function runMutation(action: () => Promise<unknown>, success?: () => void) {
  try { await action(); success?.(); } catch (error) { toast.error(planError(error)); }
}
