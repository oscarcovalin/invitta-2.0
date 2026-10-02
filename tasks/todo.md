# Tareas: invitados y mesas por proyecto

## Extensión: cloud-data-adapter aprobado 2026-10-01

- [ ] A. Validación y almacenamiento con JWT: permisos explícitos, paginación,
  creación estable y PATCH con versión. Archivos: servicio y prueba (2).
  Verificar RED/GREEN, errores y filtros; depende del esquema ya terminado.
- [ ] B. Handler GET/POST/PATCH: sesión renovable, origen de escritura y errores
  uniformes. Archivos: handler, prueba y dos envoltorios (4); depende de A.
- [ ] C. Registrar rutas aditivas: dispatcher, API y prueba (3); depende de B.
  Verificar métodos y regresiones antes de conectar la pantalla.
- [ ] D. Cliente en memoria: paginación, conflicto, resultado desconocido y
  cargas obsoletas. Archivos: cliente y prueba (2); depende de C.
- [ ] E. Pantalla acotada por proyecto sin demos ni almacenamiento heredado.
  Archivos: controlador, estilos, organizador y prueba (4); depende de D.
- [ ] F. Entrada desde portal y middleware profesional sólo con proyecto.
  Archivos: portal, middleware y pruebas (4); depende de E.
- [ ] G. Integración con handlers y Auth/PostgREST real local, dos sesiones y
  conflicto concurrente. Script y prueba de seguridad (2); depende de C.
- [ ] H. Navegador: crear/asignar/editar/recargar, fallo recuperable y móvil;
  suite completa, revisión y evidencia en docs (máximo 3); depende de E–G.

No hay build/lint. Comando común: Node `scripts/run-legacy-tests.cjs` con
archivos concretos durante RED/GREEN y suite completa en los checkpoints.
No cerrar otros módulos ni publicar hasta verificar este incremento.

Estado: desglose del [plan](plan.md) aprobado por el usuario el 2026-10-01, implementado y verificado localmente. Sin despliegue ni aplicación remota.
Especificación: [cloud-schema-rls](SPEC-cloud-schema-rls.md).
Este registro no reemplaza el historial de entregas de `docs/fusion-progress.md`.

## 1. Preparar pruebas aisladas

- [x] Confirmar un entorno PostgreSQL/Supabase desechable y sus versiones.
- [x] Verificar que carga las migraciones existentes sin datos reales ni semillas.
- [x] Comprobar que las pruebas SQL fallan por el nuevo contrato ausente,
  distinguiendo una avería del entorno de un fallo esperado de comportamiento.

Verificación: consultar versiones y conexión; descubrir opciones con
`supabase --help`, `supabase migration --help`, `supabase db --help` y
`supabase test db --help`; ejecutar pruebas del entorno confirmado. Ningún
reset se ejecuta sin comprobar la dirección local/descarte de datos.

Dependencias: revisión del plan y disponibilidad del entorno; cualquier
instalación nueva requiere autorización separada si resulta necesaria.
Archivos previstos: `supabase/tests/invitation_operations_rls.test.sql`
y, si hace falta, una configuración aislada fuera del repositorio.
Tamaño: pequeño; máximo dos archivos.

## 2. Implementar el esquema autorizado

- [x] Crear una migración nueva con CLI para los dos recursos, sus restricciones,
  índices, permisos, RLS y control de campos gestionados por la base.
- [x] Probar dueño/planner, exclusión de otros roles, cruces entre dos proyectos,
  límites de campos, identidad inmutable y actualización de versión.
- [x] Confirmar que aplicar la migración no inserta invitados/mesas ni modifica
  documentos, publicación o activos existentes.

Verificación: ejecutar pgTAP en PostgreSQL real antes/después del cambio y
revisar privilegios/asesores. Confirmar que el DELETE no está concedido y que
la creación devuelve la fila a usuarios autorizados.

Dependencias: tarea 1.
Archivos previstos: migración creada por CLI en `supabase/migrations/`,
`supabase/tests/invitation_operations_rls.test.sql` y
`docs/decisions/0003-project-guest-and-table-storage.md`.
Tamaño: medio; tres archivos.

## Punto de revisión: base

- [x] Restricciones y RLS comprobados, no sólo inspeccionados como texto.
- [x] Ningún dato real utilizado o modificado.
- [x] Revisión del incremento antes de expandirlo; mantener separado el
  contrato futuro de APIs/pantallas.

## 3. Verificar acceso directo y regresiones

- [x] Probar SELECT/INSERT/UPDATE desde PostgREST con sesiones sintéticas
  locales de dueño, planner, cuenta ajena y roles excluidos; incluir anónimo.
- [x] Comprobar que dos escrituras con versión esperada igual no pierden la
  edición más reciente, además de la pertenencia de mesa al mismo proyecto.
- [x] Ejecutar suite local y registrar qué pasó, qué no se pudo probar y qué
  queda pendiente antes de aplicar la migración remotamente.

Verificación: script de integración local usando `fetch` de Node y credenciales
locales efímeras sin imprimirlas. Ejecutar también:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/run-legacy-tests.cjs
git -c core.whitespace=cr-at-eol diff --check
```

Dependencias: tarea 2 y entorno con Auth/PostgREST local.
Archivos de verificación: `scripts/test-project-operations-local.cjs`,
`test-project-operations-local-safety.cjs` y `docs/fusion-progress.md`.
Tamaño: medio; tres archivos. Los fixtures son efímeros, no se guardan en el repositorio.

## Punto de revisión: entrega preparada

- [x] Todas las pruebas requeridas tienen resultado verificable; no inventar
  éxito de build/lint ni confundir la suite local con prueba remota.
- [x] Permisos y diferencias revisados; sin secretos ni datos personales.
- [x] La migración queda preparada localmente; aplicación remota y despliegue
  requieren revisión aparte.
- [ ] Organizador visual, importación RSVP, QR, álbum y pagos siguen pendientes.

Evidencia de cierre: 116 pruebas SQL (106 nuevas + 10 existentes), 68 comprobaciones
Auth/PostgREST, 111/111 archivos JavaScript; instalación desde cero y asesores
locales sin advertencias/errores. Revisión independiente aprobada tras corregir
la comprobación de limpieza. Ningún dato remoto o publicación alterado.
