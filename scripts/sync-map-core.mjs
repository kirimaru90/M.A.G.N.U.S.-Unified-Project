// Copies apps/packages/map-core into each app that consumes it, with a header
// on every file naming the package as its source. See the package README.
//
//   node scripts/sync-map-core.mjs           write the copies
//   node scripts/sync-map-core.mjs --check   exit 1 and name every copy that differs
//
// Dependency-free, like the apps' own dev servers.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGE = 'apps/packages/map-core';
const TARGETS = ['apps/pip-boy/src/shared/map-core', 'apps/cms/src/app/shared/map-core'];
const NOT_COPIED = new Set(['README.md']);

// .js and .d.ts take line comments, .css a block comment.
const lineComment = (text) => text.split('\n').map((l) => `// ${l}`).join('\n');
const blockComment = (text) => `/* ${text.split('\n').join('\n   ')} */`;

function header(name) {
    const comment = extname(name) === '.css' ? blockComment : lineComment;
    return comment(
        `GENERATED from ${PACKAGE}/${name} by scripts/sync-map-core.mjs. Do not edit:\n` +
        `edit ${PACKAGE}/${name}, then run \`node scripts/sync-map-core.mjs\`.`,
    ) + '\n\n';
}

// Git's autocrlf may check either side out with CRLF; compare and write in LF.
const lf = (text) => text.replace(/\r\n/g, '\n');

async function packageFiles() {
    const entries = await readdir(join(ROOT, PACKAGE), { withFileTypes: true });
    const names = entries.filter((e) => e.isFile() && !NOT_COPIED.has(e.name)).map((e) => e.name).sort();
    return Promise.all(names.map(async (name) => ({
        name,
        text: header(name) + lf(await readFile(join(ROOT, PACKAGE, name), 'utf8')),
    })));
}

async function filesIn(dir) {
    try {
        return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
    } catch {
        return [];
    }
}

async function check(files) {
    const problems = [];
    for (const target of TARGETS) {
        const dir = join(ROOT, target);
        const wanted = new Set(files.map((f) => f.name));
        for (const { name, text } of files) {
            let copy = null;
            try { copy = lf(await readFile(join(dir, name), 'utf8')); } catch { /* missing */ }
            if (copy === null) problems.push(`${target}/${name}: missing`);
            else if (copy !== text) problems.push(`${target}/${name}: differs from ${PACKAGE}/${name}`);
        }
        for (const name of await filesIn(dir)) {
            if (!wanted.has(name)) problems.push(`${target}/${name}: not in ${PACKAGE}`);
        }
    }
    return problems;
}

async function sync(files) {
    for (const target of TARGETS) {
        const dir = join(ROOT, target);
        await mkdir(dir, { recursive: true });
        const wanted = new Set(files.map((f) => f.name));
        for (const name of await filesIn(dir)) {
            if (!wanted.has(name)) await rm(join(dir, name));
        }
        for (const { name, text } of files) await writeFile(join(dir, name), text);
    }
}

const files = await packageFiles();
if (process.argv.includes('--check')) {
    const problems = await check(files);
    if (problems.length) {
        console.error(`map-core copies are out of sync with ${PACKAGE}:`);
        for (const p of problems) console.error(`  ${p}`);
        console.error('Run `node scripts/sync-map-core.mjs` from the repo root (and never edit a copy).');
        process.exit(1);
    }
    console.log(`map-core copies match ${PACKAGE}.`);
} else {
    await sync(files);
    console.log(`Synced ${files.length} files from ${PACKAGE} into ${TARGETS.join(', ')}.`);
}
