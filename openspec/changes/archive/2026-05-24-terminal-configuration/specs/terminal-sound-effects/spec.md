## ADDED Requirements

### Requirement: Global sound enable switch
The sound engine SHALL expose a global enable flag and a `setSoundEnabled(boolean)`
setter, initialized from `soundEnabled` in the active configuration. When sound is
disabled, every one-shot `play()` and every loop `start()` SHALL become a no-op and
SHALL NOT begin or resume playback. Disabling sound while a loop is playing SHALL
stop it.

#### Scenario: Disabled sound suppresses playback
- **WHEN** `setSoundEnabled(false)` has been called
- **AND** any sound's `play()` or a loop's `start()` is invoked
- **THEN** no audio SHALL be produced
- **THEN** no error SHALL be thrown

#### Scenario: Re-enabling restores playback
- **WHEN** `setSoundEnabled(true)` is called after being disabled
- **AND** a sound's `play()` is invoked
- **THEN** the audio clip SHALL play normally

#### Scenario: Disabling stops an active loop
- **WHEN** a loop sound is playing and `setSoundEnabled(false)` is called
- **THEN** the loop SHALL stop

### Requirement: Master sound volume
The sound engine SHALL expose `setSoundVolume(level)` where `level` is clamped to
`0.0–1.0`, initialized from `soundVolume` in the active configuration. The current
volume SHALL be applied to each audio element's `volume` before playback so all
sounds honor the master level.

#### Scenario: Volume applied to playback
- **WHEN** `setSoundVolume(0.5)` has been called
- **AND** any sound is played
- **THEN** that sound's audio element `volume` SHALL be `0.5` during playback

#### Scenario: Volume is clamped
- **WHEN** `setSoundVolume` is called with a value outside `0.0–1.0`
- **THEN** the applied volume SHALL be clamped into the `0.0–1.0` range
