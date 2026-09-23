# Inventario de datos para la invitación pública

Este inventario delimita la futura entrega por `slug`. Hay una proyección parcial de datos y un manifiesto interno de imágenes, pero ninguno concede acceso público ni constituye todavía un artefacto renderizable. Complementa [ADR-0002](../decisions/0002-public-invitation-by-slug.md).

## Estado del contrato

`TemplateEngine.defaultConfig` tiene 54 campos de primer nivel. El adaptador actual traslada 12 de ellos, total o parcialmente, a `event`, `content`, `design`, `sections` o `assets`; los otros 42 sólo sobreviven dentro de `legacy.config`. Incluso `ceremony` y `reception` sólo trasladan sus imágenes a `assets`: sede, dirección y hora permanecen en `legacy`. Por eso eliminar `legacy` de una respuesta pública sin evolucionar el contrato cambiaría visiblemente la invitación.

Studio no incluye `sectionOrder` en su configuración predeterminada. Para revisiones nuevas sin ese campo, el adaptador infiere únicamente las secciones conocidas por el candidato público y sus indicadores de visibilidad; un orden explícito existente conserva su semántica. Este respaldo evita un artefacto sin secciones, pero no traslada todavía todas las secciones visuales del motor heredado.
Las revisiones ya guardadas con `sections: []` no se reescriben: el propietario debe guardar una revisión nueva antes de intentar publicar su contenido. No se debe inferir secciones al leer documentos antiguos, porque eso cambiaría retrospectivamente una revisión publicada.
El constructor de publicación rechaza una revisión sin secciones habilitadas, tanto en la vista previa privada como al publicar. Esta protección evita marcar como publicable una revisión antigua vacía; no sustituye la comprobación visual de una invitación completa.

## Clasificación

| Grupo | Campos actuales | Tratamiento para una entrega pública |
| --- | --- | --- |
| Identidad y celebración | `eventType`, `name`, `brideName`, `groomName`, `nameConnector`, `monogram`, `eyebrow`, `welcomeMessage`, `quote`, `story`, familia, padrinos y corte | Contenido visible al invitado; copiar sólo las propiedades que renderiza cada sección habilitada. Revisar nombres de menores antes de publicar. |
| Fecha, lugar y programa | `eventDateISO`, `timezoneOffset`, etiquetas de fecha, `ceremony`, `reception`, `itinerary`, `lodging`, cuenta regresiva | Público cuando la sección está habilitada. Direcciones, horarios y códigos de hotel deben ser revisados por quien publica. |
| Apariencia | `theme`, `typography`, `decorations`, `sectionBackgrounds`, `familyStyle`, `waxSeal`, `illustrations`, `stardust`, `dressCode` | Sólo valores visuales validados; nunca copiar objetos arbitrarios ni archivos incrustados. Las fuentes y fondos deben tener una ruta de activo publicada. |
| Medios | `photos`, `music`, imágenes de ceremonia y recepción, logo de `vendorCard` | Publicar únicamente los activos referenciados por la revisión aprobada. No hacer público el bucket privado completo. Validar URLs externas y formatos. |
| Interacción pública | `instagram`, texto de `rsvp`, `rsvpTitle`, `rsvpDeadlineLabel`, `sharedAlbum.title/subtitle/description/albumUrl`, textos de WhatsApp y `vendorCard` | Mostrar texto y enlaces aprobados; los formularios deben llamar a endpoints separados, con sus propios controles. |
| Proyección ya clasificada | `story.title/subtitle/text` y título/plazo de `rsvp` | Se copian únicamente cuando la sección respectiva está habilitada. Se excluyen foto de historia (la gestiona el manifiesto de imágenes), webhook, respuestas y propiedades adicionales del objeto heredado. No implica que exista aún un renderizador público final. |
| Datos públicos confirmados al publicar | `giftRegistry.bank` (titular/CLABE), `whatsappNumber`, `whatsappHosts`, `lodging.hotels[].code`, `sharedAlbum.accessCode` | El propietario confirmó su exposición a quien tenga el slug. Incorporar sólo estas propiedades a la proyección de la revisión publicada, si la sección correspondiente está habilitada; revisar los valores antes de publicar. Los teléfonos dependen de RSVP habilitado, incluidos sus indicadores heredados. Nunca exponer el objeto de origen completo. |
| Dato pendiente de clasificación | `defaultPassCount` | No trasladar al artefacto público hasta distinguir el cupo genérico de pases o asignaciones individuales. |
| Nunca en el artefacto público | `rsvpWebhookUrl`, `legacy.config` íntegro, IDs de propietario y membresía, borradores, sesiones, tokens, listas y respuestas de invitados, folios, PIN y asignaciones de mesa | Mantener en APIs y tablas privadas. No devolverlos en JSON, HTML embebido ni enlaces de activos. |

