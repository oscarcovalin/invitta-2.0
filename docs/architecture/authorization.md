# Autorización de INVITTA Unified

La autoridad se decide en servidor y RLS. Parámetros URL, `localStorage`, etiquetas visuales y campos enviados por el cliente nunca conceden permisos.

## Capas de identidad

| Capa | Roles | Alcance |
|---|---|---|
| Plataforma | `platform_admin` | Operación global excepcional y auditable |
| Studio | `studio_owner`, `studio_manager`, `studio_member` | Facturación, equipo y proyectos de un Studio |
| Proyecto | `project_owner`, `planner`, `designer`, `hostess`, `catering`, `viewer` | Un proyecto de evento |
| Invitado | capacidad opaca y revocable | Un invitado y acciones RSVP concretas |

## Matriz mínima

| Acción | Owner | Planner | Designer | Hostess | Catering | Viewer |
|---|---:|---:|---:|---:|---:|---:|
| Leer proyecto | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editar contenido del evento | ✓ | ✓ | — | — | — | — |
| Editar diseño | ✓ | — | ✓ | — | — | — |
| Publicar una revisión | ✓ | — | — | — | — | — |
| Gestionar invitados y mesas | ✓ | ✓ | — | acceso | lectura táctica | — |
| Registrar acceso | ✓ | ✓ | — | ✓ | — | — |
| Ver teléfonos | ✓ | ✓ | — | mínimo necesario | — | — |
| Ver hoja de catering | ✓ | ✓ | — | — | ✓ | — |
| Gestionar miembros | ✓ | — | — | — | — | — |

`project_owner` representa a los anfitriones propietarios del evento. `studio_owner` no hereda acceso ilimitado a todos los proyectos: debe existir membresía o una operación administrativa auditada.

## Reglas de implementación

1. Cada fila operativa lleva `project_id`; las políticas verifican membresía activa.
2. Las acciones sensibles usan permisos explícitos, no comparaciones dispersas de nombres de rol.
3. Los enlaces de invitado contienen un token aleatorio cuyo hash se guarda en servidor; son revocables y expiran.
4. La invitación pública sólo expone la revisión publicada y activos públicos deliberados.
5. Las funciones privilegiadas fijan `search_path`, tienen grants mínimos y escriben auditoría.
6. El modo offline puede capturar operaciones pendientes, pero no confirma acceso, RSVP o publicación hasta reconciliar con el servidor.

## Sesión profesional durante la migración

- Supabase Auth valida correo y contraseña; ya no existen contraseñas profesionales en variables de entorno ni tokens aleatorios locales.
- El navegador recibe access y refresh tokens únicamente como cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- La UI sólo conserva en memoria una vista pública de la sesión (`userId`, correo y rol de plataforma). Al recargar, `/api/session` verifica el access token con Supabase y rota el refresh token cuando corresponde.
- Las APIs de proyectos, activos privados, confirmaciones e invitaciones profesionales usan `resolveRequestSession`: verifican el access token y, si falta o Supabase lo rechaza como credencial, renuevan la sesión con la cookie de refresh. La operación recibe el JWT renovado del usuario y conserva las mismas políticas RLS; renovar no concede permisos adicionales.
- La entrada profesional a Studio utiliza el mismo límite de sesión. Al renovarla devuelve una redirección temporal a la misma URL con las cookies rotadas, conservando el identificador de proyecto. No sustituye los controles de permisos de las APIs. Los demás módulos mantienen su acceso heredado hasta su migración explícita.
- Un fallo de red, configuración, respuesta mal formada, límite de solicitudes o error del proveedor no equivale a una sesión revocada: bloquea la operación con 502/503 sin borrar cookies ni repetir una escritura. Una renovación rechazada como credencial devuelve 401. Las peticiones de verificación y renovación no se almacenan en caché ni siguen redirecciones.
- En el portal, `AuthManager.getSessionStatus()` distingue verificación, autenticación, sesión ausente e indisponibilidad. Durante verificación o indisponibilidad, `getCurrentSession()` no conserva autoridad efectiva; la UI muestra reintento, no un logout ficticio. La comprobación usa cookies same-origin, no-store y timeout de 15 segundos. Las respuestas anteriores a logout/login no restauran el estado visual. Esto no reemplaza validación del servidor ni prueba revocación remota.
- Sólo `app_metadata.platform_role = platform_admin` concede administración de plataforma. `user_metadata`, parámetros URL y Storage no son autoridad.
- Esta decisión obliga a que las operaciones autenticadas pasen por endpoints del servidor. No se debe añadir un cliente Supabase directo en el navegador mientras los tokens sigan siendo `HttpOnly`.
- Los roles de proyecto se resolverán desde membresías y RLS; el rol global `member` no concede acceso a ningún proyecto por sí mismo.

El primer endpoint que aplica este contrato es `POST /api/projects/save-revision`: verifica la cookie profesional con Supabase y reenvía la escritura a PostgREST usando el JWT del usuario. La política `invitation_documents_insert` limita la operación a `project_owner`, `planner` o `designer`; el servidor no usa una clave de servicio ni puede saltarse RLS.

`POST /api/projects/publish-revision` usa el mismo límite de confianza, pero la política de actualización permite publicar exclusivamente a `project_owner`. Una respuesta vacía de PostgREST se trata como denegación y no como éxito para evitar que un recurso inexistente o invisible se reporte como publicado.

`GET /api/projects/latest-revision?projectId=<uuid>` recupera la última revisión visible con el JWT del usuario y `Cache-Control: no-store`. RLS impide leer documentos de otros proyectos; una respuesta vacía se presenta como 404 sin revelar si existe un proyecto ajeno.
