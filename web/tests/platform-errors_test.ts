import { platformFunctionError } from "../src/lib/platform-errors.ts";
const cases: [string, number, unknown, string][] = [
  ["Cuenta ausente no es función ausente", 404, { error: "Cuenta no encontrada en Authentication" }, "Cuenta no encontrada en Authentication"],
  ["Gateway sin despliegue", 404, { code: "NOT_FOUND", message: "Requested function was not found" }, "La función quick-service no existe en el proyecto configurado."],
  ["Mantiene error de sesión", 401, { error: "Sesión inválida. Inicia sesión nuevamente." }, "Sesión inválida. Inicia sesión nuevamente."],
  ["Mantiene error SQL", 409, { error: "Perfil rechazado" }, "Perfil rechazado"],
  ["Mantiene error de autorización", 403, { error: "Acceso exclusivo para Super Admin" }, "Acceso exclusivo para Super Admin"],
  ["404 desconocido no diagnostica despliegue", 404, null, "La operación no encontró el recurso solicitado. No se pudo determinar cuál; revisa los registros de la función."],
  ["Mantiene mensaje del servidor", 500, { message: "Database error finding user" }, "Database error finding user"],
];
for (const [label, status, body, expected] of cases) {
  Deno.test(label, () => {
    const actual = platformFunctionError("quick-service", status, body);
    if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
  });
}
