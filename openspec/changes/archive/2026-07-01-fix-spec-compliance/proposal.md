## Why

A full code-vs-spec audit (2026-07-01) of all three apps found that the code honours the
overwhelming majority of requirements, but a handful of **genuine defects** violate specs
that are still correct. One is a production blocker: the emulator ships a service worker
that pre-caches `manifest.webmanifest`, but that file does not exist in the repo, so
`cache.addAll` rejects and the service-worker `install` fails on every deploy — the PWA
never activates.

This change brings the **code** back into line with the already-correct specs. It is a
compliance/bug-fix change: for most items the spec text is right and only the
implementation moves. The single spec delta strengthens the PWA pre-cache requirement so
the brittle-install failure mode cannot regress.

## What Changes

- **Emulator PWA (blocking):** add the missing `manifest.webmanifest` (name, short_name,
  start_url, display, background_color, theme_color `#33ff00`, the existing icon set) and
  make the service-worker install resilient so a single missing optional asset cannot
  abort the whole install.
- **Emulator fast-replay:** render previously-seen nodes instantly (0 ms/char) via the
  existing `speed === 0` path instead of `typingSpeed * 0.25`.
- **Emulator CRT phosphor-wave:** inject the `.crt-scanlines` and `.crt-flicker` overlay
  divs (currently only `.crt-vignette` is created) and parent the overlays to
  `#terminal-container` rather than `<body>`.
- **Emulator sounds:** supply the missing `suoni/hover.mp3` and `suoni/init.mp3` assets and
  wire `hoverSound` to `.choice-btn` `mouseenter` (currently dead code; buttons play the
  selection sound instead).
- **API `POST /campaigns/:id/activate`:** return HTTP 200 (add `@HttpCode(200)`); it
  currently returns the NestJS POST default 201, contradicting the spec scenario.
- **API `PUT /users/:id`:** accept-and-ignore server-owned fields (`lastCampaignId`,
  `unlockedHiddenIds`) with 200 as the spec requires, instead of 400 from the global
  `forbidNonWhitelisted` pipe.
- **API character `PUT`:** make the full-document update a true replace of mutable sections
  rather than a partial merge, so omitting a field clears it as the spec states.
- **API JWT secret (latent):** align the verify-side fallback with the sign-side default so
  tokens do not silently fail verification when `JWT_SECRET` is unset.
- **API state service (defensive):** return 404 (not 500/400) for a missing terminal/campaign
  in `StateService` read/mutate/reset paths, independent of the upstream guards that mask it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `emulator-pwa-installability`: the service-worker pre-cache requirement is strengthened to
  require that every listed shell asset is actually served, and that the install tolerates a
  missing *optional* asset without rejecting.

## Impact

- Application code in `apps/terminal` (`sw.js`, new `manifest.webmanifest`, new `suoni/*.mp3`,
  `effects/crt-wave.js`, `main.js`, `screens/terminal.js`, `sounds.js`) and `apps/api`
  (`campaigns.controller.ts`, `users` DTO/pipe handling, `characters.service.ts`,
  `auth` JWT config, `state.service.ts`).
- No breaking API changes; the `activate` and `PUT /users/:id` fixes make responses *more*
  spec-compliant (callers currently coding around 201/400 should be checked).
- Only `emulator-pwa-installability` receives a spec delta; every other item is a pure
  implementation correction against an unchanged, already-correct requirement.
