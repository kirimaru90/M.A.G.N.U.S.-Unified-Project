"""Shared DSP pipeline for the radio-mixdown CLI and playground.

Both mix.py and playground.py import this module so that a preset tuned
interactively in the playground produces byte-for-byte the same result
when applied via the CLI.
"""
from __future__ import annotations

import dataclasses
import json
import math
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, resample_poly, sosfiltfilt

DEFAULT_TARGET_PEAK = 0.95
WORKING_SAMPLE_RATE = 48000
NOISE_FADE_MS = 150.0
OUTPUT_FORMATS = {".wav": ("WAV", "PCM_16"), ".mp3": ("MP3", "MPEG_LAYER_III")}


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


def read_clip(path: str | Path) -> tuple[np.ndarray, int]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Input clip not found: {path}")
    try:
        audio, sample_rate = sf.read(str(path), dtype="float64", always_2d=False)
    except Exception as exc:
        if path.suffix.lower() == ".mp3":
            raise RuntimeError(
                f"Could not decode MP3 file '{path}'. The installed soundfile/libsndfile "
                "build may not support MP3 decoding on this system. "
                "Try converting the file to WAV and re-running."
            ) from exc
        raise RuntimeError(f"Could not read audio file '{path}': {exc}") from exc
    return to_mono(audio), sample_rate


def resample(audio: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    if from_rate == to_rate:
        return audio
    g = math.gcd(from_rate, to_rate)
    return resample_poly(audio, to_rate // g, from_rate // g)


def load_clips(
    paths: list[str | Path],
    sample_rate: int = WORKING_SAMPLE_RATE,
) -> tuple[list[np.ndarray], int, list[tuple[Path, int]]]:
    """Read clips as mono and conform them to one working sample rate.

    Returns the clips, the working rate, and (path, original_rate) for every
    clip that had to be resampled.
    """
    clips = []
    resampled = []
    for path in paths:
        audio, sr = read_clip(path)
        if sr != sample_rate:
            audio = resample(audio, sr, sample_rate)
            resampled.append((Path(path), sr))
        clips.append(audio)
    return clips, sample_rate, resampled


def write_audio(path: str | Path, audio: np.ndarray, sample_rate: int) -> None:
    """Write WAV or MP3, chosen by the file extension."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix not in OUTPUT_FORMATS:
        supported = ", ".join(OUTPUT_FORMATS)
        raise ValueError(f"Unsupported output format '{path.suffix}' for '{path}'. Supported: {supported}.")
    fmt, subtype = OUTPUT_FORMATS[suffix]
    try:
        sf.write(str(path), audio, sample_rate, format=fmt, subtype=subtype)
    except Exception as exc:
        path.unlink(missing_ok=True)
        if suffix == ".mp3":
            raise RuntimeError(
                f"Could not encode MP3 '{path}'. The installed soundfile/libsndfile build "
                "may not support MP3 encoding on this system. Use a .wav output instead."
            ) from exc
        raise RuntimeError(f"Could not write audio file '{path}': {exc}") from exc


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


def fade_edges(audio: np.ndarray, sample_rate: int, fade_ms: float = NOISE_FADE_MS) -> np.ndarray:
    n = min(int(sample_rate * fade_ms / 1000), len(audio) // 2)
    if n <= 0:
        return audio
    out = audio.copy()
    ramp = np.linspace(0.0, 1.0, n, endpoint=False)
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def add_hiss(
    audio: np.ndarray,
    level: float,
    sample_rate: int,
    low_hz: float,
    high_hz: float,
    rng: np.random.Generator,
) -> np.ndarray:
    """Add hiss heard *through* the radio: band-limited, at an absolute RMS level, faded in/out."""
    if level <= 0:
        return audio
    noise = bandpass_filter(rng.standard_normal(audio.shape), sample_rate, low_hz, high_hz)
    rms = np.sqrt(np.mean(noise**2))
    if rms < 1e-12:
        return audio
    noise *= level * DEFAULT_TARGET_PEAK / rms
    return audio + fade_edges(noise, sample_rate)


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
    # Saturation shapes only the program; hiss/crackle sit on top so their level
    # doesn't get lifted by saturate()'s drive + peak make-up gain.
    out = saturate(out, preset.saturation_amount)
    out = add_hiss(out, preset.hiss_level, sample_rate, preset.bandpass_low_hz, preset.bandpass_high_hz, rng)
    out = add_crackle(out, preset.crackle_density, preset.crackle_intensity, sample_rate, rng)

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
