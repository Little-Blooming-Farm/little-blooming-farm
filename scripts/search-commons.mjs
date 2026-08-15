#!/usr/bin/env node
/**
 * List Wikimedia Commons candidates for a query, so a slot can be pinned to a
 * specific file after checking what it actually is.
 *
 *   node scripts/search-commons.mjs "alpaca farm" [limit]
 *
 * Prints title, dimensions, year and licence for each result that passes the
 * same safety and eligibility rules fetch-media.mjs applies.
 */
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'LittleBloomingFarm/1.0 (placeholder media fetch; contact: site owner)';

const UNSAFE =
  /(nude|nudity|naked|topless|lingerie|underwear|bikini|erotic|porn|sex|sexual|nsfw|fetish|pin.?up|boudoir|corpse|injur|wound|blood|weapon|firearm|gun|death|funeral|grave|cemetery|memorial|war |soldier|military|protest|riot|police|crime|accident|disaster|burn(ed|t) area|wildfire)/i;

const plain = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const query = process.argv[2];
const limit = Number(process.argv[3] ?? 25);

if (!query) {
  console.error('Usage: node scripts/search-commons.mjs "<query>" [limit]');
  process.exit(1);
}

const params = new URLSearchParams({
  action: 'query',
  format: 'json',
  generator: 'search',
  gsrsearch: `${query} filetype:bitmap`,
  gsrnamespace: '6',
  gsrlimit: String(limit),
  prop: 'imageinfo|categories',
  iiprop: 'url|size|mime|extmetadata',
  cllimit: '60',
  clshow: '!hidden',
});

const response = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
const data = await response.json();

for (const page of Object.values(data?.query?.pages ?? {})) {
  const info = page.imageinfo?.[0];
  if (!info) continue;
  const meta = info.extmetadata ?? {};
  const categories = (page.categories ?? []).map((c) => c.title).join(' ');
  const description = plain(meta.ImageDescription?.value);
  const year = (plain(meta.DateTimeOriginal?.value).match(/\b(1[5-9]\d{2}|20\d{2})\b/) ?? [])[1];
  const licence = plain(meta.LicenseShortName?.value) || '?';

  const unsafe = UNSAFE.test(`${page.title} ${categories} ${description}`);
  const flags = [
    unsafe ? 'UNSAFE' : '',
    year && Number(year) < 1995 ? `OLD(${year})` : '',
    info.width < 1000 ? 'SMALL' : '',
  ]
    .filter(Boolean)
    .join(',');

  console.log(
    `${flags ? `[${flags}] ` : '      '}${String(info.width).padStart(5)}x${String(info.height).padEnd(5)} ` +
      `${licence.padEnd(15)} ${page.title.replace(/^File:/, '')}`
  );
}
