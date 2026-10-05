(function installInvittaPublicRsvpBridge(root) {
  'use strict';

  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const DIETARY_OPTIONS = new Set(['', 'child_menu', 'allergies', 'vegan']);
  const REQUEST_TYPE = 'INVITTA_PUBLIC_RSVP_SUBMIT';
  const RESULT_TYPE = 'INVITTA_PUBLIC_RSVP_RESULT';
  const INVALID_MESSAGE = 'Revisa los datos de tu confirmación e inténtalo de nuevo.';
  const SAVE_ERROR = 'No fue posible guardar la respuesta. Intenta nuevamente.';

  function isValidPayload(payload, requestId) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    if (payload.submissionId !== requestId) return false;
    if (typeof payload.guestName !== 'string' || payload.guestName.trim().length < 2
        || payload.guestName.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(payload.guestName)) return false;
    if (typeof payload.email !== 'string' || payload.email.length > 254) return false;
    if (!['confirmed', 'declined'].includes(payload.attendance)) return false;
    if (!Number.isInteger(payload.passes) || !DIETARY_OPTIONS.has(payload.dietary)) return false;
    return payload.attendance === 'confirmed'
      ? payload.passes >= 1 && payload.passes <= 5
      : payload.passes === 0;
  }

  function sendResult(target, requestId, success, error) {
    if (!target || typeof target.postMessage !== 'function') return;
    const message = { type: RESULT_TYPE, requestId, success };
    if (!success) message.error = error || SAVE_ERROR;
    // The child has an opaque sandbox origin, so only a non-sensitive result is returned.
    try { target.postMessage(message, '*'); } catch (_) {}
  }

  function attach(frame, slug) {
    if (!frame || !frame.contentWindow || typeof slug !== 'string' || !SLUG.test(slug)) return () => {};

    const inFlight = new Set();
    const handleMessage = async (event) => {
      if (event.source !== frame.contentWindow || event.origin !== 'null') return;
      const message = event.data;
      if (!message || typeof message !== 'object' || message.type !== REQUEST_TYPE) return;

      const requestId = message.requestId;
      if (typeof requestId !== 'string' || !UUID.test(requestId)) return;
      if (inFlight.has(requestId)) return;
      if (!isValidPayload(message.payload, requestId)) {
        sendResult(event.source, requestId, false, INVALID_MESSAGE);
        return;
      }

      inFlight.add(requestId);
      try {
        const payload = message.payload;
        const response = await root.fetch('/api/public/rsvp', {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            submissionId: requestId,
            guestName: payload.guestName,
            email: payload.email,
            attendance: payload.attendance,
            passes: payload.passes,
            dietary: payload.dietary,
          }),
        });
        const result = await response.json().catch(() => ({}));
        const succeeded = response.ok && result && result.success === true;
        const error = typeof (result && result.error) === 'string' ? result.error : SAVE_ERROR;
        sendResult(event.source, requestId, succeeded, error);
      } catch (_) {
        sendResult(event.source, requestId, false, SAVE_ERROR);
      } finally {
        inFlight.delete(requestId);
      }
    };

    root.addEventListener('message', handleMessage);
    return () => root.removeEventListener('message', handleMessage);
  }

  root.InvittaPublicRsvpBridge = { attach };
})(window);
