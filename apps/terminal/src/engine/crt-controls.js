// Slider ranges for the wave tuner — def values removed; callers pass the
// current config value as the initial value (single source of truth in DEFAULT_CONFIG).
export const WAVE_SLIDER_DEFS = [
    { id: 's-bmin',   key: 'brightnessMin', label: 'Min brightness', min: 0.1,  max: 1.2,  step: 0.01 },
    { id: 's-bmax',   key: 'brightnessMax', label: 'Max brightness', min: 0.5,  max: 2.5,  step: 0.01 },
    { id: 's-wmin',   key: 'widthMin',      label: 'Min wave width', min: 0.1,  max: 8.0,  step: 0.1  },
    { id: 's-wmax',   key: 'widthMax',      label: 'Max wave width', min: 0.5,  max: 20.0, step: 0.5  },
    { id: 's-wcount', key: 'count',         label: 'Wave count',     min: 1,    max: 12,   step: 1    },
    { id: 's-speed',  key: 'speed',         label: 'Speed',          min: 0.1,  max: 4.0,  step: 0.1  },
    { id: 's-vignette', key: 'vignetteStrength', label: 'Vignette',  min: 0.0,  max: 1.5,  step: 0.01 },
];

// Decimals to display follow the slider step (step 1 → "5", step 0.01 → "0.20").
function formatValue(value, step) {
    const decimals = (String(step).split('.')[1] || '').length;
    return value.toFixed(decimals);
}

// Builds a labelled range slider. Returns the wrapping <label> element.
export function buildSlider({ id, label, min, max, step }, initial, onInput) {
    const lbl = document.createElement('label');

    const head = document.createElement('span');
    head.className = 'ctl-head';
    const name = document.createElement('span');
    name.textContent = label;
    const valOut = document.createElement('span');
    valOut.className = 'ctl-val';
    head.appendChild(name);
    head.appendChild(valOut);
    lbl.appendChild(head);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = initial;
    valOut.textContent = formatValue(parseFloat(input.value), step);
    input.addEventListener('input', function () {
        const value = parseFloat(this.value);
        valOut.textContent = formatValue(value, step);
        onInput(value);
    });
    lbl.appendChild(input);

    return lbl;
}
