# Estado verificable de la fusión

## Primera entrega: continuidad de sesión (2026-10-01)

Problema reproducido: las operaciones de proyectos rechazaban una cookie de acceso vencida o ausente incluso con un refresh token válido. `/api/session` sí intentaba renovar, pero ese comportamiento no se compartía con guardar, cargar, publicar o subir archivos. La entrada a Studio también rechazaba una sesión renovable y descartaba el parámetro de proyecto al enviar al portal.

Corrección local: resolución centralizada de sesión para las APIs de proyectos, activos, confirmaciones, invitaciones profesionales y consulta de sesión. Studio renueva antes de cargar su interfaz; las APIs continúan operando con el JWT del usuario. Un error temporal de Auth no borra cookies ni permite operar sin verificación. No cambia roles, RLS, datos guardados ni la publicación de Janna.

Pruebas de regresión:

- `test-project-session-refresh.cjs`: once operaciones con sesión activa, acceso vencido, acceso ausente, renovación revocada, indisponibilidad y permiso denegado. Comprueba cookies privadas y ejecución única.
- `test-request-auth-session.cjs`: consulta de sesión, credenciales fuera de JSON, configuración ausente, red, 429/503 y respuestas mal formadas.
- `test-session-save-http.cjs`: integración HTTP local con los handlers y servicios reales; proveedor y almacenamiento simulados. Comprueba renovación, guardado y segundo guardado con cookies rotadas. No es una prueba contra Supabase remoto.
- `test-studio-middleware-session.cjs`: entrada activa y renovada, conservación de proyecto, rechazo anónimo, fallo del proveedor y separación de los módulos heredados.

Estado: implementado localmente. El despliegue en Vercel y la verificación con sesión real siguen pendientes; no declarar resuelto el incidente del navegador hasta verificarlos.

Verificación local: 109/109 archivos de prueba pasan, incluyendo la integración HTTP; comprobaciones de sintaxis y diferencias sin errores. `npm audit` no reportó vulnerabilidades en las dependencias bloqueadas existentes. No hay scripts de build o lint definidos en este repositorio, y estas verificaciones no sustituyen un build de Vercel.

Revisión independiente: no encontró un bypass nuevo de permisos. Se corrigió además la propagación de cookies de borrado al redirigir una renovación revocada. La interfaz pendiente de esta entrega se aborda en el siguiente incremento.

## Segunda entrega: recuperación del portal (2026-10-01)

`AuthManager` distingue `checking`, `authenticated`, `anonymous` y `unavailable`. Un fallo de red, timeout, 429/5xx o respuesta mal formada no se presenta como logout; bloquea permisos efectivos y permite reintentar. Sólo 401/403 o una respuesta explícita de sesión ausente muestra el login. Las verificaciones simultáneas comparten petición, no usan caché y tienen un límite de 15 segundos. La sesión pública sigue sólo en memoria.

El portal muestra verificación/reintento antes de decidir entre login y dashboard. La lista de proyectos diferencia carga, error y lista vacía confirmada. Buscar o filtrar durante un error no borra el aviso ni inventa una lista vacía. Una respuesta antigua no puede reemplazar una lista nueva. Login/logout invalidan respuestas anteriores, abortan autenticaciones pendientes y evitan envíos paralelos del formulario; esto es protección del cliente, no una prueba de revocación remota en Supabase.

Pruebas: nuevos casos en `test-auth-system.js` y `test-portal-session-recovery.cjs`, incluyendo respuestas fuera de orden reproducidas en RED antes de corregirlas. Suite completa: **110/110 archivos** pasan. Revisión independiente: dos carreras detectadas, reproducidas y corregidas; no quedan hallazgos Required/Critical de este incremento.

Verificación de navegador local con servidor simulado: caída de sesión → reintento sin contraseña → caída de lista → búsqueda/filtro conserva error → reintento recupera proyecto; lista vacía confirmada. Aviso sin desbordamiento horizontal a 320, 768, 1024 y 1440 px; botón de 44 px de alto. Sin errores JavaScript observados. Persiste el aviso previo de Tailwind CDN en consola: sustituirlo por CSS compilado antes de declarar listo el lanzamiento. No se verificaron cookies o RLS del despliegue real con esta prueba.

Estado: código local, **sin publicación en GitHub/Vercel**. No se modificaron datos, fotos, revisiones o enlace de Janna.

## Inventario real para invitados y mesas (2026-10-01)

Consultas de sólo lectura al proyecto Supabase confirmado: `list_tables(public)`, `list_migrations`, `pg_policies` y catálogo de funciones `public/private`. Resultado: sólo existen `invitation_projects`, `invitation_project_members`, `invitation_documents` e `invitation_rsvps`, todas con RLS. No existen `events`, `tables`, `guests` o `checkin_logs`, ni RPCs `submit_guest_rsvp`/`process_door_checkin` que espera el adaptador heredado.

