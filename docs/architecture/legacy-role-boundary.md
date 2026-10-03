# Límite de confianza de roles heredados

## Hallazgo

El rol de algunos módulos heredados todavía puede venir de `?role=...` o de `localStorage` (`role-manager.js`). Esos controles visuales no son autorización ni garantizan aislamiento de datos. Studio ya no carga ese gestor: `?role=designer`, `?role=planner`, `edit=true` y `unlock=true` no desbloquean la edición en nube, y el botón de verificación consulta `/api/session` sin guardar un rol local. La interfaz puede explorarse sin sesión sólo como diseño local; las escrituras en nube siguen protegidas por el servidor.

La prueba `test-role-permissions.js` comprueba principalmente nombres y fragmentos de HTML; no demuestra por sí sola que una persona sin permiso no pueda editar o leer otro proyecto. Se reemplazó su expectativa textual antigua (`role === 'designer'`) por la ausencia del desbloqueo por URL, y `test-studio-session-boundary.cjs` comprueba las transiciones de sesión. La verificación de permisos de proyecto sigue requiriendo las pruebas de API/RLS y, antes de producción, una comprobación en navegador.

## Límite vigente en el flujo nuevo

Las rutas de guardar, revisar y marcar una revisión en nube exigen una sesión del servidor y operan con el JWT del usuario. Las políticas RLS de proyectos/documentos determinan el permiso efectivo; el rol en URL o `localStorage` no se envía como autorización. Esta protección no se extiende automáticamente al editor local, sus exportaciones HTML ni a datos de demostración empaquetados en JavaScript.

## Criterio de cierre

Antes de tratar Studio como editor protegido: probar en Preview con navegador y API que un usuario sin sesión o sin rol de proyecto no puede guardar ni publicar. No modificar RLS para acomodar un rol suministrado por el cliente. El selector global de eventos ya fue restringido a una sesión de administrador comprobada por `/api/session`, pero eso sólo corrige la interfaz: los datos heredados precargados en el cliente siguen siendo públicos para quien descargue el código.
