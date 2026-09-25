# Nuvia · QR de cobro, puntos, fotos del equipo y Copiloto

**24/09/2026 — Implementado y probado localmente. Sin SQL, tokens nuevos ni despliegue aplicados al proyecto remoto.**

## 1. Yape y Plin

En **Ajustes → QR de cobro · Yape y Plin**, un usuario con `settings.manage` puede subir una imagen por método, indicar el titular y pulsar **Guardar QR**. La subida y el guardado son operaciones distintas y confirmadas; subir sin guardar no reemplaza el QR que se utiliza en Ventas.

En **Ventas**, al seleccionar Yape o Plin se abre una ventana con el QR guardado, titular e importe. Se puede volver a abrir con **Ver QR**. Si falta configuración o la imagen no carga, se muestra el motivo, no un QR inventado. El panel funciona también en celular.

**No hay conexión bancaria:** escanear o mostrar la imagen no confirma el abono. El cajero debe verificarlo en la cuenta del negocio, marcar la confirmación y después registrar el cobro en el ticket. La referencia de operación es informativa; no se valida contra Yape/Plin. El titular se introduce manualmente: siempre contrastarlo con el que muestra la aplicación de pago al escanear. La imagen no se analiza para verificar su contenido QR.

Backend: `business_payment_qrs`, con una fila por negocio/método, y RPCs:

- `get_payment_qrs(p_business_id uuid)`: requiere `sales.manage` o `settings.manage`.
- `save_payment_qr(p_business_id uuid, p_method text, p_storage_path text, p_holder text)`: requiere `settings.manage`; valida método, prefijo del propio negocio y existencia del objeto en Storage.
- `remove_payment_qr(p_business_id uuid, p_method text)`: quita la configuración, no el archivo físico.

La tabla no permite DML directo a roles de aplicación. No se modifica el catálogo de planes ni se exige un plan superior.

## 2. Fidelización

**Causas corregidas en frontend:**

- La relación `customers → loyalty_accounts` es 1:1 por `UNIQUE(customer_id)`. PostgREST puede devolver un **objeto**, pero el mapper anterior buscaba únicamente `[0]` y presentaba saldo cero. Ahora admite objeto, array o null.
- El cliente de Ventas podía quedarse vacío por la carga asíncrona de la lista. Ahora hay que elegir un cliente o **Venta sin cliente · sin puntos**, sin asignar silenciosamente el cobro a la primera persona.
- Tras una venta confirmada se vuelve a cargar el saldo y su historial. Los niveles utilizan puntos históricos (`lifetime_points`), no solo el saldo disponible después de canjes.

**Regla conservada del backend:** 1 punto por S/1 cobrado en una venta PAID con cliente, sobre el total después de descuentos, redondeado hacia abajo. La capacidad de fidelización debe estar habilitada. Por ejemplo, S/25.50 suma 25 puntos. El alta de venta, pagos, stock y puntos se confirma en la misma transacción; si falla, no hay suma parcial.

Completar una cita **no acredita un cobro**: debe registrarse su venta en POS. Las ventas sin cliente no suman puntos y no se han adjudicado a personas retrospectivamente. No se reescribieron ni duplicaron saldos/históricos. Si una venta antigua no tiene cliente, hace falta revisión administrativa antes de cualquier conciliación, no una asignación automática.

## 3. Foto del trabajador

En **Equipo → Editar trabajador**, subir foto, revisar preview y pulsar **Guardar**. Se puede quitar la foto sin borrar el trabajador. La tarjeta muestra el retrato y este se recupera al recargar.

`save_team_member` ahora acepta `photo_url`; conserva foto al recibir payloads de clientes antiguos que omitan ese campo. Mantiene los permisos `team.manage`, aislamiento de negocio, cuotas de empleados y asignación de servicios.

La página pública sigue usando su snapshot: para reflejar una foto nueva del equipo en el sitio publicado, volver a **Mi página → Publicar cambios**.

### Almacenamiento compartido por estas funciones

JPG/PNG/WebP, hasta 5 MB, con decodificación en navegador. SVG rechazado. No hay carga manual desde Supabase.

- QR: `brand-assets/<business_uuid>/payments/yape|plin/<archivo_uuid>.png|jpg|webp`.
- Retratos: `website-media/<business_uuid>/team/<employee_uuid>/<archivo_uuid>.png|jpg|webp`.

