# Galería con papel rasgado (2026-10-04)

Added: Studio permite elegir «Papel rasgado con borde blanco» en Galería.
Se conserva en `photos.galleryFrame` y viaja por los adaptadores de documento
y presentación pública existentes. Ausente/desconocido conserva el marco
original; ninguna invitación cambia automáticamente.

El borde usa una máscara vectorial local de contorno irregular y fibras,
compatible con mask y -webkit-mask. No altera fotos ni añade dependencias.
Fotos con proporción natural, sin el recorte extra del parallax original;
en motores sin máscara queda un borde blanco recto. No añade carrusel,
hashtag, texto o fondo de la referencia del cliente.

Verificación: prueba RED por ausencia de marcos; GREEN de render, opt-in,
documento/presentación pública y control de Studio. Suite 124/124 archivos;
sintaxis de app/engine y diff --check correctos. Navegador con presentación
pública en memoria, sin escrituras: 10 marcos a 320/768/1024/1440 px reales
en iframe, sin desbordes y proporciones conservadas. Las diez fotos cargaron
en la prueba de 768 px. No equivalen a pruebas en teléfono/Safari físico.

Avisos del navegador: Tailwind CDN ya pertenece a la plantilla existente.
También apareció un MutationObserver sin URL (observado antes en el harness
de puerta); origen pendiente, no se afirma consola limpia. No se añadió ningún
MutationObserver a este incremento. No ampliar esta corrección a cambios de
infraestructura o bibliotecas sin revisión separada.

Revisión de alcance: sólo app.js, invitacion-estudio.html, template-engine.js
y prueba/documentación. Ningún SQL, secreto, foto, audio o dato de invitación
en el commit. Base publicada eec9cd4; avances de puerta guardados en su rama
feature/event-pass-validity, fuera del despliegue.

Entrega: verificar despliegue READY, cargar el proyecto en Studio, elegir el
marco, guardar una revisión y publicarla con el flujo existente. Confirmar
en el enlace público los marcos y el Liverpool solicitado; mantener URL,
horarios, música, RSVP y demás invitaciones intactos.

Entrega completada: d615e713 publicado en preview/invitta-cloud-client-flow;
Vercel dpl_AWBKuW7cNvWkXigX1tuk88DASFhE READY. Mara y Fer
(1f4e41cc-a44a-41f3-b82e-bbd57d0f66bc) guardada/publicada en revisión 5
por Studio. API pública: únicamente galleryFrame y normalización de fecha
difieren de revisión 4. Fecha anterior 2026-11-14T18:00 con offset -06:00;
nueva 2026-11-14T18:00:00-06:00: mismo horario e instante local.
Calendario conserva 20261115T000000Z/20261115T073000Z; misa 6 pm,
recepción 7 pm. Liverpool ya era correcto y se conserva en /51981370.
Navegación pública real: diez marcos, diez imágenes cargadas, máscara activa;
captura ../.. fuera del repositorio: ta/.cache/mara-paper-public-proof.png.
No errores capturados en ese tab público; el aviso local anterior sigue sin
diagnóstico y no forma parte de esta entrega. URL y restantes campos intactos.

Rollback visual: elegir «Recto (original)», guardar y publicar nueva revisión;
no eliminar fotos ni historial. Rollback de código: volver al despliegue previo
eec9cd4 (no requiere deshacer datos ni cambiar el enlace público).
