# ADR-0004: Consumidor operativo separado del organizador heredado

## Estado

Aceptado e implementado localmente el 2026-10-01. Sin aplicación remota ni despliegue.

## Fecha

2026-10-01.

## Contexto

La base del ADR-0003 ya permite invitados y mesas por proyecto. El organizador
anterior usa identidades de evento, demostraciones y persistencia local que no
deben copiarse automáticamente a un proyecto ni confundirse con Supabase.
El contrato aprobado es `tasks/SPEC-cloud-data-adapter.md`.

## Decisión

Abrir `organizador-mesas.html?project=<UUID>` desde la tarjeta del portal.
En este modo no instanciar los gestores heredados ni acceder a sus datos.
Conservar el modo anterior cuando no hay parámetro `project`.

Añadir GET/POST/PATCH en `/api/projects/guests` y `/api/projects/tables`.
Resolver la sesión profesional renovable en el servidor y operar PostgREST
con el JWT del usuario, nunca con clave privilegiada. Comprobar pertenencia
explícita para distinguir denegación de lista vacía; conservar RLS también
para acceso directo. Las escrituras con cookie exigen origen propio.

Validar entrada y respuesta, seleccionar sólo campos permitidos, paginar por
UUID y filtrar PATCH por proyecto/id/versión esperada. Exigir exactamente una
fila confirmada. Cero filas es conflicto, no guardado exitoso. Autoridad
malformada o proveedor indisponible se muestra como 502, no como sesión vencida.

El cliente mantiene estado y borradores sólo en memoria. Generar UUID de alta
antes de enviar y conservarlo si no se conoce el resultado. Bloquear otra
escritura hasta consultar: coincidencia de intención y versión confirma éxito;
ausencia/versión sin cambio permite reintentar el mismo UUID; diferencia exige
decisión explícita sin sobrescritura automática. La PK y versión protegen
también frente a una respuesta que llegue tarde. No ofrecer una cola offline.

Usar confirmación de descarte dentro de la pantalla, con foco conservado y
Escape, en vez de `window.confirm`: el diálogo nativo bloqueó el navegador
integrado durante una prueba. Renderizar registros con texto, no HTML.

## Alternativas consideradas

- Adaptar los gestores de demostración en el mismo estado: rechazado por mezcla
  de identidades, persistencia y operaciones no cubiertas por el contrato.
- Clave privilegiada o rol global para desbloquear escritura: rechazado; la
  autorización corresponde al proyecto y debe aplicarse en PostgREST directo.
- Reintento automático con otro UUID: rechazado porque un timeout no prueba
  que la escritura falló y puede crear duplicados.
- Actualización silenciosa ante conflicto: rechazado; descarta intención ajena.

## Consecuencias y verificación

El usuario puede crear/editar mesas e invitados, asignar/desasignar mesa y
consultar desde otra sesión autorizada. Actualización manual, no Realtime.
Sobrecupo es aviso; pases no son admisiones. Sin borrado, importación RSVP,
QR, álbum, pagos o migración de datos locales.

115 archivos JavaScript, 116 pgTAP y 24 comprobaciones HTTP del consumidor más
68 Auth/PostgREST directas. Navegador local con dos sesiones, conflicto,
reconciliación, recarga y cuatro tamaños. Dependencias externas heredadas
también evaluadas en la prueba de aislamiento para detectar efectos top-level.
Revisión independiente sin Required/Critical pendientes.

## Riesgos y reversión

Los tests locales no prueban el despliegue remoto. Revisar y aplicar la migración,
publicar código y verificar usuarios/dispositivos reales en un paso separado.
Para detener el consumidor, retirar su entrada del portal antes de desactivar
las APIs; preservar registros. No borrar tablas con datos para revertir.
La invitación pública de Janna y su enlace no cambian con este incremento.
