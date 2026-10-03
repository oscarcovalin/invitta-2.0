# Especificación: boletos de emergencia e ingreso por proyecto

Estado: alcance aprobado por el usuario el 2026-10-02. Implementación y pruebas
locales autorizadas sin confirmaciones intermedias; activación remota excluida.
Módulo: `door-scanner-sync` del mapa existente. Depende del organizador por
proyecto ya activado; no depende de importar RSVP ni de terminar el álbum.

## Alcance aprobado

- Primera entrega online: sin servidor disponible no se confirma admisión.
  Realtime y operación offline no forman parte de este corte.
- Dueño del proyecto y planner pueden emitir boletos. Dueño, planner y hostess
  con membresía explícita pueden consultar y registrar entradas de ese proyecto.
  Ninguna cuenta recibe un rol nuevo automáticamente.
- Se permiten ingresos parciales: una familia con cuatro pases puede entrar
  en dos grupos de dos. El saldo acumulado nunca puede superar cuatro.
- Boleto de emergencia válido durante 24 horas desde emisión, revocable; no
  supone publicar o editar una invitación. El ingreso inmediato es opcional y
  debe requerir decisión explícita, no quedar marcado por defecto.
- Pruebas e implementación primero locales, con datos sintéticos. Aplicación
  remota y despliegue requieren revisión separada. Janna no se modifica.

## Objetivo

Desde la tarjeta de un proyecto, emitir un boleto real, mostrar un QR que pueda
leer otra sesión autorizada y confirmar entradas en Supabase. Un QR desconocido,
alterado, vencido, revocado o de otro proyecto nunca crea un invitado ni autoriza
personas. El nombre o un folio legible no son una credencial de acceso.

## Diagnóstico reproducido

`generador-emergencia.html` y `scanner-acceso.html` instancian `GuestManager`
sin proyecto. Usan almacenamiento local y datos de ejemplo. El escáner crea
un invitado automáticamente si no encuentra el QR, tomando pases del payload.
`syncOfflineCheckins()` simula espera, no llama al servidor y marca éxito.

Prueba aislada en memoria el 2026-10-02, sin credenciales ni datos reales:
emitir tres pases → registrar tres → volver a registrar tres devuelve éxito
las dos veces y crea dos logs. Otro dispositivo no encuentra el invitado.
La sincronización marca ambos logs sincronizados con cero solicitudes de red.
Las cuatro suites heredadas de invitados/ciclo de vida/acceso/roles pasan:
por tanto no cubren estas garantías, aunque su nombre diga E2E.

## Contrato funcional y de datos

- Siempre `project` UUID explícito; nada de elegir por nombres, `event` heredado
  o la última invitación abierta. La ausencia del proyecto no inicia una demo.
- Alta atómica: crear invitado de emergencia en `invitation_guests` y su boleto;
  si se solicita entrada inmediata, registrar esa admisión en la misma transacción.
- Mesa opcional, existente en el mismo proyecto. Pases 1–20 en este formulario;
  nombre 1–160 caracteres. No guardar teléfono, correo, dietas o notas en este corte.
  Se mantiene el significado de pases del organizador y su control de versión.
- Registros privados de boletos y operaciones de admisión, vinculados por FK al
  proyecto/invitado. UUID de operación estable, actor verificado, fecha del servidor,
  cantidad admitida y resultado. No guardar payloads, IPs o tokens en los logs.
- El QR transporta una credencial HMAC del servidor con identidad del
  boleto/proyecto; el vencimiento de 24 horas lo decide y valida la base, no
  el contenido del QR. No contiene una cantidad de pases autoritativa.
  Firma con clave independiente del servidor, sin valor por defecto. Validar
  contra el registro emitido y su revocación incluso cuando la firma es válida.
- La credencial debe poder reconstruirse para un reintento autorizado del mismo
  alta sin emitir otro boleto. No imprimirla en consola ni exponerla en listados
  genéricos. Fallar cerrado si falta la clave; fixtures usan una clave sintética.
- Enlace de boleto público sólo para quien posee esa credencial: datos mínimos
  de su boleto, sin Studio, portal, listas, otros invitados ni credenciales de sesión.
  No cambiar la URL pública de ninguna invitación ni enviar WhatsApp automáticamente.
- Bloqueo transaccional por invitado para resolver dos escáneres concurrentes y
  cambios de pases. Una reducción de pases por debajo de lo admitido se rechaza.
  No permitir actualizar directamente el saldo, actor o contador vía Data API.
- Una operación idéntica repetida devuelve el resultado anterior sin sumar otra
  entrada; mismo UUID con intención distinta es conflicto. Un ingreso parcial
  posterior legítimo usa otra operación explícita y sólo consume el saldo restante.
- Revocar impide nuevas entradas, pero no borra ni devuelve admisiones previas.
  No hay función de anular ingresos ya confirmados en este primer corte.
- Tras timeout, conservar la operación e intentar verificar su resultado; no
  crear otro UUID ni mostrar éxito. Sin resultado confirmado, detener nuevas altas
  o admisiones dependientes. Sin red no hay semáforo verde ni sincronización ficticia.

## Límite de confianza y API

Extender el dispatcher actual, no crear otra función Vercel independiente.
Todas las operaciones privadas usan la sesión Supabase renovable y JWT del
usuario; pertenencia por proyecto, nunca `user_metadata`, query `role` o una
clave privilegiada en navegador. Cookies de escritura exigen origen propio.

Rutas concretas: POST `/api/projects/passes`, acciones context/issue/inspect/admit/revoke;
POST `/api/public/pass` para lectura mínima por credencial. Contrato exacto y
evidencia local en `docs/decisions/0005-project-door-passes.md`.
Errores conservan `{ success: false, code, error }` con 401/403/404/409/422/502/503.
Sin errores internos, tokens o datos de otros invitados en respuestas.

