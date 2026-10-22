import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import _filters as filters


def sine(freq: float, duration_s: float, sr: int = 8000, amp: float = 0.5) -> np.ndarray:
    t = np.linspace(0, duration_s, int(sr * duration_s), endpoint=False)
    return amp * np.sin(2 * np.pi * freq * t)


def silence(duration_s: float, sr: int = 8000) -> np.ndarray:
    return np.zeros(int(sr * duration_s))


class TestNormalizePeak:
    def test_quiet_clip_normalized_up(self):
        clip = sine(440, 1.0, amp=0.05)
        normalized = filters.normalize_peak(clip, target_peak=0.9)
        assert np.max(np.abs(normalized)) == pytest.approx(0.9, rel=1e-3)

    def test_loud_clip_normalized_down(self):
        clip = sine(440, 1.0, amp=1.5)
        normalized = filters.normalize_peak(clip, target_peak=0.9)
        assert np.max(np.abs(normalized)) == pytest.approx(0.9, rel=1e-3)
        assert np.max(np.abs(normalized)) <= 1.0

    def test_silent_clip_untouched(self):
        clip = silence(0.5)
        normalized = filters.normalize_peak(clip, target_peak=0.9)
        assert np.max(np.abs(normalized)) == 0.0


class TestConcatenation:
    def test_output_length_is_sum_of_inputs(self):
        a, b, c = sine(200, 1.0), sine(300, 0.5), sine(400, 0.25)
        result = filters.concatenate_clips([a, b, c])
        assert len(result) == len(a) + len(b) + len(c)

    def test_hard_cut_no_blend_at_seam(self):
        a = np.full(100, 0.5)
        b = np.full(100, -0.5)
        result = filters.concatenate_clips([a, b])
        assert result[99] == pytest.approx(0.5)
        assert result[100] == pytest.approx(-0.5)


class TestBandpass:
    def test_attenuates_outside_passband(self):
        sr = 16000

        def tone(freq, duration=1.0, amp=0.3):
            t = np.linspace(0, duration, int(sr * duration), endpoint=False)
            return amp * np.sin(2 * np.pi * freq * t)

        mixed = tone(50) + tone(1000) + tone(6000)
        filtered = filters.bandpass_filter(mixed, sr, low_hz=300, high_hz=3000)

        def band_energy(sig, f_lo, f_hi):
            spectrum = np.abs(np.fft.rfft(sig))
            freqs = np.fft.rfftfreq(len(sig), d=1 / sr)
            mask = (freqs >= f_lo) & (freqs <= f_hi)
            return np.sum(spectrum[mask] ** 2)

        passband_before = band_energy(mixed, 800, 1200)
        passband_after = band_energy(filtered, 800, 1200)
        stopband_before = band_energy(mixed, 5500, 6500)
        stopband_after = band_energy(filtered, 5500, 6500)
        low_before = band_energy(mixed, 0, 200)
        low_after = band_energy(filtered, 0, 200)

        assert passband_after > passband_before * 0.5
        assert stopband_after < stopband_before * 0.1
        assert low_after < low_before * 0.1


class TestToMono:
    def test_stereo_downmixed_to_mono(self):
        stereo = np.stack([sine(440, 0.5), sine(440, 0.5) * 0.5], axis=1)
        mono = filters.to_mono(stereo)
        assert mono.ndim == 1
        assert len(mono) == stereo.shape[0]

    def test_mono_passthrough(self):
        mono_in = sine(440, 0.5)
        assert filters.to_mono(mono_in) is mono_in


