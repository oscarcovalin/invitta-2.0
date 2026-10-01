# Especificación: invitados y mesas vinculados al proyecto

Estado: propuesta para revisión; no autoriza ejecutar cambios remotos.
Fecha: 2026-10-01.
Módulo: `cloud-schema-rls` del [mapa existente](CAPABILITY-MAP.md).
Primer consumidor previsto: `cloud-data-adapter`, en un incremento posterior.

## Objetivo

Dar a cada proyecto una fuente compartida de invitados y mesas en Supabase.
El organizador autorizado debe poder guardar su distribución y recuperarla
desde otro dispositivo sin mezclar eventos ni cargar familias de demostración.
Este contrato sustituye, para esta entrega, el modelo de `events` descrito en
`SPEC-cloud-architecture.md`; ese documento se conserva como antecedente, no
como una migración que deba ejecutarse sobre la base actual.

Se mantiene la identidad `invitation_projects.id` y la pertenencia existente
en `invitation_project_members`. La invitación pública, sus documentos, fotos,
audio y dirección no cambian como efecto de esta entrega.

## Supuestos que requieren revisión

- Un registro de invitado representa una persona o familia/grupo invitado;
  `passes` representa sus lugares autorizados, no asistentes ya admitidos.
- Sólo el dueño y los miembros con rol `planner` consultan y modifican estos
  registros en el primer incremento. No se concede acceso global por la
  etiqueta de administrador del portal.
- No se importan automáticamente datos locales, demostraciones o RSVP. Las
  confirmaciones por nombre libre necesitan conciliación explícita posterior.
- No se recopilan teléfonos, correos, restricciones alimentarias ni notas
  privadas nuevas en este primer modelo.

## Modelo propuesto

| Recurso | Campos de negocio iniciales | Relación |
|---|---|---|
| `invitation_tables` | nombre, tipo, capacidad | pertenece a un `project_id` |
| `invitation_guests` | nombre, pases, mesa opcional | pertenece a un `project_id`; su mesa debe ser del mismo proyecto |

Ambos recursos usan UUID, fecha de creación/actualización y versión positiva
para detectar ediciones concurrentes. `project_id`, identificadores y fechas
no se pueden cambiar mediante una actualización ordinaria.

Límites iniciales propuestos: nombre recortado de 1 a 160 caracteres; pases y
capacidad como enteros de 1 a 100; tipo de mesa `circular`, `imperial` o
`rectangular`. Se rechazan propiedades ajenas al contrato. Los límites se
aplican tanto en el servidor como en restricciones de la base.

La asignación se protege con clave foránea compuesta `(project_id, table_id)`
contra `(project_id, id)` de mesas; un UUID válido no basta para cruzar eventos.
Se indexan las claves foráneas utilizadas en consultas por proyecto. Borrar una
mesa con invitados asignados se rechaza; primero se deben reasignar. No se
habilita borrado masivo ni eliminación de proyectos en esta entrega.

La capacidad no se presenta como una garantía automática de cupo: bloquear
asignaciones simultáneas que la excedan requiere una operación transaccional.
Esa operación y el registro de entrada quedan fuera de este primer contrato.

## Permisos y persistencia

- RLS habilitado desde la creación; ningún permiso de tabla ni función para
  `anon`. SELECT/INSERT/UPDATE limitados a dueño/planner del proyecto.
- Reutilizar `private.has_project_role`; no crear una segunda identidad o
  basarse en `localStorage`, parámetros de URL o etiquetas visuales.
- Las APIs futuras usan la sesión verificada y el JWT del usuario, nunca una
  credencial privilegiada para eludir RLS. Tokens fuera de JSON y registros.
- Las actualizaciones futuras exigen la versión leída y aumentan esa versión
  atómicamente; conflicto explícito sin sobrescribir una edición más reciente.
- Un fallo de red o de permisos no se convierte en lista vacía ni en éxito de
  guardado. Sin conexión, cualquier edición pendiente se señala como pendiente.
- Los roles hostess/catering/designer/viewer no reciben acceso a las tablas
  operativas en esta entrega. Proyecciones limitadas para su trabajo necesitan
  un contrato posterior; no añadir permisos amplios para habilitar una pantalla.

## Estructura y estilo

Migración nueva en `supabase/migrations/`, creada con la CLI antes de editarla.
Pruebas SQL de restricciones y permisos en `supabase/tests/`. Servicios y
handlers posteriores siguen los módulos CommonJS de `lib/`, rutas del
dispatcher existente de `api/index.js` y pruebas `test-*.cjs` en la raíz.
No se añade otra función Vercel ni una dependencia para esta propuesta.

Estilo SQL: nombres snake_case, objetos cualificados y permisos explícitos.
Ejemplo del predicado propuesto, no migración ejecutable:

```sql
using (
  private.has_project_role(project_id, array['project_owner', 'planner'])
)
```

INSERT requiere WITH CHECK; UPDATE requiere USING y WITH CHECK además de
SELECT. Las pruebas deben intentar el acceso directo a PostgREST, no sólo a
los handlers. Las funciones añadidas, si hacen falta, tienen permisos mínimos
y un `search_path` seguro; no usar SECURITY DEFINER por conveniencia.

## Comandos y verificación

Desde la raíz del repositorio:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/run-legacy-tests.cjs
git -c core.whitespace=cr-at-eol diff --check
```

No hay scripts de build/lint definidos; no inventarlos ni declarar un build
exitoso. La CLI de Supabase no se encontró en PATH durante el inventario.
Antes de implementar, resolver su disponibilidad y acordar el entorno de
prueba. Comandos previstos cuando exista un entorno local aislado:

```powershell
supabase migration new add_project_guests_and_tables
supabase start
supabase db reset --local
supabase test db
```

`db reset --local` sólo se permite sobre el entorno desechable de pruebas,
nunca enlazado a los datos del cliente. No se acepta una prueba de texto SQL o
un mock como evidencia de que RLS funciona en PostgreSQL real.

## Criterios de aceptación

1. Dueño y planner de A crean/leen/editan únicamente los registros de A;
   anónimo, cuenta ajena y roles excluidos no pueden hacerlo directamente.
2. La base rechaza nombre/pases/capacidad inválidos y una mesa de B asignada a
   un invitado de A. La actualización no permite mover filas entre proyectos.
3. Un proyecto nuevo empieza con cero invitados/mesas; no existe seed de
   familias reales o de demostración. Aplicar la migración no inserta invitados
   ni mesas en proyectos existentes.
4. Se prueba en PostgreSQL real el aislamiento con dos proyectos y sus roles;
   las 110 pruebas locales actuales deben seguir pasando, pero no reemplazan
   esas pruebas de base ni la posterior verificación entre dispositivos.
5. El incremento no modifica documentos, activos o publicación de Janna.

## Límites de ejecución

- Siempre: cambio aditivo, revisar diferencias, probar restricciones/RLS y
  documentar lo realmente verificado antes de publicar.
- Consultar primero: aprobar este alcance, cambios de esquema remotos,
  dependencias nuevas o permisos adicionales. La revisión de especificación
  precede al plan, tareas e implementación de este módulo.
- Nunca: ejecutar los SQL heredados completos, copiar datos de demostración
  a proyectos, vaciar tablas, publicar secretos o prometer sincronización sin
  verificarla.

## Fuera de alcance y siguientes contratos

Importación de familias existentes, conciliación RSVP, sobrecupo transaccional,
QR/check-in e idempotencia, sincronización offline, acceso hostess/catering,
álbum, pagos y publicación del cambio en Vercel. La primera pantalla conectada
se planifica después de aprobar esta base, como corte vertical verificable.