Funciones de base deben validar permisos también en PostgREST directo. Cualquier
privilegio necesario para escribir logs/contadores se limita a una función
privada revisada, con `search_path` fijo y comprobación explícita de actor,
proyecto, boleto e intención. Sin INSERT/UPDATE libre a los contadores, sin
EXECUTE anónimo de admisión y sin usar SECURITY DEFINER para ocultar permisos rotos.

## Abuso y pruebas de aceptación

1. Dueño emite en proyecto A; otra sesión de puerta de A reconoce el mismo QR.
2. Dueño/planner autorizados; hostess no emite por defecto. Designer/catering/viewer,
   anónimo y miembros de B no pueden emitir o registrar ingresos de A.
3. QR fabricado, antiguo JSON manipulable, nombre parecido, token alterado,
   expiración y revocación se rechazan sin altas o logs de admisión.
4. Cuatro pases: 2 + 2 permitidos; otra entrada rechazada. Dos peticiones por
   el último pase sólo producen un ganador, también desde PostgREST directo.
5. Doble click/reintento misma operación: una fila/una suma. Mismo id distinto
   cuerpo se rechaza; el registro de actor viene de Auth, no del formulario.
6. Carrera emisión/reintento, admisión/revocación y reducción de pases:
   resultados consistentes; saldo no negativo ni superior a autorización.
7. Timeout después del commit: verificar/repetir recupera resultado sin duplicar.
   Fallo previo no aparece confirmado. UI conserva intención y bloqueo.
8. Lectura mínima del boleto no da acceso al editor o administración. No se
   añaden invitados, tokens o logs a la proyección pública de la invitación.
9. QR generado se decodifica con la biblioteca real; escáner acepta ese contenido.
   Verificar también ingreso manual de la credencial sin solicitar cámara.
10. Navegador móvil, formulario accesible, botones bloqueados mientras guardan;
    permiso de cámara sólo al pulsar e iniciarlo el usuario. La cámara física
    requiere una comprobación separada, no se declara probada por un fake.

## Stack, estructura y estilo

HTML/JS del proyecto, Node/CommonJS en `lib/*.cjs`, dispatcher `api/index.js`,
PostgreSQL 17 y Auth/PostgREST Supabase. `jose` ya existe para firma; no instalar
dependencias sin revisar. UI separada por proyecto: no reutilizar la cola local
de `GuestManager` como autoridad ni importar sus demos a Supabase.

Archivos esperados por fases: `lib/`, `api-handlers/projects/`, `src/`, páginas
del generador/escáner, middleware y enlaces de tarjeta; migración creada por CLI
en `supabase/migrations/`, pgTAP en `supabase/tests/`, suites `test-*.cjs` y arnés
de Auth/PostgREST local bajo `scripts/`. No archivos personales en Git.

Estilo compatible:

```js
if (!Number.isInteger(count) || count < 1) {
  throw new OperationError(422, 'INVALID_INPUT', 'Revisa la cantidad de entradas.');
}
// La base, no este contador de la UI, decide cuántos pases quedan.
```

## Comandos y estrategia de verificación

RED/GREEN primero, casos de abuso y concurrencia en PostgreSQL real. Auth/JWT
y PostgREST directos con usuarios sintéticos; integración HTTP, dos sesiones y
QR real en navegador. Mocks solamente en límites de fallo, no para probar la
atomicidad de la base. El arnés local rechaza proyectos enlazados/remotos y
verifica limpieza por UUID. No usar registros reales para probar duplicación.

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/run-legacy-tests.cjs test-guest-manager.js test-e2e-full-lifecycle.js test-access-control-suite.js test-role-security-suite.js
& 'C:\Program Files\nodejs\node.exe' scripts/run-legacy-tests.cjs
git -c core.whitespace=cr-at-eol diff --check
```

Sin build/lint definidos en el proyecto. Comandos CLI locales y nombres de
suites nuevas se fijan en el plan tras consultar `--help`, no se inventan aquí.

## Límites y lanzamiento

- Siempre: pruebas, permisos por proyecto, RLS, decisiones atómicas, sin secretos
  ni datos privados en logs, revisión independiente y reversión preservando datos.
- Aprobar antes: cambio de roles/permisos, esquema de boletos/admisiones, clave
  nueva de firma, dependencias y aplicación remota/despliegue.
- Nunca: modificar Janna, aceptar un QR desconocido creando personas, confirmar
  sin servidor, borrar datos reales, enviar mensajes o debilitar acceso a Studio.
- Conservar el código/datos heredados, pero no ofrecerlos como puerta verificada
  para proyectos nuevos. Revisar compatibilidad de boletos anteriores; no
  considerarlos credenciales nuevas por su formato o nombre.
- Datos de ingreso son privados y sólo para control de acceso/auditoría. Antes
  del uso remoto se debe aprobar retención y una eliminación/exportación operativa;
  no añadir purga automática o almacenamiento de contactos silenciosamente.

Fuentes de diseño: [funciones y privilegios de Supabase](https://supabase.com/docs/guides/database/functions),
[bloqueos de filas PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).
Changelog Supabase revisado: el aviso de PostgreSQL 17.11 afecta ltree/cifrados
legados/btree_gist/operadores personalizados; este contrato no usa esos elementos.

## Próximo punto de revisión

Aprobar este alcance y sus supuestos. Después: plan/tareas pequeños y contrato
de API/SQL concreto, implementación local y pruebas, revisión de seguridad y
entrega; sólo entonces decidir activación en Supabase/Vercel. Si se aprueba
avanzar sin confirmaciones locales intermedias, respetar ese alcance y comunicar
resultados sin volver a solicitar cada paso rutinario.
