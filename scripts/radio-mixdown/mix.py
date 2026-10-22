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
    uv run mix.py opening.mp3 mid.mp3 closing.mp3 -o recap.mp3 --preset presets/warm-static.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _filters as filters

DEFAULT_PRESET_PATH = Path(__file__).resolve().parent / "presets" / "default.json"


def build_output(opening: Path, mid: Path, closing: Path, preset: filters.Preset) -> tuple[np.ndarray, int]:
    clips, sample_rate, resampled = filters.load_clips([opening, mid, closing])
    for path, original_rate in resampled:
        print(f"resampled {path}: {original_rate} -> {sample_rate} Hz", file=sys.stderr)
    mix = filters.build_mix(clips, sample_rate, preset)
    return mix, sample_rate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Concatenate an opening/mid/closing clip trio into an old-timey radio broadcast."
    )
    parser.add_argument("opening", type=Path, help="Path to the opening/station-ID clip")
    parser.add_argument("mid", type=Path, help="Path to the mid/DJ-content clip")
    parser.add_argument("closing", type=Path, help="Path to the closing/sign-off clip")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output path (.wav or .mp3)")
    parser.add_argument(
        "--preset",
        type=Path,
        default=DEFAULT_PRESET_PATH,
        help="Path to a preset JSON file (defaults to presets/default.json)",
    )
    args = parser.parse_args(argv)

    if args.output.suffix.lower() not in filters.OUTPUT_FORMATS:
        supported = ", ".join(filters.OUTPUT_FORMATS)
        print(f"Unsupported output format '{args.output.suffix}'. Supported: {supported}.", file=sys.stderr)
        return 1

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
    try:
        filters.write_audio(args.output, mix, sample_rate)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
