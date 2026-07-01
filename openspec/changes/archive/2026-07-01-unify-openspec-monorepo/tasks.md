# Tasks — unify-openspec-monorepo

> Pure filesystem reorganization. The repo has no commits yet (everything is untracked),
> so plain `mv` is correct and `git mv` is moot — the first commit will capture the unified
> layout. Validate before deleting per-app folders.

## 1. Prep
- [x] 1.1 Confirm root `openspec/specs/` and `openspec/changes/archive/` exist and are empty.
- [x] 1.2 Re-verify no archive-name collisions across apps (already checked 2026-06-03).

## 2. Merge live specs (53) + archives (47) — scripted
Run from repo root. Targets are deterministic (`<prefix>-<original>`):
```bash
for app in "api:api" "cms:cms" "terminal:emulator"; do
  src="${app%%:*}"; pfx="${app##*:}"
  for d in apps/$src/openspec/specs/*/; do
    mv "$d" "openspec/specs/$pfx-$(basename "$d")"
  done
  mv apps/$src/openspec/changes/archive/* openspec/changes/archive/ 2>/dev/null
done
```
- [x] 2.1 Run the loop above (53 spec renames + 47 archive moves).
- [x] 2.2 Grep merged specs for cross-references to old bare capability names and fix any
      (specs are mostly self-contained; expect few or none).

## 3. Relocate active change `add-character-module`
- [x] 3.1 `git mv apps/api/openspec/changes/add-character-module openspec/changes/`.
- [x] 3.2 Rename its 4 delta folders to `api-characters`, `api-character-stats`,
      `api-character-inventory`, `api-character-resources`.
- [x] 3.3 Update capability names in its `proposal.md` "Capabilities" section to match.

## 4. (Archives merged in step 2)
- [x] 4.1 Confirm 47 archived changes landed in `openspec/changes/archive/`; no file inside
      any archived change was edited.

## 5. Merge config
- [x] 5.1 Replace root `openspec/config.yaml` with the merged `context` + `rules`
      (see design.md sketch).

## 6. Validate
- [x] 6.1 Run `openspec list` and `openspec list --json` — confirm 53 specs + the active
      change resolve.
- [x] 6.2 Validate the active change against the renamed `api-*` specs.

## 7. Retire per-app folders (full delete — no stub folders)
- [x] 7.1 Delete the now-empty `apps/api/openspec`, `apps/cms/openspec`,
      `apps/terminal/openspec` entirely. Do NOT leave a stub `openspec/` folder — an empty
      one is a trap: running `openspec` from inside an app would walk up, find it first, and
      report a broken/empty project. Exactly one `openspec/` must be discoverable in the tree.
- [x] 7.2 Add a one-line pointer to each app's `README.md` (NOT an `openspec/` folder), e.g.
      `> Specs live in the root \`openspec/\` folder (this app's capabilities are prefixed \`api-\`).`
- [x] 7.3 Grep repo (CI, scripts, READMEs, CLAUDE.md, .opencode) for `apps/*/openspec`
      references and update to root `openspec/`.

## 8. Follow-ups (separate future changes, not this one)
- [ ] 8.1 Optionally consolidate overlapping concepts (terminals / campaigns / users /
      auth / state) across `api-*`, `cms-*`, `emulator-*` into shared domain capabilities,
      one reviewable change at a time.
