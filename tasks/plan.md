# Plan: base compartida de invitados y mesas

## Extensión aprobada: door-scanner-sync (2026-10-02)

Contrato: SPEC-door-scanner-sync.md. Sólo local, sin modificar Janna ni publicar.
Orden: pruebas de atomicidad/RLS → funciones transaccionales → credencial y API
→ cliente y pantallas por proyecto → integración real y revisión.
Credencial IV2.projectUUID.ticketUUID.HMAC; ticketUUID es el UUID estable de
emisión. HMAC-SHA256 usa INVITTA_PASS_QR_SECRET independiente, mínimo 32 bytes.
La base guarda sólo SHA256 de la credencial y vencimiento generado por servidor.
Los reintentos reconstruyen la misma credencial; no hay segunda escritura de firma.
Funciones privadas comprobadas con wrappers SECURITY INVOKER: emitir, inspeccionar,
admitir y revocar. Lectura pública sólo por digest de alta entropía, sin listados.
Admisión bloquea invitado antes de boleto; reducción de pases toma ese mismo bloqueo.
Todos los POST privados exigen sesión renovable/origen; no usan service_role.
Ruta única /api/projects/passes con action context/issue/inspect/admit/revoke, y
/api/public/pass para lectura mínima. La credencial pública va en fragmento del
enlace a pase.html, nunca en query ni logs. Reintento conserva operationId/cuerpo.
Revisión remota posterior: secreto, retención/exportación y migración/despliegue.

Implementación local verificada: 120 archivos JS, 146 SQL, 174 HTTP reales,
246–248 verificaciones de puerta/PostgREST según orden de concurrencia más 68 base.
Instalación de migración desde cero y revisión independiente completadas.
Evidencia, uso y límites en docs/decisions/0005-project-door-passes.md.
Cámara física, prueba móvil efectiva y activación remota todavía pendientes.


## Extensión aprobada: consumidor por proyecto (2026-10-01)

Contrato: [SPEC-cloud-data-adapter.md](SPEC-cloud-data-adapter.md). Continuar
sin aprobaciones intermedias; sólo local. Orden: validación y operaciones con
JWT/RLS → handlers con sesión/origen → cliente de estado → pantalla separada
del gestor antiguo → acceso desde portal → integración local y revisión.
Cada incremento se prueba antes de expandirlo y se conserva en un commit local.
Riesgos principales: confirmar un guardado desconocido, sobrescribir versiones,
mostrar una denegación como vacío y cargar demostraciones en el proyecto.
Mitigaciones: UUID estable, filtro de versión atómico, errores explícitos y
no inicializar el modo heredado con `project`. No cambiar publicación/Janna.

Resultado: consumidor, rutas, pantalla y entrada por proyecto implementados
localmente. 115/115 archivos JavaScript, 116 pgTAP y 24 comprobaciones HTTP
del consumidor más 68 Auth/PostgREST directas. Navegador: dos sesiones locales,
guardado/asignación/desasignación, conflicto, borrador conservado, recuperación
y recarga; tamaños 320/768/1024/1440 px sin desbordamiento. Sin cambios remotos.
Revisión independiente sin hallazgos Required/Critical pendientes.

## Historial del incremento de esquema

Estado: aprobado por el usuario el 2026-10-01; implementación local y sus tres tareas verificadas. Sin aplicación remota ni conexión de pantallas.
Módulo: `cloud-schema-rls`.
Alcance aprobado: [SPEC-cloud-schema-rls.md](SPEC-cloud-schema-rls.md).
Tareas y verificaciones: [todo.md](todo.md).

## Resultado de esta entrega

Una migración aditiva que permita guardar y consultar invitados y mesas por
proyecto, con aislamiento demostrado en PostgreSQL y acceso directo a la API
de datos. No significa todavía que el organizador visual guarde en la nube:
esa conexión pertenece al siguiente incremento de `cloud-data-adapter`.

Este plan no publica código en GitHub/Vercel, no modifica la base del cliente,
ni cambia documentos, activos, revisiones o dirección de la invitación de Janna.

## Orden y dependencias

1. Resolver un entorno de prueba aislado y reproducible.
2. Implementar el contrato de invitados/mesas con pruebas que fallen primero.
3. Verificar permisos desde la API de datos y comprobar regresiones.

Cada paso depende del anterior. Se trabaja secuencialmente porque comparten
esquema y permisos. No se necesita delegación ni trabajo paralelo.

## Decisiones de implementación

- Mantener `invitation_projects.id` como identidad; no crear `events` ni
  ejecutar `database/schema.sql` o `database/rls-policies.sql` heredados.
- Crear `invitation_tables` e `invitation_guests` según los campos y límites
  aprobados. Incluir índices por proyecto y clave foránea compuesta para que
  una mesa de otro proyecto nunca se asigne a un invitado.
- Reutilizar `private.has_project_role` con dueño/planner. Revocar privilegios
  públicos, conceder sólo columnas necesarias y cubrir SELECT/INSERT/UPDATE
  con RLS; no habilitar DELETE en esta entrega.
- Identidad y fechas permanecen bajo control de la base. Una actualización
  aumenta la versión del registro de forma atómica; no se permite fijar
  arbitrariamente versión/fecha desde PostgREST. El consumidor posterior debe
  exigir la versión leída para evitar sobrescrituras.
