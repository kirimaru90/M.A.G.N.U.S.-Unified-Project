// GENERATED from apps/packages/map-core/icons.d.ts by scripts/sync-map-core.mjs. Do not edit:
// edit apps/packages/map-core/icons.d.ts, then run `node scripts/sync-map-core.mjs`.

export declare const ICONS: Readonly<Record<string, string>>;
export declare const TYPE_DEFAULT_ICON: Readonly<Record<string, string>>;
/** The inline SVG for a place: its own `icon`, else its type's default. */
export declare function iconFor(place: { icon?: string; type?: string }): string;