## Hallazgos que bloquean la publicación automática

1. El contenido de ejemplo de `defaultConfig` incluye nombres, teléfonos, cuenta bancaria, códigos de hospedaje y código de álbum. Una invitación recién creada puede conservar esos ejemplos. Antes de activar una URL pública debe haber una revisión de datos de muestra, no sólo `status = 'published'`.

La vista previa de contenido ahora rechaza la revisión si la proyección contiene valores exactos de ejemplo de Studio para nombres, titular/CLABE, teléfonos y códigos. La respuesta pública sigue siendo un 404 genérico: las rutas de los campos detectados sólo se conocen al ejecutar el chequeo de forma privada. Esto reduce publicaciones accidentales de ejemplos conocidos, pero no detecta ejemplos modificados ni sustituye la aprobación editorial.
La ruta de imágenes de Preview aplica el mismo chequeo antes de leer Storage, para que una revisión rechazada no entregue sus fotos por separado.
2. El motor visual lee muchos campos de `legacy.config`, incluidos campos sensibles. No debe recibir ese objeto bruto en una ruta anónima. Se necesita una proyección explícita o un renderizado servidor que no incluya datos internos en el resultado.
3. El RSVP, pases, mesa y álbum pueden requerir datos específicos por invitado. Un slug público no debe convertirse en autorización para leerlos; sus endpoints y enlaces necesitan límites propios.
4. El bucket `invitation-assets` es privado. Mostrar una imagen en la invitación pública exige una copia aprobada o una ruta que compruebe que el archivo pertenece a la revisión publicada.
5. El manifiesto interno sólo acepta imágenes privadas de la misma carpeta de proyecto para portada, retrato, sedes, galería, historia y fondos de secciones habilitadas. También acepta una lista cerrada de imágenes estáticas incluidas con el sitio; otras rutas `assets/...` y referencias visuales todavía necesitan clasificación explícita. No conectar este manifiesto a una respuesta anónima tal como está.
6. Las URL firmadas de Storage tienen vigencia propia y no pueden revocarse individualmente de inmediato según la [documentación de Supabase](https://supabase.com/docs/guides/storage/serving/downloads). Si despublicar debe cortar el acceso al instante, no deben ser el mecanismo principal sin una política de caducidad y revocación aceptada.
7. La ruta de imagen `/api/public/image?slug=...&field=...` está deshabilitada por defecto. Incluso en Preview requiere una clave secreta sólo del servidor, `INVITTA_PUBLIC_ASSETS_ENABLED=1` y un único `INVITTA_PUBLIC_ASSET_PREVIEW_SLUG`. Comprueba la revisión publicada antes y después de leer la imagen y no sirve archivos de borradores ni rutas arbitrarias. No habilitarla en producción hasta crear el artefacto público y probarla con un proyecto aislado: el estado `published` existente no representa por sí solo aprobación de exposición pública.

## Criterios para el siguiente incremento

- Definir el esquema público con lista permitida hasta nivel de propiedad, sin `legacy` ni datos operativos.
- Probar con valores trampa que ningún campo excluido aparece en JSON o HTML público.
- Exigir revisión previa de los valores bancarios, teléfonos y códigos, especialmente los ejemplos de `defaultConfig`; la autorización de exponer esos campos no autoriza publicar datos de muestra accidentalmente.
- Comprobar que borradores y revisiones posteriores no alteran la versión pública.
