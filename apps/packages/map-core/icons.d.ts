export declare const ICONS: Readonly<Record<string, string>>;
export declare const TYPE_DEFAULT_ICON: Readonly<Record<string, string>>;
/** The inline SVG for a place: its own `icon`, else its type's default. */
export declare function iconFor(place: { icon?: string; type?: string }): string;
