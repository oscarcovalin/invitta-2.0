# ADR-0005: Boletos e ingresos atómicos por proyecto

## Estado

Alcance aprobado e implementado localmente el 2026-10-02. Activación en vista
previa aprobada por el usuario ese día: esquema instalado remotamente y firma
privada configurada sólo para `preview/invitta-cloud-client-flow`; despliegue y
recorrido publicado en verificación. No sustituye todavía la puerta heredada.
No se modifica Janna ni se envían mensajes.

## Fecha

2026-10-02; la CLI generó el archivo final con fecha UTC 2026-10-03.

## Contexto

El generador/escáner heredado usa datos locales, acepta payloads desconocidos
creando invitados y simula sincronización. Sus suites pasan aun cuando una segunda
admisión repite todos los pases. Eso no demuestra control de acceso compartido.
El contrato aprobado es `tasks/SPEC-door-scanner-sync.md`, sobre el ADR-0003/0004.

## Decisión

Abrir `puerta-proyecto.html?project=<UUID>` desde cada tarjeta del portal. Los
accesos heredados con proyecto redirigen aquí; sin proyecto mantienen su modo
anterior, que no se considera una puerta verificada para proyectos nuevos.

Dueño/planner explícitos emiten y revocan. Dueño/planner/hostess explícitos
inspeccionan y admiten. El JWT verificado se usa en PostgREST, no una clave de
servicio. Las cinco funciones privadas también rechazan `is_anonymous` confiable;
no usan metadata editable. Las cuentas no reciben roles automáticamente.

`private.invitation_passes` y `private.invitation_admissions` tienen RLS, sin
privilegios directos para clientes. Funciones privadas SECURITY DEFINER comprueban
actor, proyecto e intención, con búsqueda vacía; wrappers públicos son INVOKER.
Se revocan explícitamente incluso los privilegios por defecto antes de regrantar
las funciones acotadas. El lector público sólo devuelve ocho campos de un boleto.

Emisión crea invitado y boleto en una transacción. El ingreso inmediato es opt-in.
La admisión bloquea primero invitado y después boleto; revocación/reducción siguen
ese orden. No se pueden reducir pases por debajo de los ya admitidos. Una mesa
de otro proyecto se rechaza. Este corte no garantiza capacidad total de mesa.

Cada emisión/admisión usa UUID de operación estable y hash de intención con actor.
Una repetición exacta devuelve el resultado original, incluso tras revocar/vencer,
sin admitir otra persona. Una nueva admisión requiere nueva intención y saldo.
Se evita por tanto tanto el doble clic como perder la respuesta después del commit.

QR: `IV2.<projectUUID>.<ticketUUID>.<HMAC-SHA256-base64url>`, sin cantidades
autoritativas ni contactos. `INVITTA_PASS_QR_SECRET` es una clave independiente
**sólo del servidor**, mínimo 32 bytes y sin fallback. Se guarda SHA256 del código,
no la clave ni la credencial. El UUID del boleto coincide con el UUID de emisión,
lo que permite reconstruir exactamente el QR de un reintento. La base fija 24 h
desde emisión y comprueba vencimiento/revocación para cada operación nueva.

No rotar la clave mientras existan boletos vigentes sin un plan de invalidación;
este formato no tiene llavero/versionado de claves. No reutilizar secrets de Auth.
Falta de configuración falla cerrado con 503. No existe envío automático.

## Contrato de API y uso

POST `/api/projects/passes` exige cookie profesional renovable y Origin propio.
Todos los cuerpos privados llevan `action` y `projectId`:

- `context`: devuelve `{context:{projectName,canIssue,canAdmit}}`.
- `issue`: `operationId,name,passes(1..20),tableId(null|UUID),immediate(bool)`;
  devuelve `{pass,credential}` con 201.
- `inspect`: `credential`; devuelve `{pass}` actualizado.
- `admit`: `credential,operationId,count(1..20)`; devuelve `{admission}` confirmado.
- `revoke`: `credential`; devuelve `{revocation:{ticketId,revoked:true}}`.

Las respuestas incluyen `success:true`. Errores: 401 sesión, 403 permiso/origen,
404 boleto no disponible, 409 conflicto/saldo, 422 entrada, 502 resultado sin
confirmar, 503 configuración. Se validan formas, identidades e intención de la
respuesta de almacenamiento; un resultado de otro boleto no da éxito.

POST `/api/public/pass` sólo acepta `{credential}`, no cookies. Devuelve nombre,
pases, admitidos, restantes, expiración, revocado, proyecto y mesa; no listas,
identidades internas, logs, editor o portal. `pase.html#<credential>` usa fragmento,
no query, `no-referrer`, `noindex` y `no-store`. Cualquiera con el código puede
leer/presentar ese boleto; no concede pertenencia ni permiso para registrar entrada.

Cliente: emitir → conservar/copiar QR o enlace → hostess verifica → confirma sólo
personas presentes → vuelve a verificar antes del grupo siguiente. Owner/planner
pueden verificar y revocar un boleto anterior aunque hayan recargado la pantalla.

