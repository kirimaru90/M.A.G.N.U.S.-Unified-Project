// TODO(openapi-gap): /campaigns/:id/map has no OpenAPI schema in reference/API-docs.json yet.
// Hand-typed to match specs/api-campaign-map/spec.md; regenerate (`npm run api:gen`) and
// replace with generated types once the backend spec declares this shape.

export type PlaceType =
  | 'region'
  | 'settlement'
  | 'vault'
  | 'building'
  | 'room'
  | 'landmark'
  | 'poi';

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapConfig {
  startLat: number;
  startLng: number;
  startZoom: number;
  minZoom: number;
  maxZoom: number;
  bounds: MapBounds;
}

export interface MapPlace {
  slug: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  /** False makes this a pin: no interior, no children, contributes R = 0. */
  hasLocalMap: boolean;
  /** Metres. Authored only — the effective radius is derived, never stored. */
  radius?: number;
  isPublic: boolean;
  parent?: string | null;
  desc?: string;
  /** Overrides the type's default icon. Resolved at render, never copied. */
  icon?: string;
}

export interface CampaignMapDto {
  config: MapConfig;
  places: MapPlace[];
}

/** A place's authored radius when it has an interior but no explicit one. */
export const DEFAULT_PLACE_RADIUS_M = 250;

export const PLACE_TYPE_OPTIONS: readonly {
  value: PlaceType;
  label: string;
  defaultIcon: string;
}[] = [
  { value: 'region', label: 'Regione', defaultIcon: 'region' },
  { value: 'settlement', label: 'Insediamento', defaultIcon: 'settlement' },
  { value: 'vault', label: 'Vault', defaultIcon: 'vault' },
  { value: 'building', label: 'Edificio', defaultIcon: 'building' },
  { value: 'room', label: 'Stanza', defaultIcon: 'room' },
  { value: 'landmark', label: 'Punto di riferimento', defaultIcon: 'landmark' },
  { value: 'poi', label: 'Punto di interesse', defaultIcon: 'poi' },
];
