// The tinted tile layer's worker (tint-tiles.js): tints tile bitmaps off the
// main thread, so the ~20 retina tiles landing at the end of a zoom do not
// stall it. A module worker; each app constructs it and hands the layer a
// factory, since a worker URL resolves differently with and without a bundler.
//
// Messages in:
//   { type: 'tables', key, tables }   the lookup tables for one tint, kept by key
//   { id, key, bitmap }               a tile to tint, its ImageBitmap transferred
// Messages out:
//   { id, bitmap }                    the tinted ImageBitmap, transferred
//   { id, error }                     the layer then tints that tile itself

import { tintPixels } from './style.js';

// A theme switch can leave tiles of the previous tint in flight; a few keys
// cover that without growing with every lab slider move.
const KEEP = 4;
const tablesByKey = new Map();

self.onmessage = ({ data }) => {
    if (data.type === 'tables') {
        tablesByKey.delete(data.key);
        tablesByKey.set(data.key, data.tables);
        if (tablesByKey.size > KEEP) tablesByKey.delete(tablesByKey.keys().next().value);
        return;
    }
    const { id, key, bitmap } = data;
    try {
        const tables = tablesByKey.get(key);
        if (!tables) throw new Error(`no tables for tint ${key}`);
        const { width, height } = bitmap;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const image = ctx.getImageData(0, 0, width, height);
        tintPixels(image.data, tables);
        ctx.putImageData(image, 0, 0);
        const tinted = canvas.transferToImageBitmap();
        self.postMessage({ id, bitmap: tinted }, [tinted]);
    } catch (err) {
        bitmap?.close?.();
        self.postMessage({ id, error: String(err?.message ?? err) });
    }
};
