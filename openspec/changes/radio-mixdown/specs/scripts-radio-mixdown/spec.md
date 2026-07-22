## ADDED Requirements

### Requirement: CLI Broadcast Mixdown
The system SHALL provide a `mix.py` CLI that accepts three input audio file paths (opening, mid, closing, in that order) and an output path, and produces a single WAV file containing the normalized, concatenated, radio-filtered broadcast.

#### Scenario: Successful mixdown with default preset
- **WHEN** a user runs `uv run mix.py opening.wav mid.wav closing.wav -o recap.wav` with no `--preset` flag
- **THEN** the system generates `recap.wav` using the built-in default filter preset, containing the three clips normalized, concatenated in order, and radio-filtered

#### Scenario: Successful mixdown with a named preset
- **WHEN** a user runs `mix.py` with `--preset presets/warm-static.json` pointing at a valid preset file
- **THEN** the system loads that preset's filter parameters and applies them instead of the defaults

#### Scenario: Missing input file
- **WHEN** one of the three input file paths does not exist
- **THEN** the system exits with a clear error naming the missing file, without producing a partial output file

### Requirement: Per-Clip Volume Normalization
The system SHALL peak-normalize each of the three input clips independently, before concatenation, so that no clip is inaudibly quiet or clipping, while preserving each clip's relative dynamic character.

#### Scenario: Quiet clip is brought up to an audible level
- **WHEN** the mid clip's peak amplitude is significantly lower than the opening and closing clips
- **THEN** the mid clip is normalized to the target peak level independently, without being scaled relative to the other two clips' loudness

#### Scenario: Clipping clip is brought down to the target peak
- **WHEN** an input clip's peak amplitude exceeds the target normalization level
- **THEN** that clip is scaled down so its peak matches the target level and no sample exceeds full scale

### Requirement: Hard-Cut Concatenation
The system SHALL concatenate the three normalized clips in opening → mid → closing order with a hard cut at each boundary and no crossfade or blending.

#### Scenario: Output length matches sum of input lengths
- **WHEN** three clips of known individual duration are concatenated
- **THEN** the resulting concatenated audio's duration equals the sum of the three input durations (no added or removed samples at the seams)

#### Scenario: No crossfade artifacts at seams
- **WHEN** two adjacent clips with different amplitude/character are concatenated
- **THEN** the transition between them is an abrupt cut, with no fade-in/fade-out or cross-blended region introduced at the boundary

### Requirement: Old-Timey Radio Filter Chain
The system SHALL apply a filter chain to the full concatenated mix consisting of: a bandpass filter, mono downmix, dynamic-range compression, background hiss, crackle/pop, and soft-clip saturation, each independently parameterized.

#### Scenario: Bandpass filter attenuates frequencies outside the configured range
- **WHEN** the filter chain runs with `bandpass_low_hz` and `bandpass_high_hz` set to specific values
- **THEN** the output's spectral energy outside that range is measurably reduced relative to the input, and energy within the range is substantially preserved

#### Scenario: Stereo input is downmixed to mono
- **WHEN** an input mix has two channels
- **THEN** the filtered output has a single channel

#### Scenario: Hiss and crackle are present and tunable
- **WHEN** `hiss_level`, `crackle_density`, and `crackle_intensity` are set to nonzero values
- **THEN** the output contains added background noise and sparse impulse artifacts whose overall level scales with those parameters; setting a parameter to zero removes that component from the output

#### Scenario: Filter chain never produces invalid audio
- **WHEN** the filter chain runs on any valid input clip combination
- **THEN** the output contains no NaN or infinite sample values and no samples exceed full scale

### Requirement: MP3 Input Support with WAV-Only Output
The system SHALL accept input clips in WAV or MP3 format, and SHALL always write the output mixdown as WAV regardless of input format.

#### Scenario: MP3 input is decoded successfully
- **WHEN** one or more of the three input clips is an MP3 file and the installed audio backend supports MP3 decoding
- **THEN** the system reads it correctly and includes it in the mixdown

#### Scenario: MP3 decoding is unsupported in the current environment
- **WHEN** an MP3 input is provided but the installed `soundfile`/`libsndfile` build cannot decode MP3
- **THEN** the system fails with a clear, actionable error identifying the file and the missing MP3 support, rather than raising a raw traceback or producing corrupted output

#### Scenario: Output is always WAV
- **WHEN** the mixdown completes, regardless of whether inputs were WAV, MP3, or a mix of both
- **THEN** the output file is a valid WAV file at the path the user specified

### Requirement: Shared Preset Format
The system SHALL define a single JSON preset schema for the filter chain's parameters, readable and writable by both `mix.py` and `playground.py`, so parameters tuned in one tool are directly usable by the other with no manual transcription.

#### Scenario: Preset saved by the playground is usable by the CLI
- **WHEN** a preset JSON file is saved from the playground with a given set of filter parameter values
- **THEN** running `mix.py --preset <that file>` applies the exact same parameter values

#### Scenario: A default preset ships with the tool
- **WHEN** `mix.py` is run without a `--preset` flag
- **THEN** it uses a built-in default preset that requires no external file

### Requirement: Interactive Playground for Parameter Tuning
The system SHALL provide a `playground.py` local Gradio web application that lets a user load three clips, adjust filter chain parameters via sliders, render and preview the result, and save/load presets.

#### Scenario: Rendering a preview from the playground
- **WHEN** a user loads three clips into the playground, adjusts one or more sliders, and triggers render
- **THEN** the playground produces a filtered concatenated preview audible via an inline player, using the current slider values

#### Scenario: Saving a preset from the playground
- **WHEN** a user sets slider values and chooses to save a preset under a given name
- **THEN** a JSON preset file matching the shared preset schema is written under `scripts/radio-mixdown/presets/` with that name

#### Scenario: Loading a preset into the playground
- **WHEN** a user selects an existing preset file to load
- **THEN** all sliders update to reflect that preset's parameter values

### Requirement: Zero-Setup Execution
The system SHALL be runnable via `uv run <script>.py` with no manual virtual environment creation or dependency installation step, and SHALL NOT require `ffmpeg` or any other system-level binary dependency.

#### Scenario: Running the CLI on a machine with only Python and uv installed
- **WHEN** a user with no pre-existing virtual environment runs `uv run scripts/radio-mixdown/mix.py ...`
- **THEN** `uv` resolves and installs the script's declared dependencies automatically and the command completes without a manual setup step

#### Scenario: No ffmpeg dependency
- **WHEN** the CLI or playground processes WAV or MP3 input
- **THEN** no call is made to an external `ffmpeg` binary, and the tools function correctly on a machine without `ffmpeg` on PATH
