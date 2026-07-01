import { DEFAULT_CONFIG } from '../config.js';

// DEFAULT_PARAMS is now derived from DEFAULT_CONFIG (single source of truth).
const DEFAULT_PARAMS = DEFAULT_CONFIG.crtWave;

const ROW_SELECTOR = 'h1, h2, h3, p, .choice-btn, .crt-line';

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function gaussian(dist, width) {
    return Math.exp(-(dist * dist) / (2 * width * width));
}

function collectRows(rootEl) {
    return Array.from(rootEl.querySelectorAll(ROW_SELECTOR))
        .filter(el => el.offsetParent !== null && !el.closest('#crt-controls'));
}

function injectOverlays(containerEl) {
    // Three non-interactive CRT overlays as direct children of the container.
    // While these are mounted, the global .crt::before/::after pseudo-elements
    // are suppressed (body.crt-injected) so the injected divs take precedence
    // and the effects do not render twice.
    const scanlines = document.createElement('div');
    scanlines.className = 'crt-scanlines';
    const vignette = document.createElement('div');
    vignette.className = 'crt-vignette';
    const flicker = document.createElement('div');
    flicker.className = 'crt-flicker';
    containerEl.appendChild(scanlines);
    containerEl.appendChild(vignette);
    containerEl.appendChild(flicker);
    document.body.classList.add('crt-injected');
    return { scanlines, vignette, flicker };
}

function setVignette(vignetteEl, strength) {
    vignetteEl.style.background =
        `radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,${strength.toFixed(2)}) 100%)`;
}

function spawnWaves(params) {
    const { count, speed, widthMin, widthMax, totalRows } = params;
    const speedMin = speed * 0.5;
    const speedMax = speed * 1.5;
    return Array.from({ length: count }, () => ({
        row:   rand(0, totalRows),
        speed: rand(speedMin, speedMax) * (Math.random() < 0.5 ? 1 : -1),
        width: rand(widthMin, widthMax),
        dir:   Math.random() < 0.5 ? 1 : -1,
    }));
}

function tick(t, rows, waves, params, phosphorRgb) {
    const { totalRows, brightnessMin, brightnessMax } = params;
    const mid       = (brightnessMin + brightnessMax) / 2;
    const halfRange = (brightnessMax - brightnessMin) / 2;

    for (let ri = 0; ri < rows.length; ri++) {
        const el = rows[ri];
        if (!el) continue;

        let totalInfluence = 0;
        for (const wave of waves) {
            const pos  = ((wave.row + t * wave.speed) % totalRows + totalRows) % totalRows;
            const dist = Math.min(Math.abs(ri - pos), totalRows - Math.abs(ri - pos));
            const g    = gaussian(dist, wave.width);
            totalInfluence += wave.dir * g;
        }

        const clamped    = Math.max(-1, Math.min(1, totalInfluence));
        const brightness = mid + clamped * halfRange;
        const bf         = (brightness - brightnessMin) / (brightnessMax - brightnessMin || 1);
        const opacity = 0.42 + 0.58 * bf;
        const glowAmt = Math.max(0, (bf - 0.5) * 2);
        const glow    = glowAmt > 0.2
            ? `0 0 ${(glowAmt * 6).toFixed(1)}px rgba(${phosphorRgb},${(glowAmt * 0.4).toFixed(2)})`
            : 'none';

        el.style.opacity    = opacity.toFixed(3);
        el.style.filter     = `brightness(${brightness.toFixed(3)})`;
        el.style.textShadow = glow;
    }
}

function stripRowStyles(rows) {
    rows.forEach(el => {
        el.style.opacity = '';
        el.style.filter = '';
        el.style.textShadow = '';
    });
}

export function mountCrtWave(containerEl, userParams, { startEnabled = true } = {}) {
    const params = Object.assign({}, DEFAULT_PARAMS, userParams);

    const { scanlines, vignette, flicker } = injectOverlays(containerEl);
    setVignette(vignette, params.vignetteStrength);

    const rows = collectRows(containerEl);
    rows.forEach((el, i) => { el.dataset.row = i; });
    params.totalRows = rows.length || 1;

    let waves = spawnWaves(params);
    let rafHandle = null;
    let running = false;

    function frame() {
        // Re-read phosphor RGB each frame so color changes apply immediately.
        const phosphorRgb = getComputedStyle(document.documentElement)
            .getPropertyValue('--phosphor-rgb').trim() || '51,255,0';

        const liveRows = collectRows(containerEl);
        if (liveRows.length !== params.totalRows) {
            params.totalRows = liveRows.length || 1;
            liveRows.forEach((el, i) => { el.dataset.row = i; });
        }
        tick(performance.now() / 1000, liveRows, waves, params, phosphorRgb);
        rafHandle = requestAnimationFrame(frame);
    }

    function enable() {
        if (running) return;
        running = true;
        vignette.style.opacity = '';
        rafHandle = requestAnimationFrame(frame);
    }

    function disable() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
        // Strip inline styles so rows return to their CSS baseline.
        stripRowStyles(collectRows(containerEl));
        vignette.style.opacity = '0';
    }

    function destroy() {
        disable();
        scanlines.remove();
        vignette.remove();
        flicker.remove();
        document.body.classList.remove('crt-injected');
    }

    function respawn(newParams) {
        Object.assign(params, newParams);
        params.totalRows = collectRows(containerEl).length || 1;
        waves = spawnWaves(params);
        if (newParams.vignetteStrength !== undefined) {
            setVignette(vignette, newParams.vignetteStrength);
        }
    }

    function updateVignette(strength) {
        setVignette(vignette, strength);
    }

    // Honor startEnabled: if false, never start the loop or write inline styles.
    if (startEnabled) {
        enable();
    }

    return { destroy, respawn, updateVignette, enable, disable };
}

// Reports whether the OS requests reduced motion, used by applyConfig.
export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
