"""Shared DSP pipeline for the radio-mixdown CLI and playground.

Both mix.py and playground.py import this module so that a preset tuned
interactively in the playground produces byte-for-byte the same result
when applied via the CLI.
"""
from __future__ import annotations

import dataclasses
import json
from pathlib import Path

import numpy as np
from scipy.signal import butter, lfilter, sosfiltfilt

DEFAULT_TARGET_PEAK = 0.95


@dataclasses.dataclass
class Preset:
    bandpass_low_hz: float = 300.0
    bandpass_high_hz: float = 3000.0
    hiss_level: float = 0.05
    crackle_density: float = 2.0
    crackle_intensity: float = 0.3
    compression_amount: float = 0.4
    saturation_amount: float = 0.2

    @classmethod
    def from_dict(cls, data: dict) -> "Preset":
        return cls(**data)

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


def load_preset(path: str | Path) -> Preset:
    data = json.loads(Path(path).read_text())
    return Preset.from_dict(data)


def save_preset(path: str | Path, preset: Preset) -> None:
    Path(path).write_text(json.dumps(preset.to_dict(), indent=2))


def normalize_peak(audio: np.ndarray, target_peak: float = DEFAULT_TARGET_PEAK) -> np.ndarray:
    peak = np.max(np.abs(audio))
    if peak < 1e-9:
        return audio.copy()
    return audio * (target_peak / peak)


def concatenate_clips(clips: list[np.ndarray]) -> np.ndarray:
    return np.concatenate(clips, axis=0)


def to_mono(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 1:
        return audio
    return audio.mean(axis=1)


def bandpass_filter(audio: np.ndarray, sample_rate: int, low_hz: float, high_hz: float) -> np.ndarray:
    nyquist = sample_rate / 2
    low = min(max(low_hz / nyquist, 1e-5), 0.99)
    high = min(max(high_hz / nyquist, low + 1e-4), 0.999)
    sos = butter(4, [low, high], btype="bandpass", output="sos")
    return sosfiltfilt(sos, audio, axis=0)


def compress(
    audio: np.ndarray,
    amount: float,
    sample_rate: int,
    threshold: float = 0.3,
    ratio: float = 4.0,
    time_constant_ms: float = 30.0,
) -> np.ndarray:
    if amount <= 0:
        return audio

    coeff = np.exp(-1.0 / (sample_rate * time_constant_ms / 1000))
    envelope = lfilter([1 - coeff], [1, -coeff], np.abs(audio))
    envelope = np.maximum(envelope, 1e-6)

    over_db = np.maximum(20 * np.log10(envelope / threshold), 0)
    reduction_db = over_db * (1 - 1 / ratio) * amount
    gain = 10 ** (-reduction_db / 20)

    compressed = audio * gain
    peak_before = np.max(np.abs(audio)) + 1e-9
    peak_after = np.max(np.abs(compressed)) + 1e-9
    return compressed * (peak_before / peak_after)


def add_hiss(audio: np.ndarray, level: float, rng: np.random.Generator) -> np.ndarray:
    if level <= 0:
        return audio
    noise = rng.standard_normal(audio.shape)
    return audio + noise * level * DEFAULT_TARGET_PEAK


def add_crackle(
    audio: np.ndarray,
    density: float,
    intensity: float,
    sample_rate: int,
    rng: np.random.Generator,
) -> np.ndarray:
    if density <= 0 or intensity <= 0:
        return audio

    duration_s = len(audio) / sample_rate
    n_pops = int(round(density * duration_s))
    if n_pops <= 0:
        return audio

    pop_len = max(1, int(sample_rate * 0.002))
    out = audio.copy()
    positions = rng.integers(0, max(len(out) - pop_len, 1), size=n_pops)
    for pos in positions:
        end = min(pos + pop_len, len(out))
        shape = np.hanning(end - pos)
        sign = 1.0 if rng.random() < 0.5 else -1.0
        out[pos:end] += sign * intensity * DEFAULT_TARGET_PEAK * shape
    return out


def saturate(audio: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0:
        return audio
    drive = 1 + amount * 9
    shaped = np.tanh(audio * drive)
    peak_before = np.max(np.abs(audio)) + 1e-9
    peak_after = np.max(np.abs(shaped)) + 1e-9
    return shaped * (peak_before / peak_after)


def apply_filter_chain(
    audio: np.ndarray,
    sample_rate: int,
    preset: Preset,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    if rng is None:
        rng = np.random.default_rng()

    out = bandpass_filter(audio, sample_rate, preset.bandpass_low_hz, preset.bandpass_high_hz)
    out = to_mono(out)
    out = compress(out, preset.compression_amount, sample_rate)
    out = add_hiss(out, preset.hiss_level, rng)
    out = add_crackle(out, preset.crackle_density, preset.crackle_intensity, sample_rate, rng)
    out = saturate(out, preset.saturation_amount)

    out = np.nan_to_num(out, nan=0.0, posinf=1.0, neginf=-1.0)
    out = np.clip(out, -1.0, 1.0)
    return out.astype(np.float32)


def build_mix(
    clips: list[np.ndarray],
    sample_rate: int,
    preset: Preset,
    target_peak: float = DEFAULT_TARGET_PEAK,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    normalized = [normalize_peak(clip, target_peak) for clip in clips]
    concatenated = concatenate_clips(normalized)
    return apply_filter_chain(concatenated, sample_rate, preset, rng=rng)
