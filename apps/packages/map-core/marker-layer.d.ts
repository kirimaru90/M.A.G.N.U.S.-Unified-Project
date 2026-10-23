import type * as Leaflet from 'leaflet';
import type { DeclutterItem, PlaceLike, ZoomRange } from './geometry.js';

/** A place the layer can draw: the geometry's fields plus what its icon reads. */
export interface MarkerPlace extends PlaceLike {
  name: string;
  type: string;
  icon?: string;
}

export interface MarkerPlan<P extends MarkerPlace = MarkerPlace> {
  /** Rendered slugs, in priority order. */
  shown: Set<string>;
  absorbedBy: Map<string, string>;
  groups: Map<string, string[]>;
  placedItems: DeclutterItem[];
  labelsHidden: Set<string>;
  bySlug: Map<string, P>;
}

export interface MarkerLayerOptions<P extends MarkerPlace = MarkerPlace> {
  places: () => readonly P[];
  radii: () => Map<string, number>;
  focused?: () => string | null;
  forceFocused?: boolean;
  include?: (place: P) => boolean;
  markerClass?: (place: P) => string;
  markerOptions?: (place: P) => Leaflet.MarkerOptions;
  zoomRange?: () => ZoomRange;
  onAdd?: (place: P, marker: Leaflet.Marker) => void;
  onClick?: (place: P, marker: Leaflet.Marker) => void;
  onDragEnd?: (place: P, latlng: Leaflet.LatLng) => void;
  onGroupChange?: (place: P, nearby: P[], marker: Leaflet.Marker) => void;
  onBadge?: (slug: string, members: string[]) => void;
}

export interface MarkerLayer<P extends MarkerPlace = MarkerPlace> {
  sync(): void;
  plan(): MarkerPlan<P> | null;
  markerFor(slug: string): Leaflet.Marker | undefined;
  separate(slug: string): void;
  destroy(): void;
}

export declare function createMarkerLayer<P extends MarkerPlace>(
  L: typeof Leaflet,
  map: Leaflet.Map,
  opts: MarkerLayerOptions<P>,
): MarkerLayer<P>;
