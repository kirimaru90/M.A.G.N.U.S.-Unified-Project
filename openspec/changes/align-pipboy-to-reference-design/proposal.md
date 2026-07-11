## Why

`apps/pip-boy` is modelled on the design handoff in
`reference/Pipboy TTRPG character sheet/design_handoff_field_deck/` — a Fallout-inspired CRT
"field terminal" character sheet whose README declares itself **high-fidelity** ("every color, font
size, spacing value, and border you see in the mockups is final… do not approximate. The previous
implementation attempt drifted from these specifics; this doc exists to close that gap").

The current implementation drifted anyway, in two distinct ways.

**1. Product-model drift (the substantive one).** The reference is a sheet the *player owns and
edits*: a single `✎` editor toggle flips every list — S.P.E.C.I.A.L., abilities, talents, gear —
into an editable state for that character's owner. The implementation instead makes those sections
**admin-only**, codified in `pipboy-character-sheet` ("SHALL NOT attempt a write … on behalf of a
non-admin") and enforced at the API by `api-character-stats` (`special`, `skills`, `perks` are
admin-only; `paMax`/`paTrackedBy` and `bobbleheads` likewise). A player opening their own sheet sees
"Sola lettura — modificabile solo da un admin". That is a coherent design — a GM authors the sheet of
record in the CMS — but it is *not the designed product*, and it cannot be reconciled by styling
alone: the `✎` pattern requires owner-writable stats at the API.

**2. Visual/structural drift.** Verified against `src/styles/pipboy.css` and `src/`:
- The `scanMove` keyframe is **defined and never used** (`pipboy.css:44`); there is no scanline
  sweep, no scanline texture overlay, no vignette, and no amber critical ring. `crtFlicker` is
  flattened to a `0.985` dip against the specified `0.97 / 1 / 0.94` curve.
- **No bottom bezel at all** — the specified two knobs, ridged speaker grille, and slider nub are
  absent (`grep` for `bezel|knob|grille|vignette|scanline` in `src/` returns nothing).
- The status bar is a static `M.A.G.N.U.S. · PIP-BOY OS`; the specified `[◄ DOSSIER][ESCI]` nav lives
  in the sheet header instead, as `[ Personaggi ][ Campagna ][ Esci ]`.
- The sheet header has **no PUNTI AZIONE control** and no species chip — the spec calls for PA pips
  plus a `[−][+]` stepper and a `PA · <source approach>` line.
- There are **4 tabs, not 5** (`ABIL` is folded into `S.P.E`), and **no `✎` editor-toggle button**.
  The active tab uses an inset `box-shadow` rather than the specified 2px glowing underline.
- The **6-step character creation wizard does not exist** (`grep` for `wizard|editMode` finds
  nothing). Characters are created by a bare name prompt.
- The S.P.E tab renders label + pips only — no VT323 letter, no description, no tap-to-roll jump to
  `DADI`, no dice-legend box.
- The dice roller lacks the specified tumble animation, reroll-for-PA flow, and `▸ REGISTRO` history.

Crucially, the **data model is not the problem**. The API already matches the reference almost
exactly: `inventory` tags carry `type: core | extra` and a `damaged` flag (the reference's
`BASE`/`EXTRA` chips and `DANNEGGIATA` toggle); `skills[].level` is `competent | expert | master`
(maestria); `paTrackedBy` is `agility | endurance` (the reference's PA source); conditions carry
`severity: minor | major` (weight ×1 / ×2); `resources` is `caps`/`scraps`/`bobbleheads`
(TAPPI/ROTTAMI/BOBBLEHEAD). `POST /campaigns/:cid/characters` already supports player self-creation
and admin-creates-for-player. The backend was built for this design; the client and the
authorization rules are what diverged.

## What Changes

1. **Ownership model flips to owner-editable.** `special`, `skills`, `perks`, `paMax`,
   `paTrackedBy`, and `bobbleheads` become writable by the character's **owner** (admins retain
   write access to any character in the campaign, per §3 of the agreed model). Non-owners still get
   HTTP 404 — ownership enforcement is unchanged.
2. **S.P.E.C.I.A.L. range widens from `1..5` to `0..8`**, matching the reference (a stat's value is
   its d6 pool size, free-edited `0–8` on the sheet). The creation wizard enforces the reference's
   stricter build rule — exactly 18 points, each attribute clamped `1..4` — **client-side**. Widening
   is backward-compatible: all existing `1..5` data remains valid.
3. **New `api-species-catalog`.** A global, CMS-authored catalog of `{ slug, name, permesso,
   svantaggio, tagSkillBudget, description? }`. This gives the species benefit/drawback copy a home
   and turns the reference's hardcoded "budget 4 for Umano, 3 otherwise" rule into data.
   `character.species` relaxes from a hard enum to a catalog slug, validated on write.
4. **New `api-equipment-catalog`.** A global, CMS-authored catalog of equipment **templates**
   `{ slug, name, kind: weapon | armor | consumable, tags?, defaultQuantity?, isStarter, description? }`.
   Entries flagged `isStarter` are offered in the creation wizard. Selecting one **copies** it into
   the character's `inventory` (server-minted ids, no persisted link back to the slug) — identical
   copy-on-use semantics to `api-conditions-catalog`. Templates are authorable **only** in the CMS;
   the copy on a character is then freely modifiable. This replaces the reference's hardcoded
   `WEAPON_KITS` / `ARMOR_KITS` constants, and lets the fixed "2 Stimpack" dotazione be data too.
5. **CMS gains species + equipment catalog editors**, alongside the existing skills/conditions ones.
6. **New `pipboy-character-creation`** — the 6-step wizard (IDENTITÀ → S.P.E.C.I.A.L. →
   PUNTI AZIONE MASSIMI → TAG SKILLS → EQUIPAGGIAMENTO → RIEPILOGO) with its per-step validation.
7. **New `pipboy-dice-roller`** — pool sizing, Vantaggio/Svantaggio, situational modifier, tumble
   animation, outcome rules, PA refund on sixes, reroll-for-1-PA gated on a Tag Skill, and the
   `▸ REGISTRO` history. Extracted out of `pipboy-character-sheet`.
8. **New `pipboy-terminal-chrome`** — the design-token, CRT-effect, and case/bezel system applied to
   every screen (the four CRT layers, the amber critical ring, the bottom bezel, the wireframe
   control vocabulary, no border-radius, glyphs not emoji).
9. **`pipboy-character-sheet` restructured** — 5 tabs (`S.P.E · ABIL · SALUTE · ZAINO · DADI`) plus
   the `✎` editor toggle, header PA control + species chip, tap-an-approach-to-roll, the
   logoramento tracker with net-value and quick conditions, and gear tag-chips.
10. **Single-campaign auto-select.** When exactly one campaign is accessible, `pipboy-app-shell`
    skips the campaign picker and goes straight to the dossier; the picker still appears for two or
    more. Character creation from the dossier now enters the wizard (admins pick the owning player
    first).

## Rationale

The two drifts share one root cause and therefore one fix. Restyling the sheet without flipping the
authorization rules would produce an `✎` button that reveals nothing a player may actually write —
the reference's central interaction, rendered inert. So the ownership flip is a precondition for the
visual work, not a separable concern. This is why the change is bundled rather than split into a
"visuals" change and a "behavior" change.

The backend turning out to be ~90% aligned collapses the perceived risk: the API work is three
narrow edits (widen a numeric range, move six fields from admin-only to owner-writable, relax one
enum to a catalog slug) plus two new catalogs that clone the well-established
`api-conditions-catalog` shape. The bulk of the work — and the bulk of the risk — is a client-side
rebuild of `apps/pip-boy`, which is a 1,641-line vanilla-JS app with no framework to fight.

Choosing **catalogs over hardcoded constants** for species and equipment (a deliberate departure from
the reference, which hardcodes both) keeps faith with the project's existing "data, not code"
philosophy — the same reason `conditions.json` was externalized in the original. Modelling starter
kits as *equipment documents flagged `isStarter`*, rather than as a separate "kit" concept, means one
catalog serves both the wizard's starter picker and any future in-game equipment browser, and a GM
can promote any authored item to a starter with one flag.

`unauthorized_field` and `disallowed_section` become unreachable for owner writes once every section
is owner-writable. They are retained in the envelope's reason-code enum (reserved for future
field-level restrictions) rather than removed, so the `{ section, ignored }` contract in
`api-character-stats` stays stable for existing consumers; `unknown_id` remains the only code emitted
in practice.

