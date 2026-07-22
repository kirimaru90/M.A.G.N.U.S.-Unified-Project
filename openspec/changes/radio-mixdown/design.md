## Context

This is a new, self-contained capability with no existing code to integrate with: a root-level `scripts/radio-mixdown/` folder, deliberately outside `apps/` and outside the api/cms/emulator domain model. It exists to turn three separately-recorded audio clips (opening / DJ mid-section / closing) into a single in-universe "old radio broadcast" file for session recaps.

Constraints established during exploration:
- Must run with effectively zero setup (`uv run <script>.py ...`) — no manual venv creation, no `pip install -r requirements.txt` step.
- `ffmpeg` is confirmed not on PATH locally and must not become a required system dependency.
- The three input clips come from different recording sessions/sources with inconsistent volume; the result should still read as "three spliced segments," not one homogenized take.
- The filter recipe (bandpass, hiss, crackle, compression, saturation) needs to be tunable by ear, not just hardcoded — hence the companion Gradio playground.

## Goals / Non-Goals

**Goals:**
- A `mix.py` CLI that reliably produces a WAV broadcast mixdown from three input clips (WAV or MP3), using either a named preset or built-in defaults.
- A `playground.py` Gradio app for interactively tuning filter parameters against real clips and saving the result as a preset.
- One shared preset JSON schema consumed by both tools, so tuning happens once.
- Zero required system dependencies beyond Python + `uv`.

**Non-Goals:**
- No integration with `apps/*`, Docker, or CI — this is a local authoring tool for the repo owner, not a deployed feature.
- No MP3 *output* support — output is always WAV.
- No wow-and-flutter (pitch wobble) effect in this iteration — noted as a clean future addition, not built now.
- No batch processing / multiple-broadcast pipelines — one three-clip mix per invocation.

## Decisions

**Dependency management: PEP 723 inline script metadata + `uv run`, not a shared requirements.txt or project venv.**
Each script declares its own dependencies (`numpy`, `scipy`, `soundfile`, and — for `playground.py` only — `gradio`) in a `# /// script` header block. `uv run` resolves and caches them transparently on first run. Alternative considered: a `requirements.txt` + documented `python -m venv` step — rejected because it reintroduces the manual setup step this tool is explicitly trying to avoid, and because these two scripts don't share a dependency set (the CLI doesn't need `gradio`).

**Audio I/O: `soundfile` (libsndfile) for both WAV and MP3 read, no `ffmpeg` shell-out.**
`libsndfile` >= 1.1.0 added native MP3 read support, and current `soundfile` wheels bundle a recent-enough build on the platforms this matters for (Windows/macOS/Linux x86_64). This avoids the `ffmpeg` system dependency entirely for the read path. Write path stays WAV-only, sidestepping `libsndfile`'s less consistent MP3-encode support (LAME availability varies by build) — acceptable because the output is a broadcast mixdown for this repo's own use, not a distributable format. Alternative considered: `pydub` — rejected because it shells out to `ffmpeg` for anything beyond WAV, which fails the zero-setup goal on this machine.

**DSP stack: `numpy` + `scipy.signal`, hand-rolled filter chain.**
Bandpass via `scipy.signal.butter` + `sosfiltfilt`, compression as a simple envelope-follower gain-reduction function, hiss as generated pink/white noise mixed at a controllable level, crackle as sparse randomly-timed short impulses, soft-clip saturation as a `tanh`-based waveshaper. All are small, dependency-free (beyond numpy/scipy) building blocks, individually parameterized so they map 1:1 onto playground sliders and preset fields.

**Normalization and concatenation order: per-clip peak-normalize → hard-cut concatenate → filter the whole mix.**
Per-clip normalization (independently on opening/mid/closing, before concatenation) fixes inaudible or clipping source clips while preserving each clip's relative dynamic character — deliberately not a single loudness-matching pass across all three, which would flatten the "three different recordings" feel the user wants preserved. Concatenation is a hard cut with no crossfade, for the same reason. The radio filter chain then runs once over the full concatenated result, since the whole thing represents one in-universe broadcast (confirmed: bookends and mid-section are all "on air," not just the transitions).

**Preset format: flat JSON, one file per preset, shared by both scripts.**
```json
{
  "bandpass_low_hz": 300,
  "bandpass_high_hz": 3000,
  "hiss_level": 0.05,
  "crackle_density": 2.0,
  "crackle_intensity": 0.3,
  "compression_amount": 0.4,
  "saturation_amount": 0.2
}
```
Stored under `scripts/radio-mixdown/presets/*.json`. `playground.py` writes this shape on "Save preset"; `mix.py --preset <path>` reads it directly into the same filter-chain function the playground uses — no format translation layer, no risk of the two tools drifting apart. A `default.json` preset ships with the recipe agreed during exploration (bandpass 300–3000 Hz, mild compression, light hiss, light saturation, moderate crackle) so `mix.py` works with zero flags.

**Filter chain and preset logic live in one shared module, not duplicated between `mix.py` and `playground.py`.**
E.g. `_filters.py` (or similar) holds the normalize/concatenate/filter-chain/preset-load-save functions; `mix.py` and `playground.py` are thin CLI/UI wrappers around it. This is what makes "tune in the playground, use in the CLI" actually true rather than aspirational.

## Risks / Trade-offs

- **MP3 read support is a runtime assumption, not a guarantee.** → Mitigation: at startup, `mix.py` attempts the read and, on failure, raises a clear error naming the file and suggesting WAV conversion, rather than a raw traceback or a silent garbage decode. Verified concretely during implementation (task-level check), not just assumed from library changelogs.
- **Hand-rolled DSP (vs. a mature audio-effects library) risks subtle bugs (e.g., filter instability, clipping after saturation).** → Mitigation: unit tests assert no NaN/inf in output, no post-processing clipping beyond intended saturation, and expected output length/sample rate; `sosfiltfilt` (not raw `lfilter`) used for the bandpass to avoid phase/stability issues.
- **Gradio adds a heavier dependency (and slower first-run install) than the CLI alone needs.** → Mitigation: isolated entirely to `playground.py`'s own PEP 723 block; `mix.py` never pulls it in, so day-to-day recap generation stays lightweight.
- **Shared mutable state between playground tuning and preset files** (accidentally overwriting `default.json` while experimenting) → Mitigation: "Save preset" requires an explicit filename/slug from the user; it never silently overwrites `default.json`.

## Open Questions

- Exact default numeric values for `hiss_level`, `crackle_density`, `crackle_intensity`, `compression_amount`, `saturation_amount` in `default.json` are approximate until heard against real clips in the playground — expect the shipped defaults to be adjusted post-implementation via normal preset tuning, not a spec change.
