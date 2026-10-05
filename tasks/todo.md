# Tareas: invitados y mesas por proyecto

## Extensión: door-scanner-sync aprobado 2026-10-02 (sólo local)

- [x] I. Pruebas de base y funciones atómicas: permisos, último pase concurrente,
  repetición, conflicto de intención, revocación/expiración y reducción de pases.
- [x] J. Firma independiente, validación y API con sesión/origen; sin contactos,
  secretos/logs ni acceso público a listas. RED/GREEN y fallos de proveedor.
- [x] K. Generador/escáner por proyecto, cliente de reintento estable y pase mínimo;
  ingreso manual y cámara iniciada por usuario; entrada desde portal.
- [x] L. Auth/PostgREST y HTTP reales locales, QR real y navegador; regresiones,
  revisión de seguridad, documentación y limitaciones. Sin cambios remotos.

Entrega local: 120/120 archivos JS, 146 pgTAP, 174 HTTP, última corrida 246
checks de puerta +68 base; cinco QR decodificados. Migración instalada desde
cero y revisión sin Required/Critical. Fixtures eliminados; Janna intacta.
Pendientes de lanzamiento, no ocultos por estas casillas: cámara/dispositivo móvil
reales y recorrido remoto con otros roles. Aprobación remota, secreto y retención
se resolvieron en la activación posterior siguiente; no hay exportador nuevo.
Véase ADR-0005. El modo global heredado no se declara sincronizado/verificado.

## Activación posterior de puerta en vista previa (2026-10-02)

- [x] Aprobación del esquema, firma, despliegue y prueba sólo ficticia; retención
  privada sin purga automática. Sin Janna, mensajes ni main/producción.
- [x] Migración remota `20261003021708`, catálogo ACL/RLS y smoke SQL transaccional.
- [x] Firma sensible sólo para la rama de vista previa; código desplegado READY.
- [x] Navegador publicado: emisión cuatro, ingreso 2+2, saldo tras recarga,
  revocación y rechazo público; una emisión/dos admisiones confirmadas en Supabase.
- [x] Limpieza exacta del proyecto ficticio y comparación de huellas de Janna.
- [ ] Cámara física y dos dispositivos móviles reales.
- [ ] Recorrido publicado con sesión distinta de planner/hostess asignada.
- [ ] Revisar mapa de entrega sencilla para anfitriones antes de especificar módulos.

Evidencia: [estado de fusión](../docs/fusion-progress.md) y ADR-0005. La nueva
página de personalización está propuesta, no implementada; emergencia sigue 24 h.


## Extensión: cloud-data-adapter aprobado 2026-10-01

- [x] A. Validación y almacenamiento con JWT: permisos explícitos, paginación,
  creación estable y PATCH con versión. Archivos: servicio y prueba (2).
  Verificar RED/GREEN, errores y filtros; depende del esquema ya terminado.
- [x] B. Handler GET/POST/PATCH: sesión renovable, origen de escritura y errores
  uniformes. Archivos: handler, prueba y dos envoltorios (4); depende de A.
- [x] C. Registrar rutas aditivas: dispatcher, API y prueba (3); depende de B.
  Verificar métodos y regresiones antes de conectar la pantalla.
- [x] D. Cliente en memoria: paginación, conflicto, resultado desconocido y
  cargas obsoletas. Archivos: cliente y prueba (2); depende de C.
- [x] E. Pantalla acotada por proyecto sin demos ni almacenamiento heredado.
  Archivos: controlador, estilos, organizador y prueba (4); depende de D.
- [x] F. Entrada desde portal y middleware profesional sólo con proyecto.
  Archivos: portal, middleware y pruebas (4); depende de E.
- [x] G. Integración con handlers y Auth/PostgREST real local, dos sesiones y
  conflicto concurrente. Script y prueba de seguridad (2); depende de C.
- [x] H. Navegador: crear/asignar/editar/recargar, fallo recuperable y móvil;
  suite completa, revisión y evidencia en docs (máximo 3); depende de E–G.

No hay build/lint. Comando común: Node `scripts/run-legacy-tests.cjs` con
archivos concretos durante RED/GREEN y suite completa en los checkpoints.
No cerrar otros módulos ni publicar hasta verificar este incremento.

Cierre del consumidor: 115/115 archivos JavaScript, 116 SQL, 24 comprobaciones
HTTP y 68 Auth/PostgREST. Pruebas de navegador con sesiones sintéticas, no con
Janna. Revisado independientemente; no desplegado ni aplicado remotamente.

## Historial del incremento de esquema

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
- [x] Organizador por proyecto conectado y verificado en el incremento superior.
- [ ] Aplicación remota/despliegue, importación RSVP, QR, álbum y pagos siguen pendientes.

Evidencia de cierre: 116 pruebas SQL (106 nuevas + 10 existentes), 68 comprobaciones
Auth/PostgREST, 111/111 archivos JavaScript; instalación desde cero y asesores
locales sin advertencias/errores. Revisión independiente aprobada tras corregir
la comprobación de limpieza. Ningún dato remoto o publicación alterado.

## Integración selectiva de New-Invitta

- [x] Contenido por evento: boda, XV y otros sin textos cruzados cuando falta
  personalización; conservar textos propios. Verificar prueba enfocada y suite.
- [x] Título Stardust editable y seguro, con respaldo actual si queda vacío;
  comprobar recorrido Studio → documento → presentación pública en pruebas.
- [x] Navegador local y revisión del incremento antes de publicar código.
- [ ] Aprobación humana y publicación del bloque de contenido en vista previa.
- [ ] Firebase: revisar configuración/rutas/reglas y autorización por proyecto
  antes de implementar cargas remotas. No tocar invitaciones reales como prueba.
