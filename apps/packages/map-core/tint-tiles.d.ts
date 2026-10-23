import type * as Leaflet from 'leaflet';
import type { FilterParams } from './style.js';

export interface TintedTileLayerOptions extends Leaflet.TileLayerOptions {
  /** The initial tint: a theme triplet `'r, g, b'`, or null for the tiles as served. */
  tint?: string | null;
  /** A module worker on tint-worker.js. Omitted, or failing, the main thread tints. */
  createWorker?: () => Worker;
}

export interface TintedTileLayer extends Leaflet.TileLayer {
  /** Tints every tile from now on and repaints the loaded ones in place; null removes the tint. */
  setTint(rgb: string | null, params?: FilterParams): this;
}

export declare function createTintedTileLayer(
  L: typeof Leaflet,
  url: string,
  options?: TintedTileLayerOptions,
): TintedTileLayer;
