# Estado verificable de la fusión

## Activación de boletos en vista previa (2026-10-02, verificada)

Usuario aprobó activar esquema, firma y código en vista previa, probar sólo un
proyecto ficticio y conservar registros privados sin borrado automático. Supabase
registró `20261003021708_add_project_door_passes_verified`; firma sensible sólo
en la rama `preview/invitta-cloud-client-flow`, sin copiar su valor localmente.
120/120 archivos JS volvieron a pasar. Catálogo y smoke transaccional remoto
verificados; datos de esa prueba revertidos. Despliegue Vercel
`dpl_AhvQTkkFJyqKNP7KpHaoXMutyqsR`, commit `1ca912b`, READY y alias estable
apuntando a él. No hay autorización para publicar en main/producción.

Recorrido publicado con la sesión existente del propietario y proyecto ficticio:
emitir cuatro pases, enlace/QR público, admitir dos grupos de dos, recargar e
inspeccionar saldo 4 ingresados/0 disponibles; confirmar ingreso quedó deshabilitado.
Revocación tras recarga confirmada: lector público rechazó el boleto y ocultó QR;
sin errores/avisos de consola. Supabase confirmó una emisión, dos admisiones y
total cuatro, preservados después de revocar. HTTP sin sesión: API privada 401,
credencial pública inválida 422, páginas privadas redirigidas a autenticación.

Proyecto ficticio `f19c2b1e-f9c2-4a63-bb3d-26242d11a67a` eliminado con guardas de
id/slug/propietario/borrador/no publicación y cero documentos. Conteos posteriores
de proyecto, invitados, boletos y admisiones: cero. Janna conservó las huellas
del inicio de esta activación: proyecto `657f86bc8600a03b37d11c23bce16a39`, seis
documentos `acc5305fd644b0d70215a8497c37cc9d`. No se eliminaron usuarios Auth.

Cámara física, dos móviles y recorrido remoto con otra sesión/rol siguen
pendientes: las pruebas locales de esos permisos no se presentan como uso remoto
real. Los pases de emergencia siguen venciendo a las 24 h; no son entrega anticipada.

No modifica Janna ni envía mensajes. El nuevo deseo del usuario —anfitrión que
personaliza nombres y pases desde una página sencilla— es una capacidad separada
por definir en [el mapa propuesto](../tasks/CAPABILITIES-host-delivery.md), aún sin
implementar ni activar. Retención aprobada: registros privados sin purga automática;
exportación/eliminación por solicitud, sin prometer una interfaz nueva para ello.

## Incremento local: boletos y puerta por proyecto (2026-10-02)

Implementado únicamente en la copia local, con alcance aprobado. No se envió
código a GitHub, no se aplicó SQL remoto ni se cambió Janna. El generador/escáner
global heredado sigue separado y no se declara fiable para operaciones compartidas.

Nueva entrada desde tarjeta de proyecto: propietario/planner emiten y revocan;
propietario/planner/hostess asignada registran ingresos parciales. Supabase local
impide superar pases y cuenta una sola vez el mismo reintento. QR firmado con
clave independiente; lector público de un boleto sin navegación privada. Sin red
no se confirma ingreso. No hay envío automático, datos de contacto ni importación.

Verificación final: 120/120 archivos JavaScript, 146 pgTAP, 174 checks HTTP reales,
246–248 checks directos de puerta según orden de carreras (última corrida 246)
más 68 base Auth/PostgREST; cinco QR codificados/decodificados con bibliotecas
fijadas y SRI. Migración CLI `20261003000557` instalada desde cero en entorno
desechable sin semillas después de verificar limpieza. Asesor local sin problemas.

Navegador owner/hostess: emisión, QR visible, grupos 2+2, recuperación después
de respuesta perdida postcommit y revocación tras recarga. La versión del middleware
incluye página nueva en protección y matcher. Se reprodujo/corrigió permiso de
cámara tardío tras detenerla y rechazo anónimo incluso en RPC directo.
Revisión independiente sin Required/Critical; fixtures sintéticos eliminados.

Pendiente en el cierre local original: activar esquema/secreto/código con autorización
separada y acordar retención. Estas acciones se completaron en la activación superior;
probar cámara y dos móviles sigue pendiente antes de uso real.
El override de tamaño no afectó el navegador disponible: no se afirma una prueba
móvil real. El aviso de solicitud pendiente impidió probar recarga incierta aquí;
la restauración está cubierta por pruebas del cliente. No hay build/lint definidos.
Detalles de contrato, operación y reversión: [ADR-0005](decisions/0005-project-door-passes.md).

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

La migración `20261002222510_add_project_guests_and_tables.sql` añade dos tablas
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

## Activación de invitados y mesas en vista previa (2026-10-02)

Continuación autorizada por el cliente para aplicar las tablas privadas en
`invitta-2-preview` y desplegar el código probado en la rama de vista previa.
Se incorporó `b78a562` remoto sin sobrescribirlo: su ajuste de texto stardust
coincide con el commit local `c7c90d1`. Las 115/115 pruebas vuelven a pasar.

Supabase `gwgnufusldpikwwoeism` aplicó `add_project_guests_and_tables` como
`20261002222510`. Se renombró el archivo local, sin cambiar su SQL, para
mantener el historial de migraciones alineado con el servicio. RLS habilitado,
seis políticas dueño/planner, permisos de columnas y dos triggers verificados.
Anónimo sin SELECT y usuario autenticado sin DELETE en ambas tablas.

