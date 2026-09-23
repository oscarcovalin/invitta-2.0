# ADR-0002: Entrega pública de la revisión publicada por slug

## Estado

Propuesto; no habilita acceso público todavía.

## Fecha

2026-09-22

## Contexto

El objetivo de la fusión pide una URL pública estable basada en `slug` sin romper las páginas actuales de Invitta 2.0. Hoy `invitation_projects.slug` existe, pero Studio sólo marca `published_document_id`: no hay una ruta pública que resuelva ese slug ni una lectura anónima del documento. Las revisiones guardan `legacy.config`, una copia completa de la configuración del editor, y los archivos están en el bucket privado `invitation-assets`.

Por tanto, `status = 'published'` no equivale todavía a una invitación entregable. Conceder `SELECT` anónimo a `invitation_documents` o hacer público el bucket expondría más datos y archivos que los de una invitación publicada. Tampoco basta devolver el JSON sin procesar: el motor actual consume campos de `legacy.config` que aún no forman parte del contrato público canónico.

## Decisión propuesta

Separar explícitamente la edición privada de la entrega pública:

1. Mantener `invitation_projects`, `invitation_documents` y `invitation-assets` privados, con sus políticas actuales. No añadir una política anónima sobre esas tablas o el bucket.
2. En una fase aditiva, construir un artefacto público derivado y validado de la revisión seleccionada, con una lista permitida de campos para renderizar; excluir datos operativos del editor, credenciales internas, listas de invitados y otros campos no destinados al invitado. La publicación debe fallar si el renderizador necesita un campo cuya exposición no se haya clasificado.
3. Asociar el artefacto inmutable al `slug` y a la revisión publicada. Una revisión nueva no modifica lo que ven los invitados hasta otra publicación explícita. Despublicar debe retirar su acceso público sin borrar el borrador.
4. Publicar sólo los archivos referenciados por ese artefacto, mediante una copia pública controlada o una ruta de lectura que compruebe la referencia publicada. No abrir todo el bucket privado ni reutilizar el proxy autenticado de Studio.
5. Exponer una URL nueva por slug sin sustituir de golpe `invitacion-boda.html?event=...` ni `invitacion-xv.html?event=...`. Medir sus consumidores y mantenerlas durante la transición. El `slug` generado hoy (`p-<uuid>`) es estable pero poco legible; una edición de slug requerirá una política de unicidad y redirecciones antes de ofrecerse.

El propietario confirmó que los datos bancarios de regalos, los teléfonos de anfitriones y los códigos de álbum y hotel son públicos **una vez publicada la invitación**. Esta decisión aplica sólo a propiedades explícitas de la revisión publicada, no a `legacy.config` íntegro ni a borradores. Cualquiera que obtenga el enlace podrá ver esos datos; el enlace no constituye control de acceso. La revisión previa debe detectar valores de ejemplo antes de activar la URL. `defaultPassCount`, pases y asignaciones individuales no quedan autorizados por esta confirmación.

## Alternativas consideradas

### Dar lectura anónima a la revisión privada

Simple de implementar, pero revela `legacy.config` completo y rompe la separación entre borrador y artefacto público. Rechazado.

### Convertir `invitation-assets` en bucket público

Permitiría cargar imágenes sin proxy, pero expondría archivos de borradores y proyectos no publicados. Rechazado.

### Publicar directamente el HTML exportado por Studio

Conserva la apariencia actual y puede servir como artefacto derivado, pero exige revisar sanitización, scripts, enlaces de RSVP y referencias a activos antes de servirlo. No se acepta como atajo para abrir las tablas privadas.

## Secuencia y criterios de salida

Ya existe un constructor puro del candidato de publicación. Separa `publicArtifact` (contenido filtrado, identificadores de imágenes y rutas estáticas permitidas) de `privateImages` (rutas internas de Storage) y de `source` (identidad de revisión). Rechaza ejemplos exactos de Studio e imágenes inválidas. Todavía no persiste el candidato ni concede acceso anónimo.

La acción actual de Studio conserva su respuesta, pero ahora lee la revisión guardada con el JWT del usuario y ejecuta esa validación **antes** de marcarla `published`. Una revisión ausente, mal formada, con ejemplos o con rutas inválidas no cambia el estado. Esto es un control preliminar, no la generación persistida del artefacto: `published` sigue sin significar que exista una URL final aprobada.

`POST /api/projects/publication-preview` permite preparar una revisión privada por `projectId` y `documentId` con la sesión de Studio. Devuelve sólo el `publicArtifact` y el número de revisión, con `no-store`; las rutas privadas de Storage y el documento fuente no salen en la respuesta. Es un endpoint de revisión técnica, aún sin interfaz editorial ni persistencia. La lectura conserva las políticas RLS del usuario.

1. Inventariar los campos que el motor de invitación realmente necesita y clasificarlos como públicos o privados; probar que la proyección excluye datos privados.
2. Crear el almacenamiento aditivo del artefacto y su rollback sin modificar ni borrar documentos privados existentes.
3. Hacer que la acción de publicar genere y valide el artefacto antes de activar el slug; probar fallos parciales y concurrencia.
4. Probar en Preview Deployment la URL por slug, activos, RSVP y móvil; verificar que borradores, otros proyectos y slugs inexistentes no filtran datos.
5. Sólo después, ofrecer la URL en Studio y evaluar la transición de las rutas actuales. No promover a producción sin revisión.

## Riesgos y reversión

La ruta experimental `GET /api/public/invitation?slug=...` entrega sólo la proyección permitida de la revisión publicada y está apagada por defecto. En Preview requiere `INVITTA_PUBLIC_CONTENT_ENABLED=1`, `INVITTA_PUBLIC_CONTENT_PREVIEW_SLUG` y una clave secreta sólo de servidor; responde únicamente para ese slug, sin caché, y vuelve a comprobar la revisión antes de responder. No es la URL final ni sustituye la aprobación editorial o el artefacto inmutable propuesto arriba. La ruta de imágenes tiene su propia habilitación separada.

El principal riesgo es filtrar contenido privado por una proyección incompleta o por el acceso a archivos. El rollback de la fase pública debe retirar la ruta y sus permisos primero; los artefactos derivados pueden conservarse temporalmente para diagnóstico o eliminarse tras respaldo y revisión. No debe tocar las tablas y archivos privados existentes ni las URLs actuales.
