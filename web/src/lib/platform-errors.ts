/** Distingue errores del gateway de errores devueltos por nuestra función. */
export function platformFunctionError(functionName: string, status: number, payload: unknown): string {
  const body = payload !== null && typeof payload === "object" ? payload as Record<string, unknown> : {};
  // Nuestra función devuelve { error }; su 404 puede ser el usuario, no el endpoint.
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  // El gateway de Supabase usa este código/cuerpo cuando falta el despliegue.
  if (status === 404 && body.code === "NOT_FOUND" && body.message === "Requested function was not found") {
    return `La función ${functionName} no existe en el proyecto configurado.`;
  }
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (status === 401) return "La función rechazó la sesión. Vuelve a iniciar sesión y revisa su configuración de Verify JWT.";
  if (status === 403) return "No tienes permiso para realizar esta operación. Se requiere Super Admin.";
  if (status === 404) return "La operación no encontró el recurso solicitado. No se pudo determinar cuál; revisa los registros de la función.";
  return `La función ${functionName} devolvió un error HTTP ${status}. Revisa sus registros en Supabase.`;
}
