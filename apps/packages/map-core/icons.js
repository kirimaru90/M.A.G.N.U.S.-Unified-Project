// The place icon set, shared by both maps.
//
// Inline SVG, keyed by name. Resolved at render (`place.icon ?? type default`)
// and never copied onto a place, so retyping a place or changing a type's
// default updates every place that never overrode it.

export const ICONS = {
    region: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 16l9 5 9-5"/><path d="M3 12l9 5 9-5"/></svg>',
    settlement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/></svg>',
    vault: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
    building: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>',
    room: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M15 12h.01"/></svg>',
    landmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6 6 .9-4.5 4.2 1.2 6.4L12 16.5 6.3 19.5l1.2-6.4L3 8.9 9 8z"/></svg>',
    poi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
};

/** Mirrors PLACE_TYPE_OPTIONS[].defaultIcon in the CMS. */
export const TYPE_DEFAULT_ICON = {
    region: 'region',
    settlement: 'settlement',
    vault: 'vault',
    building: 'building',
    room: 'room',
    landmark: 'landmark',
    poi: 'poi',
};

/** An unknown key falls back to the type's default rather than rendering nothing. */
export function iconFor(place) {
    if (place.icon && ICONS[place.icon]) return ICONS[place.icon];
    return ICONS[TYPE_DEFAULT_ICON[place.type]] ?? ICONS.poi;
}
