# Confirmar con cada anfitrión

Las bodas con dos o más contactos de WhatsApp válidos muestran un botón
«Confirmar con …» por contacto. Los rótulos predeterminados de novia y novio
usan los nombres de la invitación; los contactos vacíos no generan botones.
Los proyectos de XV y los de un solo contacto conservan el envío anterior.

El visitante escribe su nombre, elige asistencia y pulsa el contacto deseado.
Primero se guarda mediante el puente público existente y la API de RSVP de
Supabase. Sólo después se dirige a WhatsApp con el mensaje preparado. No se
envía automáticamente ni se verifica su entrega: el visitante debe pulsar
Enviar en WhatsApp. Si se bloquea o se cierra la ventana, queda el botón
«Abrir WhatsApp con …» para continuar. Un error de guardado cierra la ventana
reservada, muestra el error y permite reintentar; los botones se bloquean
durante el guardado para evitar envíos simultáneos.

La respuesta incluye nombre, asistencia tal como aparece en el formulario y,
si asistirá, lugares y dieta; correo sólo cuando se proporcionó. No inventa
mesa, folio ni un pase de entrada. El RSVP general no identifica a quién se
envió originalmente el enlace: el nombre es declarado por quien responde.
La personalización con destinatarios registrados y boletos verificados sigue
siendo una entrega independiente; no se deben considerar confiables los pases
o nombres editables de una dirección web.

No cambia el contrato del servidor, los permisos, los contactos almacenados
ni los datos/revisiones de proyectos. El iframe continúa sin `allow-same-origin`;
únicamente permite que las ventanas externas de WhatsApp no hereden su sandbox,
con `opener` anulado. El editor no se incorpora a la invitación pública.

## Verificación y reversión

Prueba de regresión `test-rsvp-host-buttons.cjs`: RED primero; luego respuestas
afirmativa/negativa, selección de contacto, persistencia antes del mensaje,
validación, conexión fallida, ventana bloqueada, concurrencia, reset, rótulos
hostiles, límite de cinco lugares del servidor y preservación del flujo XV.
El nuevo flujo no llama al QR antiguo: en navegador se reprodujo un desbordamiento
de esa librería, y se añadió una prueba que lanza si el RSVP intenta emitirlo.

Pruebas en navegador integrado con invitación y guardado sintéticos, sin crear
asistentes ni enviar mensajes reales: anchos 320, 768, 1024 y 1440; teclado,
negativa con cero pases, afirmativa con dos, recuperación de conexión y mensajes
de destino en ventanas locales. Botones con texto oscuro sobre fondo dorado,
foco visible y altura mayor de 44 px. El aviso heredado de Tailwind CDN permanece.
No hay scripts de build, lint ni tipado configurados; no se afirma haberlos pasado.

Se puede revertir el commit de este cambio y volver a desplegar la misma rama,
sin revertir ni eliminar datos de Supabase. Base previa: `b276af6`.
No se incluyen los tres commits locales del álbum de `fix/album-save-feedback`.
