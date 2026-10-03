# Propuesta: entrega sencilla para anfitriones

Estado: propuesta para revisión; no implementada ni activada. Requisito confirmado
el 2026-10-02: el anfitrión personaliza desde una página sencilla, no desde el portal.
No extiende por sí sola la autorización del módulo de emergencia.

Supuestos propuestos: tú eliges y publicas el diseño; el anfitrión sólo personaliza
destinatario/pases y comparte por iniciativa propia. No cambia el diseño, no entra
a Studio, no ve otros proyectos y no registra ingresos desde la pantalla de entrega.
No necesita cuenta profesional, pero sí acceso privado verificable. "Sin portal"
no significa "sin protección" ni "funciona sin servidor".

| Módulo | Responsabilidad | Depende de |
| --- | --- | --- |
| event-pass-validity | Boletos para entrega anticipada, ligados a fecha/zona horaria del evento, con vencimiento y revocación explícitos. Separados del pase de emergencia de 24 h. | puerta por proyecto existente |
| host-delivery-access | Acceso privado revocable, acotado a un evento y cupo, sin conceder roles de planner ni acceso a Studio/portal. | permisos de proyecto existentes |
| host-delivery-ui | Página simple: destinatario, pases dentro del cupo, vista previa, enlace y descarga imprimible; compartir manualmente. | event-pass-validity, host-delivery-access |

Orden propuesto: event-pass-validity y host-delivery-access, después host-delivery-ui.
Cada módulo tendrá especificación y pruebas propias tras aprobar este mapa.

El enlace de edición del anfitrión nunca se incluye en la invitación ni en el QR
del invitado. El boleto del invitado es de lectura; no autoriza emisión ni admisión.
El acceso de anfitrión debe poder invalidarse sin cambiar los enlaces de invitados.
Si se entrega como enlace privado, advertir que compartirlo comparte su permiso;
no presentar un enlace secreto como verificación de identidad de una persona.

Por definir antes de código/esquema: mecanismo de acceso privado, duración/cupo,
fecha límite precisa y efecto de corregir fecha/pases tras entregar. No habrá envío
automático de WhatsApp/correo ni importación/mezcla de registros por nombre.
Se mantienen los datos y permisos de Janna. Cámara/móviles reales siguen pendientes
para la puerta; la propuesta no declara fiable el escáner global heredado.