Por tanto, pasar `test-cloud-adapter.js` no prueba integración real: usa un cliente simulado y comprueba archivos SQL antiguos que no están aplicados. No ejecutar esos SQL completos sobre la base actual: introducirían una identidad de evento paralela en vez de integrar `project_id` y las membresías existentes.

La siguiente entrega debe ser un corte vertical pequeño: invitados/mesas vinculados por `project_id`, lectura/escritura autenticada con JWT del usuario y RLS por rol, navegación que conserva el proyecto y ninguna copia automática de demostraciones. Importar invitados desde RSVP requiere conciliación explícita; el nombre libre no es un identificador fiable. QR/replay necesita operación identificada y transacción idempotente antes de habilitar reintentos automáticos de acceso.

## Siguientes entregas

El [contrato](../tasks/SPEC-cloud-schema-rls.md), [plan](../tasks/plan.md) y
[tareas](../tasks/todo.md) de invitados/mesas fueron aprobados el 2026-10-01.
Su base local ya está implementada y verificada; todavía no está conectada a las
pantallas ni aplicada al proyecto Supabase del cliente. Véase la entrega siguiente.

1. Aplicar y desplegar el consumidor de invitados/mesas por proyecto ya verificado localmente; comprobarlo con usuarios/dispositivos reales. El modo heredado sigue separado y no se importan demostraciones automáticamente.
2. Conectar RSVP con invitados identificados, pases y enlaces revocables. Las confirmaciones públicas existentes no demuestran ese flujo individualizado.
3. Registro de entrada QR atómico e idempotente; mesa y hoja de catering compartidas entre dispositivos. Sin conexión, mostrar pendiente y no confirmar una escritura que no llegó al servidor.
4. Migrar el álbum colaborativo de Firebase a Supabase, con pertenencia al evento, autorización de carga y moderación.
5. Persistir pedidos y conciliación de Clip; deduplicar notificaciones y activar servicios sólo tras validación del pago.
6. Completar revisiones/recuperación del editor y corregir mensajes de publicación heredados.
7. Pruebas completas con usuarios y dispositivos reales, aislamiento entre eventos, respaldo/reversión y transición controlada antes de retirar código o datos anteriores.

El listado antiguo de `tasks/todo.md` no basta para declarar avance: contrastar cada cierre con código, pruebas y verificación del entorno desplegado. Conservar el enlace público de Janna y no republicar sus datos como efecto de cambios internos.

## Tercera entrega: base operativa por proyecto (2026-10-01)

La migración `20261002022200_add_project_guests_and_tables.sql` añade dos tablas
sin registros iniciales, restricciones de nombres/pases/capacidad, FK compuesta
de mesa del mismo proyecto y permisos de lectura/creación/edición para dueño y
planner. Identidad, fechas y versión no son editables por el cliente; la base
aumenta la versión al guardar. No concede DELETE directo ni permisos a otros roles.
Decisión y límites: [ADR-0003](decisions/0003-project-guest-and-table-storage.md).

Se encontraron CLI y Docker existentes fuera de PATH, sin instalar dependencias
de la app. Docker no iniciaba por endpoints de ejecución obsoletos; se movieron
dos directorios de endpoints a respaldos locales recuperables, sin borrar
contenedores, volúmenes, configuraciones ni datos. Respaldos conservados:
`C:\Users\oscar\AppData\Local\Docker\run.codex-backup-20261001` y
`C:\Users\oscar\AppData\Local\docker-secrets-engine.codex-backup-20261001`.

Entorno aislado: `..\..\.cache\invitta-project-ops-test`, proyecto sin enlace
remoto, API local 55421/base 55422, CLI 2.117.0, Docker 29.8.0 y PostgreSQL 17.6.
Se cargaron las seis migraciones previas sin semillas. Prueba inicial: 4/4
fallos esperados por tablas ausentes; después se reprodujeron los permisos y
trigger ausentes antes de implementarlos. `db pull --local` generó la migración
final, normalizada/revisada con permisos explícitos. Instalación desde cero local
verificada; otra comparación informó `No schema changes found`.

Resultados comprobados:

- **116 pruebas SQL**: 106 nuevas y 10 previas. La prueba anónima previa esperaba
  equivocadamente una lista vacía pese a no tener SELECT; ahora exige 42501 sin
  cambiar los permisos de producción.
- **68 comprobaciones Auth/PostgREST reales** con usuarios locales sintéticos:
  roles, acceso directo, campos gestionados, cruces de proyecto, revocación y
  dos PATCH concurrentes por versión. Un único ganador por recurso; cero filas
  para la escritura obsoleta. Los consumidores futuros deben manejar ese conflicto.
- **111/111 archivos JavaScript** pasan; sintaxis y diferencias verificadas.
- Asesores locales de seguridad/rendimiento sin advertencias o errores.
- Limpieza verificada: cero usuarios y proyectos sintéticos al terminar.

