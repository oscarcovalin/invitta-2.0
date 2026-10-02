# Plan: base compartida de invitados y mesas

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
