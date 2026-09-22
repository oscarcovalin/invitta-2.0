# ADR-0001: Documento canónico versionado para invitaciones

## Estado

Aceptado para la rama de integración.

## Fecha

2026-09-22

## Contexto

Invitta 1.0 concentra la autoridad de datos en Supabase. Invitta 2.0 contiene el editor y el motor visual más completos, pero su configuración vive en objetos locales y HTML generado. Mantener cualquiera de esos formatos como fuente de verdad acoplaría persistencia, interfaz y publicación, y dificultaría migraciones futuras.

También debemos distinguir tres identidades que hoy se mezclan: el proyecto, la revisión editable y la versión publicada. Una invitación pública nunca debe cambiar sólo porque alguien guardó un borrador.

## Decisión

Usar un documento JSON versionado como contrato entre Studio, persistencia, previsualización y publicación.

- `schemaVersion` identifica la versión del contrato.
- `projectId` relaciona el documento con el proyecto autorizado.
- `revision` permite control de concurrencia optimista.
- `event`, `content`, `design`, `sections` y `assets` separan responsabilidades.
- Las referencias de activos guardan rutas de Storage, nunca datos base64 ni URLs firmadas.
- La publicación apunta a una revisión inmutable; editar crea una revisión nueva.
- El HTML es una salida reproducible del renderizador, no un dato editable.
- Las extensiones de compatibilidad se aceptan sólo dentro de `legacy`, con fecha de retirada documentada.

## Alternativas consideradas

### Guardar HTML generado

Facilita publicar el estado actual, pero impide validar semánticamente el contenido, complica cambios globales y mezcla datos con presentación. Rechazado como fuente de verdad; puede conservarse como artefacto derivado o caché.

### Persistir directamente `TemplateEngine.defaultConfig`

Reduce trabajo inicial, pero convierte detalles accidentales del editor 2.0 en contrato permanente y conserva campos base64. Rechazado como contrato público; se usará un adaptador temporal de importación.

### Modelar cada campo visual como columna SQL

Ofrece consultas granulares, pero vuelve costosa cada evolución del editor. Rechazado para el contenido de diseño. Los campos operativos consultables —estado, slug, propietario, revisión publicada— sí permanecen normalizados.

## Consecuencias

- Studio y el renderizador pueden evolucionar detrás de adaptadores explícitos.
- La base debe validar identidad, pertenencia, versión y tamaño, además de la validación JSON del cliente.
- Se requiere migrar los documentos locales actuales y eliminar gradualmente base64/localStorage.
- Los cambios incompatibles exigen una nueva `schemaVersion` y una función de migración; no se modificará silenciosamente el significado de campos existentes.