## Out of scope

- **`manifest.webmanifest`, icons, `sw.js`** — owned by `pipboy-pwa-installability`; untouched.
- **The `responsive-fullscreen-shell` contract** — `.pb-case` must still render at a size that
  depends only on viewport and orientation, and scrolling must stay inside `.pb-screen-content`. The
  new bezel and CRT layers are added **within** that constraint, and its Playwright regression guard
  must stay green.
- **`apps/terminal` (emulator)** — not modified. Its `emulator-crt-*` capabilities are read as prior
  art for the CRT effects, but no code is shared or extracted in this change; doing so would couple
  two independently-deployed apps. A follow-up may extract a shared package.
- **`api-auth`, `api-users`, `api-campaigns`** — unchanged. Login stays real-user JWT; the reference's
  local-profile "auto-register on first login" model is explicitly **not** adopted (it contradicts
  `pipboy-app-shell`'s "Real-user login only", which stands).
- **Multiplayer, real-time sync, roll persistence** — rolls remain client-side and unrecorded; only
  the resulting `paCurrent` change is persisted.
- **The CMS's terminal/campaign/user editors** — unchanged. The CMS keeps its authoring role
  (terminals, skills, conditions, campaigns, users) and gains two catalogs; its ability to override
  any character sheet is preserved by admins retaining write access everywhere.

## Impact

**API (`apps/api/api`)**
- `characters/schemas/character.schema.ts` — `SpecialSection` bounds `1..5` → `0..8`; `species`
  relaxed from enum to catalog-slug string.
- `characters/dto/patch-special.dto.ts`, `dto/create-character.dto.ts` — range + species validation.
- `characters/characters.service.ts`, `patch-utils.ts` — field-level authorization: `special`,
  `skills`, `perks` no longer `disallowed_section` for the owner; `paMax`/`paTrackedBy` and
  `bobbleheads` no longer `unauthorized_field` for the owner.
- New `species-catalog/` and `equipment-catalog/` modules (schema, DTOs, controller, service,
  seed), cloning the `conditions-catalog/` module shape. Registered in `app.module.ts`.

**CMS (`apps/cms`)**
- New species-catalog and equipment-catalog editor routes/components under
  `src/app/core/`, alongside the existing skills/conditions catalog screens; sidebar entries.

**Pip-Boy (`apps/pip-boy`)** — the bulk of the work.
- `src/styles/pipboy.css` — token set, the four CRT layers (flicker curve, sweep, texture,
  vignette), amber critical ring, bottom bezel, wireframe control vocabulary, 2px glowing active-tab
  underline, custom scrollbar.
- `index.html` — status bar (`[◄ DOSSIER][ESCI]` + OS label), bottom-bezel markup.
- `src/screens/login.js` — reference copy, labelled fields, amber `⚠` inline errors, `▸ ACCEDI`.
- `src/screens/campaign-select.js` — auto-skip when a single campaign is accessible.
- `src/screens/character-select.js` — becomes the DOSSIER (cards, mini-SPECIAL row, `✕` delete,
  `+ NUOVO PERSONAGGIO` → wizard).
- **New** `src/screens/create.js` — the 6-step wizard.
- `src/screens/sheet.js` — 5 tabs, `✎` toggle, header PA control + species chip, footer clock.
- `src/tabs/special.js` — approach rows + tap-to-roll; **new** `src/tabs/skills.js` (ABIL).
- `src/tabs/health.js` — net-value, sorted conditions, quick-picks, custom condition form.
- `src/tabs/gear.js` — resource steppers, tag chips, consumables rows.
- `src/tabs/dice.js` — full roller per `pipboy-dice-roller`.
- `src/api/` — new `species.js`, `equipment.js` clients.

**Specs** — 3 modified (`api-character-stats`, `api-character-resources`, `api-characters`),
1 extended (`cms-game-data-catalogs`), 2 modified (`pipboy-app-shell`, `pipboy-character-sheet`),
5 new (`api-species-catalog`, `api-equipment-catalog`, `pipboy-character-creation`,
`pipboy-dice-roller`, `pipboy-terminal-chrome`).

**Sequencing.** `tasks.md` is phased so the change can be executed (and, if desired, later split)
along clean seams: **Phase 1** API authorization + range, **Phase 2** the two new catalogs (API),
**Phase 3** CMS editors, **Phase 4** pip-boy chrome, **Phase 5** sheet + tabs, **Phase 6** wizard,
**Phase 7** dice roller. Phases 4–7 depend on 1–2; phase 3 is independent of 4–7.

**Migration.** None required. The SPECIAL widening and the species enum→slug relaxation both accept
all existing persisted values. The two new catalogs seed themselves when empty (mirroring
`api-skills-catalog`'s "Default skills seed the catalog when empty"), so existing deployments gain
the 4 canonical species and the reference's starter equipment without a data migration.

## Testing

Per the repo's OpenSpec rules, every behavioural task below is paired with a test task in
`tasks.md`, and no phase is complete while any test is red.

**API — unit (`src/**/*.spec.ts`)**
- `patch-utils` / `characters.service`: owner PATCH of `special`, `skills`, `perks` now applies
  (previously `disallowed_section`); owner PATCH of `paMax`/`paTrackedBy` and `bobbleheads` now
  applies (previously `unauthorized_field`); `ignored` is empty for these.
- SPECIAL bounds: `0` and `8` accepted, `-1` and `9` rejected.
- Species-catalog and equipment-catalog services: batched `add`/`update`/`rename`/`delete` ops,
  duplicate-slug 409, unknown-slug → `ignored` with `unknown_slug`, invalid `kind`/`polarity`
  enum → 400, empty-catalog seeding.

**API — e2e (`test/*.e2e-spec.ts`, mongodb-memory-server, no external DB)**
- `PATCH .../special` as owner → 200 and the value persists; as a non-owner player → 404; as admin on
  another player's character → 200.
- `PATCH .../special { strength: 8 }` → 200; `{ strength: 9 }` → 400.
- `PATCH .../action-points { paMax, paTrackedBy }` as owner → both persist.
- `PATCH .../resources { bobbleheads }` as owner → persists.
- `POST /campaigns/:cid/characters { species: "<unknown-slug>" }` → 400.
- `GET /species-catalog` and `GET /equipment-catalog` → 200 for any authenticated user, 401
  anonymous; `PATCH` → 403 for a player, 401 anonymous.
- Both catalogs seed on first read of an empty collection.
- Changed files meet ≥ 80% line coverage (`npm run test:cov`).

**CMS — Vitest (`npm test` from `apps/cms`, ≥ 70% line coverage)**
- Species- and equipment-catalog editor components: render catalog rows, emit the correct batched
  `ops` payload for add/update/rename/delete, and surface a 409 duplicate-slug error.
- The `isStarter` toggle round-trips through an `update` op.
- Non-admin cannot reach either screen (extends the existing "Non-admin cannot reach the catalog
  screens" requirement).

**Pip-Boy — Playwright (`apps/pip-boy/tests/`, `npm test`)**
- **Chrome:** `.pb-case` renders a bottom bezel; the scanline-sweep element exists and is animated;
  a vignette and scanline-texture overlay are present and `pointer-events: none`; no element in the
  design has a non-zero `border-radius` except the case (`26px`), screen (`14px`), and bezel parts.
- **Regression guard:** the existing `responsive-fullscreen-shell` assertions still pass — no
  page-level scrollbar at mobile-portrait / mobile-landscape / desktop, and `.pb-case`'s
  `boundingBox()` is constant across `login → dossier → create → sheet`.
- **Ownership:** an owning non-admin player sees `[−][+]` steppers on S.P.E.C.I.A.L. in editor mode
  and **no** "sola lettura" note; toggling `✎` reveals `+ AGGIUNGI` / `✕` controls on abilities,
  talents, weapons, and armor.
- **Tabs:** exactly 5 tab buttons plus one `✎` toggle; the active tab carries the glowing underline;
  the amber `STATO CRITICO` banner appears on **every** tab (not just SALUTE) when net wear ≥ 4.
- **Auto-select:** a user with one accessible campaign lands on the dossier without seeing the
  campaign picker; a user with two campaigns sees the picker.
- **Wizard:** `AVANTI ▸` stays disabled until each step validates — blank name (step 1); non-zero
  remaining points (step 2); duplicate skills → `ABILITÀ DUPLICATE`, and over-budget →
  `MAESTRIA OLTRE IL BUDGET (N)` (step 4). Budget is read from the species catalog's
  `tagSkillBudget` (4 for Umano, 3 otherwise). Submitting creates the character and opens the sheet.
- **Starter equipment copy-on-use:** selecting a starter weapon writes an inventory item whose name
  and tags match the catalog template, with a server-minted `id` and no catalog slug persisted;
  renaming the character's copy afterwards does not alter the catalog entry.
- **Dice roller:** pool size = approach value + (1 if Vantaggio) + modifier, min 1; Svantaggio drops
  the single highest die before evaluation; any `6` → `SUCCESSO PIENO`, else any `4|5` →
  `SUCCESSO CON COSTO`, else `FALLIMENTO`; a roll with three `6`s refunds 2 PA via
  `PATCH .../action-points`; Fortuna refunds none; reroll costs exactly 1 PA, requires a selected Tag
  Skill and ≥ 1 selected die, and never refunds; `▸ REGISTRO` retains the last 8 rolls.
- **Deterministic dice:** the roller's RNG is injectable so these assertions are seeded, not flaky.

**Final gates.** `npm test` + `npm run test:e2e` from `apps/api/api`; `npm test` from `apps/cms`;
`npm test` (Playwright) from `apps/pip-boy`. All must pass before archive.
