# Especificación: organizador conectado por proyecto

Estado: aprobado el 2026-10-01, implementación local en curso. El usuario
autoriza continuar con plan, pruebas e implementación sin confirmaciones
intermedias. No autoriza cambios remotos.
Módulo: `cloud-data-adapter` del [mapa existente](CAPABILITY-MAP.md).
Dependencia: [base de invitados y mesas](SPEC-cloud-schema-rls.md), ya verificada localmente.

## Objetivo y alcance propuesto

Desde un proyecto del portal, abrir el organizador con su `project` UUID y
crear, consultar y editar invitados/mesas en Supabase usando la sesión profesional.
Mostrar el mismo estado confirmado al abrir otra sesión autorizada o recargar.
No confundir el proyecto con los slugs `event` del gestor anterior.

La pantalla de proyecto ofrece únicamente los datos del contrato aprobado:

- Invitados: nombre, pases, mesa opcional; asignación y desasignación.
- Mesas: nombre, tipo circular/imperial/rectangular y capacidad.
- Indicadores calculados de pases/asignaciones; aviso de sobrecupo sin prometer
  bloqueo transaccional ni confundir pases con asistentes admitidos.

El modo anterior se conserva, sin borrar sus datos locales. Al abrir con
`project`, no se inicializan sus demostraciones, `EventVaultManager` ni colas
offline heredadas. Los controles de teléfono/correo/notas/VIP, importación,
RSVP, envíos, admisiones y eliminación no se ofrecen como funciones guardadas
en nube: necesitan otro contrato. No se amplía silenciosamente el esquema.

## Evidencia de la inspección

`organizador-mesas.html` inicializa `SeatingPlanner` y `GuestManager` desde
almacenamiento local particionado por un evento heredado, con valores de ejemplo
si no hay datos. El formulario de invitados incluye más campos que la base
aprobada y genera identificadores `g_...`, no UUID. La configuración del salón
puede reemplazar mesas; no es compatible con la ausencia aprobada de DELETE.

`src/cloud-guest-adapter.js` consulta `events` y promete guardado offline para
RPCs que no forman parte del proyecto canónico. No se reutiliza ese fallback
para confirmar operaciones nuevas. El middleware acepta sesiones profesionales
en Studio, pero todavía exige la cookie anterior para el organizador.

## Contrato de API

Rutas aditivas en el dispatcher existente, sin otra función Vercel:

| Ruta | Operación | Entrada |
|---|---|---|
| `/api/projects/tables` | GET | `projectId`, cursor UUID opcional, límite 1–100 |
| `/api/projects/tables` | POST | `projectId`, UUID estable `id`, nombre, tipo, capacidad |
| `/api/projects/tables` | PATCH | `projectId`, `id`, `expectedVersion`, campos editables |
| `/api/projects/guests` | GET | `projectId`, cursor UUID opcional, límite 1–100 |
| `/api/projects/guests` | POST | `projectId`, UUID estable `id`, nombre, pases, `tableId` opcional |
| `/api/projects/guests` | PATCH | `projectId`, `id`, `expectedVersion`, campos editables |

GET devuelve `{ success: true, records, nextCursor }`; una escritura confirmada
devuelve `{ success: true, record }`. Campos de salida en camelCase, incluyendo
UUID, `projectId`, `version`, `createdAt` y `updatedAt`. Selección explícita de
columnas; sin credenciales, metadatos de autenticación o documento de invitación.

Errores uniformes `{ success: false, code, error }`: 401 sesión ausente/revocada,
403 sin rol operativo, 404 proyecto no visible, 409 conflicto, 422 entrada
inválida, 502 proveedor/red inválidos y 503 configuración ausente. Rechazar
propiedades desconocidas, UUID/versiones inválidas y límites del contrato.

El servidor resuelve/renueva la sesión con `resolveRequestSession`, valida el
rol dueño/planner del proyecto mediante consultas con el JWT del usuario y
mantiene RLS en todas las operaciones. Una lista vacía sólo se muestra tras
una lectura autorizada exitosa; nunca como sustituto de un error de permisos.

PATCH filtra conjuntamente proyecto, UUID y versión esperada. Exige una fila
devuelta; cero filas se informa como conflicto, no éxito. No usa PUT/upsert,
clave privilegiada, privilegios de portal ni `?role=` para decidir acceso.
Escrituras con cookies: validar origen en el servidor, sin CORS abierto.

