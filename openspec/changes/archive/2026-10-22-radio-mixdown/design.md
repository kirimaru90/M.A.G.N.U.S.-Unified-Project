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
- No wow-and-flutter (pitch wobble) effect in this iteration — noted as a clean future addition, not built now.
- No batch processing / multiple-broadcast pipelines — one three-clip mix per invocation.

## Decisions

**Dependency management: PEP 723 inline script metadata + `uv run`, not a shared requirements.txt or project venv.**
Each script declares its own dependencies (`numpy`, `scipy`, `soundfile`, and — for `playground.py` only — `gradio`) in a `# /// script` header block. `uv run` resolves and caches them transparently on first run. Alternative considered: a `requirements.txt` + documented `python -m venv` step — rejected because it reintroduces the manual setup step this tool is explicitly trying to avoid, and because these two scripts don't share a dependency set (the CLI doesn't need `gradio`).

**Audio I/O: `soundfile` (libsndfile) for both WAV and MP3 read, no `ffmpeg` shell-out.**
`libsndfile` >= 1.1.0 added native MP3 read support, and current `soundfile` wheels bundle a recent-enough build on the platforms this matters for (Windows/macOS/Linux x86_64). This avoids the `ffmpeg` system dependency entirely for the read path. The write path supports WAV and MP3 (see "Output format" below); MP3 encoding depends on LAME being in the libsndfile build, so it fails with a clear error where it isn't. Alternative considered: `pydub` — rejected because it shells out to `ffmpeg` for anything beyond WAV, which fails the zero-setup goal on this machine.

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

**Mixed input sample rates: resample every clip to a fixed 48 kHz working rate in one shared loader.**
Clips come from different sources, and 44.1 kHz vs 48 kHz is a routine mismatch (discovered during manual playground verification: a 48 kHz MP3 alongside 44.1 kHz clips was rejected). Rather than rejecting the trio, a shared `_filters.py` loader (e.g. `load_clips(paths) -> (clips, sample_rate)`) reads each clip, downmixes to mono, and resamples any clip not already at 48 kHz using `scipy.signal.resample_poly` (rational ratio, e.g. 160/147 for 44.1k → 48k). Output is always written at 48 kHz.
- *Why fixed, not "first clip" or "highest input":* the output rate never depends on clip order or content, and the CLI and playground can't drift — which matters because crackle timing/pop length derive from `sample_rate`, so a different working rate would make CLI output differ from the playground preview even with an identical preset.
- *Why 48 kHz:* never downsamples a 48 kHz source; 44.1 kHz sources upsample cleanly.
- *Why resample quality is a non-issue:* the bandpass removes everything above `bandpass_high_hz` (≤ 8 kHz by slider range, 3 kHz by default), far below either rate's Nyquist, so any resampling artifact is filtered out.
- `mix.py` and `playground.py` both call this loader; neither keeps its own read/downmix/rate-check code. When a clip is resampled, the CLI prints a one-line note to stderr (`resampled <file>: 44100 → 48000 Hz`); the playground may surface the same note via `gr.Info`.
- Alternative considered: keep the rejection and tell the user to convert — rejected because conversion would need an external tool, contradicting the zero-setup / no-ffmpeg goal.

**Noise bed is added after saturation, band-limited, and faded in/out.**
Chain order is bandpass → mono → compress → saturate → hiss → crackle. Manual verification found that adding hiss *before* the saturation stage made `hiss_level` meaningless: `saturate()` drives by up to 10× then restores the original peak, which lifts every low-level signal by roughly the drive factor (measured: `hiss_level=0.05` gave −26.5 dB RMS hiss at saturation 0, −16.4 dB at 0.2, −10.9 dB at 0.5). Saturation therefore only shapes the broadcast content; hiss and crackle are layered on top as the "reception" noise, so `hiss_level` sets an absolute RMS level independent of the other sliders. The hiss is run through the same bandpass as the program (noise heard *through* the radio, not full-band 0–24 kHz white noise) and rescaled after filtering so its RMS stays `hiss_level × target peak`. The hiss bed fades in and out over 150 ms so playback never starts on an instant wall of noise. Existing presets will sound noticeably less hissy and may need re-tuning by ear.

**Output format: WAV or MP3, chosen by the user.**
The pinned `soundfile` build (libsndfile 1.2.2) encodes MP3 (`MPEG_LAYER_III`), verified on this machine. A shared `write_audio(path, audio, sample_rate)` in `_filters.py` picks the format from the file extension (`.wav` → PCM_16, `.mp3` → MPEG Layer III); any other extension is rejected. If the libsndfile build can't encode MP3, it raises a clear error suggesting `.wav` and leaves no partial file. The CLI derives the format from `-o`; the playground offers a WAV/MP3 selector and an Export button that writes the **last rendered preview** (kept in `gr.State`) rather than re-rendering — hiss and crackle are random per render, so exporting the heard take is the only way "export" matches "preview". Gradio's own numpy-to-MP3 path needs ffmpeg (via pydub), so the playground writes the file itself and returns it via `gr.File`.

## Risks / Trade-offs

- **MP3 read support is a runtime assumption, not a guarantee.** → Mitigation: at startup, `mix.py` attempts the read and, on failure, raises a clear error naming the file and suggesting WAV conversion, rather than a raw traceback or a silent garbage decode. Verified concretely during implementation (task-level check), not just assumed from library changelogs.
- **Hand-rolled DSP (vs. a mature audio-effects library) risks subtle bugs (e.g., filter instability, clipping after saturation).** → Mitigation: unit tests assert no NaN/inf in output, no post-processing clipping beyond intended saturation, and expected output length/sample rate; `sosfiltfilt` (not raw `lfilter`) used for the bandpass to avoid phase/stability issues.
- **Gradio adds a heavier dependency (and slower first-run install) than the CLI alone needs.** → Mitigation: isolated entirely to `playground.py`'s own PEP 723 block; `mix.py` never pulls it in, so day-to-day recap generation stays lightweight.
- **Shared mutable state between playground tuning and preset files** (accidentally overwriting `default.json` while experimenting) → Mitigation: "Save preset" requires an explicit filename/slug from the user; it never silently overwrites `default.json`.

## Open Questions

- Exact default numeric values for `hiss_level`, `crackle_density`, `crackle_intensity`, `compression_amount`, `saturation_amount` in `default.json` are approximate until heard against real clips in the playground — expect the shipped defaults to be adjusted post-implementation via normal preset tuning, not a spec change.
