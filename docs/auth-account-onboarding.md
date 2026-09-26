# Alta y habilitación de cuentas profesionales

El alta pública crea una identidad `member`, no concede acceso a eventos ni rol administrativo. La edición de roles de proyecto y sus permisos sigue dependiendo de las membresías y políticas RLS existentes.

## Preparación (sólo Preview)

En Vercel → proyecto `invitta-2-0` → Settings → Environment Variables, añade estas variables con alcance **Preview** únicamente:

| Variable | Valor / uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto de desarrollo Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable de ese mismo proyecto. No es una clave secreta. |
| `INVITTA_AUTH_REDIRECT_URL` | URL HTTPS exacta de Preview más `/portal.html`, preferiblemente el alias estable de la rama del PR. No uses el dominio de producción. |
| `SUPABASE_SECRET_KEY` | Clave secreta del proyecto de desarrollo Supabase. Sólo la usa el servidor para enviar invitaciones. Nunca la pongas en el navegador, en una variable `NEXT_PUBLIC_*`, ni en Git o chat. |

Después de añadir variables, crea un nuevo deployment Preview. Las funciones de invitación responden 503 sin la clave secreta y nunca degradan a la clave publicable.

En Supabase → Authentication → URL Configuration:

1. Configura Site URL en el mismo origen HTTPS de Preview aprobado para los enlaces de autenticación.
2. Añade `INVITTA_AUTH_REDIRECT_URL` como redirect URL permitida exacta.
3. Mantén habilitado el registro por email y la confirmación de correo. Configura un proveedor SMTP propio antes de depender del envío a clientes; los límites del correo de prueba pueden ser restrictivos.

No añadas un comodín amplio como `*.vercel.app`: limita la lista al alias Preview elegido y revisa que no se permita redirigir a producción por error.

## Habilitar la cuenta de administrador inicial

1. Abre el deployment Preview, entra al portal profesional y elige **Crear cuenta profesional**.
2. Registra `opl2@yahoo.com` con una contraseña única de al menos 12 caracteres.
3. Abre el correo de Supabase y confirma la dirección. El enlace debe volver al dominio Preview configurado.
4. En Supabase → Authentication → Users, comprueba que la cuenta confirmada corresponde a `opl2@yahoo.com`.
5. Desde el mecanismo administrativo confiable de Supabase, asigna a esa cuenta `app_metadata.platform_role = platform_admin`. No uses `user_metadata`, una variable con correo allowlist, ni el formulario público para otorgar ese rol.
6. Inicia sesión en Preview. El servidor verifica los metadatos de Auth y habilita el panel administrativo.
7. Comprueba que una cuenta distinta sólo obtiene rol `member`.

## Dar de alta otra cuenta

- Para que alguien se registre por sí mismo, usa **Crear cuenta profesional**. La persona confirma su correo y luego inicia sesión. Eso sólo crea su identidad global.
- Para invitar desde administración, usa el panel de cuentas del portal. El servidor vuelve a verificar la sesión y el rol admin con Supabase antes de llamar Auth Admin. La persona invitada debe aceptar el correo y establecer su contraseña.
- Crear una cuenta no la agrega automáticamente a un evento o Studio. Un administrador debe asignarle la membresía de Studio/proyecto correspondiente; hasta entonces no debe tener acceso a los datos del evento.

## Límites conocidos

- La invitación administrativa requiere `SUPABASE_SECRET_KEY`; su configuración se hace directamente en Vercel, no en el repositorio. El primer administrador debe habilitarse en Supabase Dashboard; Invitta no incorpora una puerta trasera o autoalta de administrador.
- La URL de confirmación/recuperación debe ser idéntica a una URL permitida por Supabase. El código acepta los enlaces de token enviados por Supabase y guarda la sesión en cookies `HttpOnly`.
- Esta guía y los cambios de código no activan registro, SMTP, ni variables en el proyecto remoto por sí solos. Antes de producción, repetir una configuración independiente con dominios y secretos de producción y verificar el flujo end-to-end.