La clave privilegiada local se usó sólo para preparar/eliminar fixtures, nunca
en las operaciones bajo prueba. No se imprimieron credenciales ni se consultaron
datos personales para estos tests. Script reproducible:
`scripts/test-project-operations-local.cjs <directorio-aislado> <CLI-Supabase>`.
El script rechaza proyectos enlazados y direcciones que no sean las locales de prueba.

Revisión independiente: un hallazgo Required en limpieza del arnés se reprodujo
y corrigió con una nueva prueba de seguridad; ahora exige eliminación verificable
por UUID, no sólo respuesta HTTP exitosa. Cierre sin Required/Critical pendientes.

Estado: **sólo local, sin cambios remotos ni despliegue**. No se modificó la
invitación, sus activos o el enlace de Janna. Falta el corte vertical de APIs y
organizador por proyecto, verificarlo entre dispositivos, revisar/aplicar la
migración remotamente y desplegar. Las pruebas actuales no convierten el gestor
heredado de almacenamiento local en un gestor sincronizado.

## Cuarta entrega: organizador por proyecto conectado (2026-10-01)

Contrato `cloud-data-adapter` aprobado e implementado localmente. La tarjeta del
portal añade “Invitados y mesas del proyecto”. Con `?project=<UUID>` se abre
una pantalla acotada de nombres, pases, mesas y asignaciones; no se inicializan
los gestores anteriores ni se leen/escriben sus datos locales. Sin parámetro,
se conserva el organizador anterior. Decisión: [ADR-0004](decisions/0004-project-organizer-user-jwt.md).

GET/POST/PATCH por recurso validan campos y respuestas. Sesión renovable,
origen propio en escrituras con cookie y JWT del usuario en PostgREST, sin clave
privilegiada en la aplicación. Membresía explícita y RLS dueño/planner; identidad
malformada falla como indisponibilidad. Edición filtrada por proyecto/id/versión
con una fila confirmada; conflicto no sobrescribe ni vacía el formulario.

Estado del cliente en memoria, paginación sin listas incompletas, UUID de alta
estable y bloqueo durante resultado desconocido. Verificar antes de reintentar;
coincidencia de intención/versión confirma y diferencia requiere decisión
explícita. No se promete offline, sincronización inmediata, admisión ni garantía
transaccional de capacidad. Descartar borradores exige confirmación inline.

Evidencia de cierre:

- **115/115 archivos JavaScript** pasan. RED/GREEN de servicio, rutas, cliente y
  entrada profesional; prueba de aislamiento incluye scripts legacy externos.
- **116 pgTAP** pasan. La primera repetición coexistió con los fixtures del
  navegador y falló correctamente las dos expectativas de base sin registros.
  Tras limpiar esos fixtures, pasan sin alterar la prueba ni los permisos.
- **24 comprobaciones HTTP reales del consumidor + 68 Auth/PostgREST directas**:
  dueño/planner, roles excluidos, proyecto ajeno, duplicado, paginación, revocación
  y un único ganador en dos PATCH concurrentes. Fixtures eliminados por UUID,
  verificados por el arnés; ninguna cuenta del cliente utilizada.
- Navegador integrado sobre servidor/Supabase locales: crear mesa y familia,
  asignar/desasignar, abrir segunda sesión, conflicto con borrador conservado,
  consulta de versión actual y recarga. Fallo sintético de guardado → verificación
  → reintento del mismo registro, sin duplicado.
- 320/768/1024/1440 px sin desbordamiento horizontal; una columna en móvil y dos
  desde 768 px. Captura visual inspeccionada. Sin avisos/errores en consola de
  las sesiones nuevas tras completar el flujo.
- El diálogo nativo de descarte bloqueó una pestaña local del navegador integrado.
  Se sustituyó por aviso inline con foco y Escape; conservar/descartar/conflicto
  se volvieron a comprobar en sesiones nuevas. No se recargó Studio remoto.
- Revisión independiente: sin Required/Critical pendientes; dos hallazgos de
  clasificación de autoridad malformada corregidos. Sin build/lint definidos,
  dependencias nuevas ni cambios al archivo de bloqueo.

Reproducción: `scripts/test-project-organizer-local.cjs <directorio-aislado>
<CLI-Supabase>`; `--browser` habilita únicamente fixtures y archivos locales
permitidos para comprobar dos sesiones en localhost/127.0.0.1. No publicar
este servidor de prueba. La suite SQL debe ejecutarse sin fixtures persistentes.

Estado: **implementado y verificado localmente, no activado remotamente**.
La migración todavía debe revisarse/aplicarse en Supabase del cliente y el código
debe publicarse/desplegarse. No cambió ningún dato, foto, revisión o enlace de
Janna. QR, importación RSVP, álbum, catering compartido y pagos siguen pendientes;
este incremento no equivale a terminar la fusión completa.
