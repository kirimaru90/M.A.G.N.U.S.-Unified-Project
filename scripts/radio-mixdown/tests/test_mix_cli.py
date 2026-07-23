import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent


def write_wav(path: Path, freq: float = 440, duration: float = 0.5, sr: int = 8000, amp: float = 0.3) -> None:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    audio = amp * np.sin(2 * np.pi * freq * t)
    sf.write(str(path), audio, sr)


def run_cli(args: list[str]) -> subprocess.CompletedProcess:
    cmd = [sys.executable, str(ROOT / "mix.py"), *args]
    return subprocess.run(cmd, capture_output=True, text=True)


@pytest.fixture
def clips(tmp_path):
    opening = tmp_path / "opening.wav"
    mid = tmp_path / "mid.wav"
    closing = tmp_path / "closing.wav"
    write_wav(opening, freq=300, duration=0.3)
    write_wav(mid, freq=500, duration=0.6)
    write_wav(closing, freq=700, duration=0.3)
    return opening, mid, closing


def test_missing_input_file_errors_cleanly(tmp_path, clips):
    _opening, mid, closing = clips
    missing = tmp_path / "does-not-exist.wav"
    out = tmp_path / "out.wav"

    result = run_cli([str(missing), str(mid), str(closing), "-o", str(out)])

    assert result.returncode != 0
    assert not out.exists()
    assert "does-not-exist.wav" in result.stderr


def test_end_to_end_mixdown_default_preset(tmp_path, clips):
    opening, mid, closing = clips
    out = tmp_path / "out.wav"

    result = run_cli([str(opening), str(mid), str(closing), "-o", str(out)])

    assert result.returncode == 0
    assert out.exists()
    audio, _sr = sf.read(str(out))
    total_in_frames = sum(sf.info(str(p)).frames for p in clips)
    assert abs(len(audio) - total_in_frames) <= 1


def test_preset_flag_changes_output(tmp_path, clips):
    opening, mid, closing = clips
    preset_a = tmp_path / "a.json"
    preset_b = tmp_path / "b.json"
    preset_a.write_text(
        json.dumps(
            {
                "bandpass_low_hz": 300,
                "bandpass_high_hz": 3000,
                "hiss_level": 0.0,
                "crackle_density": 0.0,
                "crackle_intensity": 0.0,
                "compression_amount": 0.0,
                "saturation_amount": 0.0,
            }
        )
    )
    preset_b.write_text(
        json.dumps(
            {
                "bandpass_low_hz": 300,
                "bandpass_high_hz": 3000,
                "hiss_level": 0.5,
                "crackle_density": 10.0,
                "crackle_intensity": 0.9,
                "compression_amount": 0.8,
                "saturation_amount": 0.8,
            }
        )
    )
    out_a = tmp_path / "out_a.wav"
    out_b = tmp_path / "out_b.wav"

    result_a = run_cli([str(opening), str(mid), str(closing), "-o", str(out_a), "--preset", str(preset_a)])
    result_b = run_cli([str(opening), str(mid), str(closing), "-o", str(out_b), "--preset", str(preset_b)])

    assert result_a.returncode == 0
    assert result_b.returncode == 0
    audio_a, _ = sf.read(str(out_a))
    audio_b, _ = sf.read(str(out_b))
    assert not np.allclose(audio_a, audio_b, atol=1e-3)


def test_mp3_decode_failure_reports_actionable_error(tmp_path, clips):
    _opening, mid, closing = clips
    fake_mp3 = tmp_path / "opening.mp3"
    fake_mp3.write_bytes(b"not a real mp3 file")
    out = tmp_path / "out.wav"

    result = run_cli([str(fake_mp3), str(mid), str(closing), "-o", str(out)])

    assert result.returncode != 0
    assert "mp3" in result.stderr.lower()
    assert not out.exists()