Sin respuesta confirmada se conserva intención en sessionStorage de esa pestaña
y se bloquean operaciones nuevas hasta verificar el mismo reintento. No hay cola
offline ni éxito ficticio. Recarga conserva la solicitud; **cerrar la pestaña o
borrar sus datos puede perder esa intención**. No recrear un boleto a ciegas ante
un resultado desconocido. El saldo de un resultado repetido es histórico, no un
saldo global nuevo. Por eso el siguiente grupo exige inspección otra vez.

## Alternativas consideradas

- Payload QR con nombre/pases y alta automática: rechazado por falsificación/replay.
- Contador del navegador/cola offline: rechazado por dos dispositivos sin autoridad.
- Service role para operar: rechazado por bypass de permisos de proyecto.
- Realtime: pospuesto; la transacción y consulta explícita bastan para este corte.
- Importar RSVP/demos: fuera de alcance; no conciliar identidades por nombre libre.

## Consecuencias y verificación

Supabase desechable `invitta-project-ops-test`, localhost 55421/55422, sin vínculo
remoto, semillas ni datos reales. CLI 2.117.0, PostgreSQL 17.6, Node 24.18.0.
La CLI creó el borrador y generó el diff final; se revisaron ACL y rechazo anónimo.
Instalación completa desde cero con `db reset --local --no-seed`, después de
confirmar cero usuarios/proyectos/documentos/boletos/admisiones y limpiar fixtures.

- 120/120 archivos JavaScript; cinco nuevos de credencial/API/cliente/cámara/middleware.
- 146 pgTAP (30 nuevos). RED: cinco operaciones aceptaban identidad anónima;
  GREEN: denegadas antes de consultar o escribir. ACL/RLS probados en instalación limpia.
- 246–248 checks directos según el orden ganador de carreras, última ejecución 246,
  más 68 checks base de Auth/PostgREST. Último pase, intención, expiración,
  revocación, reducción, roles y aislamiento de proyectos comprobados realmente.
- 174 checks HTTP reales más 68 base: la respuesta se pierde **después** del commit
  y el reintento recupera una sola emisión/admisión, no un fake de atomicidad.
- Cinco matrices QR reales codificadas/decodificadas exactamente. CDN ya utilizado,
  versiones fijadas y SRI SHA384 en ambas páginas; sin nuevas dependencias instaladas.
- Navegador local: owner/hostess en hosts separados, QR visible, parcial 2+2,
  emisión/admisión inciertas y recuperación, revocación tras recarga, lector público
  sin enlaces privados. Sin errores/avisos de consola en las páginas nuevas.
- Cancelación tardía de cámara y matcher de protección tuvieron RED/GREEN propios.
- Asesor local de seguridad: sin advertencias/errores. Sintaxis/diff limpios.

No hay scripts de build/lint. La cámara física no se probó ni se solicitaron
permisos. El override móvil del navegador no cambió el ancho observado (1280);
no se presenta esa comprobación como prueba móvil a 320 px. CSS responsivo revisado,
pero dispositivo móvil real y lectura de cámara siguen pendientes antes de uso.
Restauración de intención tras recarga cubierta por test del cliente; el aviso
beforeunload impidió comprobar esa recarga incierta en el navegador disponible.

## Riesgos y reversión

Retención de vista previa aprobada: registros privados, sin purga automática,
hasta solicitud explícita de exportación/eliminación. El borrado en cascada de
un proyecto sigue existiendo; esto no añade una pantalla para borrar ni promete
un exportador implementado. No rotar la firma durante boletos vigentes.

La migración local generada originalmente como `20261003000557` conserva el mismo
SQL bajo `20261003021708`, versión registrada por la aplicación remota. Permisos
verificados en catálogo: RLS en ambas tablas, sin acceso directo de anon,
authenticated o service_role; ejecución privada sólo en funciones acotadas.
Smoke SQL remoto en transacción: emisión/replay, parcial/replay, límite de pases,
reducción, lector mínimo, rechazo anónimo y revocación; todos los datos sintéticos
se revirtieron. Los avisos INFO de RLS sin políticas son deliberados (tablas
privadas accesibles sólo por funciones); permanece el WARN previo de protección
de contraseñas filtradas desactivada. No se cambió Auth fuera de este alcance.

Activar remotamente exige revisión/aprobación del esquema, secreto y despliegue,
asignaciones explícitas y definición operativa de retención/exportación/eliminación.
La cascada existente de eliminación de proyecto incluye boletos/logs; no se añade
purga automática ni formulario de borrar en este corte. No se almacena contacto.

Para revertir después de activar: detener el consumidor nuevo, preservar/exportar
datos y revisar una migración de reversión. No borrar tablas con admisiones reales.
Antes de sustituir una puerta existente, resolver compatibilidad de códigos viejos
y probar dos dispositivos, conexión perdida, último pase y revocación en vista previa.
Este incremento local no declara terminada la fusión ni afecta la invitación pública.
