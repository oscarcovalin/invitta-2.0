# Apertura con iniciales

Added: Studio permite seleccionar «Sólo iniciales, sin sello» dentro de la
apertura interactiva. Mantenerla activada; el monograma se configura en
«Monograma / Iniciales (apertura y encabezado)». El campo
`waxSeal.openingStyle = 'initials'` conserva el botón de apertura y su gesto
para iniciar música, sin imagen/sello, frase ni nombres completos duplicados.
Usa la familia tipográfica de los nombres y un tamaño medio de 48–64 px.
La apertura tiene fondo azul marino (#0D1524) y letras marfil (#f7f6ec).
Las iniciales se apilan en vertical
(M, &, F), según la referencia del cliente; no copia nombres, frases ni flechas.
Reutiliza la textura decorativa existente, sin nuevas imágenes/dependencias.
Sin modo nuevo, modo desconocido o apertura desactivada: comportamiento anterior.
No cambia otras invitaciones automáticamente, auth, activos, SQL ni permisos.

Verificación: RED comprobó que todavía aparecía sello; GREEN cubre render,
fallback, apertura desactivada, teclado nativo, música, texto codificado,
binding y conservación del modo en documento/presentación pública.
Navegador con presentación pública real de Mara en memoria, sin escrituras:
320/768/1024/1440 px, sin desbordes, 48/48/61.44/64 px; misma familia principal
LocalCustomNames que los nombres. Enter elimina cortina y reproduce audio.
No equivale a pruebas en Safari/cámara/teléfono físico.

Aviso local anterior: MutationObserver sin URL (ya observado en prueba de
galería/puerta) volvió a aparecer en harness. Diagnóstico pendiente fuera de
este cambio; no se añadió MutationObserver ni se declara consola global limpia.
Tailwind CDN pertenece a la plantilla anterior; no se modifica infraestructura.

Mara mantiene cambios sin guardar en su Studio al comenzar; no recargar,
reemplazar ni guardar esa pestaña sin confirmar que terminó su edición.
Aplicar el estilo sobre la última revisión guardada, nunca sobre copia vieja.
Rollback: seleccionar «Sello de cera (original)», guardar y publicar una
nueva revisión; las fotos, registros y URL no requieren cambios.

Revisión de cinco ejes: opción opt-in, pequeña rama de render en la apertura
existente y binding canónico de Studio; sin librerías ni servicios nuevos.
Iniciales codificadas en contexto de texto; modo restringido a initials/seal.
Botón nativo con nombre accesible y foco visible; reutiliza handler de música.
Auditoría npm de dependencias runtime: cero vulnerabilidades; no instalaciones.
Sintaxis y diff --check (CRLF del repositorio) correctos; pruebas de galería,
guardado, tipografía, monograma y música conservadas. No se publica el cambio
ni se aplica sobre datos remotos mientras el usuario mantiene edición abierta.

Revisión visual del fondo claro: RED por ausencia de líneas verticales;
GREEN conserva botón, música, texto codificado y modo opt-in. Cuatro tamaños
verificados nuevamente sin desbordes; fuente LocalCustomNames cargada.
La preferencia final del cliente reemplaza el fondo beige por azul marino y
letras marfil; mantiene posición, tipografía, tamaño, textura y gesto de apertura.
Verificación azul/marfil: RED de paleta, GREEN y 125/125 archivos de pruebas;
colores calculados rgb(13,21,36)/rgb(247,246,236), fuente cargada y sin
desbordes en los cuatro tamaños. Enter sigue abriendo e iniciando música.
Captura vigente: ta/.cache/mara-initials-blue-proof.jpg. No es publicación pública.
