# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "numpy",
#     "scipy",
#     "soundfile",
#     "gradio",
# ]
# ///
"""Interactive playground for tuning the radio-mixdown filter chain.

Usage:
    uv run playground.py

Opens a local Gradio tab: drag in opening/mid/closing clips, adjust the
filter sliders, render a preview, and save the tuned parameters as a
preset that `mix.py --preset` can consume directly.
"""
from __future__ import annotations

import sys
from pathlib import Path

import gradio as gr
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _filters as filters

PRESETS_DIR = Path(__file__).resolve().parent / "presets"
PRESETS_DIR.mkdir(exist_ok=True)


def list_presets() -> list[str]:
    return sorted(p.stem for p in PRESETS_DIR.glob("*.json"))


def _load_clip(path: str) -> tuple[np.ndarray, int]:
    audio, sample_rate = sf.read(path, dtype="float64", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sample_rate


def render(
    opening_path: str | None,
    mid_path: str | None,
    closing_path: str | None,
    bandpass_low_hz: float,
    bandpass_high_hz: float,
    hiss_level: float,
    crackle_density: float,
    crackle_intensity: float,
    compression_amount: float,
    saturation_amount: float,
) -> tuple[int, np.ndarray]:
    if not (opening_path and mid_path and closing_path):
        raise gr.Error("Load all three clips (opening, mid, closing) before rendering.")

    clips = []
    sample_rate = None
    for path in (opening_path, mid_path, closing_path):
        audio, sr = _load_clip(path)
        if sample_rate is None:
            sample_rate = sr
        elif sr != sample_rate:
            raise gr.Error(f"Sample rate mismatch: '{path}' is {sr} Hz, expected {sample_rate} Hz.")
        clips.append(audio)

    preset = filters.Preset(
        bandpass_low_hz=bandpass_low_hz,
        bandpass_high_hz=bandpass_high_hz,
        hiss_level=hiss_level,
        crackle_density=crackle_density,
        crackle_intensity=crackle_intensity,
        compression_amount=compression_amount,
        saturation_amount=saturation_amount,
    )
    mix = filters.build_mix(clips, sample_rate, preset)
    return sample_rate, mix


def save_preset_action(
    name: str,
    bandpass_low_hz: float,
    bandpass_high_hz: float,
    hiss_level: float,
    crackle_density: float,
    crackle_intensity: float,
    compression_amount: float,
    saturation_amount: float,
):
    if not name or not name.strip():
        raise gr.Error("Enter a preset name before saving.")
    slug = name.strip()
    if slug.lower() == "default":
        raise gr.Error("Refusing to overwrite 'default' from the playground — choose a different name.")

    preset = filters.Preset(
        bandpass_low_hz=bandpass_low_hz,
        bandpass_high_hz=bandpass_high_hz,
        hiss_level=hiss_level,
        crackle_density=crackle_density,
        crackle_intensity=crackle_intensity,
        compression_amount=compression_amount,
        saturation_amount=saturation_amount,
    )
    path = PRESETS_DIR / f"{slug}.json"
    filters.save_preset(path, preset)
    return f"Saved {path.name}", gr.update(choices=list_presets())


def load_preset_action(name: str | None):
    if not name:
        raise gr.Error("Choose a preset to load.")
    preset = filters.load_preset(PRESETS_DIR / f"{name}.json")
    return (
        preset.bandpass_low_hz,
        preset.bandpass_high_hz,
        preset.hiss_level,
        preset.crackle_density,
        preset.crackle_intensity,
        preset.compression_amount,
        preset.saturation_amount,
    )


with gr.Blocks(title="Radio Mixdown Playground") as demo:
    gr.Markdown("# Radio Mixdown Playground\nTune the old-timey radio filter chain against real clips.")

    with gr.Row():
        opening_in = gr.Audio(label="Opening", type="filepath")
        mid_in = gr.Audio(label="Mid", type="filepath")
        closing_in = gr.Audio(label="Closing", type="filepath")

    with gr.Row():
        with gr.Column():
            bandpass_low = gr.Slider(20, 2000, value=300, label="Bandpass low (Hz)")
            bandpass_high = gr.Slider(1000, 8000, value=3000, label="Bandpass high (Hz)")
            hiss = gr.Slider(0.0, 1.0, value=0.05, label="Hiss level")
            crackle_density = gr.Slider(0.0, 20.0, value=2.0, label="Crackle density (pops/sec)")
            crackle_intensity = gr.Slider(0.0, 1.0, value=0.3, label="Crackle intensity")
            compression = gr.Slider(0.0, 1.0, value=0.4, label="Compression amount")
            saturation = gr.Slider(0.0, 1.0, value=0.2, label="Saturation amount")
        with gr.Column():
            render_btn = gr.Button("Render", variant="primary")
            output_audio = gr.Audio(label="Preview", type="numpy")

    sliders = [bandpass_low, bandpass_high, hiss, crackle_density, crackle_intensity, compression, saturation]

    render_btn.click(render, inputs=[opening_in, mid_in, closing_in, *sliders], outputs=output_audio)

    with gr.Row():
        preset_name = gr.Textbox(label="Preset name")
        save_btn = gr.Button("Save preset")
    save_status = gr.Markdown()

    with gr.Row():
        preset_dropdown = gr.Dropdown(choices=list_presets(), label="Load preset")
        load_btn = gr.Button("Load preset")

    save_btn.click(save_preset_action, inputs=[preset_name, *sliders], outputs=[save_status, preset_dropdown])
    load_btn.click(load_preset_action, inputs=[preset_dropdown], outputs=sliders)


if __name__ == "__main__":
    demo.launch()
