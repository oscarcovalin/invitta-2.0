# ADR-0003: Invitados y mesas por proyecto canónico

## Estado

Aceptado para implementación local el 2026-10-01. No aplicado al Supabase del cliente ni desplegado.

## Fecha

2026-10-01 (la CLI nombró la migración con su fecha UTC del 2026-10-02).

## Contexto

La base actual identifica proyectos mediante `invitation_projects` y sus miembros.
El adaptador heredado espera `events`, `guests` y `tables` que no existen en esa base.
Instalar sus SQL antiguos crearía otra identidad y no resolvería la fusión.
El [contrato aprobado](../../tasks/SPEC-cloud-schema-rls.md) limita el primer paso
a almacenamiento de invitados/mesas; las pantallas se conectan posteriormente.

## Decisión

Crear `invitation_tables` e `invitation_guests`, vinculadas por `project_id`.
Reutilizar `private.has_project_role` y permitir SELECT/INSERT/UPDATE sólo al
dueño y planner. Sin acceso anónimo, permisos globales de administrador,
DELETE directo ni importación automática de demostraciones/RSVP.

La clave compuesta `(project_id, table_id)` impide asignar mesas entre eventos,
incluso a quien es dueño de ambos. El índice de invitados empieza por
`project_id`; la clave única de mesas cubre también su relación con proyectos.
La FK de asignación usa NO ACTION: rechaza borrar una mesa asignada al terminar
la sentencia, pero permite las cascadas de una eliminación del proyecto ya
autorizada por las políticas existentes. Este incremento no añade esa operación.

Permisos por columnas impiden editar identidad, fechas o versión. Un trigger
SECURITY INVOKER, sin búsqueda implícita de objetos ni ejecución para clientes,
defiende identidad también en mantenimiento e incrementa versión/fecha de cada
actualización exitosa. No se añade una RPC privilegiada ni clave de servicio a la app.

El consumidor deberá filtrar PATCH por proyecto, id y versión esperada y exigir
una fila devuelta. Cero filas no es éxito: puede significar conflicto o pérdida
de permiso. **Incrementar `version` sin ese filtro no evita sobrescrituras.**

## Alternativas consideradas

- Reutilizar los SQL de `events`: rechazado por identidad y permisos paralelos.
- Mantener listas en JSON del editor: rechazado para datos operativos compartidos;
  revisiones públicas y listas privadas tienen ciclos y permisos distintos.
- Acceso amplio por rol del portal o clave privilegiada: rechazado; el permiso
  debe corresponder al proyecto y aplicarse también en PostgREST directo.
- Borrado con reasignación automática: pospuesto; no se debe perder la ubicación
  de invitados sin una operación explícita.

## Consecuencias y verificación

Los proyectos empiezan sin invitados ni mesas. No se alteran documentos, activos
o publicaciones. La capacidad de mesa es un dato, no una garantía transaccional
de cupo; importación, RSVP identificado, admisión y sobrecupo quedan pendientes.

Entorno desechable `invitta-project-ops-test`, sin vínculo remoto ni semillas:
CLI 2.117.0, Docker 29.8.0, PostgreSQL del contenedor 17.6, Auth y PostgREST reales.
La CLI creó el borrador, `db pull --local --schema public,private` generó la
migración final y se conservaron permisos explícitos y SQL legible en su versión
revisada. `db query --file` rechazó sentencias múltiples en esta CLI; la iteración
se aplicó con psql dentro del contenedor local. Luego se verificó la migración
completa con `db reset --local --no-seed` y su historial local.

- 106 pruebas nuevas pgTAP de restricciones, columnas, roles y revocación.
- 10 pruebas previas de proyectos; se corrigió su expectativa anónima para
  exigir denegación 42501, no una lectura concedida de lista vacía.
- 68 comprobaciones Auth/PostgREST, con dos guardados concurrentes y un único
  ganador por recurso; fixtures sintéticos eliminados por UUID exacto al terminar.
- Asesores locales de seguridad/rendimiento: sin advertencias o errores.
- 111/111 archivos de regresión JavaScript. Sin scripts de build/lint definidos.

La revisión independiente detectó un falso positivo posible en la limpieza:
un DELETE 200 con cero filas no prueba que se eliminó el fixture. Se reprodujo
y corrigió en el arnés: UUID exacto devuelto para proyectos y GET posterior 404
para el mismo usuario de Auth (su DELETE devuelve un objeto vacío). La prueba
de seguridad cubre también respuestas fallidas y verificaciones denegadas.
Revisión final sin Required/Critical pendientes.

## Riesgos y reversión

Esto prueba la base local, no sincronización del organizador entre dispositivos
ni el despliegue real. Aplicación remota y conexión de pantallas requieren su
siguiente revisión. No incluir datos de Janna en los fixtures.

No borrar tablas para revertir cuando contengan datos. Si posteriormente se
aplica remotamente, detener primero el consumidor nuevo, preservar/exportar
registros y revisar una migración de reversión. La publicación actual es independiente.