- No añadir RPC privilegiada para evitar restricciones. Cualquier función
  auxiliar necesaria usa permisos mínimos y `search_path` seguro.
- Separar límites de campos y pertenencia de la garantía de cupo. No prometer
  bloqueo transaccional de sobrecupo ni admisiones QR en este incremento.

## Entorno de verificación

Se encontraron instalaciones existentes fuera de PATH: CLI 2.117.0 y Docker
29.8.0. El entorno `invitta-project-ops-test` usa PostgreSQL 17.6 en contenedor,
puertos locales 55421/55422, sin enlace remoto ni semillas. Se verificó la carga
de las migraciones anteriores y la nueva desde cero. No se instalaron dependencias
de la app ni se usó el proyecto del cliente como laboratorio.

Primero buscar instalaciones disponibles en ubicaciones conocidas. Si falta
el entorno, no instalar Docker, introducir dependencias ni abrir un proyecto
remoto de pago silenciosamente. Documentar la limitación y solicitar sólo la
autoridad nueva realmente necesaria. No usar producción como laboratorio.

En un entorno desechable, fijar versiones y descubrir comandos con `--help`.
Crear la migración con `supabase migration new`, no inventar su nombre. Usar
una configuración aislada sin semillas; las pruebas generan datos sintéticos
y no envían correo ni toman usuarios, sesiones o registros del cliente.

## Verificación y puntos de revisión

- Prueba inicial: restricciones/permisos fallan por falta del nuevo esquema;
  no aceptar un fallo causado sólo por una herramienta ausente como RED.
- Prueba SQL: dueño y planner de A acceden a A; otros roles y miembros de B
  no. Probar intentos de mover una fila a B, mesa ajena y valores inválidos.
- Prueba REST directa: emitir sesiones de usuarios sintéticos locales,
  consultar/escribir con su JWT y confirmar que RLS sigue actuando sin pasar
  por los handlers de Invitta. No imprimir credenciales en los resultados.
- Prueba de concurrencia: dos operaciones con la misma versión no pueden
  sobrescribir silenciosamente el cambio más reciente. La respuesta HTTP
  propia de Invitta se probará cuando se construya ese consumidor.
- Revisar asesores de seguridad/privilegios y ejecutar las pruebas existentes
  antes de considerar la migración preparada. No hay build/lint en package.json.
- Después de esquema/pruebas SQL: revisión antes de conectar el consumidor.
  Después de REST/regresiones: informar evidencia y límites antes de solicitar
  cualquier aplicación remota o publicación.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Probar accidentalmente sobre datos reales | Entorno aislado confirmado; fixtures sintéticos; nunca reset remoto |
| Una prueba SQL antigua presupone permisos distintos | Comprobar rechazo real: sin GRANT puede ser 42501, no lista vacía |
| Confundir pruebas simuladas con integración real | Registrar por separado pgTAP, PostgREST y suite local |
| Mezclar familias locales con otro evento | Ninguna importación automática ni seed de invitados/mesas |
| Perder una edición simultánea | Versión atómica en base y filtro de versión en el consumidor posterior |
| Dar acceso excesivo para desbloquear una pantalla | Dueño/planner únicamente; otros roles requieren contrato específico |

## Aprobaciones y cierre

El usuario aprobó el modelo, este plan y su desglose para implementación local,
conforme a `spec-driven-development` y `planning-and-task-breakdown`.
Los cambios remotos, instalaciones nuevas y despliegue quedan fuera de esta
revisión. Cierre: 116 pgTAP, 68 comprobaciones Auth/PostgREST y 111/111 archivos
JavaScript; asesores locales sin advertencias/errores. Revisión independiente
sin hallazgos Required/Critical pendientes. Evidencia y límites en
[fusion-progress.md](../docs/fusion-progress.md).

## Integración selectiva de New-Invitta: contenido por evento

Fuente revisada: New-Invitta `93a79d93ef3f2f314e20aa506589096a2b634e13`.
Base: vista previa `8b7c748`, con visibilidad de familia corregida. No incorporar
la rama local de validez de boletos ni sustituir autenticación, publicación o RSVP.

1. Adaptar textos de respaldo de Stardust, álbum y música para boda, XV y otros
   eventos. Criterios: tres tipos distinguidos; textos personalizados intactos;
   escape de configuración y confirmación persistente conservados.
   Verificar pruebas enfocadas y suite completa. Archivos: motor, prueba y
   documentación; depende de la base desplegada.
2. Incorporar título personalizado del overlay Stardust y control en Studio.
   Criterios: campo vacío usa el título actual; texto guardado/importado aparece
   en editor y presentación pública; caracteres HTML se muestran como texto.
   Verificar pruebas RED/GREEN, importación/exportación y navegador local.
   Depende de 1; archivos: motor, Studio, controlador y pruebas.
3. Revisar integración Firebase separadamente: identidad del proyecto, rutas,
   permisos y almacenamiento real antes de habilitar cargas. No migrar datos
   ni reglas remotas como parte de las entregas de contenido.

Punto de revisión: pruebas y navegador local antes de solicitar publicación.
No modificar documentos, fotos, audio, revisiones o slugs reales de Janna/Mara.
Riesgos: cambio involuntario de mensajes escritos por el usuario (sólo usar
respaldos cuando no haya valor); regresión RSVP (conservar flujo confirmado y
tests existentes); importación amplia insegura (cambios selectivos, no reemplazo).
