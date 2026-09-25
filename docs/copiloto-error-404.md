# Copiloto: diagnóstico confirmado y solución

## Resultado de la comprobación remota

El endpoint del proyecto configurado en el frontend:

`https://uvydtpclprvuxhxdvwoq.supabase.co/functions/v1/ai-copilot`

respondió a OPTIONS y GET con **HTTP 404**:

```json
{"code":"NOT_FOUND","message":"Requested function was not found"}
```

Comprobación sin datos del negocio ni tokens de los proveedores; sin escrituras remotas ni inferencia. Evidencia: `.pgtest/ai-remote-diagnostic.json`.

**Causa confirmada de este error:** la ruta `ai-copilot` no existe en ese proyecto. Guardar `HF_TOKEN`/`GROQ_API_KEY` en Secrets no instala la función. Tampoco se ha comprobado todavía si los tokens del proveedor son válidos: el fallo ocurre antes de poder usarlos.

## Solución desde el panel, sin terminal

1. Entrar al proyecto Supabase con referencia **`uvydtpclprvuxhxdvwoq`**, el mismo que usa este frontend. Si los secretos se configuraron en otro proyecto, no se aplican a este.
2. Ir a **Edge Functions → Deploy a new function → Via Editor** (los rótulos pueden variar).
3. Nombre exacto de función: **`ai-copilot`**. No `quick-service`, ni `ai_copilot`, ni el nombre de un proveedor.
4. En `index.ts`, reemplazar el ejemplo con **todo** el contenido de `supabase/dashboard/ai-copilot.ts`, que se entrega abierto en el visor. Es un archivo único, sin imports a archivos locales ni claves privadas incluidas.
5. Pulsar **Deploy** y confirmar que aparezca `ai-copilot` en la lista de funciones.
6. Esta implementación valida la sesión dentro de la función con `auth.getUser()` y autoriza las RPCs. Su configuración local es `verify_jwt=false`. Para reproducirla en el panel, desactivar **Verify JWT / Verify JWT with legacy secret** del gateway solo para esta función y este código; no quitar la validación Auth ni los permisos del código. No aplicar este cambio indiscriminadamente a otras funciones.
7. Conservar en **Secrets**, como entradas separadas:

```text
HF_TOKEN=<token privado real>
GROQ_API_KEY=<clave privada real>
AI_PROVIDER=huggingface
AI_FALLBACK_PROVIDER=groq
```

Los valores de los últimos dos son exactamente `huggingface` y `groq`, sin comillas ni nombres concatenados. Los dos primeros deben contener las claves reales, no el texto explicativo de la tabla. No volver a compartirlas en el chat.

8. Volver a Nuvia, recargar, iniciar sesión si es necesario y enviar una pregunta al Copiloto.

## Alternativa con CLI autorizada

Desde la raíz de este proyecto, con la CLI autenticada y permisos sobre Supabase:

```bash
npx supabase functions deploy ai-copilot --project-ref uvydtpclprvuxhxdvwoq
```

La configuración de `supabase/config.toml` ya conserva autenticación interna y RBAC. No hace falta SQL nuevo para desplegar esta función; la migración de planes/capacidades debe existir para que las RPCs de autorización funcionen.

## Cambios locales realizados

- El preview ahora distingue función inexistente, sesión rechazada, error de red/CORS, fallo de inicio y errores del proveedor.
- Cuando OPTIONS falla y el navegador solo expone `FunctionsFetchError`, realiza un GET simple, sin JWT/apikey/datos del negocio, para comprobar si la ruta es 404. No adivina que falta la función ante cualquier fallo de red.
- Archivo único para el panel generado de las fuentes existentes mediante `python3 supabase/compose_edge.py`. No se mantiene una implementación diferente.
- **17 pruebas Edge PASS sobre el archivo único**, incluidas Auth, tenant y respaldo; **7 pruebas de mensajes PASS**; TypeScript/Vite build PASS. Pruebas aisladas con red interceptada.

## Estado

La función se preparó y comprobó localmente. **No se ha desplegado remotamente**: este entorno sigue sin acceso administrativo a Supabase. Tampoco se han leído los secretos guardados ni certificado respuestas reales de Hugging Face/Groq. El paso pendiente que resuelve el 404 es desplegar la función en el proyecto indicado.
