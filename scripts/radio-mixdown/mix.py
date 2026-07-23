# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "numpy",
#     "scipy",
#     "soundfile",
# ]
# ///
"""CLI: concatenate an opening/mid/closing clip trio into an old-timey radio broadcast mixdown.

Usage:
    uv run mix.py opening.wav mid.wav closing.wav -o recap.wav
    uv run mix.py opening.mp3 mid.mp3 closing.mp3 -o recap.wav --preset presets/warm-static.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _filters as filters

DEFAULT_PRESET_PATH = Path(__file__).resolve().parent / "presets" / "default.json"


def load_clip(path: Path) -> tuple[np.ndarray, int]:
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
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sample_rate


def build_output(opening: Path, mid: Path, closing: Path, preset: filters.Preset) -> tuple[np.ndarray, int]:
    clips = []
    sample_rate = None
    for path in (opening, mid, closing):
        audio, sr = load_clip(path)
        if sample_rate is None:
            sample_rate = sr
        elif sr != sample_rate:
            raise RuntimeError(
                f"Sample rate mismatch: '{path}' is {sr} Hz but expected {sample_rate} Hz. "
                "Ensure all three clips share the same sample rate."
            )
        clips.append(audio)
    mix = filters.build_mix(clips, sample_rate, preset)
    return mix, sample_rate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Concatenate an opening/mid/closing clip trio into an old-timey radio broadcast."
    )
    parser.add_argument("opening", type=Path, help="Path to the opening/station-ID clip")
    parser.add_argument("mid", type=Path, help="Path to the mid/DJ-content clip")
    parser.add_argument("closing", type=Path, help="Path to the closing/sign-off clip")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output WAV path")
    parser.add_argument(
        "--preset",
        type=Path,
        default=DEFAULT_PRESET_PATH,
        help="Path to a preset JSON file (defaults to presets/default.json)",
    )
    args = parser.parse_args(argv)

    try:
        preset = filters.load_preset(args.preset)
    except FileNotFoundError:
        print(f"Preset file not found: {args.preset}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"Invalid preset JSON in '{args.preset}': {exc}", file=sys.stderr)
        return 1

    try:
        mix, sample_rate = build_output(args.opening, args.mid, args.closing, preset)
    except (FileNotFoundError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(args.output), mix, sample_rate, subtype="PCM_16")
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
