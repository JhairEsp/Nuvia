# Disponibilidad — inspección y alcance antes de cambios

Problemas comprobados en código:
- SettingsPage: Guardar horarios/Guardar reglas solo llamaban toast.success. Horarios editados nunca llegaban al backend; la interfaz partía de db.site.hours (puede estar vacío, combinado entre sucursales o anticuado).
- BranchEditor consultaba solo horarios específicos. Si existían horarios generales heredados, mostraba los siete días cerrados y guardarlos podía crear cierres explícitos que prevalecieran sobre los generales.
- get_public_availability exige horarios guardados, servicio activo/visible, trabajador activo/visible con todos los servicios asignados, turnos compatibles, sin ausencias/solapamientos y anticipación mínima. Un calendario sin citas no garantiza por sí solo que esas condiciones se cumplan.

Cambios previstos:
- Componente reutilizable para leer horarios efectivos con preferencia por sucursal y fallback general por día, sin mezclar sucursales ni generar horas ficticias.
- Ajustes con siete días editables, selección explícita de sucursal, carga/error/reintento y guardado real mediante save_branch existente. Reglas cargadas y persistidas mediante business_settings con RLS existente. Sin éxito optimista.
- Corregir carga heredada en BranchEditor usando la misma función. Alertar sobre profesionales sin asignaciones, con enlace a Equipo.
- Pruebas navegador aisladas y PostgreSQL local: un día futuro sin citas y con configuración válida devuelve horarios; cierres, anticipación, asignaciones y reservas ocupadas siguen respetados.

Sin borrado de citas/clientes, sin cambios de planes ni asignación automática de servicios a trabajadores. Sin migración nueva prevista. El RPC existente reemplaza únicamente los horarios de la sucursal seleccionada al guardar los siete días (transacción); no se toca la configuración de las otras sucursales ni el horario general. No se ha identificado ni modificado la configuración remota del negocio concreto del usuario.
