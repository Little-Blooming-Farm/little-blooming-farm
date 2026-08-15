#!/usr/bin/env node
/**
 * Build a labelled contact sheet of everything in client/public/media, so the
 * whole image set can be reviewed at a glance instead of opened one file at a
 * time.
 *
 *   node scripts/contact-sheet.mjs [outputPath] [columns]
 *
 * Output goes to .media-review/ which is git-ignored — this is a review aid,
 * not a build artefact.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'client/public/media');

const CELL_W = 300;
const CELL_H = 200;

async function listImages(dir, base = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listImages(path.join(dir, entry.name), rel)));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      files.push(rel);
    }
  }
  return files;
}

async function main() {
  const outPath = process.argv[2] ?? path.join(ROOT, '.media-review/contact-sheet.jpg');
  const columns = Number(process.argv[3] ?? 6);

  const files = await listImages(MEDIA);
  if (files.length === 0) {
    console.error('No images found in client/public/media');
    process.exit(1);
  }

  const tmp = path.join(ROOT, '.media-review/cells');
  await fs.rm(path.join(ROOT, '.media-review'), { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });

  // Cells are letterboxed into a fixed box. Labels would be nicer, but ffmpeg's
  // drawtext needs libfreetype and many builds lack it — so the ordering is
  // fixed and printed as an index map instead, which is just as reviewable.
  for (const [index, file] of files.entries()) {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', path.join(MEDIA, file),
      '-vf',
      [
        `scale=${CELL_W}:${CELL_H}:force_original_aspect_ratio=decrease`,
        `pad=${CELL_W}:${CELL_H}:(ow-iw)/2:(oh-ih)/2:color=0x1F281E`,
      ].join(','),
      path.join(tmp, `${String(index).padStart(3, '0')}.jpg`),
    ]);
  }

  const rows = Math.ceil(files.length / columns);
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-pattern_type', 'glob', '-i', path.join(tmp, '*.jpg'),
    '-filter_complex', `tile=${columns}x${rows}:margin=6:padding=4:color=0x2A3628`,
    '-q:v', '3',
    outPath,
  ]);

  await fs.rm(tmp, { recursive: true, force: true });

  // Index map: cell at (row r, column c), both zero-based, is r*columns + c.
  const map = files.map((file, i) => {
    const r = Math.floor(i / columns);
    const c = i % columns;
    return `r${r}c${c}  ${file}`;
  });
  await fs.writeFile(path.join(path.dirname(outPath), 'index.txt'), `${map.join('\n')}\n`);

  console.log(`${files.length} images → ${path.relative(ROOT, outPath)} (${columns}×${rows})\n`);
  console.log(map.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
