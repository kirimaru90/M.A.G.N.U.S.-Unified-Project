# radio-mixdown

Turns an opening / mid / closing clip trio into a single in-universe old-timey
radio broadcast recap: each clip is peak-normalized independently, hard-cut
concatenated in order, then run through a tunable radio filter chain
(bandpass, mono downmix, compression, saturation, then band-limited hiss and
crackle layered on top).

Standalone tool — not linked to any app under `apps/`. No system dependencies
beyond Python and [`uv`](https://docs.astral.sh/uv/); `ffmpeg` is not required.

## CLI

```sh
uv run mix.py opening.wav mid.wav closing.wav -o recap.wav
uv run mix.py opening.mp3 mid.mp3 closing.mp3 -o recap.mp3 --preset presets/warm-static.json
```

Input clips may be WAV or MP3 (MP3 read support depends on the installed
`soundfile`/`libsndfile` build) and may have different sample rates: any clip
not already at 48 kHz is resampled (noted on stderr). Output is 48 kHz WAV or
MP3, picked from the `-o` extension (`.wav` / `.mp3`). Without `--preset`,
`presets/default.json` is used.

A file must really be the format its extension says: some downloaders save
MP4/AAC audio with a `.mp3` name, which libsndfile cannot read.

## Playground

```sh
uv run playground.py
```

Opens a local Gradio tab: drag in the three clips, adjust the filter sliders,
render a preview, and save the tuned parameters as a preset — the same JSON
format `mix.py --preset` reads, so nothing needs to be retyped. Pick WAV or MP3
and click **Export** to download exactly the take you just previewed (hiss and
crackle are random per render, so re-rendering would differ).

`hiss_level` is an absolute level, independent of saturation. Presets saved
before this was fixed had their hiss boosted by saturation, so they now sound
less hissy — re-tune by ear.

## Presets

Flat JSON under `presets/*.json`:

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

## Tests

```sh
uv run --project . pytest tests
```

(run from `scripts/radio-mixdown/`, or pass `--project scripts/radio-mixdown`
from the repo root)
