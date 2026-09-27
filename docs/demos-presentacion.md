# Demos para presentar Nuvia (Plan Starter)

## Acceso

Debajo del formulario de login aparecen dos tarjetas y la ficha de capacidades de Starter, sin pedir credenciales:

- **Barbería — Distrito 01:** `/#/demo/barberia`, verde profundo, marfil y arte decorativo de barbería.
- **Estética — Alma Estética:** `/#/demo/estetica`, tonos cálidos/rosados e imagen ilustrativa de cuidado personal.

Ambas rutas son públicas y pueden abrirse directamente con el dominio del frontend más esa URL. El login real sigue funcionando con normalidad.

---

## Capacidades Starter reflejadas en las demos

Las dos demos incorporan de forma explícita la propuesta para negocios que están comenzando a digitalizar su operación:

- **Hasta 5 trabajadores:** cada demo inicia con 3 profesionales de ejemplo y permite añadir hasta 5. Al llegar al quinto, el formulario se bloquea y explica que Business permite un equipo mayor en negocios reales. Todos los trabajadores añadidos quedan disponibles inmediatamente para agendar citas ficticias.
- **300 citas mensuales:** el contador mensual controla las reservas demo del mes seleccionado. Las citas canceladas sin atender liberan cupo, las atendidas siguen contando y las citas de otros meses usan su propio cupo. Si se alcanza el límite, la demo bloquea nuevas reservas de ese mes y orienta sobre cómo funciona la ampliación en producción.
- **500 MB de almacenamiento:** sección interactiva de archivos donde se visualiza el consumo (MB utilizados sobre 500 MB). Se pueden añadir y retirar archivos de ejemplo (JPG/PNG/WebP), gestionando su tamaño en memoria sin subir contenidos a la nube.
- **✓ Página web:** renderer completo con plantilla propia de cada rubro, portadas, catálogo y reserva online simulada conectada a la agenda local.
- **✓ Fidelización:** consulta de saldo, puntos acumulados por ventas simuladas, historial de movimientos y simulación de canje de recompensas (ej. lavado o mascarilla de cortesía por 25 puntos demo). No permite saldo negativo y sincroniza el saldo con la vista de Clientes.
- **✓ Copiloto IA (Nuvia IA):** panel de conversación con preguntas predefinidas («Resume mi negocio», «¿Qué servicio se vende más?», «Ayúdame a llenar la agenda», «Redacta un recordatorio») y campo libre. Las respuestas son calculadas en memoria a partir de los datos actuales de la demo y se actualizan al registrar nuevas ventas. Muestra de forma transparente que es un modo demo guiado sin conexión a un modelo de IA real.
- **✓ WhatsApp:** preparación de mensajes con plantillas (recordatorio de cita, seguimiento de atención, invitación a volver) y selector de cliente. Los mensajes quedan en una cola de demostración marcada como «En cola demo · No enviado». Incluye interruptores de configuración de automatizaciones ilustrativas sin realizar llamadas ni envíos externos.
- **✕ Multisucursal:** claramente señalizado como no incluido en Starter. No existen botones de crear sucursales ni conmutador multisede dentro de la demo.

---

## Pantallas disponibles en cada demo

1. **Resumen:** tarjeta destacada del Plan Starter con accesos directos a web, fidelización, IA y WhatsApp; métricas de la jornada y del mes, agenda del día y recorrido sugerido.
2. **Agenda:** selector de fecha, lista de citas por profesional, cancelaciones locales y contador de citas consumidas del mes frente al tope de 300.
3. **Clientes:** buscador, fichas con historial simulado y saldo neto de puntos demo.
4. **Servicios y equipo:** catálogo de servicios y gestión de equipo (hasta 5 trabajadores con indicador de cupo).
5. **Ventas:** registro de ventas simuladas que actualiza ingresos, resumen, puntos de fidelización y análisis del Copiloto IA.
6. **Página web:** vitrina pública interactiva con reserva que alimenta la agenda demo.
7. **Fidelización:** saldo de puntos, simulación de canje con confirmación y desglose de movimientos.
8. **Copiloto IA:** asistente Nuvia IA con respuestas calculadas a partir del estado de la demo.
9. **WhatsApp:** redactor con plantillas, vista previa de mensaje, cola demo y conmutadores de automatización.
10. **Plan y almacenamiento:** barras de progreso de trabajadores (5), citas mensuales (300) y almacenamiento (500 MB), checklist de inclusiones/exclusiones y gestor de archivos demo.

---

## Recorrido sugerido de 3 minutos para presentaciones

1. **Entrada:** abrir una demo desde el login y mostrar la tarjeta resumen del Plan Starter con las 4 funciones activadas y los límites visibles.
2. **Reserva online:** ir a *Página web*, elegir un servicio y reservar a nombre de «Cliente presentación».
3. **Agenda y capacidad:** pasar a *Agenda*, ver la cita recién ingresada y el consumo de citas del mes (ej. 7/300).
4. **Venta y fidelización:** ir a *Ventas*, registrar el cobro demo de esa cita; luego ir a *Fidelización* para mostrar cómo se sumaron los puntos y probar el botón «Simular canje».
5. **Copiloto IA y WhatsApp:** abrir *Copiloto IA*, tocar «¿Qué servicio se vende más?» para comprobar cómo analiza la venta registrada; pasar a *WhatsApp* para preparar el mensaje de seguimiento y dejarlo en la cola demo.
6. **Equipo y límites:** entrar a *Servicios y equipo*, añadir un cuarto y quinto trabajador para mostrar el tope de 5, y revisar *Plan y almacenamiento* para ver las barras de consumo.
7. **Cierre:** usar «Reiniciar demo» para dejar todo limpio para la siguiente presentación.

---

## Aislamiento y seguridad

- Estado gestionado exclusivamente en memoria mediante `useReducer` en `DemoWorkspace`.
- Cero peticiones de red hacia Supabase o APIs de IA. Cero envíos de WhatsApp o correo.
- No almacena contraseñas, tokens ni estados en `localStorage`/`sessionStorage`.
- Las citas, ventas, equipo y mensajes se restablecen al cambiar de demo, salir al login, recargar o pulsar «Reiniciar demo».

---

## Pruebas automatizadas

- `web/tests/demo-starter-ui.local.mjs`: **53 PASS** (límites Starter 5 trabajadores / 300 citas / 500 MB, no multisucursal, altas de equipo, cupo de citas por mes, liberación en cancelación no atendida, gestión de archivos, fidelización e idempotencia de canjes, respuestas calculadas de Nuvia IA tras ventas, cola WhatsApp y automatizaciones, reinicio total, móvil y cero llamadas a Supabase).
- `web/tests/demos-ui.local.mjs`: **17 PASS** (regresión de flujo original).
- `web/tests/logout-ui.local.mjs`: **5 PASS**.
- `web/tests/public-booking-ui.local.mjs`: **13 PASS**.
- `web/tests/website-ui.local.mjs`: **13 PASS**.
- `web/tests/barber-templates-ui.local.mjs`: **9 PASS**.
- Typecheck (`tsc --noEmit`) y build de producción (`vite build`): **PASS**.