Se mantienen cuotas backend y buckets existentes. Las políticas nuevas exigen el permiso correcto para esas rutas (ajustes/equipo), sin exigir además `website.manage`. Otro negocio no puede escribir esos objetos.

**Son imágenes públicas**: no subir claves, documentos ni fotografías sin autorización. Quitar/reemplazar no elimina automáticamente el objeto anterior; puede seguir utilizado por una publicación y continúa contando para almacenamiento. No hay limpieza automática de huérfanos.

## 4. Copiloto: modelo seleccionado y costos reales

**Actualización posterior autorizada:** ahora se admite IA principal + respaldo automático. Ver [activar doble IA](activar-doble-ia.md); esta guía sustituye las referencias anteriores a un único proveedor sin fallback.

Se eligió **Qwen/Qwen3-8B**, modelo abierto con capacidad de herramientas; su documentación describe cómo integrarlo en agentes. Es un candidato para consultas y recomendaciones sobre ventas, servicios, agenda, clientes, equipo, inventario y fidelización mediante las herramientas ya autorizadas. La calidad y compatibilidad del proveedor concreto deben validarse con casos reales antes de producción. [1](https://huggingface.co/Qwen/Qwen3-8B)

La familia Qwen3 incluye soporte de español y publica los modelos dense, incluido 8B, bajo Apache 2.0. El modelo se puede autoalojar, pero la máquina/GPU, electricidad y mantenimiento no son gratuitos. [3](https://qwenlm.github.io/blog/qwen3/)

**La API alojada no es ilimitada:** Hugging Face documenta USD 0.10 de crédito mensual para usuarios gratuitos, sujeto a cambios; el uso adicional requiere créditos. No se presenta como servicio gratuito ilimitado ni se evaden cuotas mediante cuentas/tokens rotativos. [1](https://huggingface.co/docs/inference-providers/pricing)

Implementación:

- `AI_PROVIDER=huggingface`: router OpenAI-compatible de Hugging Face, `HF_TOKEN` y `HF_MODEL` en secretos.
- `AI_PROVIDER=self-hosted`: servidor propio HTTPS OpenAI-compatible, protegido con clave y con soporte de herramientas/JSON. Evita la cuota comercial de esa API, no las limitaciones de hardware ni el costo de operación.
- `AI_PROVIDER=groq`: compatibilidad con el proveedor anterior, para no romper una instalación que ya lo utilice.
- Sin selección explícita: HF si existe `HF_TOKEN`; de lo contrario Groq si existe `GROQ_API_KEY`; si no hay tokens, se informa configuración faltante.
- Con dos tokens configurados se admite fallback al otro proveedor por cuota o fallo temporal. Se puede desactivar con `AI_FALLBACK_PROVIDER=none`. No se eluden errores de Auth/permisos ni se inventan respuestas financieras.
- Máximo cuatro rondas, ocho herramientas por pregunta y 2048 tokens por llamada. Con respaldo: timeout de 20 s por intento; sin respaldo: 45 s. Presupuesto de modelo de 90 s por pregunta. Sin prometer uso ilimitado.
- El JWT del usuario sigue autorizando cada herramienta. El modelo no elige tenant, SQL, endpoint ni secretos; no recibe `service_role` ni credenciales Supabase.

Esta entrega configura el **Copiloto interactivo y los insights solicitados desde él**. El job cron independiente `ai-insights` conserva su implementación previa con Groq; no se cambia ni activa automáticamente.

## Activar en tu despliegue existente

### A. Base de datos

Respaldar e inspeccionar primero:

```sql
select
 to_regprocedure('public.get_website_editor(uuid)') as editor_04,
 to_regprocedure('public.save_payment_qr(uuid,text,text,text)') as medios_05;
```

Si falta la 04, instalar `EDITOR_WEB.sql` después de la 03. Cuando exista la 04 y falte la 05, ejecutar **una sola vez** `supabase/VENTAS_Y_EQUIPO.sql`. Es copia exacta de `migrations/20260924000005_business_media.sql`: elegir paquete o migración, no ambos. No repetir los scripts ya instalados.

La 05 agrega la tabla/RPCs/políticas de QR y sustituye `save_team_member`. No borra negocios, usuarios, ventas, puntos ni imágenes. **No usar `SUPABASE.sql` en el proyecto existente**: ahora es el paquete 01–05 solo para una instalación nueva.

### B. Frontend

Incorporar estos archivos al proyecto real y redeploy:

```bash
npm ci --prefix web
npm run build --prefix web
# Publicar web/dist (o raíz web, build npm run build, output dist).
```

Conservar las variables públicas del mismo proyecto Supabase. Ningún token HF/Groq/servidor propio debe llevar prefijo `VITE_`.

### C. Copiloto en Hugging Face

Crear un token de Hugging Face con permiso de inferencia e introducirlo en **Supabase → Edge Functions → Secrets**, nunca en este documento, chat, repositorio ni navegador:

```text
AI_PROVIDER=huggingface
HF_TOKEN=<tu token privado>
HF_MODEL=Qwen/Qwen3-8B
```

Después:

```bash
supabase functions deploy ai-copilot --project-ref <tu-project-ref>
```

No usar `--no-verify-jwt` para eludir autenticación sin revisar la configuración de seguridad del proyecto. La función también verifica al usuario mediante Auth y las capacidades/RPCs autorizadas.

El modelo seleccionado debe estar disponible en el proveedor enrutado y admitir herramientas y respuesta JSON. Si no lo está, configurar un proveedor/modelo compatible en `HF_MODEL` y verificarlo, sin fingir que respondió. La integración sigue el contrato de function calling de HF: https://huggingface.co/docs/inference-providers/guides/function-calling.

**Alternativa autoalojada:** desplegar Qwen3-8B con un servidor compatible, por ejemplo vLLM configurado para herramientas de Qwen, detrás de HTTPS, autenticación y controles de acceso. Luego usar secretos `AI_PROVIDER=self-hosted`, `AI_BASE_URL=https://<servidor>/v1`, `AI_API_KEY=<clave privada>`, `AI_MODEL=Qwen/Qwen3-8B`. No se ha instalado ni financiado ese servidor; las Edge Functions no alojan los pesos del modelo. No poner `localhost`: el endpoint debe ser alcanzable desde Supabase.

Los prompts y resultados autorizados pueden enviarse al proveedor elegido; revisar su política de datos antes de usar información sensible del negocio.

## Verificación antes de producción

1. Admin: subir/guardar un QR real de cada método; recargar Ajustes y comprobar titular/imagen.
2. Caja: elegir Yape/Plin, verificar que corresponde a la cuenta correcta y que escanea en la app bancaria. No asumir pago recibido por el QR.
3. Registrar una venta real autorizada con cliente y verificar incremento exacto en Fidelización. No usar cobros ficticios en producción como prueba.
4. Guardar/reabrir la foto de un trabajador autorizado. Republicar la web si debe actualizarse allí.
5. Copiloto: probar una pregunta de ventas, una de fidelización y una con usuario sin permiso. Contrastar cifras con reportes; verificar el respaldo y el error cuando ambos proveedores estén indisponibles.

## Evidencia local

- **23 comprobaciones SQL PASS:** QR/RBAC/IDOR/Storage, foto, ventas Yape/Plin, puntos, rollback y ausencia de adjudicación a otro cliente.
- **17 comprobaciones UI PASS:** carga/guardado/reload, errores sin falsos éxitos, selección de cliente, puntos con objeto/array, QR y fotos, móvil, SVG rechazado.
- **18 pruebas Edge PASS:** proveedor HF/propio/Groq, secretos, herramientas, aislamiento, permisos, límites y errores.
- Regresiones PASS: suite SQL de planes, 29 SQL del editor, 13 UI del editor, 10 UI de planes, 5 logout y 5 concurrencia de cuotas/canjes.
- Compilación TypeScript/Vite PASS; persiste advertencia de bundle >500 kB.
- Instalación nueva 01–05 PASS: dos planes, cero cuentas y cero negocios de muestra.

Logs `.pgtest/business-*.log`. PostgreSQL local usa stubs Auth/Storage; navegador y Edge usan red interceptada únicamente en tests. La suite previa de planes UI tuvo un timeout de navegación inicial; repetida pasó completa, sin errores React. No se acreditan Auth/Storage remotos, pagos bancarios ni inferencia HF real ni publicación remota: faltan los pasos de activación y smoke test descritos arriba.
