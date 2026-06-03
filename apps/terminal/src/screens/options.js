import { getConfig, setConfig, applyConfig, resetToDefaults, isWaveForcedOff } from '../state/config.js';
import { DEFAULT_CONFIG } from '../config.js';
import {
    getUserConfig, getCampaignConfig, putUserTerminalConfig, resetUserConfig,
    putCampaignTerminalConfig,
} from '../api/configuration.js';
import { getUser } from '../api/session.js';

let _overlay = null;
let _openTuner = null; // Set by mountOptions so the Tune button can open the tuner.

// ─── Helper builders ──────────────────────────────────────────────────────────

function makeToggle(id, checked, disabled, onChange) {
    const label = document.createElement('label');
    label.className = 'opts-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    input.disabled = disabled;
    input.addEventListener('change', () => onChange(input.checked));

    const track = document.createElement('span');
    track.className = 'opts-toggle-track';

    label.appendChild(input);
    label.appendChild(track);
    return { label, input };
}

function makeRow(labelText, controlEl, helperText) {
    const row = document.createElement('div');
    row.className = 'opts-row';

    const lbl = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'opts-label';
    nameEl.textContent = labelText;
    lbl.appendChild(nameEl);
    if (helperText) {
        const helper = document.createElement('div');
        helper.className = 'opts-helper';
        helper.textContent = helperText;
        lbl.appendChild(helper);
    }
    row.appendChild(lbl);
    row.appendChild(controlEl);
    return row;
}

function makeSliderRow(labelText, value, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'opts-row opts-row--slider';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;';
    const lbl = document.createElement('span');
    lbl.className = 'opts-label';
    lbl.textContent = labelText;
    const val = document.createElement('span');
    val.className = 'opts-label';
    val.style.opacity = '0.7';
    const decimals = (String(step).split('.')[1] || '').length;
    val.textContent = value.toFixed(decimals);
    head.appendChild(lbl);
    head.appendChild(val);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'opts-slider';
    slider.min = min; slider.max = max; slider.step = step; slider.value = value;
    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        val.textContent = v.toFixed(decimals);
        onChange(v);
    });

    row.appendChild(head);
    row.appendChild(slider);
    return row;
}

function makeSegmented(options, active, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'opts-segment';
    const buttons = options.map(opt => {
        const btn = document.createElement('button');
        btn.className = 'opts-segment-btn' + (opt.value === active ? ' active' : '');
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
            wrap.querySelectorAll('.opts-segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange(opt.value);
        });
        return btn;
    });
    buttons.forEach(b => wrap.appendChild(b));
    return wrap;
}

// ─── Mount / open ─────────────────────────────────────────────────────────────

// getCampaignId is a lazy getter function so the Options panel always reads
// the campaign that is active at the moment the user opens it.
export function mountOptions({ onOpenTuner, getCampaignId } = {}) {
    _openTuner = onOpenTuner || null;

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'o' && e.key !== 'O') return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' ||
                  t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (_overlay) { close(); return; }
        open(getCampaignId ? getCampaignId() : null);
    });
}