Antes/después: 1 proyecto y 6 documentos, con huellas idénticas. Cero invitados
y mesas iniciales; no se importaron registros antiguos ni se modificó Janna.
El asesor de seguridad mantiene únicamente la advertencia previa de protección
contra contraseñas filtradas desactivada; no aparecen advertencias nuevas.

Código publicado en `preview/invitta-cloud-client-flow`, commit `e1ab464`.
GitHub registra Vercel success / Deployment has completed, despliegue
`Fvv9WyEjyob7sQby25EkmhZebFKc`. Rama principal no modificada.

Comprobaciones remotas posteriores:

- Cuenta profesional existente reconocida; el portal lista Janna y ofrece la
  entrada de invitados/mesas por proyecto.
- Organizador: “Datos confirmados desde Supabase”, formularios habilitados,
  cero registros iniciales. Sin escrituras de prueba sobre proyectos reales.
- Studio abre Janna Sharlot y carga “revisión 6 guardada”, sin volver al login.
- Nuevo cliente abre el formulario y ofrece “CREAR BORRADOR Y ABRIR STUDIO”.
  No se envió el formulario sin datos del nuevo cliente.
- GET invitados/mesas sin sesión responde 401; POST desde otro origen, 403.
- Invitación pública responde 200, título `XV Janna | Invitta Studio` y
  metadatos de imagen para compartir; enlace original conservado.
- Suite repetida tras alinear el historial: 115/115 archivos pasan.
- El portal/Studio heredados siguen usando Tailwind CDN y generan su aviso de
  producción. No se presenta esta comprobación como consola global sin avisos.
- Asesor de rendimiento: INFO de índices en tablas anteriores y del índice
  nuevo aún no usado; no se eliminan índices por falta de uso inicial.

Las altas/ediciones, conflicto y recuperación se verificaron con Auth/PostgREST
local real; el smoke remoto verifica sesión, permisos y lectura, no una escritura
real del cliente. Se evita crear clientes ficticios o cambiar la revisión publicada.
QR, importación RSVP, álbum, catering compartido y pagos no se dan por terminados.

Punto de reversión previo: rama `b78a562`, despliegue Vercel
`3Av7SjUEKQPnBfMg3MCgvBScrKLB`. Revertir el código no exige eliminar tablas;
conservar siempre los registros que el cliente haya creado.

## 2026-10-04 — Integración selectiva de New-Invitta: textos por evento (local)

Base desplegada `8b7c748`; fuente New-Invitta `93a79d93`. No reemplazar el
motor completo: la fuente pierde confirmaciones RSVP persistentes y el escape
de CONFIG. No incorporar cambios de permisos/validez de boletos sin desplegar.

Primera entrega: respaldos de Stardust, álbum y música diferenciados para boda,
XV y otros eventos. Los mensajes personalizados se conservan; no se migran ni
reescriben textos guardados, incluso si contienen referencias a otro evento.

Prueba nueva primero RED (etiqueta XV faltante), después 3/3 pruebas enfocadas
y 121/121 archivos de la suite. Navegador integrado sobre servidor loopback con
documentos sintéticos: XV muestra Vals Principal y overlay XV; boda Primer Baile
y destinatarios novios; otros Momento Mágico y anfitriones. Sin escrituras remotas
ni cambios en proyectos publicados. Revisión del diff: sólo respaldos de texto;
flujo RSVP, serialización y publicación preservados. Sin herramientas de build,
lint o tipado configuradas en package.json. Pendiente publicar previa revisión.

Esta entrega no verifica ni habilita almacenamiento del álbum: Firebase necesita
revisión independiente de rutas, reglas y autorización por proyecto.

Segunda entrega local: campo «Título al encender la luz» dentro de Polvo de
Estrellas. `stardust.overlayTitle` se conserva mediante el adaptador existente;
el motor acepta sólo cadenas, ignora espacios vacíos y codifica caracteres HTML.
No se cambia el título automático de proyectos anteriores ni la lógica RSVP.

Verificación: prueba nueva primero RED y luego GREEN, incluyendo HTML hostil,
valor no textual, campo vacío, binding/hidratación reales de Studio, round-trip
de documento/JSON y proyección pública con respuestas sintéticas. Suite final
122/122; comprobaciones de sintaxis de app.js y template-engine.js correctas.
Diff revisado en cinco ejes; whitespace comprobado respetando CRLF existente.
Sin dependencias nuevas ni migración. El motor grande permanece como deuda
existente: se añade un campo a su módulo, sin refactorización amplia en este bloque.

Navegador local: edición → preview → guardado en memoria → recarga recupera el
título. Overlay visible a ancho de escritorio y dentro de un iframe de 390 px,
sin desbordamiento del encabezado. El override del navegador no cambió el ancho
observado; se restableció y se usó el iframe explícito para verificar el ancho.
La sesión/API son fixtures locales, no una verificación remota de Supabase.
Consola: persiste el aviso heredado de Tailwind CDN; no se promete cero avisos.
Capturas en outputs/new-invitta-studio-field.jpg y
outputs/new-invitta-stardust-mobile-390.jpg, fuera del repositorio.

Uso del campo documentado en [stardust-customization.md](stardust-customization.md).
Pendiente aprobación humana y despliegue de los dos commits locales. Punto de
reversión del bloque completo: `8b7c748`, sin cambios de datos o permisos remotos.
