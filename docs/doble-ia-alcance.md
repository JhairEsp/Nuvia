# Copiloto con IA principal y respaldo · alcance 24/09/2026

Petición autorizada: activar y agregar una segunda IA cuando la principal agote su cuota.

Inspección de acceso: solo existen variables públicas VITE de la aplicación. No se encontraron credenciales de despliegue, tokens HF/Groq ni acceso administrativo a Supabase en el entorno. No se pueden aplicar migraciones ni desplegar con la clave anónima. No se intentarán escrituras remotas con ella.

Cambios no destructivos previstos:
- `_shared/ai-provider.ts`: principal Hugging Face/Qwen3-8B y respaldo Groq/gpt-oss-120b cuando estén configurados ambos tokens; selección explícita por secretos de servidor.
- Fallback por crédito agotado, 429, fallos temporales 5xx y red/timeout. No por rechazo de permisos/Auth, peticiones inválidas o negativa del modelo.
- Una conmutación por consulta; continuar con el respaldo en siguientes rondas. Sin bucles, rotación de cuentas ni elusión de cuotas. Si ambos fallan, error claro, sin cifras inventadas.
- Respuesta indica qué proveedor/modelo respondió y si se utilizó respaldo; UI lo identifica.
- Mantener JWT de usuario, RBAC, aislamiento tenant y allowlist de herramientas. No cambiar SQL, saldos, usuarios, planes ni QR.
- Tests aislados de cuota/fallback/ambos caídos/permisos y guía de activación. No contratación ni recarga de créditos; dos proveedores también tienen límites.

Activación remota bloqueada por falta de acceso y secretos; no anunciarla como realizada.