export function open(campaignId) {
    if (_overlay) return;

    const cfg = getConfig();
    const user = getUser();
    const isLoggedIn = !!user;
    const isAdmin = !!(user && (user.role === 'admin' || user.isAdmin === true));
    const waveForced = isWaveForcedOff();

    _overlay = document.createElement('div');
    _overlay.id = 'options-overlay';

    const panel = document.createElement('div');
    panel.className = 'opts-panel';

    // ── Title
    const title = document.createElement('h2');
    title.textContent = 'ROBCO TERMINAL CONFIGURATION';
    panel.appendChild(title);

    // ── Sound on/off
    const { label: soundToggle, input: soundInput } = makeToggle('opt-sound', cfg.soundEnabled, false, (v) => {
        setConfig({ soundEnabled: v });
        applyConfig(getConfig());
    });
    panel.appendChild(makeRow('SOUND', soundToggle));

    // ── Volume
    panel.appendChild(makeSliderRow('VOLUME', cfg.soundVolume, 0, 1, 0.05, (v) => {
        setConfig({ soundVolume: v });
        applyConfig(getConfig());
    }));

    // ── CRT wave
    const waveHelper = waveForced ? 'Disabled by system reduced-motion setting' : null;
    const { label: waveToggle, input: waveInput } = makeToggle('opt-wave', cfg.crtEffectsEnabled && !waveForced, waveForced, (v) => {
        setConfig({ crtEffectsEnabled: v });
        applyConfig(getConfig());
    });
    panel.appendChild(makeRow('CRT WAVE', waveToggle, waveHelper));

    // ── Scanlines
    const { label: scanToggle } = makeToggle('opt-scanlines', cfg.scanlinesEnabled, false, (v) => {
        setConfig({ scanlinesEnabled: v });
        applyConfig(getConfig());
    });
    panel.appendChild(makeRow('SCANLINES', scanToggle));

    // ── Phosphor color
    const phosphorSeg = makeSegmented(
        [
            { label: 'GREEN', value: 'green' },
            { label: 'AMBER', value: 'amber' },
            { label: 'WHITE', value: 'white' },
        ],
        cfg.phosphorColor,
        (v) => { setConfig({ phosphorColor: v }); applyConfig(getConfig()); },
    );
    panel.appendChild(makeRow('PHOSPHOR', phosphorSeg));

    // ── Reduce motion respect
    const { label: motionToggle } = makeToggle('opt-motion', cfg.respectReducedMotion, false, (v) => {
        setConfig({ respectReducedMotion: v });
        applyConfig(getConfig());
        // Re-reflect forced state on the wave toggle.
        const forced = isWaveForcedOff();
        waveInput.disabled = forced;
        waveInput.checked = getConfig().crtEffectsEnabled && !forced;
    });
    panel.appendChild(makeRow('RESPECT REDUCED MOTION', motionToggle));

    // ── Modern font
    const { label: fontToggle } = makeToggle('opt-font', cfg.useModernFont, false, (v) => {
        setConfig({ useModernFont: v });
        applyConfig(getConfig());
    });
    panel.appendChild(makeRow('MODERN FONT', fontToggle));

    // ── CRT Effects / Tune
    const tuneBtn = document.createElement('button');
    tuneBtn.className = 'opts-tune-btn';
    tuneBtn.textContent = '[ TUNE ]';
    tuneBtn.addEventListener('click', () => {
        close();
        if (_openTuner) _openTuner(campaignId);
    });
    panel.appendChild(makeRow('CRT EFFECTS', tuneBtn));

    panel.appendChild(Object.assign(document.createElement('hr'), { className: 'opts-divider' }));

    // ── Footer
    const footer = document.createElement('div');
    footer.className = 'opts-footer';

    // Reset
    const resetBtn = document.createElement('button');
    resetBtn.className = 'opts-footer-btn opts-footer-btn--reset';
    resetBtn.textContent = 'RESET TO DEFAULT';
    resetBtn.addEventListener('click', async () => {
        if (isLoggedIn) {
            try { await resetUserConfig(); } catch (_) {}
            // Re-resolve config from campaign or user layer after wipe.
            let resolved = null;
            try {
                resolved = campaignId
                    ? await getCampaignConfig(campaignId)
                    : await getUserConfig();
            } catch (_) {}
            applyConfig(resolved || DEFAULT_CONFIG);
        } else {
            resetToDefaults();
            applyConfig(getConfig());
        }
        close();
        open(campaignId);
    });
    footer.appendChild(resetBtn);

    // Save / Apply
    const saveBtn = document.createElement('button');
    saveBtn.className = 'opts-footer-btn opts-footer-btn--primary';
    saveBtn.textContent = isLoggedIn ? 'SAVE' : 'APPLY';
    saveBtn.addEventListener('click', async () => {
        if (isLoggedIn) {
            try { await putUserTerminalConfig(); } catch (_) {}
        }
        close();
    });
    footer.appendChild(saveBtn);

    // Admin: Apply to campaign
    if (isAdmin && campaignId) {
        const campBtn = document.createElement('button');
        campBtn.className = 'opts-footer-btn';
        campBtn.textContent = 'APPLY TO CAMPAIGN';
        campBtn.addEventListener('click', async () => {
            try { await putCampaignTerminalConfig(campaignId, getConfig()); } catch (_) {}
            close();
        });
        footer.appendChild(campBtn);
    }

    panel.appendChild(footer);
    _overlay.appendChild(panel);
    document.body.appendChild(_overlay);

    // Close on ESC
    _overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Close on click outside panel
    _overlay.addEventListener('click', (e) => { if (e.target === _overlay) close(); });
}

export function close() {
    if (!_overlay) return;
    _overlay.remove();
    _overlay = null;
}
