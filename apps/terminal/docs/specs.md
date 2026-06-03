# Fallout Terminal Simulator — Technical Specifications

## Architecture

The application follows a **three-layer content architecture**:

```
index.html          ← Engine layer (immutable)
    ↓ fetches
dati/manifest.json  ← Registry layer (add entries to expose new olonastri)
    ↓ points to
dati/*.json         ← Content layer (one file per olonastro)
```

All layers are static files. There is no server-side processing.

---

## Engine (`index.html`)

Single self-contained HTML file that includes all CSS and JavaScript inline.

### Startup Sequence

1. DOM ready → `initTerminal()` called
2. Fetch `dati/manifest.json`
3. Render boot header + one `<button>` per manifest entry
4. On button click → `loadTerminal(filename)` fetches the selected olonastro JSON
5. Navigate to the `"start"` node

### State Variables

| Variable | Type | Purpose |
|---|---|---|
| `terminalData` | `Object` | Loaded olonastro JSON (all nodes) |
| `navigationHistory` | `Array<string>` | Stack of visited node IDs for back navigation |
| `isTyping` | `boolean` | Lock to prevent concurrent typewriter runs |
| `audioUnlocked` | `boolean` | Whether browser audio context has been unblocked |
| `clickSound` | `Audio` | Reusable Audio object for the typing click |

### Key Functions

| Function | Signature | Description |
|---|---|---|
| `initTerminal` | `() → void` | Bootstraps app; fetches manifest |
| `loadTerminal` | `(filename: string) → void` | Fetches olonastro JSON; navigates to `start` |
| `navigateTo` | `(nodeId: string) → void` | Renders a node; pushes to history |
| `typeText` | `(element, html, callback) → void` | Typewriter effect; char-by-char with audio |
| `goBack` | `() → void` | Pops history stack; re-renders previous node |

### Typewriter Behaviour

- Iterates over rendered HTML character by character
- HTML tags are output at 0 ms delay (invisible to user)
- Visible characters trigger `click.mp3` playback and a 25 ms delay
- Audio requires a prior user gesture (browser security); `audioUnlocked` flag tracks this

### Navigation

- `navigationHistory` is a simple array; `navigateTo` pushes, `goBack` pops
- "Torna al menu precedente" back button is auto-injected at node render time
- The back button is hidden when `navigationHistory.length <= 1`

---

## Manifest Schema (`dati/manifest.json`)

```json
[
  {
    "file": "<filename>.json",
    "nome": "<Display label shown on boot screen>"
  }
]
```

- **Array** of entry objects (order determines button order on boot screen)
- `file` — relative filename inside `dati/` (no path prefix needed)
- `nome` — Italian display name rendered as the button label

---

## Olonastro Schema (`dati/*.json`)

```json
{
  "start": {
    "text": "<Markdown string>",
    "choices": [
      {
        "label": "<Button text>",
        "next": "<node_id>"
      }
    ]
  },
  "<node_id>": {
    "text": "<Markdown string>",
    "choices": []
  }
}
```

### Node Object

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | Yes | Markdown content rendered as terminal output |
| `choices` | `Array<Choice>` | Yes | Interactive buttons; empty array = terminal node |

### Choice Object

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | Yes | Button text shown to user |
| `next` | `string` | Yes | ID of the destination node within the same file |

### Constraints

- Every olonastro **must** have a `"start"` node
- `next` values must reference a valid key in the same JSON file
- Terminal nodes (dead ends) use `"choices": []` — the engine shows only the back button
- Node IDs are arbitrary strings; use descriptive snake_case names by convention

---

## Styling Specifications

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--terminal-green` | `#33ff00` | Primary text, borders, buttons |
| `--terminal-dark` | `#001a00` | Page and terminal background |
| `--terminal-glow` | `rgba(51,255,0,0.1)` | Button hover background |
| `--scan-line` | `rgba(0,0,0,0.15)` | CRT scan line overlay |

### CRT Effects

- **Scan lines**: repeating-linear-gradient overlay with 4px stripes at 15% opacity
- **Phosphor aberration**: `text-shadow` with red +1px / blue -1px offsets
- **Glow**: `box-shadow` on the terminal container (multi-layer green glow)
- **Cursor blink**: `@keyframes blink` toggles border-right on `.cursor` at 0.7s intervals

### Typography

- Font: `VT323` (Google Fonts) with `Courier New` monospace fallback
- Base size: 18px
- Headings (via Markdown `#`): up to 28px, uppercase

---

## Deployment

### Docker (recommended)

```yaml
# docker-compose.yml
services:
  terminal:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - .:/usr/share/nginx/html:ro
```

Run with: `docker compose up`  
Access at: `http://localhost:8080`

### Local (no Docker)

Any static file server works. Example with Python:

```bash
python -m http.server 8080
```

### Static Hosting

Upload the entire project directory to any static host (GitHub Pages, Netlify, etc.). No build step required.

---

## Extending the System

### Adding a New Olonastro

1. Create `dati/<name>.json` following the Olonastro Schema
2. Add an entry to `dati/manifest.json`
3. Reload the page — no code changes needed

### Adding Audio

Place `click.mp3` in the project root. The engine references it at `./click.mp3`. If absent, navigation works silently (no error).

### Changing Typewriter Speed

In `index.html`, locate `typeText` and adjust the `delay` constant (default: 25 ms per character).
