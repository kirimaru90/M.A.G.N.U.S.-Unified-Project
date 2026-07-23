## 1. Scaffolding

- [x] 1.1 Create `scripts/radio-mixdown/` folder at the repo root with `presets/` subfolder
- [x] 1.2 Add PEP 723 inline script metadata blocks to `mix.py` and `playground.py` declaring their dependencies (`numpy`, `scipy`, `soundfile` for both; `gradio` additionally for `playground.py`)
- [x] 1.3 Add a short `scripts/radio-mixdown/README.md` documenting the `uv run` invocations for both tools and the preset file format

## 2. Shared DSP Module

- [x] 2.1 Create `scripts/radio-mixdown/_filters.py` with a preset dataclass/dict shape matching the schema in design.md (`bandpass_low_hz`, `bandpass_high_hz`, `hiss_level`, `crackle_density`, `crackle_intensity`, `compression_amount`, `saturation_amount`)
- [x] 2.2 Implement per-clip peak normalization (independent per clip, target peak configurable/constant)
- [x] 2.3 Implement hard-cut concatenation of three normalized clips in order
- [x] 2.4 Implement bandpass filter using `scipy.signal.butter` + `sosfiltfilt`
- [x] 2.5 Implement mono downmix
- [x] 2.6 Implement dynamic-range compression (envelope-follower gain reduction)
- [x] 2.7 Implement hiss generation (pink/white noise mixed at `hiss_level`)
- [x] 2.8 Implement crackle/pop generation (sparse random impulses parameterized by `crackle_density`, `crackle_intensity`)
- [x] 2.9 Implement soft-clip saturation (`tanh`-based waveshaper at `saturation_amount`)
- [x] 2.10 Implement `apply_filter_chain(audio, sample_rate, preset)` composing 2.4–2.9 in order over the full concatenated mix
- [x] 2.11 Implement preset JSON load/save functions (`load_preset(path)`, `save_preset(path, preset)`)
- [x] 2.12 Ship `scripts/radio-mixdown/presets/default.json` with the recipe from design.md (bandpass 300–3000 Hz, mild compression, light hiss, light saturation, moderate crackle)

## 3. DSP Unit Tests

- [x] 3.1 Add `scripts/radio-mixdown/tests/test_filters.py` using synthetic sine-wave/silence fixtures (no real audio assets)
- [x] 3.2 Test: per-clip normalization brings each clip to target peak without clipping (covers quiet-clip and loud-clip cases)
- [x] 3.3 Test: concatenation output length equals sum of input lengths; no crossfade/blend at seams (abrupt sample-level transition)
- [x] 3.4 Test: bandpass filter measurably reduces spectral energy outside the configured range while preserving energy within it
- [x] 3.5 Test: stereo input to the filter chain produces mono output
- [x] 3.6 Test: hiss/crackle parameters at zero remove that component; nonzero values produce measurable added noise/impulses
- [x] 3.7 Test: filter chain output contains no NaN/inf values and no out-of-range samples for a range of preset values
- [x] 3.8 Test: preset save → load round-trip reproduces identical parameter values

## 4. CLI (`mix.py`)

- [x] 4.1 Implement argument parsing: three positional input paths, `-o/--output`, optional `--preset`
- [x] 4.2 Wire input loading via `soundfile` supporting WAV and MP3, applying 2.2–2.10 and writing WAV output
- [x] 4.3 Add clear error handling for missing input files (fail before producing partial output)
- [x] 4.4 Add clear, actionable error handling for MP3 decode failures (name the file, state MP3 support is unavailable, no raw traceback)
- [x] 4.5 Default to `presets/default.json` when `--preset` is not supplied

## 5. CLI Tests

- [x] 5.1 Add `scripts/radio-mixdown/tests/test_mix_cli.py`
- [x] 5.2 Test: missing input file exits with a clear error and no output file is created
- [x] 5.3 Test: end-to-end mixdown with synthetic WAV fixtures and default preset produces a valid WAV of expected duration
- [x] 5.4 Test: `--preset` flag applies the specified preset's parameters (verify via a mocked/spied filter-chain call or by comparing output against two different presets)
- [x] 5.5 Test: MP3 input decoding failure path produces the actionable error message (simulate unsupported-format condition)

## 6. Interactive Playground (`playground.py`)

- [x] 6.1 Implement Gradio layout: three file inputs (opening/mid/closing), sliders for all seven filter parameters, Render button, audio player output
- [x] 6.2 Wire Render to call the shared `_filters` pipeline (normalize → concatenate → apply_filter_chain) using current slider values
- [x] 6.3 Implement Save-preset control (name input + save button) writing to `scripts/radio-mixdown/presets/<name>.json` via `save_preset`
- [x] 6.4 Implement Load-preset control (dropdown of existing presets) that updates all sliders via `load_preset`
- [x] 6.5 Guard against overwriting `default.json` from the Save-preset control without explicit confirmation

## 7. Manual Verification

- [ ] 7.1 Run `uv run scripts/radio-mixdown/playground.py`, load real opening/mid/closing clips, confirm render + inline playback works and sounds like an old radio broadcast
- [ ] 7.2 Save a preset from the playground, then run `uv run scripts/radio-mixdown/mix.py <clips> --preset <saved preset>` and confirm the CLI output matches what was previewed
- [x] 7.3 Confirm `uv run` works from a clean environment (no pre-existing venv) for both scripts with no manual setup steps

## 8. Final Verification

- [x] 8.1 Run the full pytest suite (`uv run pytest scripts/radio-mixdown/tests`) and confirm all tests pass
