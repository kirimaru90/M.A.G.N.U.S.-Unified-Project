import { getConfig, setConfig, applyConfig } from '../state/config.js';
import { WAVE_SLIDER_DEFS, buildSlider } from '../engine/crt-controls.js';
import { DEFAULT_CONFIG } from '../config.js';

let _overlay = null;

// ─── Frequency ↔ period helpers (D6) ─────────────────────────────────────────
function periodToFreq(period) {
    return period === 0 ? 0 : parseFloat((1 / period).toFixed(3));
}
function freqToPeriod(f) {
    return f === 0 ? 0 : Math.ceil(1 / f);
}

// ─── Example node content for the live preview (D8) ──────────────────────────
function buildPreviewNode() {
    const wrap = document.createElement('div');

    const h = document.createElement('h2');
    h.textContent = 'ROBCO INDUSTRIES UNIFIED OPERATING SYSTEM';
    wrap.appendChild(h);

    const sub = document.createElement('h3');
    sub.textContent = 'GENERAL DIAGNOSTIC REPORT — UNIT 7-ALPHA';
    wrap.appendChild(sub);

    const p1 = document.createElement('p');
    p1.textContent = 'SYSTEM STATUS: NOMINAL. ALL SECTORS RESPONSIVE. MEMORY BANKS ONLINE.';
    wrap.appendChild(p1);

    const p2 = document.createElement('p');
    p2.textContent = 'Accessing terminal network… Authorization level OMEGA granted. ' +
        'Records indicate last maintenance cycle completed 847 days prior.';
    wrap.appendChild(p2);

    const p3 = document.createElement('p');
    p3.textContent = 'WARNING: Sector 7-G data logs corrupted. Recommend immediate retrieval ' +
        'before full degradation occurs. Time remaining: 00:14:32.';
    wrap.appendChild(p3);

    ['[ RETRIEVE LOGS ]', '[ RUN DIAGNOSTIC ]', '[ EXIT TERMINAL ]'].forEach(txt => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = txt;
        btn.addEventListener('click', e => e.preventDefault());
        wrap.appendChild(btn);
    });

    return wrap;
}

// ─── Mount / open ─────────────────────────────────────────────────────────────
export function openWaveTuner() {
    if (_overlay) return;

    // Snapshot config at open time — used by Cancel to revert.
    const cfgAtOpen = getConfig();
    const waveAtOpen = { ...cfgAtOpen.crtWave };
    const flickerAtOpen = cfgAtOpen.flickerPeriodSec;

    _overlay = document.createElement('div');
    _overlay.id = 'wave-tuner-overlay';

    // ── Header
    const header = document.createElement('div');
    header.className = 'tuner-header';
    const h = document.createElement('h2');
    h.textContent = 'CRT WAVE TUNER';
    const sub = document.createElement('p');
    sub.textContent = 'Adjust parameters — preview updates live. Changes stage on Apply.';
    header.appendChild(h);
    header.appendChild(sub);
    _overlay.appendChild(header);

    // ── Body: preview + controls
    const body = document.createElement('div');
    body.className = 'tuner-body';

    // Preview panel
    const preview = document.createElement('div');
    preview.className = 'tuner-preview';
    preview.appendChild(buildPreviewNode());
    body.appendChild(preview);

    // Controls panel
    const controls = document.createElement('div');
    controls.className = 'tuner-controls';

    // Seven wave sliders — reuse buildSlider from crt-controls.js
    WAVE_SLIDER_DEFS.forEach(def => {
        const initial = cfgAtOpen.crtWave[def.key] !== undefined
            ? cfgAtOpen.crtWave[def.key]
            : DEFAULT_CONFIG.crtWave[def.key];
        const lbl = buildSlider(def, initial, (value) => {
            setConfig({ crtWave: { [def.key]: value } });
            applyConfig(getConfig());
        });
        controls.appendChild(lbl);
    });

    // Flicker frequency slider (D6): 0 = off, range 0–1 Hz, step 0.01
    const freqDef = { id: 's-flicker-freq', label: 'Flicker frequency (Hz)', min: 0, max: 1, step: 0.01 };
    const freqInitial = periodToFreq(cfgAtOpen.flickerPeriodSec);
    const flickerLbl = buildSlider(freqDef, freqInitial, (f) => {
        const period = freqToPeriod(f);
        setConfig({ flickerPeriodSec: period });
        applyConfig(getConfig());
    });
    controls.appendChild(flickerLbl);

    body.appendChild(controls);
    _overlay.appendChild(body);

    // ── Footer
    const footer = document.createElement('div');
    footer.className = 'tuner-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tuner-btn';
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.addEventListener('click', () => {
        // Revert to values at open time.
        setConfig({ crtWave: waveAtOpen, flickerPeriodSec: flickerAtOpen });
        applyConfig(getConfig());
        close();
    });

    const applyBtn = document.createElement('button');
    applyBtn.className = 'tuner-btn tuner-btn--primary';
    applyBtn.textContent = 'APPLY';
    applyBtn.addEventListener('click', () => {
        // Tuned values are already live in active config via setConfig calls above.
        close();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(applyBtn);
    _overlay.appendChild(footer);

    document.body.appendChild(_overlay);

    // ESC closes (cancel semantics)
    _overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            setConfig({ crtWave: waveAtOpen, flickerPeriodSec: flickerAtOpen });
            applyConfig(getConfig());
            close();
        }
    });
}

export function close() {
    if (!_overlay) return;
    _overlay.remove();
    _overlay = null;
}
