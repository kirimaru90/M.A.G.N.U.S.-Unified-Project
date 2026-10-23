// GENERATED from apps/packages/map-core/tint-tiles.js by scripts/sync-map-core.mjs. Do not edit:
// edit apps/packages/map-core/tint-tiles.js, then run `node scripts/sync-map-core.mjs`.

// The basemap layer both maps draw: an L.TileLayer whose tiles are canvases,
// each tinted once, when it loads, with style.js's lookup tables. Zoom and pan
// then only transform finished bitmaps; nothing re-runs per frame, as the SVG
// filter on the tile pane did.
//
//   - A tile becomes visible already tinted: Leaflet fades a tile in on `done`,
//     which is called only after the tinted pixels are drawn.
//   - `setTint` repaints the tiles on screen in place: each is decoded again
//     from its URL (served by the HTTP or service-worker cache) into the same
//     canvas, the old pixels staying until the new ones are drawn. No untinted
//     copy is kept: a retina tile is 1 MB decoded.
//   - The pixels are tinted in tint-worker.js when the caller supplies a worker
//     factory, and on the main thread with the same `tintPixels` otherwise.
//
// Tiles are CORS requests, so the tile host must send Access-Control-Allow-Origin.
// Leaflet is injected, never imported, as everywhere in this package.

import { tintPixels, tintTables } from './style.js';

/**
 * A tinted `L.TileLayer` on `url`.
 *
 *   tint           the initial tint, a theme triplet `'r, g, b'`, or null for none
 *   createWorker   () => Worker on tint-worker.js; omit to tint on the main thread
 *   ...options     L.TileLayer options
 */
export function createTintedTileLayer(L, url, { tint = null, createWorker, ...options } = {}) {
    const TintedTileLayer = L.TileLayer.extend({
        initialize(url, options) {
            L.TileLayer.prototype.initialize.call(this, url, options);
            // undefined: not tried yet; null: unavailable, tint on the main thread.
            this._worker = undefined;
            this._jobs = new Map();
            this._jobId = 0;
            this._sentKey = null;
            this.setTint(tint);
            // tileabort: Leaflet dropped a tile still loading when the zoom moved on.
            this.on('tileunload tileabort', (e) => this._release(e.tile));
        },

        /** Tints every tile from now on, and repaints the ones on screen. */
        setTint(rgb, { tone, sat } = {}) {
            this._tintTables = rgb ? tintTables(rgb, { tone, sat }) : null;
            this._tintKey = rgb ? JSON.stringify([rgb, tone ?? null, sat ?? null]) : null;
            for (const key in this._tiles) this._paint(this._tiles[key].el);
            return this;
        },

        createTile(coords, done) {
            const canvas = document.createElement('canvas');
            canvas.setAttribute('role', 'presentation');
            canvas._tintTile = { src: this.getTileUrl(coords), gen: 0, img: null, done };
            this._paint(canvas);
            return canvas;
        },

        onRemove(map) {
            // Tiles first, so jobs released by the worker's stop find them stale.
            L.TileLayer.prototype.onRemove.call(this, map);
            this._stopWorker(undefined);
        },

        /** Loads the tile's image and draws it with the current tint, superseding any paint in flight. */
        _paint(canvas) {
            const tile = canvas._tintTile;
            if (!tile) return;
            const gen = ++tile.gen;
            const tables = this._tintTables;
            const key = this._tintKey;
            this._abortImage(tile);
            const img = new Image();
            tile.img = img;
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                tile.img = null;
                this._render(canvas, tile, gen, img, tables, key).catch((err) => {
                    if (gen === tile.gen) this._finish(canvas, tile, err);
                });
            };
            img.onerror = (err) => {
                tile.img = null;
                if (gen === tile.gen) this._finish(canvas, tile, err);
            };
            img.src = tile.src;
        },

        async _render(canvas, tile, gen, img, tables, key) {
            const bitmap = tables ? await this._tintInWorker(img, tables, key) : null;
            if (gen !== tile.gen) {
                bitmap?.close();
                return;
            }
            const source = bitmap ?? img;
            const width = bitmap ? bitmap.width : img.naturalWidth;
            const height = bitmap ? bitmap.height : img.naturalHeight;
            // Resizing clears the canvas; the new pixels land in the same task,
            // so no frame shows it empty.
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            bitmap?.close();
            if (tables && !bitmap) {
                const image = ctx.getImageData(0, 0, width, height);
                tintPixels(image.data, tables);
                ctx.putImageData(image, 0, 0);
            }
            this._finish(canvas, tile, null);
        },

        /** The tile's first paint, or its failure, tells Leaflet; a repaint has no one to tell. */
        _finish(canvas, tile, err) {
            // Leaflet's _abortLoading drops only tiles that are not `complete`.
            canvas.complete = true;
            const done = tile.done;
            tile.done = null;
            done?.(err, canvas);
        },

        /** The tinted bitmap from the worker, or null to tint on the main thread. */
        async _tintInWorker(img, tables, key) {
            const worker = this._ensureWorker();
            if (!worker) return null;
            try {
                const bitmap = await createImageBitmap(img);
                if (this._worker !== worker) {
                    bitmap.close();
                    return null;
                }
                if (this._sentKey !== key) {
                    worker.postMessage({ type: 'tables', key, tables });
                    this._sentKey = key;
                }
                const id = ++this._jobId;
                return await new Promise((resolve) => {
                    this._jobs.set(id, resolve);
                    worker.postMessage({ id, key, bitmap }, [bitmap]);
                });
            } catch {
                return null;
            }
        },

        _ensureWorker() {
            if (this._worker !== undefined) return this._worker;
            this._worker = null;
            if (!createWorker || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
                return null;
            }
            try {
                const worker = createWorker();
                worker.onmessage = ({ data }) => {
                    const resolve = this._jobs.get(data.id);
                    this._jobs.delete(data.id);
                    if (resolve) resolve(data.bitmap ?? null);
                    else data.bitmap?.close();
                };
                // A worker that fails to load or crashes is not retried.
                worker.onerror = worker.onmessageerror = () => this._stopWorker(null);
                this._worker = worker;
            } catch {
                // No worker: the main thread tints.
            }
            return this._worker;
        },

        /** Ends the worker; its jobs fall back to the main thread, if their tiles still want them. */
        _stopWorker(next) {
            this._worker?.terminate();
            this._worker = next;
            this._sentKey = null;
            const jobs = [...this._jobs.values()];
            this._jobs.clear();
            for (const resolve of jobs) resolve(null);
        },

        _abortImage(tile) {
            const img = tile.img;
            if (!img) return;
            img.onload = img.onerror = null;
            img.src = L.Util.emptyImageUrl;
            tile.img = null;
        },

        /** A tile Leaflet has let go of: stop its paint and free its pixels. */
        _release(canvas) {
            const tile = canvas?._tintTile;
            if (!tile) return;
            tile.gen++;
            tile.done = null;
            this._abortImage(tile);
            canvas.width = canvas.height = 0;
        },
    });

    return new TintedTileLayer(url, options);
}
