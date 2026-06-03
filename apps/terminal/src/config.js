export const DEFAULT_CONFIG = {
    schemaVersion: 1,

    // Appearance
    useModernFont:  false,
    phosphorColor:  'green',     // 'green' | 'amber' | 'white'

    // Audio
    soundEnabled:   true,
    soundVolume:    1.0,         // 0.0 – 1.0

    // CRT effects
    crtEffectsEnabled:    true,
    scanlinesEnabled:     true,
    respectReducedMotion: true,
    flickerPeriodSec:     10,    // .crt::after cycle length; 0 = flicker off

    crtWave: {
        brightnessMin:    0.80,
        brightnessMax:    1.40,
        widthMin:         0.5,
        widthMax:         2.5,
        count:            7,
        speed:            0.6,
        vignetteStrength: 1.00,
    },
};

// Alias kept so any remaining import of APP_CONFIG keeps working until fully removed.
export const APP_CONFIG = DEFAULT_CONFIG;
