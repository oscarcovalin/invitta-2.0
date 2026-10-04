# Public family visibility

The public presentation preserves the boolean `family.enabled` and
`familyEnabled` switches used by Studio. Either switch set to `false` hides
the family section. Other fields from the `family` object are not exposed.
The existing published-document, private-media, and RSVP controls are unchanged.

## Verification — 2026-10-04

- Reproduced with a failing public-review test before the fix.
- Renderer tests cover nested, legacy, conflicting, and enabled switches.
- A private family note is excluded from the public presentation.
- All 120 test files pass after a frozen install with scripts disabled.
- Native dependency audit: zero vulnerabilities.
- Syntax and whitespace checks pass; no separate build/lint script is configured.
- Live publication: Mara & Fer revision 4 is published, but the deployed viewer
  still drops the switches and renders example family text.

## Release gate

This isolated fix is based on deployed preview commit
`0a985c2a110dcff1b50c790b8babb3c72638c970`. It does not include the unfinished
EVENT work or invitation photos/audio. Remote deployment requires approval.
After deployment, verify Mara's hidden family and album sections, photos,
music, calendar, share metadata, and unchanged Janna revision.

Rollback: revert the visibility-fix commit on the preview branch and redeploy.
No database migration or document revision rollback is required.
