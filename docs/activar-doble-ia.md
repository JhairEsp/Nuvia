# Activar IA principal + respaldo en Nuvia

**Estado al 24/09/2026: implementado y probado localmente; NO activado en el despliegue remoto.**

## Configuración elegida

| Función | Proveedor | Modelo predeterminado |
|---|---|---|
| Principal | Hugging Face | `Qwen/Qwen3-8B` |
| Respaldo | Groq | `openai/gpt-oss-120b` |

Se usan dos proveedores independientes: dos modelos bajo un mismo saldo de Hugging Face no solucionarían el agotamiento de ese saldo. Ambos tienen sus propios límites; esto no ofrece uso ilimitado ni activa recargas o suscripciones.

### Cómo cambia de IA

- Conmuta por HTTP 402 (créditos), 429 (cuota), 5xx o error de red/timeout.
- Solo una conmutación por pregunta. Después sigue con el respaldo en las rondas de herramientas de esa pregunta; no vuelve a intentar la principal en cada ronda.
- Una pregunta nueva vuelve a intentar la principal. No hay circuito global persistente entre instancias.
- No conmuta para eludir denegaciones de Auth/permisos, errores de configuración 400/401/403/404/422 o una negativa del modelo.
- Si las dos están caídas/agotadas, comunica el fallo y no inventa métricas.
- Cuatro rondas, ocho herramientas y 2048 tokens por llamada como máximo. Con respaldo: timeout de 20 segundos por intento y presupuesto de 90 segundos para las llamadas al modelo durante la pregunta. Sin respaldo: 45 segundos por intento, dentro del mismo presupuesto.
- La respuesta incluye `{ai: {provider, model, usedFallback}}`, sin secretos. El chat muestra **IA principal** o **IA de respaldo** y el proveedor/modelo que respondió.

Los permisos de negocio y capacidades se validan **antes de llamar a cualquier IA**. Las herramientas siguen usando el JWT del usuario, el tenant autorizado y la allowlist existente. No se concede acceso extra al usar el respaldo.

## Qué bloquea la activación desde este entorno

Aquí solo se encontraron variables públicas de la aplicación (`VITE_SUPABASE_URL`, clave anónima y nombre de función de administración). No hay token administrativo de Supabase/CLI autenticada, tokens de IA, sesión del hosting ni repositorio remoto conectado.

La clave anónima no puede instalar migraciones, administrar secretos o desplegar funciones. La autorización del usuario para realizarlo no sustituye esas credenciales técnicas. **No se han realizado escrituras remotas ni llamadas de inferencia real.**

No pegar tokens en el chat ni subirlos a un repositorio. Se requiere una sesión de despliegue autorizada y los tokens en el gestor de secretos del proyecto.

## Activación una vez disponible el acceso

### 1. Secretos del proyecto Supabase

Introducir mediante **Edge Functions → Secrets** (valores privados reales, no estos marcadores):

```text
AI_PROVIDER=huggingface
HF_TOKEN=<token privado Hugging Face con acceso de inferencia>
HF_MODEL=Qwen/Qwen3-8B
AI_FALLBACK_PROVIDER=groq
GROQ_API_KEY=<clave privada Groq>
GROQ_MODEL=openai/gpt-oss-120b
```

No utilizar `VITE_*` para ninguno de estos secretos. El modelo debe estar disponible en el proveedor elegido y admitir herramientas; verificar con una consulta real autorizada antes de dar la activación por terminada.

**Valores compatibles:**

- Si no se declara `AI_PROVIDER`, se elige HF cuando hay `HF_TOKEN`; en su defecto, Groq cuando hay `GROQ_API_KEY`.
- Si no se declara `AI_FALLBACK_PROVIDER` y están ambos tokens, se utiliza el otro proveedor como respaldo.
- `AI_FALLBACK_PROVIDER=none` desactiva explícitamente la conmutación.
- Un respaldo explícito aún sin token no impide funcionar a una principal sana; si llega a necesitarse, se informa que falta configurar el secreto.
- También se admite `self-hosted` con endpoint HTTPS autenticado y compatible, según la guía anterior. No se instala un servidor ni se contrata hardware automáticamente.

### 2. Desplegar el código actualizado

Con CLI autenticada y permiso sobre el proyecto correcto, desde la raíz del proyecto:

```bash
supabase functions deploy ai-copilot --project-ref <referencia-real-del-proyecto>
npm ci --prefix web
npm run build --prefix web
```

Publicar `web/dist` en el hosting existente para que el chat muestre el proveedor utilizado. El `config.toml` existente delega la verificación del JWT a `auth.getUser()` dentro de `ai-copilot`; la función mantiene esa autenticación y validación de permisos. No se elimina autenticación para hacer funcionar el respaldo.

**No hace falta SQL adicional por la doble IA.** Para activar también los cambios anteriores de QR/fotos/editor, instalar las migraciones faltantes 03 → 04 → 05, una vez cada una, según las guías anteriores. No ejecutar `SUPABASE.sql` sobre una base existente.

Esta modificación aplica al Copiloto y los insights invocados desde él. El cron independiente `ai-insights` no cambia.

### 3. Validar antes de anunciar activación

1. Iniciar sesión como usuario autorizado y consultar una cifra conocida del negocio; comparar con el reporte y confirmar indicador de principal.
2. Probar con usuario sin permisos: debe rechazar antes de llamar proveedores.
3. Validar el respaldo en un entorno de pruebas con fallo controlado del principal; no consumir créditos deliberadamente para provocar el agotamiento ni poner una clave inválida (401 no provoca fallback).
4. Confirmar que ningún secreto aparece en bundle, respuestas o logs.
5. Si hay cuotas agotadas en ambos, comprobar error claro, sin cifras ficticias.

## Pruebas ejecutadas

- **39 pruebas Edge PASS**: principal sana, agotamiento, 429, 5xx/red, respaldo fijo por pregunta, dos proveedores fallando, falta de token, no bypass de rechazos ni permisos y metadatos de proveedor.
- **TypeScript/Vite build PASS**. Persiste la advertencia de bundle grande.
- Todas las peticiones de proveedor/Supabase de las pruebas están interceptadas. No acreditan inferencia con tokens reales ni despliegue remoto.

Evidencia: `.pgtest/ai-fallback-results.log`, `.pgtest/ai-fallback-build.log`.

## Diagnóstico posterior: función ausente

La comprobación remota devolvió 404 NOT_FOUND en `ai-copilot`. Existe ahora una [guía de instalación desde el panel](copiloto-error-404.md) y un archivo único `supabase/dashboard/ai-copilot.ts`, generado con `python3 supabase/compose_edge.py`. Guardar Secrets no sustituye el despliegue de esta función.
