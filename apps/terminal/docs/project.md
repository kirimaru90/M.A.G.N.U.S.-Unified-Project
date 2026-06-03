# Fallout Terminal Simulator — Project

## Vision

An immersive, browser-based interactive terminal simulator faithful to the RobCo Industries terminals from the Fallout universe. The system allows content creators to write branching narrative experiences (called *olonastri*) in JSON, which are rendered through a CRT-accurate phosphor-green interface with no backend required.

## Goals

- Deliver a faithful Fallout terminal aesthetic: green phosphor text, CRT scan lines, typewriter effect, click audio
- Enable non-technical authors to create branching stories by editing JSON files only — no code changes required
- Support Markdown formatting inside terminal nodes for rich content
- Run anywhere: static files served locally, via Docker/nginx, or from any static host
- Keep the engine (index.html) immutable; all new content lives in `dati/`

## Non-Goals

- No server-side logic, authentication, or database
- No multi-user or networked play features
- No custom scripting language — content authors use JSON + Markdown only
- No official English localization (UI and docs are Italian)

## Key Concepts

| Term | Meaning |
|---|---|
| **Olonastro** | A single content file (`dati/*.json`) representing one "holotape" or story |
| **Nodo** | A terminal screen within an olonastro — has `text` and `choices` |
| **Manifest** | `dati/manifest.json` — the registry linking file names to display labels |
| **Engine** | `index.html` — the single-file application; not to be modified for content |
| **Start node** | The mandatory entry node (`"start"`) every olonastro must define |

## Stakeholders

- **Content creators** — write olonastri (JSON files); primary users of the documentation
- **Project maintainer** — owns the engine (`index.html`) and deployment configuration
- **End users** — navigate terminals in a browser; Fallout fans or tabletop RPG players

## Tech Stack

- **Runtime**: Vanilla HTML5 / CSS3 / JavaScript (no build step)
- **Markdown rendering**: marked.js (CDN)
- **Deployment**: Docker + nginx:alpine, or any static file host
- **Data format**: JSON (content) + manifest pattern

## Domain Knowledge

All UI labels, documentation, and example content are in **Italian**. The project uses Fallout lore-accurate naming: "RobCo Industries", "ROBCO OLONASTRO READER", and dated references to 2077 (the Fallout in-universe apocalypse year).
