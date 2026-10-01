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

Revisión independiente: no encontró un bypass nuevo de permisos. Se corrigió además la propagación de cookies de borrado al redirigir una renovación revocada. Seguimiento de interfaz: `AuthManager.refreshSession` todavía presenta fallos temporales como sesión visual ausente; debe distinguir indisponibilidad de sesión inválida, mostrar reintento y bloquear acciones sin verificación. Es un pendiente de esta fase, no una autorización para conservar permisos efectivos sin comprobarlos.

## Siguientes entregas

1. Integrar invitados y mesas con `invitation_projects`, membresías y APIs autenticadas. El gestor actual persiste en almacenamiento local y el adaptador antiguo consulta `events`, no el proyecto canónico. Inventariar la base real antes de escribir migraciones; no copiar demostraciones ni mezclar eventos.
2. Conectar RSVP con invitados identificados, pases y enlaces revocables. Las confirmaciones públicas existentes no demuestran ese flujo individualizado.
3. Registro de entrada QR atómico e idempotente; mesa y hoja de catering compartidas entre dispositivos. Sin conexión, mostrar pendiente y no confirmar una escritura que no llegó al servidor.
4. Migrar el álbum colaborativo de Firebase a Supabase, con pertenencia al evento, autorización de carga y moderación.
5. Persistir pedidos y conciliación de Clip; deduplicar notificaciones y activar servicios sólo tras validación del pago.
6. Completar revisiones/recuperación del editor y corregir mensajes de publicación heredados.
7. Pruebas completas con usuarios y dispositivos reales, aislamiento entre eventos, respaldo/reversión y transición controlada antes de retirar código o datos anteriores.

El listado antiguo de `tasks/todo.md` no basta para declarar avance: contrastar cada cierre con código, pruebas y verificación del entorno desplegado. Conservar el enlace público de Janna y no republicar sus datos como efecto de cambios internos.