## Guardado y recuperación en el navegador

No persistir listas nuevas ni sesiones en localStorage. Mostrar carga, estado
vacío confirmado, guardado pendiente, éxito confirmado y error/reintento como
estados distintos. Bloquear envíos paralelos del mismo formulario. Conservar
los valores no guardados tras un fallo y avisar antes de recargar/abandonar.
Los nombres se muestran como texto, no HTML inyectado.

En un timeout el resultado puede ser desconocido: no reintentar ciegamente.
Conservar el UUID de creación y verificar su registro antes de generar otra
operación. Un conflicto requiere consultar el estado reciente y ofrecer una
decisión explícita, no sobrescribirlo. Una lectura antigua no reemplaza estado
nuevo ni cambia el proyecto activo. No prometer sincronización en tiempo real:
la primera entrega confirma persistencia mediante recarga/actualización explícita.

El portal añade la entrada al organizador en cada tarjeta con su UUID.
El middleware permite la sesión profesional sólo para la ruta de proyecto;
las APIs siguen verificando pertenencia. Mantener permisos de las rutas
heredadas, conservar el proyecto al redirigir al login y no cambiar Studio.

## Estructura y estilo

Servicios/handlers CommonJS en `lib/`, envoltorios en `api-handlers/projects/`,
rutas en `lib/api-dispatcher.cjs` y `api/index.js`. Cliente/controlador de
proyecto separado bajo `src/`, enlazado desde el organizador existente.
Pruebas `test-*.cjs` con assert de Node según la convención del repositorio.
Evitar añadir lógica operativa al adaptador `events` o a la invitación pública.

Ejemplo del filtro interno que el servidor construye, nunca texto libre del cliente:

```js
new URLSearchParams({
  project_id: `eq.${projectId}`,
  id: `eq.${recordId}`,
  version: `eq.${expectedVersion}`,
});
```

## Pruebas y comandos

Pruebas RED/GREEN de validación, sesiones/renovación, roles, conflicto, respuesta
mal formada y fallo de red. Integración con handlers reales y Supabase local:
dos proyectos, dos sesiones autorizadas, lectura posterior de registros y dos
ediciones simultáneas con una versión esperada. Fixtures locales sintéticos.
Verificación de navegador de crear mesa → crear invitado → asignar → editar →
recargar y ver persistencia, así como error recuperable y pantallas pequeñas.

Desde la raíz del repositorio:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/run-legacy-tests.cjs
& 'C:\Program Files\nodejs\node.exe' server.cjs
git -c core.whitespace=cr-at-eol diff --check
```

No hay scripts de build/lint; no declarar resultados inexistentes. Reutilizar el
entorno local `invitta-project-ops-test`, API 55421/base 55422, sin enlace remoto.
Comandos Supabase con `--local` y `--workdir` explícitos, descubiertos con `--help`.
La prueba en dos navegadores locales no es evidencia de un despliegue en Vercel.

## Criterios de aceptación y límites

1. Dueño/planner crea, lee y edita sólo operaciones del proyecto permitido;
   otros roles, anónimos y cuentas ajenas no leen ni escriben esos datos.
2. Recargar desde otra sesión autorizada conserva registros/asignaciones; no
   carga demostraciones ni datos del gestor anterior. No oculta errores como vacío.
3. Conflicto o fallo no anuncia guardado ni pierde el formulario. La pantalla
   distingue capacidades conectadas de funciones aún pendientes.
4. Las pruebas existentes siguen pasando y se registra qué se comprobó en
   navegador, base real local y simulaciones, sin mezclarlas.
5. Sin cambios en publicación, documentos, fotos, audio o enlace de Janna.

Siempre: pruebas antes de cerrar cada incremento, aislamiento por proyecto,
validación y revisión. Consultar antes: ampliar campos/roles, añadir dependencias,
aplicar migraciones remotas o publicar en GitHub/Vercel. Nunca: copiar datos de
demostración, borrar datos locales anteriores, usar service_role en la app o
confirmar guardados que no llegaron al servidor.

Fuera de alcance: migración de datos existentes, DELETE, importación, plano 2D
persistido, QR/entrada, RSVP individualizado, hostess/catering, álbum y pagos.
Tras revisar este contrato se extenderán el plan y las tareas existentes sin
cerrar sus pendientes de otros módulos ni sustituir el historial anterior.
