# Inventario de datos para la invitación pública

Este inventario delimita la futura entrega por `slug`. No concede acceso público ni constituye todavía una proyección implementada. Complementa [ADR-0002](../decisions/0002-public-invitation-by-slug.md).

## Estado del contrato

`TemplateEngine.defaultConfig` tiene 54 campos de primer nivel. El adaptador actual traslada 12 de ellos, total o parcialmente, a `event`, `content`, `design`, `sections` o `assets`; los otros 42 sólo sobreviven dentro de `legacy.config`. Incluso `ceremony` y `reception` sólo trasladan sus imágenes a `assets`: sede, dirección y hora permanecen en `legacy`. Por eso eliminar `legacy` de una respuesta pública sin evolucionar el contrato cambiaría visiblemente la invitación.

## Clasificación

| Grupo | Campos actuales | Tratamiento para una entrega pública |
| --- | --- | --- |
| Identidad y celebración | `eventType`, `name`, `brideName`, `groomName`, `nameConnector`, `monogram`, `eyebrow`, `welcomeMessage`, `quote`, `story`, familia, padrinos y corte | Contenido visible al invitado; copiar sólo las propiedades que renderiza cada sección habilitada. Revisar nombres de menores antes de publicar. |
| Fecha, lugar y programa | `eventDateISO`, `timezoneOffset`, etiquetas de fecha, `ceremony`, `reception`, `itinerary`, `lodging`, cuenta regresiva | Público cuando la sección está habilitada. Direcciones, horarios y códigos de hotel deben ser revisados por quien publica. |
| Apariencia | `theme`, `typography`, `decorations`, `sectionBackgrounds`, `familyStyle`, `waxSeal`, `illustrations`, `stardust`, `dressCode` | Sólo valores visuales validados; nunca copiar objetos arbitrarios ni archivos incrustados. Las fuentes y fondos deben tener una ruta de activo publicada. |
| Medios | `photos`, `music`, imágenes de ceremonia y recepción, logo de `vendorCard` | Publicar únicamente los activos referenciados por la revisión aprobada. No hacer público el bucket privado completo. Validar URLs externas y formatos. |
| Interacción pública | `instagram`, texto de `rsvp`, `rsvpTitle`, `rsvpDeadlineLabel`, `sharedAlbum.title/subtitle/description/albumUrl`, textos de WhatsApp y `vendorCard` | Mostrar texto y enlaces aprobados; los formularios deben llamar a endpoints separados, con sus propios controles. |
| Datos sensibles sujetos a decisión editorial | `giftRegistry.bank` (titular/CLABE), `whatsappNumber`, `whatsappHosts`, `lodging.hotels[].code`, `sharedAlbum.accessCode`, `defaultPassCount` | No trasladar por defecto. Algunos se muestran hoy en la plantilla, pero publicar una URL abierta revela esos datos a cualquiera con el slug; exigir aprobación explícita por campo o un mecanismo privado por invitado. |
| Nunca en el artefacto público | `rsvpWebhookUrl`, `legacy.config` íntegro, IDs de propietario y membresía, borradores, sesiones, tokens, listas y respuestas de invitados, folios, PIN y asignaciones de mesa | Mantener en APIs y tablas privadas. No devolverlos en JSON, HTML embebido ni enlaces de activos. |

## Hallazgos que bloquean la publicación automática

1. El contenido de ejemplo de `defaultConfig` incluye nombres, teléfonos, cuenta bancaria, códigos de hospedaje y código de álbum. Una invitación recién creada puede conservar esos ejemplos. Antes de activar una URL pública debe haber una revisión de datos de muestra, no sólo `status = 'published'`.
2. El motor visual lee muchos campos de `legacy.config`, incluidos campos sensibles. No debe recibir ese objeto bruto en una ruta anónima. Se necesita una proyección explícita o un renderizado servidor que no incluya datos internos en el resultado.
3. El RSVP, pases, mesa y álbum pueden requerir datos específicos por invitado. Un slug público no debe convertirse en autorización para leerlos; sus endpoints y enlaces necesitan límites propios.
4. El bucket `invitation-assets` es privado. Mostrar una imagen en la invitación pública exige una copia aprobada o una ruta que compruebe que el archivo pertenece a la revisión publicada.

## Criterios para el siguiente incremento

- Definir el esquema público con lista permitida hasta nivel de propiedad, sin `legacy` ni datos operativos.
- Probar con valores trampa que ningún campo excluido aparece en JSON o HTML público.
- Decidir la exposición de datos bancarios, teléfonos de anfitriones y códigos antes de conectar el botón de publicar con una URL abierta.
- Comprobar que borradores y revisiones posteriores no alteran la versión pública.
