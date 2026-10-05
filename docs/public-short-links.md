# Enlace corto de Mara y Fer

La ruta `/mara-y-fer` redirige temporalmente (307) a la invitación pública
existente `p-1f4e41cc-a44a-41f3-b82e-bbd57d0f66bc` en el mismo dominio.
La dirección corta es para compartir; al abrirla el navegador muestra la ruta
de entrega original. WhatsApp controla la presentación de su mensaje: no se
promete ocultar el enlace ni cambiar tarjetas de mensajes ya enviados.

Se utiliza `invitta-enlaces.vercel.app`, un dominio separado de Vercel asociado a
`preview/invitta-cloud-client-flow`, sin promover ni sustituir producción.
El dominio fue aceptado y verificado por Vercel. La asociación a rama
permite que las siguientes publicaciones de código actualicen ese dominio.

No se copian invitaciones: se lee la revisión publicada existente desde el
mismo flujo público. Fotos, música, nombres, horarios, RSVP, contactos y datos
privados no se modifican ni se añaden a Git. Studio y las API privadas
conservan sus comprobaciones de sesión/permisos; ningún bypass de la app.
El enlace largo anterior y el de Janna siguen con sus rutas originales.

Verificación: `node scripts/run-legacy-tests.cjs test-public-short-link.cjs`,
suite completa y comprobación real de respuesta 307, destino, metadatos de
WhatsApp e invitación, en ambos enlaces. No enviar mensajes de prueba reales.

Pruebas locales: contrato nuevo RED antes de agregar la ruta y GREEN después;
126/126 archivos de pruebas aprobados. Auditoría de dependencias de producción:
0 vulnerabilidades reportadas. No hay cambios de dependencias.

Despliegue f1c08b8642692cd4a37cdd1bcdd7557d1b55f2bd:
`dpl_7GVJA2H5YUvzByZYd8sybLzGbdVy` READY, ambos alias de vista previa
asociados. Inicialmente el dominio nuevo devolvía 302 al acceso de Vercel.
Tras autorización expresa «AUTORIZO», se añadió una excepción de protección
únicamente para `invitta-enlaces.vercel.app` desde el panel de Vercel.
La autenticación estándar del proyecto permaneció activada y la excepción
anterior permaneció intacta. No se creó secreto de automatización.

Entrega verificada sin credenciales: ruta corta 307 al slug original, página
200 con título/imagen de Mara y Fer; foto de tarjeta 200 image/jpeg.
`/api/projects/list` y `/api/session` devuelven 401 sin sesión; Studio 302
al login del portal. El enlace largo anterior sigue devolviendo 200.
En navegador: iniciales M / & / F y textos de apertura; clic abre la invitación,
foto principal y nueve fotos cargadas, nueve marcos de papel, música sin error
y reproduciendo. No hay enlaces al editor/portal dentro de la invitación.
Sin errores capturados en el tab de entrega; no se afirma ausencia de avisos
previos del sitio. No se envió RSVP ni mensaje de WhatsApp de prueba.
Captura: ta/.cache/mara-short-link-ready.jpg, fuera de Git. La prueba visual
se realizó en el tamaño real 1280x720; el intento de override no lo cambió
y se restableció al finalizar. Registro documental local posterior a entrega;
el código desplegado continúa en f1c08b8, sin otro despliegue necesario.

Rollback: revertir sólo el commit de esta ruta y desplegar en la rama de vista
previa. Conservar el enlace largo; no borrar datos ni historial en Supabase.
Si se desasocia el dominio corto, los enlaces cortos enviados dejarán de
funcionar; preferir mantener la asociación y corregir el destino.
