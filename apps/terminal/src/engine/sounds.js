let soundEnabled = true;
let soundVolume  = 1.0;

export function setSoundEnabled(bool) {
    soundEnabled = !!bool;
}

export function setSoundVolume(v) {
    soundVolume = Math.max(0, Math.min(1, parseFloat(v) || 0));
}

function createSound(path) {
    let audio;
    try { audio = new Audio(path); } catch (_) {}
    return function play() {
        if (!audio || !soundEnabled) return;
        try {
            audio.currentTime = 0;
            audio.volume = soundVolume;
            audio.play().catch(() => {});
        } catch (_) {}
    };
}

function createLoopSound(path) {
    let audio;
    try { audio = new Audio(path); audio.loop = true; } catch (_) {}
    return {
        start() {
            if (!audio || !soundEnabled) return;
            try {
                audio.currentTime = 0;
                audio.volume = soundVolume;
                audio.play().catch(() => {});
            } catch (_) {}
        },
        stop() {
            if (!audio) return;
            try { audio.pause(); audio.currentTime = 0; } catch (_) {}
        },
    };
}

const initSound         = createSound('suoni/init.mp3');
const dataTerminalSound = createSound('suoni/data_terminal.mp3');
const typingSound       = createLoopSound('suoni/typing.mp3');
const hoverSound        = createSound('suoni/hover.mp3');
const clickSound        = createSound('suoni/click.mp3');
const selectionSound    = createSound('suoni/selection.mp3');

export { initSound, dataTerminalSound, typingSound, hoverSound, clickSound, selectionSound };
