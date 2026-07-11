# Design — Aligning `apps/pip-boy` to the reference field-terminal design

## Context

The source of truth is `reference/Pipboy TTRPG character sheet/design_handoff_field_deck/`:
- `README.md` — the handoff (design tokens, screen-by-screen detail, state machine, game rules)
- `reference/Field Deck.dc.html` — the working prototype: exact copy, exact style values, fixed data
- `reference/conditions.json` — quick-condition presets
- `mockups/*.png` — 17 numbered screenshots of every screen and state

The handoff is explicit that this is a **recreation, not a port**: "Do not copy its markup or
'compile' it directly… Treat the `.dc.html` file as ground truth for exact copy, exact values, and
the state machine… read it like a spec, not like a template to paste."

The reference describes a **local-only, single-player, no-backend** app. `Unified MAGNUS` is a
multi-user system with a NestJS/Mongo backend, campaigns, and a CMS. This change adopts the
reference's *product model and visual design* while keeping the unified backend. The four points
below were decided with the project owner before drafting.

## Decisions

### D1 — Characters stay campaign-scoped; a lone campaign auto-selects

**Decision.** `character.campaignId` remains required. `pipboy-app-shell` skips the campaign picker
when exactly one campaign is accessible to the user, landing directly on the dossier. Two or more →
the picker still renders.

**Why.** The reference's "DOSSIER" is a flat per-user character list because it has no campaign
concept at all. Making `campaignId` nullable to imitate that would fork every campaign-scoped query,
index, and authorization check in the API (`CharacterSchema.index({ campaignId, userId, isDeleted })`,
`Requirement: Campaign membership enforced`, the whole `/campaigns/:cid/characters/...` route tree)
for a purely cosmetic gain. Auto-selecting the sole campaign delivers the reference's *experience* —
a solo player logs in and sees their characters — with zero model change.

**Rejected:** a hidden "default campaign" per user. Same UX, but it invents a second kind of campaign
that the CMS would have to hide, and it silently breaks the "admin sees every character in the
campaign" rule.

### D2 — The owner may edit their whole sheet; admins may edit anyone's

**Decision.** `special`, `skills`, `perks`, `paMax`, `paTrackedBy`, and `bobbleheads` move from
**admin-only** to **owner-or-admin** writable. Ownership enforcement is unchanged: a non-owner player
patching another player's character still receives HTTP 404.

**Why.** This is the reference's central interaction. The `✎` toggle "gates every editable list" for
the player holding the sheet; §4.4 has the player editing S.P.E.C.I.A.L. directly ("Edit: header
`▸ MODIFICA S.P.E.C.I.A.L.`, 7 stepper rows… then a `FONTE PA` select and a `MAX PA` stepper"). A
frontend-only `✎` would reveal controls whose writes the API silently discards as
`disallowed_section` — worse than not shipping it.

**Consequence.** `unauthorized_field` and `disallowed_section` become unreachable for owner writes.
They are **retained** in the reason-code enum rather than removed, so the `{ section, ignored }`
envelope contract stays stable; `unknown_id` remains the only code emitted in practice. This keeps
the door open for future field-level restrictions without another envelope change.

**Consequence.** The CMS's ability to "override character sheets" is preserved automatically —
admins keep write access to every character in the campaign. The CMS's authoring role is unchanged;
what changes is that it is no longer the *only* way a sheet gets authored.

### D3 — S.P.E.C.I.A.L. widens to `0..8`; the 18-point build rule is client-side

**Decision.** `SpecialSection` bounds move from `min: 1, max: 5` to `min: 0, max: 8`. The wizard
enforces the reference's build rule — exactly 18 points spent, each attribute clamped `1..4` — in
`apps/pip-boy`, not at the API.

**Why.** The reference uses three different ranges for the same field: `1..4` during creation (an
18-point buy), `0..8` when free-editing on the sheet, and "value = number of d6 in the pool" at roll
time. The API must permit the widest of these (`0..8`); the narrowest is a *character-creation*
rule, not an invariant of the stored document — a character legitimately leaves `1..4` the moment a
GM grants a stat increase.

Widening is backward-compatible: every persisted `1..5` value stays valid, so **no migration**. The
reverse (narrowing) would not be.

**Rejected:** enforcing the 18-point buy server-side. It is only meaningful at the instant of
creation, and `POST /characters` creates a character at defaults before the wizard's values are
patched in — the server never sees the build as an atomic unit.

### D4 — Species and equipment become CMS-authored catalogs, not hardcoded constants

**Decision.** Two new global catalogs, both cloning the `api-conditions-catalog` module shape
(global, non-campaign-scoped; `GET` for any authenticated user; admin-only batched
`add|update|rename|delete` ops; self-seeding when empty).

```
api-species-catalog     { slug, name, permesso, svantaggio, tagSkillBudget, description? }
api-equipment-catalog   { slug, name, kind, tags?, defaultQuantity?, isStarter, description? }
                          kind: 'weapon' | 'armor' | 'consumable'
                          tags: [{ name, type: 'core' | 'extra' }]
```

**Why species.** The wizard needs each species' `permesso`/`svantaggio` copy (shown in step 1's info
box, and again as the two auto-generated talents `SPECIE · {SPECIES}` and `SVANTAGGIO`). The
reference hardcodes this in a `SPECIES` constant. Putting it in a catalog also lets the reference's
hardcoded rule *"budget 4 for Umano, 3 for other species"* become the `tagSkillBudget` field —
turning a magic number into data.

