// One-off icon generator: emits solid-fill PNGs for the PWA manifest.
// Not part of the runtime app — run once via `node scripts/generate-icons.mjs`.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

function crc32(buf) {
    let c;
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })());
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Renders a solid phosphor-green square with a darker inset ring — enough to
// read as a distinct icon at small sizes while staying safely within a
// maskable safe zone (the fill reaches every edge, so masking never clips content).
function makePng(size, { inset = false } = {}) {
    const bg = [0x06, 0x11, 0x0a]; // screen bg
    const fg = [0x33, 0xff, 0x66]; // phosphor green
    const ringMargin = inset ? Math.round(size * 0.22) : Math.round(size * 0.14);

    const raw = Buffer.alloc((size * 3 + 1) * size);
    let offset = 0;
    for (let y = 0; y < size; y++) {
        raw[offset++] = 0; // filter type: none
        for (let x = 0; x < size; x++) {
            const onRing = x < ringMargin || x >= size - ringMargin || y < ringMargin || y >= size - ringMargin;
            const [r, g, b] = onRing ? bg : fg;
            raw[offset++] = r;
            raw[offset++] = g;
            raw[offset++] = b;
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type: RGB
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    const idat = deflateSync(raw);
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

const targets = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-192-maskable.png', 192, true],
    ['icon-512-maskable.png', 512, true],
];

for (const [filename, size, inset] of targets) {
    const png = makePng(size, { inset });
    writeFileSync(join(ICONS_DIR, filename), png);
    console.log(`wrote ${filename} (${png.length} bytes)`);
}
