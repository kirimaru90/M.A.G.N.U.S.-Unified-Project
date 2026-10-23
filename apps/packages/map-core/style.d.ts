export interface PhosphorTheme {
  /** `'r, g, b'`, 0–255. */
  rgb: string;
  brightRgb: string;
}

export interface MapTone {
  land: number;
  water: number;
  lineLo: number;
  lineHi: number;
}

export declare const PHOSPHOR_THEMES: {
  readonly green: PhosphorTheme;
  readonly amber: PhosphorTheme;
  readonly white: PhosphorTheme;
};
export declare const MAP_TONE: MapTone;
export declare const MAP_TINT_SAT: number;
export declare const MAP_WATER_MASK_GAIN: number;
export declare const MAP_TINT_FILTER_ID: 'pb-phosphor-tint';

export interface FilterParams {
  tone?: MapTone;
  sat?: number;
}

export declare function toneLevel(L: number, tone?: MapTone): number;
export declare function toneTable(tone?: MapTone): number[];
export declare function tintColour(rgb: string, sat?: number): [number, number, number];
export declare function filterOutput(
  pixel: readonly [number, number, number],
  rgb: string,
  params?: FilterParams,
): [number, number, number];
export declare function filterMarkup(rgb: string, params?: FilterParams): string;
export declare function ensureTintFilter(doc: Document, rgb: string): SVGFilterElement;
