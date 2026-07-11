# Implementing M.A.G.N.U.S. in VSCode with OpenSpec

This guide gets the Pip-Boy character-sheet project running locally in VSCode and under an
OpenSpec spec-driven workflow. Follow the steps in order.

---

## 0. What you're working with

Four files make up the whole app — there is no build step:

| File | Role |
|------|------|
| `Field Deck.dc.html` | The entire app: template + logic class (a "Design Component"). |
| `support.js` | The tiny runtime that renders the Design Component. **Do not edit.** |
| `conditions.json` | Data — the quick-condition presets, fetched at runtime. |
| `CLAUDE.md` | The design-system + architecture rules. Read this first; it's the source of truth for conventions. |

Everything runs in the browser from static files. The only reason you can't just double-click
the HTML is that it `fetch()`es `conditions.json`, which needs an HTTP origin (see §3).

---

## 1. Prerequisites

- **VSCode** (or any editor).
- **Node.js 18+** — check with `node -v`. Needed only for the OpenSpec CLI and a static server.
- An AI coding assistant that supports OpenSpec slash commands (Claude Code, Cursor, Copilot,
  Windsurf, etc.). OpenSpec supports 25+ tools.

Recommended VSCode extensions: your AI assistant's extension, plus **Live Server** (Ritwick Dey)
for one-click local serving.

---

## 2. Get the files into a project

1. Create a folder and open it in VSCode: `File → Open Folder…`
2. Put all four files above in the project root.
3. Initialise git so OpenSpec changes are reviewable:
   ```bash
   git init && git add -A && git commit -m "Import M.A.G.N.U.S. field terminal"
   ```

---

## 3. Run it locally

The app fetches `conditions.json`, so it must be served over HTTP — not opened as a `file://` URL.

**Option A — Live Server:** right-click `Field Deck.dc.html` → *Open with Live Server*.

**Option B — command line** (no install):
```bash
npx serve .
# or:  python3 -m http.server 8080
```
Then open the printed URL and navigate to `Field Deck.dc.html`.

You should see the login screen (`M.A.G.N.U.S. · ROBCO · TERMINALE DI CAMPO`). Any user id +
6-char code creates an account — data persists in `localStorage` (`pipboy_db`, `pipboy_session`).
If the conditions presets show but the network tab shows a failed `conditions.json` request,
you're viewing over `file://` — switch to a server.

---

## 4. Initialise OpenSpec

From the project root:

```bash
npx openspec@latest init
```

Pick your AI tool when prompted. This scaffolds:

```
openspec/
├── project.md        # project conventions (you'll replace this — see §5)
├── AGENTS.md         # generated instructions for your AI tool (leave as-is)
├── specs/            # current truth — what IS built
└── changes/          # proposals — what SHOULD change
```

It also registers slash commands for your tool (e.g. `/opsx:propose`, `/opsx:apply`,
`/opsx:archive`).

---

## 5. Wire the conventions into OpenSpec

Two ready-made files are provided in this repo under `openspec/`:

- **`openspec/project.md`** — tech stack + conventions, pointing at `CLAUDE.md` as the design
  authority. Copy it over the one `init` generated.
- **`openspec/specs/character-sheet/spec.md`** — a *baseline* spec that documents what the app
  already does (login, S.P.E.C.I.A.L., abilities, health/logoramento, gear, dice). This is your
  "current truth" so future changes are expressed as deltas against it.

If you prefer OpenSpec to write the baseline itself (reverse-engineering the code), create a change
named `baseline` instead and let `/opsx:apply` populate the specs — but the provided spec.md saves
you that round-trip.

---

## 6. The spec-driven loop

For every change, follow OpenSpec's flow. Type these in your AI tool's chat:

1. **Explore (optional):** `/opsx:explore` — a no-stakes conversation to sharpen a vague idea.
   Writes nothing.
2. **Propose:** `/opsx:propose add-perk-tree` — creates `openspec/changes/add-perk-tree/` with
   `proposal.md` (why/what/impact), spec deltas, `design.md`, and `tasks.md`.
3. **Review:** read the generated artifacts in VSCode. Edit anything before code is written — this
   is the alignment gate.
4. **Apply:** `/opsx:apply` — the assistant implements `tasks.md` against `Field Deck.dc.html`,
   checking tasks off as it goes.
5. **Verify:** reload the served page, exercise the change (remember state lives in `localStorage`).
6. **Archive:** `/opsx:archive` — merges the deltas into `openspec/specs/` and moves the change to
   `changes/archive/`. Keeps "current truth" accurate.

Validate structure any time with:
```bash
npx openspec validate --strict
```

### Scope rule
Use OpenSpec for behavior changes (new tabs, new game rules, persistence changes). **Skip it** for
one-line tweaks — the scanline-timing fix, a color literal, a copy edit. If the change is simpler to
explain than to spec, just make it.

---

## 7. Guardrails specific to this project

Put these in front of your AI assistant (they're already in `CLAUDE.md`, which `project.md`
references — but worth restating in any proposal):

- **One file, one Design Component.** No React/JSX entrypoints, no CSS files, no build tooling.
  All styling is inline; the only `<style>` block holds fonts, keyframes, and resets.
- **Never edit `support.js`.**
- **Never clear `pipboy_db` / `pipboy_session`** except through the existing `_db()` / `_saveDB()`
  helpers — they hold real characters. New persisted fields go on the character object.
- **Italian, terminal voice, phosphor-green palette.** Reuse the existing UI patterns (steppers,
  pips, tag chips, `▸` section headers) rather than inventing new ones.
- **Template holes are dotted paths only.** Compute every ternary/color/style string in
  `renderVals()` and expose it by name.

---

## 8. Quick reference

```bash
npx openspec@latest init          # scaffold openspec/ + slash commands
npx serve .                       # serve locally (needed for conditions.json)
npx openspec validate --strict    # check a proposal's structure
```

Slash commands (in your AI tool's chat):
`/opsx:explore` → `/opsx:propose <name>` → review → `/opsx:apply` → verify → `/opsx:archive`
