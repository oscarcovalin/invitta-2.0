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

1. Integrar invitados y mesas con `invitation_projects`, membresías y APIs autenticadas. El gestor actual persiste en almacenamiento local y el adaptador antiguo consulta `events`, no el proyecto canónico. Inventariar la base real antes de escribir migraciones; no copiar demostraciones ni mezclar eventos.
2. Conectar RSVP con invitados identificados, pases y enlaces revocables. Las confirmaciones públicas existentes no demuestran ese flujo individualizado.
3. Registro de entrada QR atómico e idempotente; mesa y hoja de catering compartidas entre dispositivos. Sin conexión, mostrar pendiente y no confirmar una escritura que no llegó al servidor.
4. Migrar el álbum colaborativo de Firebase a Supabase, con pertenencia al evento, autorización de carga y moderación.
5. Persistir pedidos y conciliación de Clip; deduplicar notificaciones y activar servicios sólo tras validación del pago.
6. Completar revisiones/recuperación del editor y corregir mensajes de publicación heredados.
7. Pruebas completas con usuarios y dispositivos reales, aislamiento entre eventos, respaldo/reversión y transición controlada antes de retirar código o datos anteriores.

El listado antiguo de `tasks/todo.md` no basta para declarar avance: contrastar cada cierre con código, pruebas y verificación del entorno desplegado. Conservar el enlace público de Janna y no republicar sus datos como efecto de cambios internos.
