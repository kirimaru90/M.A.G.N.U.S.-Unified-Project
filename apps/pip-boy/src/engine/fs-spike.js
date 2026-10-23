// TEMPORARY — fullscreen spike (pipboy-edge-to-edge-case, task 5.3 follow-up).
// Answers on the device: does element fullscreen (requestFullscreen) remove the
// top cutout strip, does revealing the gesture bar still shrink the page, and
// what does the back gesture do. Remove this file, manifest-standalone.webmanifest
// and its two hooks (main.js startFsSpikeReadout, settings-popup.js
// FULLSCREEN (TEST)) after.

const MAX_EVENTS = 6;
const events = [];
let readout = null;
let probe = null;

function insets() {
    const cs = getComputedStyle(probe);
    return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
        .map((p) => Math.round(parseFloat(cs[p]) || 0)).join('/');
}

function displayMode() {
    for (const m of ['fullscreen', 'standalone', 'minimal-ui', 'browser']) {
        if (matchMedia(`(display-mode: ${m})`).matches) return m;
    }
    return '?';
}

function log(what) {
    const t = new Date().toTimeString().slice(3, 8);
    events.unshift(`${t} ${what} ${innerWidth}×${innerHeight} i:${insets()}`);
    events.length = Math.min(events.length, MAX_EVENTS);
    render();
}

function render() {
    if (!readout) return;
    const vv = window.visualViewport;
    readout.textContent = [
        `fs:${document.fullscreenElement ? 'ON' : 'off'}  dm:${displayMode()}${STANDALONE ? '  [S-variant]' : ''}`,
        `inset T/R/B/L: ${insets()}`,
        `inner: ${innerWidth}×${innerHeight}  vv: ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : '-'}`,
        `screen: ${screen.width}×${screen.height}  avail: ${screen.availWidth}×${screen.availHeight}`,
        '──',
        ...events,
    ].join('\n');
}

// Standalone variant: opened as `./?standalone`, the page points at a second
// manifest (own id, display: standalone) so Chrome installs it as a separate
// app beside the fullscreen one. The status bar takes the case's top colour.
const STANDALONE = new URLSearchParams(location.search).has('standalone');

function applyStandaloneVariant() {
    if (!STANDALONE) return;
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', 'manifest-standalone.webmanifest');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#22261c');
}

export function startFsSpikeReadout() {
    applyStandaloneVariant();
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;'
        + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) '
        + 'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
    readout = document.createElement('pre');
    // Mid-height, so neither a top nor a bottom strip can hide it.
    readout.style.cssText = 'position:fixed;left:0;top:45%;z-index:99999;margin:0;'
        + 'padding:4px 6px;font:10px/1.3 monospace;color:#ff0;background:rgba(0,0,0,.75);'
        + 'pointer-events:none;white-space:pre;';
    document.body.append(probe, readout);
    window.addEventListener('resize', () => log('resize'));
    window.visualViewport?.addEventListener('resize', () => log('vv-resize'));
    document.addEventListener('fullscreenchange', () => log(`fschange ${document.fullscreenElement ? 'ON' : 'off'}`));
    window.addEventListener('popstate', () => log('popstate'));
    log('boot');
}

export async function enterFullscreenSpike() {
    try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        log('request ok');
    } catch (err) {
        log(`request FAIL ${err?.name || err}`);
    }
}