`character.species` relaxes from an enum to a slug validated against the catalog on write. Existing
values (`human | ghoul | super_mutant | robot`) are the seeded slugs, so nothing breaks.

**Why equipment, and why *not* a separate "kit" catalog.** The reference has four starter weapon
kits and three armor kits as constants. Modelling those as a dedicated `kit-catalog` would create a
concept that exists only during character creation. Instead the catalog holds **equipment
documents** — the same things a character carries — and an `isStarter` flag marks which are offered
in the wizard. One catalog serves the wizard's starter picker today and any future equipment browser;
a GM promotes any authored item to a starter by flipping one boolean.

**Copy-on-use, not reference.** Selecting a template **copies** `name` and `tags` into the
character's inventory with a fresh server-minted `id`, and stores **no link back to the slug**. This
is exactly how `api-conditions-catalog` already behaves ("a character's own conditions remain
freeform objects with no persisted link back to a catalog slug; the catalog exists to speed up
authoring, not to constrain it"). It is what makes "templates … that can be later modified" work:
renaming your pistol never touches the catalog, and a GM editing the catalog never rewrites a
character's gear mid-campaign.

`kind` routes the copy: `weapon → inventory.weapons`, `armor → inventory.equip`,
`consumable → inventory.consumables` (using `defaultQuantity`). This lets the reference's fixed
"Dotazione fissa: 2 Stimpack inclusi" be seeded data rather than a hardcoded line in the wizard.

**Rejected:** hardcoding both in `apps/pip-boy` as the reference does. It contradicts the project's
own precedent — `conditions.json` was externalized precisely so "game masters can reskin conditions
without a rebuild" — and the owner explicitly wants CMS-authored templates.

**Authoring is CMS-only.** Neither catalog is writable from `apps/pip-boy`; both are `GET`-only
there. Only admins may `PATCH`, matching the skills/conditions catalogs.

## Concept mapping: reference → existing API

The backend was already built for this design. Verified against
`characters/schemas/character.schema.ts` and the catalog schemas:

| Reference concept | API field | Status |
|---|---|---|
| Species Umano/Ghoul/Supermutante/Robot | `species` | ✅ same 4; enum → catalog slug (D4) |
| 7 S.P.E.C.I.A.L. attributes | `special.{strength…luck}` | ⚠️ range `1..5` → `0..8` (D3) |
| Tag skills + maestria COMP/ESP/MAE | `skills[]{id: slug, level: competent\|expert\|master}` | ✅ exact |
| Default skill list | `api-skills-catalog {slug, name, description}` | ✅ already catalog-sourced |
| PA source (Agilità / Resistenza) | `paTrackedBy: agility \| endurance` | ✅ exact |
| PA max / current | `paMax` / `paCurrent` | ✅ exact |
| Talents (species-derived + freeform) | `perks[]{name, description, icon}` | ✅ shape; copy sourced from D4 |
| Conditions, BASE ×1 / MODERATA ×2 | `negative/positiveConditions[]{name, severity: minor\|major}` | ✅ `minor`=×1, `major`=×2 |
| `conditions.json` presets `{name,sign,weight,note}` | `api-conditions-catalog {slug,name,defaultSeverity,polarity,description}` | ✅ `sign`→`polarity`, `weight`→`defaultSeverity`, `note`→`description` |
| `critico` (net wear ≥ 4) | `criticalState: boolean` | ⚠️ derived in reference, stored here (D5) |
| TAPPI / ROTTAMI / BOBBLEHEAD | `resources.{caps, scraps, bobbleheads}` | ✅ exact |
| Weapon + BASE/EXTRA tags + DANNEGGIATA | `inventory.weapons[]{name, tags[]{name, type: core\|extra, damaged}, broken}` | ✅ **exact** |
| Armor | `inventory.equip[]` (same shape) | ✅ `equip` = armatura |
| Consumabili `×qty`, 2 Stimpack | `inventory.consumables[]{name, quantity}` | ✅ seeded via D4 |
| Keepsake "oggetto significativo" | `inventory.other[]` (GenericItem) | ✅ |
| Starter weapon/armor kits | — | ➕ new `api-equipment-catalog` (D4) |
| Species permesso/svantaggio copy | — | ➕ new `api-species-catalog` (D4) |
| Rottami iniziali · 1d6 | client roll → `resources.scraps` | ✅ client-side |
| Player self-creation | `POST /campaigns/:cid/characters` | ✅ **already supported** |

`POST /campaigns/:cid/characters` already specifies "A player creates a character assigned to
themselves; an admin creates a character assigned to a specified player", and
`create-character.dto.ts` already documents `userId` as *"required for admins, ignored for players"*.
No API change is needed for wizard-driven creation — only the client.

### D5 — `criticalState` is computed by the client and persisted

**Decision.** `apps/pip-boy` computes net wear (`Σ negative weights − Σ positive weights`, where
`minor`=1 and `major`=2), derives `critico = net ≥ 4`, and writes it through the existing
`PATCH .../status { criticalState }` whenever conditions change. The stored boolean remains the
source of truth for other consumers.

**Why.** The reference derives `critico`; the API stores it, and the CMS state-viewer plus
`pipboy-character-sheet`'s existing banner requirement already read the stored field. Deriving it
server-side would be cleaner but changes `PATCH .../status` semantics for every existing caller
(the field is currently a caller-supplied partial-merge scalar). Client-computes-and-persists keeps
both the reference's rule and the existing contract, at the cost of one invariant the client must
maintain. The `CRIT` threshold (`4`) lives in one constant in the pip-boy client.

**Rejected:** deriving on write in the service. Better long-term; deferred because it would make
`criticalState` read-only and force a change to `api-character-stats`'s "Owner flips criticalState"
scenario, widening this change's blast radius for no user-visible gain.

## Fidelity strategy

The handoff insists values are used verbatim ("Where this doc gives a hex code, px value, or literal
copy string, use it exactly — do not approximate"). To keep this checkable rather than aspirational:

- The token set (`#33ff66`, `#aaffc0`, `#ffb02e`, `#06110a`, the two gradients, the opacity ladders)
  lands as CSS custom properties in `pipboy.css`, declared once.
- `pipboy-terminal-chrome` carries the machine-checkable invariants — the four CRT layers exist and
  the overlays are `pointer-events: none`; **no border-radius anywhere** except case (`26px`),
  screen (`14px`), and bezel parts; no emoji, glyphs only (`◄ ✎ ✕ ⚠ ◉ ▸ − +`).
- Italian in-universe copy is reproduced from the handoff verbatim, including
  `▸ APPROCCI · TOCCA PER TIRARE`, `⚠ STATO CRITICO — NON PUOI AGIRE`,
  `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti`, and the dice legend.

Two documented, deliberate departures from the reference, both already agreed:
1. **Login is real-user JWT**, not a local profile switcher that auto-registers on first use.
   `pipboy-app-shell`'s "Real-user login only" requirement stands and is not modified. The login
   *screen* adopts the reference's layout and copy; the footnote about first-login auto-registration
   is dropped as untrue here.
2. **Species and starter equipment are catalogs**, not constants (D4).

## Risks

- **Scope.** Seven phases across three apps, ~11 spec files. Phases are ordered so 1–2 (API) unblock
  4–7 (client) and 3 (CMS) is independent — a clean seam if this must later be split.
- **Dice-roller flakiness.** The tumble animation re-randomizes faces on a timer. The roller's RNG
  must be injectable so Playwright asserts on seeded outcomes, never on real randomness.
- **Regression against `responsive-fullscreen-shell`.** The bezel adds fixed-height chrome inside
  `.pb-case`. Its "constant case size across screens" and "no page-level scroll" assertions must be
  re-run, not just assumed — the new bezel and CRT layers must live inside that contract.
- **Silent `ignored` behaviour.** Anything still relying on `special`/`skills`/`perks` being rejected
  for players will now succeed. The e2e suite must assert the *new* behaviour explicitly so the
  change is visible, and `pipboy-character-sheet`'s "read-only for non-admin" requirement is removed
  rather than left contradicting the API.

## Open questions

None blocking. Deferred, deliberately:
- Extracting the CRT layers into a package shared with `apps/terminal`'s `emulator-crt-*`
  capabilities (out of scope here; would couple two independently-deployed apps).
- Moving `criticalState` derivation server-side (D5).
- Promoting the dice-outcome and maestria/Risk tables into a rules catalog, if GMs ever need to
  reskin them.
