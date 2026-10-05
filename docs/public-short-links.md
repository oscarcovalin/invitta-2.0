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
conservan sus comprobaciones de sesión/permisos; ningún bypass nuevo.
El enlace largo anterior y el de Janna siguen con sus rutas originales.

Verificación: `node scripts/run-legacy-tests.cjs test-public-short-link.cjs`,
suite completa y comprobación real de respuesta 307, destino, metadatos de
WhatsApp e invitación, en ambos enlaces. No enviar mensajes de prueba reales.

Pruebas locales: contrato nuevo RED antes de agregar la ruta y GREEN después;
126/126 archivos de pruebas aprobados. Auditoría de dependencias de producción:
0 vulnerabilidades reportadas. No hay cambios de dependencias.

Rollback: revertir sólo el commit de esta ruta y desplegar en la rama de vista
previa. Conservar el enlace largo; no borrar datos ni historial en Supabase.
Si se desasocia el dominio corto, los enlaces cortos enviados dejarán de
funcionar; preferir mantener la asociación y corregir el destino.
