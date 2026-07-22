## Why

Session recaps and in-fiction radio broadcasts are a natural fit for this Fallout-flavored campaign, but producing one currently means manually splicing an opening/DJ/closing clip together in a general-purpose audio editor and eyeballing an "old radio" sound each time. A small, repeatable tool removes that manual work and gives a consistent, tunable broadcast sound.

## What Changes

- Add a new standalone `scripts/radio-mixdown/` folder at the repo root, independent of `apps/` (no app build, deploy, or Docker integration).
- Add `mix.py`: a zero-setup CLI (`uv run mix.py opening mid closing -o out.wav [--preset presets/name.json]`) that peak-normalizes each input clip independently, hard-cut concatenates them in order, and applies an old-timey radio filter chain (bandpass, mono downmix, compression, hiss, saturation, crackle/pop) over the full result.
- Add `playground.py`: a local Gradio web app (`uv run playground.py`) for interactively tuning the filter chain's parameters against real clips, with instant render-and-preview and Save/Load preset controls.
- Add a JSON preset format under `scripts/radio-mixdown/presets/` shared by both tools, so parameters tuned in the playground are usable by the CLI with no manual transcription.
- Support both WAV and MP3 as input formats; output is always WAV.

## Capabilities

### New Capabilities
- `scripts-radio-mixdown`: standalone audio tooling (CLI + interactive playground) that concatenates an opening/mid/closing clip trio, normalizes their volume, and applies a tunable old-timey radio filter to produce an in-universe broadcast recap file.

### Modified Capabilities
(none — this does not touch api-*, cms-*, or emulator-* behavior)

## Impact

- **New code only**: `scripts/radio-mixdown/mix.py`, `scripts/radio-mixdown/playground.py`, `scripts/radio-mixdown/presets/*.json`. No existing files under `apps/` are touched.
- **Dependencies**: `numpy`, `scipy`, `soundfile`, `gradio` — declared via PEP 723 inline script metadata inside each script, resolved on-demand by `uv run` (already installed locally). No project-wide `package.json`/`requirements.txt` changes; no CI or Docker wiring.
- **System requirements**: none beyond Python + `uv`. Explicitly avoids requiring `ffmpeg` on PATH (confirmed not installed locally) by relying on `soundfile`'s built-in MP3 read support instead of shelling out.
- **Repo layout**: introduces the first `scripts/` folder at the repo root; establishes the convention that root-level dev/authoring tools live outside `apps/`.

## Testing

- **Unit (pytest)**, on the DSP pipeline in `mix.py`, using synthetic sine-wave/silence fixtures (no real audio assets needed):
  - Per-clip peak normalization brings each clip to the target peak without clipping.
  - Concatenation preserves hard cuts (output length equals sum of input lengths; no crossfade blending at seams).
  - The radio filter chain (bandpass, hiss, crackle, compression, saturation) runs end-to-end without raising, returns audio of the expected length/sample rate, and produces output that is meaningfully band-limited relative to the input (spectral energy outside the bandpass range is measurably reduced).
  - Preset JSON round-trips: a saved preset, when loaded, reproduces the same filter parameters.
  - MP3 input decodes successfully via `soundfile`; if the installed `soundfile`/`libsndfile` build lacks MP3 read support, the CLI fails with a clear, actionable error rather than a stack trace or silent misdecode.
- **Manual only, explicitly**: the Gradio playground UI itself (slider layout, drag-and-drop, live preview/render loop) has no automated coverage — it is a local, single-user dev tool with no headless-browser harness in this repo (Playwright coverage here is scoped to the emulator app's `index.html`, per `enable-emulator-testing`, which doesn't apply to an unrelated root-level Python tool). Verified by hand: render a mix from real clips, confirm playback and preset save/load.
