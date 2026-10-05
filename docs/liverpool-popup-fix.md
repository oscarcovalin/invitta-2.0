# External registry popup fix

## Scope and cause

Authorized fix for the existing Mara and Fer public invitation. Its Liverpool
registry URL is correct (event 51981370); clicking it opened a new tab which
inherited the public iframe sandbox. Liverpool then threw a cookie-access
SecurityError and displayed a client-side application error. Direct navigation
to the same registry loaded normally.

## Minimal change and boundary

The public share wrapper now adds `allow-popups-to-escape-sandbox` so external
tabs can run as normal pages. This applies to external popups for all invitations
rendered by this wrapper, not only Liverpool. It does not change invitation
content, photos, database records, short links, project permissions or Studio.

The iframe retains an opaque origin: no `allow-same-origin`, no top navigation
permission, and no removal of its sandbox. Registry links retain `_blank` and
`rel="noopener noreferrer"`; the public wrapper retains `referrerpolicy="no-referrer"`.
External destinations remain third-party pages, not extensions of Studio.

Browser semantics: [MDN iframe sandbox reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox).

## Verification before deployment

- New regression failed before the fix: external popups inherited the sandbox.
- Full legacy suite: 126/126 test files passed; focused rerun includes the actual
  generated Liverpool link's target and opener/referrer protections.
- Production dependency audit: zero reported vulnerabilities; no dependencies
  or lockfile changes.
- Real browser click from a localhost fixture using the actual wrapper and
  template engine opened Liverpool's Boda de Mara y Fer, event 51981370, with
  products visible and no captured popup console errors.
- A local-only script inside that iframe confirmed parent DOM access was denied
  and its origin remained `null` (opaque). The fixture is outside the repository
  and is not included in the deployment.

## Deployment and rollback

Publish only this code, regression test and record to
`preview/invitta-cloud-client-flow`; do not promote production/main or change
customer records. Verify READY commit and click the deployed invitation's
Liverpool button through the existing short link.

Rollback is a revert of this scoped fix, not a reset or force push. It restores
the old iframe permissions and therefore also restores the Liverpool popup bug.
