export interface LatLngLike {
  lat: number;
  lng: number;
}

/** The fields of a place the geometry reads. */
export interface PlaceLike extends LatLngLike {
  slug: string;
  name?: string;
  type?: string;
  hasLocalMap: boolean;
  radius?: number;
  parent?: string | null;
}

export interface ZoomRange {
  minZoom: number;
  maxZoom: number;
}

export interface SizePx {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DeclutterItem extends Point {
  slug: string;
  type?: string;
  name?: string;
  radius?: number;
}

export interface DeclutterResult {
  placed: Set<string>;
  absorbedBy: Map<string, string>;
  groups: Map<string, string[]>;
}

export declare const DEFAULT_PLACE_RADIUS_M: number;
export declare const MARKER_BOX: number;
export declare const MARKER_PAD: number;
export declare const TYPE_RANK: Readonly<Record<string, number>>;

export declare function distanceMetres(a: LatLngLike, b: LatLngLike): number;
export declare function effectiveRadius(places: readonly PlaceLike[]): Map<string, number>;
export declare function viewportRadius(sizePx: SizePx, zoom: number, lat: number): number;
export declare function kids<P extends PlaceLike>(places: readonly P[], slug: string): P[];
export declare function isOpen(
  place: PlaceLike,
  vr: number,
  radii: Map<string, number>,
  places: readonly PlaceLike[],
): boolean;
export declare function isInside(place: PlaceLike, centre: LatLngLike, radii: Map<string, number>): boolean;
export declare function ancestors<P extends PlaceLike>(places: readonly P[], slug: string): P[];
export declare function visible<P extends PlaceLike>(
  places: readonly P[],
  vr: number,
  radii: Map<string, number>,
): P[];
export declare function containZoom(
  place: PlaceLike,
  radii: Map<string, number>,
  viewportPx: SizePx,
  zoomRange: ZoomRange,
): number;
export declare function revealZoom(
  place: PlaceLike,
  places: readonly PlaceLike[],
  radii: Map<string, number>,
  viewportPx: SizePx,
  zoomRange: ZoomRange,
): number;
export declare function chain<P extends PlaceLike>(
  places: readonly P[],
  centre: LatLngLike,
  vr: number,
  radii: Map<string, number>,
): P[];
export declare function declutter(
  items: readonly DeclutterItem[],
  opts?: { focused?: string | null; box?: number; pad?: number },
): DeclutterResult;
export declare function labelPass(
  placedItems: readonly DeclutterItem[],
  sizes: Map<string, { w: number; h: number }>,
  order: Iterable<string>,
  opts?: { box?: number },
): Set<string>;
export declare function separationZoom(
  points: readonly Point[],
  zoom: number,
  range: ZoomRange,
  box?: number,
  pad?: number,
): number;
export declare function effectiveMinZoom(configMin: number, configMax: number, boundsZoom: number): number;