class TestFilterChain:
    def test_zero_hiss_crackle_compression_saturation_is_silent_on_silence(self):
        clip = silence(1.0, sr=8000)
        preset = filters.Preset(
            bandpass_low_hz=20,
            bandpass_high_hz=3900,
            hiss_level=0,
            crackle_density=0,
            crackle_intensity=0,
            compression_amount=0,
            saturation_amount=0,
        )
        out = filters.apply_filter_chain(clip, 8000, preset, rng=np.random.default_rng(0))
        assert np.allclose(out, 0, atol=1e-6)

    def test_nonzero_hiss_adds_noise(self):
        clip = silence(1.0, sr=8000)
        preset = filters.Preset(
            bandpass_low_hz=20,
            bandpass_high_hz=3900,
            hiss_level=0.1,
            crackle_density=0,
            crackle_intensity=0,
            compression_amount=0,
            saturation_amount=0,
        )
        out = filters.apply_filter_chain(clip, 8000, preset, rng=np.random.default_rng(0))
        assert np.std(out) > 1e-4

    def test_crackle_adds_impulses(self):
        clip = silence(2.0, sr=8000)
        preset = filters.Preset(
            bandpass_low_hz=20,
            bandpass_high_hz=3900,
            hiss_level=0,
            crackle_density=5,
            crackle_intensity=0.8,
            compression_amount=0,
            saturation_amount=0,
        )
        out = filters.apply_filter_chain(clip, 8000, preset, rng=np.random.default_rng(0))
        assert np.max(np.abs(out)) > 0.01

    def test_no_nan_or_inf_or_clipping_across_presets(self):
        clip = sine(440, 1.0, sr=8000, amp=0.9)
        presets = [
            filters.Preset(),
            filters.Preset(
                hiss_level=1.0,
                crackle_density=50,
                crackle_intensity=1.0,
                compression_amount=1.0,
                saturation_amount=1.0,
            ),
        ]
        for preset in presets:
            out = filters.apply_filter_chain(clip, 8000, preset, rng=np.random.default_rng(1))
            assert np.all(np.isfinite(out))
            assert np.max(np.abs(out)) <= 1.0 + 1e-6

    def _hiss_only(self, saturation: float, sr: int = 48000, duration_s: float = 2.0) -> np.ndarray:
        preset = filters.Preset(
            hiss_level=0.05,
            crackle_density=0,
            crackle_intensity=0,
            compression_amount=0,
            saturation_amount=saturation,
        )
        return filters.apply_filter_chain(silence(duration_s, sr=sr), sr, preset, rng=np.random.default_rng(0))

    def test_hiss_level_independent_of_saturation(self):
        def rms_db(a):
            return 20 * np.log10(np.sqrt(np.mean(a**2)))

        sr = 48000
        levels = [rms_db(self._hiss_only(sat, sr)[sr // 2 : -sr // 2]) for sat in (0.0, 0.2, 0.5, 1.0)]
        assert max(levels) - min(levels) < 1.0

    def test_hiss_band_limited(self):
        sr = 48000
        out = self._hiss_only(0.0, sr)
        spectrum = np.abs(np.fft.rfft(out)) ** 2
        freqs = np.fft.rfftfreq(len(out), 1 / sr)
        in_band = spectrum[(freqs >= 300) & (freqs <= 3000)].mean()
        out_band = spectrum[freqs >= 8000].mean()
        assert out_band < in_band * 0.01

    def test_hiss_fades_in(self):
        sr = 48000
        out = self._hiss_only(0.0, sr)
        first_10ms = np.sqrt(np.mean(out[: sr // 100] ** 2))
        steady = np.sqrt(np.mean(out[sr // 2 : sr] ** 2))
        assert first_10ms < steady * 0.2

    def test_stereo_input_downmixed_to_mono_through_chain(self):
        stereo = np.stack([sine(440, 1.0, sr=8000), sine(440, 1.0, sr=8000)], axis=1)
        out = filters.apply_filter_chain(stereo, 8000, filters.Preset(), rng=np.random.default_rng(0))
        assert out.ndim == 1


class TestLoadClips:
    def _write(self, path, sr, duration_s):
        import soundfile as sf

        sf.write(str(path), sine(440, duration_s, sr=sr), sr)
        return path

    def test_mixed_rates_conformed_to_working_rate(self, tmp_path):
        paths = [
            self._write(tmp_path / "opening.wav", 44100, 0.3),
            self._write(tmp_path / "mid.wav", 48000, 0.6),
            self._write(tmp_path / "closing.wav", 44100, 0.3),
        ]
        clips, sr, resampled = filters.load_clips(paths)

        assert sr == filters.WORKING_SAMPLE_RATE == 48000
        assert [p.name for p, _ in resampled] == ["opening.wav", "closing.wav"]
        assert all(orig == 44100 for _, orig in resampled)
        for clip, duration in zip(clips, (0.3, 0.6, 0.3)):
            assert abs(len(clip) - duration * sr) <= 1

        mix = filters.build_mix(clips, sr, filters.Preset(), rng=np.random.default_rng(0))
        assert abs(len(mix) - 1.2 * sr) <= len(clips)

    def test_matching_rates_not_resampled(self, tmp_path):
        paths = [self._write(tmp_path / f"{name}.wav", 48000, 0.2) for name in ("a", "b", "c")]
        clips, sr, resampled = filters.load_clips(paths)

        assert sr == 48000
        assert resampled == []
        assert all(len(clip) == int(0.2 * 48000) for clip in clips)


class TestPresetRoundTrip:
    def test_save_and_load(self, tmp_path):
        preset = filters.Preset(bandpass_low_hz=250, hiss_level=0.2)
        path = tmp_path / "p.json"
        filters.save_preset(path, preset)
        loaded = filters.load_preset(path)
        assert loaded == preset
