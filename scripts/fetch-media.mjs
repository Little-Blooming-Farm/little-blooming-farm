#!/usr/bin/env node
/**
 * Fill client/public/media with licensed stock photography.
 *
 *   node scripts/fetch-media.mjs            # fetch anything missing
 *   node scripts/fetch-media.mjs --force    # re-fetch everything
 *   node scripts/fetch-media.mjs --only gallery,animals
 *
 * Source is Wikimedia Commons, which permits programmatic access and carries
 * per-file licence metadata. Every downloaded file is recorded with its author,
 * licence and source page in client/public/media/CREDITS.json, and rendered
 * into ATTRIBUTION.md.
 *
 * THESE ARE PLACEHOLDERS. They depict other people's properties and animals.
 * Replace them with real photographs of the farm before the site goes live —
 * see ATTRIBUTION.md.
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

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'LittleBloomingFarm/1.0 (placeholder media fetch; contact: site owner)';

// Titles that are technically photos but never what we want.
const TITLE_BLOCKLIST =
  /(map|diagram|chart|logo|coat.of.arms|seal|flag|stamp|banner|icon|plaque|sign|poster|screenshot|panorama|comparison|graph|scheme|drawing|painting|engraving|illustration|sketch|portrait of|\.svg)/i;

/**
 * Hard content-safety filter.
 *
 * Commons is not a curated stock library — it hosts everything, including adult
 * material, and its search does not know that. A perfectly innocuous query for
 * a farmhouse interior ("Rosie's Bedroom") returned a lingerie photograph on
 * the first pass. On a site selling family stays that is unshippable, so it is
 * rejected on title, category and description, and this filter is checked
 * before anything else.
 */
/*
 * Word boundaries matter more than they look: an unbounded /sex/ blocks Sussex
 * and Essex, /gun/ blocks Gunnison, /war/ blocks Warwickshire — all ordinary
 * placenames that appear constantly in Commons titles.
 */
const UNSAFE_ADULT =
  /\b(nude|nudity|naked|topless|lingerie|underwear|bikini|erotic|erotica|porn|sexual|sexy|nsfw|fetish|bdsm|stripper|striptease|burlesque|pin-?ups?|boudoir|glamour model)\b/i;

/** Distressing or off-brand subject matter for a family holiday let. */
const UNSAFE_SUBJECT =
  /\b(corpse|corpses|autopsy|injury|injured|wounded|weapon|firearm|gunshot|funeral|cemetery|memorial|warfare|soldier|army|military|protest|riot|crime|wreck|disaster|wildfire)\b/i;

const UNSAFE_PHRASE = /(burn(ed|t) area|fire damage|dead body)/i;

const UNSAFE = {
  test: (text) =>
    UNSAFE_ADULT.test(text) || UNSAFE_SUBJECT.test(text) || UNSAFE_PHRASE.test(text),
};

/**
 * Every image slot the site references, with the search that fills it.
 * `w`/`h` are the target dimensions; images are cover-cropped to fit exactly.
 */
const SLOTS = [
  // ---- Home ---------------------------------------------------------------
  { group: 'home', file: 'home/hero-poster.jpg', w: 2400, h: 1350, q: ['Santa Ynez Valley', 'California oak savanna', 'California hills grassland'] },
  { group: 'home', file: 'home/stay-primary.jpg', w: 1400, h: 1750, q: ['California ranch house', 'farmhouse porch', 'farmhouse'] },
  { group: 'home', file: 'home/stay-secondary.jpg', w: 1200, h: 1200, pick: 'File:17- 18th-century Catsford Cottage garden, Newgate Street Hatfield Hertfordshire England.jpg', q: ['garden table chairs terrace', 'patio furniture garden', 'garden seating'] },
  { group: 'home', file: 'home/experiences.jpg', w: 1600, h: 1067, q: ['alpaca herd', 'alpacas grazing', 'alpaca group'] },
  { group: 'home', file: 'home/animals.jpg', w: 1600, h: 1067, q: ['Australian Shepherd', 'farm dog', 'border collie farm'] },
  { group: 'home', file: 'home/land.jpg', w: 2400, h: 1350, pick: 'File:Troç de pomeres.jpg', q: ['walnut trees orchard', 'orchard rows trees', 'olive grove rows'] },
  { group: 'home', file: 'og-cover.jpg', w: 1200, h: 630, pick: 'File:Rutherford Hill Vineyards, Napa Valley, California (8563638730).jpg', q: ['California golden hills oak', 'oak savanna landscape', 'California landscape hills'] },

  // ---- Stay ---------------------------------------------------------------
  { group: 'stay', file: 'stay/hero.jpg', w: 2400, h: 1350, pick: 'File:Sterling Vineyards, Napa Valley, California, USA.jpg', q: ['ranch house landscape', 'country house countryside', 'farmhouse field'] },
  { group: 'stay', file: 'stay/home-01.jpg', w: 1600, h: 1200, q: ['farmhouse garden exterior', 'country house garden', 'farmhouse'] },
  { group: 'stay', file: 'stay/home-02.jpg', w: 1400, h: 1400, q: ['wooden dining table set', 'dining table laid', 'farmhouse kitchen table'] },
  { group: 'stay', file: 'stay/home-03.jpg', w: 1400, h: 1400, pick: 'File:Louis Penfield House North Bedroom 1.jpg', q: ['bedroom wooden beams', 'loft bedroom interior', 'guest bedroom'] },
  { group: 'stay', file: 'stay/home-04.jpg', w: 1400, h: 1400, q: ['porch chairs house', 'terrace chairs house', 'veranda seating'] },
  { group: 'stay', file: 'stay/guest-01.jpg', w: 1600, h: 1200, q: ['cottage garden house', 'small cottage', 'guest cottage'] },
  { group: 'stay', file: 'stay/guest-02.jpg', w: 1400, h: 1400, q: ['garden patio morning', 'terrace table chairs', 'patio garden'] },
  { group: 'stay', file: 'stay/guest-03.jpg', w: 1400, h: 1400, q: ['bedroom window light', 'bedroom interior', 'bedroom'] },
  { group: 'stay', file: 'stay/bedrooms.jpg', w: 1600, h: 1200, q: ['bedroom linen bed', 'bedroom interior white', 'bedroom'] },
  { group: 'stay', file: 'stay/pool.jpg', w: 1600, h: 1200, pick: 'File:Zichy Mansion, pool in Fonyód, 2016 Hungary.jpg', q: ['outdoor pool garden villa', 'garden swimming pool', 'private pool terrace'] },
  { group: 'stay', file: 'stay/spa.jpg', w: 1600, h: 1200, q: ['hot tub outdoor', 'jacuzzi outdoor deck', 'hot tub'] },
  { group: 'stay', file: 'stay/outdoor.jpg', w: 1600, h: 1200, q: ['garden string lights evening', 'outdoor dining garden', 'garden party lights'] },

  // ---- Animals ------------------------------------------------------------
  { group: 'animals', file: 'animals/hero.jpg', w: 2400, h: 1350, q: ['sheep pasture farm', 'cattle grazing meadow', 'livestock field fence'] },
  { group: 'animals', file: 'animals/cowboy.jpeg', w: 1200, h: 1500, q: ['Australian Shepherd dog grass', 'Australian Shepherd standing', 'Australian Shepherd'] },
  { group: 'animals', file: 'animals/alpacas.jpg', w: 1200, h: 1500, q: ['alpaca', 'Vicugna pacos', 'alpaca farm'] },
  { group: 'animals', file: 'animals/goats.jpg', w: 1200, h: 1500, q: ['Nigerian Dwarf goat', 'goat kid', 'domestic goat'] },
  { group: 'animals', file: 'animals/chickens.jpg', w: 1200, h: 1500, q: ['free range chicken', 'hen grass', 'chicken farm'] },
  { group: 'animals', file: 'animals/ducks.jpg', w: 1200, h: 1500, q: ['Indian Runner duck', 'domestic duck', 'duck farm'] },
  { group: 'animals', file: 'animals/peacocks.jpg', w: 1200, h: 1500, q: ['Pavo cristatus male', 'peafowl male', 'peacock bird'] },

  // ---- Experiences --------------------------------------------------------
  { group: 'experiences', file: 'experiences/hero.jpg', w: 2400, h: 1350, q: ['farm field mist', 'countryside morning field', 'farm landscape'] },
  { group: 'experiences', file: 'experiences/alpacas.jpg', w: 1400, h: 1050, q: ['alpaca head', 'alpaca close up', 'Vicugna pacos head'] },
  { group: 'experiences', file: 'experiences/goats.jpg', w: 1400, h: 1050, q: ['goat feeding', 'goats fence', 'goat'] },
  { group: 'experiences', file: 'experiences/eggs.jpg', w: 1400, h: 1050, pick: 'File:Eggs in a plastic bowl gotten from Noiler Birds 03.jpg', q: ['hen eggs in basket', 'egg carton fresh', 'chicken eggs bowl'] },
  { group: 'experiences', file: 'experiences/garden.jpg', w: 1400, h: 1050, q: ['raised bed vegetable garden', 'kitchen garden', 'vegetable garden'] },
  { group: 'experiences', file: 'experiences/movie-night.jpg', w: 1400, h: 1050, q: ['open air cinema', 'outdoor cinema', 'projection screen outdoor'] },
  { group: 'experiences', file: 'experiences/breakfast.jpg', w: 1400, h: 1050, q: ['breakfast table outdoor', 'breakfast table', 'breakfast'] },
  { group: 'experiences', file: 'experiences/pizza-oven.jpg', w: 1400, h: 1050, q: ['wood fired oven', 'pizza oven', 'brick oven fire'] },
  { group: 'experiences', file: 'experiences/fire-pit.jpg', w: 1400, h: 1050, q: ['campfire night', 'bonfire night', 'campfire'] },
  { group: 'experiences', file: 'experiences/stargazing.jpg', w: 1400, h: 1050, q: ['Milky Way galaxy sky', 'starry sky night landscape', 'night sky astrophotography'] },
  { group: 'experiences', file: 'experiences/kids.jpg', w: 1400, h: 1050, q: ['children running outdoors', 'kids playing garden', 'child meadow flowers'] },
  { group: 'experiences', file: 'experiences/workshops.jpg', w: 1400, h: 1050, q: ['flower arranging', 'florist workshop', 'handmade wreath'] },

  // ---- The Land -----------------------------------------------------------
  { group: 'land', file: 'land/hero.jpg', w: 2400, h: 1350, q: ['California oak woodland', 'Santa Ynez Valley', 'California hills oak'] },
  { group: 'land', file: 'land/orchard.jpg', w: 2400, h: 1350, pick: 'File:Orchard at Fort Vancouver (2019) (5eeaf53a-33ec-4b7a-a315-869e93a16887).JPG', q: ['orchard trees rows', 'fruit trees orchard', 'olive grove'] },
  { group: 'land', file: 'land/light.jpg', w: 1600, h: 1200, q: ['sunlight through trees', 'oak tree sunlight', 'forest light'] },

  // ---- Garden of Erin -----------------------------------------------------
  { group: 'erin', file: 'erin/hero.jpg', w: 2400, h: 1350, q: ['cottage garden flowers', 'flower garden summer', 'garden roses'] },
  { group: 'erin', file: 'erin/garden.jpg', w: 2000, h: 1250, q: ['herbaceous border', 'cottage garden border', 'flower garden'] },

  // ---- Local Guide (real places — Commons has genuine photographs) --------
  { group: 'local', file: 'local/hero.jpg', w: 2400, h: 1350, q: ['Santa Ynez Valley vineyard', 'Santa Barbara County vineyard', 'California vineyard'] },
  { group: 'local', file: 'local/los-olivos.jpg', w: 1400, h: 1050, q: ['Los Olivos California', 'Los Olivos', 'Santa Ynez Valley town'] },
  { group: 'local', file: 'local/ballard.jpg', w: 1400, h: 1050, q: ['Ballard Canyon vineyard', 'Santa Ynez Valley vineyard', 'vineyard rows'] },
  { group: 'local', file: 'local/sta-rita.jpg', w: 1400, h: 1050, q: ['Sta. Rita Hills', 'Santa Rita Hills vineyard', 'California vineyard fog'] },
  { group: 'local', file: 'local/solvang-bakery.jpg', w: 1400, h: 1050, q: ['Danish pastry', 'bakery window pastries', 'pastry shop'] },
  { group: 'local', file: 'local/solvang-museum.jpg', w: 1400, h: 1050, q: ['Solvang California', 'Solvang', 'Solvang windmill'] },
  { group: 'local', file: 'local/mission.jpg', w: 1400, h: 1050, q: ['Mission Santa Ines', 'Old Mission Santa Ines', 'California mission church'] },
  { group: 'local', file: 'local/refugio.jpg', w: 1400, h: 1050, q: ['Refugio State Beach', 'El Capitan State Beach', 'California beach palms'] },
  { group: 'local', file: 'local/jalama.jpg', w: 1400, h: 1050, q: ['Jalama Beach', 'Jalama', 'Santa Barbara County beach'] },
  { group: 'local', file: 'local/gaviota.jpg', w: 1400, h: 1050, q: ['Gaviota State Park', 'Gaviota', 'Gaviota Pass'] },
  { group: 'local', file: 'local/nojoqui.jpg', w: 1400, h: 1050, q: ['waterfall forest California', 'waterfall cliff moss', 'waterfall rocks'] },
  { group: 'local', file: 'local/figueroa.jpg', w: 1400, h: 1050, q: ['Figueroa Mountain', 'California wildflowers hills', 'California poppy field'] },
  { group: 'local', file: 'local/riding.jpg', w: 1400, h: 1050, pick: 'File:Beatys Butte Wild Horse Training Facility (27481764768).jpg', q: ['horse riders trail', 'horseback riders', 'horses countryside'] },
  { group: 'local', file: 'local/cycling.jpg', w: 1400, h: 1050, q: ['rural road summer trees', 'country road countryside', 'road oak trees'] },
  { group: 'local', file: 'local/dinner.jpg', w: 1400, h: 1050, q: ['restaurant table setting', 'restaurant interior table', 'dining table restaurant'] },
  { group: 'local', file: 'local/santa-ynez.jpg', w: 1400, h: 1050, q: ['Santa Ynez California', 'Santa Ynez', 'Santa Ynez Valley town'] },
  { group: 'local', file: 'local/market.jpg', w: 1400, h: 1050, q: ['farmers market produce', 'vegetable market stall', 'farmers market'] },

  // ---- Gallery ------------------------------------------------------------
  { group: 'gallery', file: 'gallery/01.jpg', w: 1600, h: 1200, q: ['orchard evening light', 'orchard trees', 'fruit orchard'] },
  { group: 'gallery', file: 'gallery/02.jpg', w: 1400, h: 1867, q: ['outdoor dinner table garden', 'garden table evening', 'outdoor dining'] },
  { group: 'gallery', file: 'gallery/03.jpg', w: 1400, h: 1400, q: ['alpaca portrait', 'alpaca grazing', 'llama farm'] },
  { group: 'gallery', file: 'gallery/04.jpg', w: 1400, h: 1400, q: ['outdoor pool villa', 'garden pool terrace', 'backyard swimming pool'] },
  { group: 'gallery', file: 'gallery/05.jpg', w: 1400, h: 1400, pick: 'File:Domestic hen foraging on open ground.jpg', q: ['hens free range grass', 'chickens outdoors', 'hen garden'] },
  { group: 'gallery', file: 'gallery/06.jpg', w: 1600, h: 1200, q: ['vegetable garden beds', 'allotment garden vegetables', 'kitchen garden plants'] },
  { group: 'gallery', file: 'gallery/07.jpg', w: 1400, h: 1400, pick: 'File:Campfire site with logs and chairs set in a green area near trees on a sunny day in a backyard.jpg', q: ['campfire wood fire', 'bonfire flames night', 'fire pit garden'] },
  { group: 'gallery', file: 'gallery/08.jpg', w: 1400, h: 1400, q: ['aerial view farmland', 'aerial rural fields', 'drone view countryside'] },
  { group: 'gallery', file: 'gallery/09.jpg', w: 1400, h: 1400, pick: 'File:Peafowl Park beside Sun Moon Lake.jpg', q: ['peacock feathers', 'peafowl display', 'Pavo cristatus'] },
  { group: 'gallery', file: 'gallery/10.jpg', w: 1600, h: 1200, q: ['spring flower garden', 'garden bloom spring', 'flower garden'] },
  { group: 'gallery', file: 'gallery/11.jpg', w: 1400, h: 1400, q: ['patio terrace garden', 'garden terrace sunlight', 'veranda garden'] },
  { group: 'gallery', file: 'gallery/12.jpg', w: 1600, h: 1200, q: ['golden hour hills', 'California golden hills', 'sunset hills landscape'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The year a photograph was taken, when Commons records one.
 *
 * This is the single most effective filter available. Wikimedia is an archive
 * as much as a photo library, so searches happily return 19th-century oil
 * paintings and 1900s plate photography — "basket of eggs" returned a classical
 * painting, "children playing" a Victorian street scene. Anything old is wrong
 * for a contemporary holiday-let site regardless of how well it matches.
 */
function yearOf(meta) {
  const raw =
    plain(meta.DateTimeOriginal?.value) || plain(meta.DateTime?.value) || '';
  const match = raw.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

/** Categories that mean "this is an artwork or an archival scan, not a photo". */
const CATEGORY_BLOCKLIST =
  /(painting|drawing|engraving|lithograph|etching|watercolou?r|sketch|artwork|illustration|woodcut|black.and.white photograph|19th.century|18th.century|historical images|archival)/i;

/** Strip the HTML Commons returns in its metadata fields. */
function plain(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch one specific Commons file by title.
 *
 * Search is good enough for most slots but occasionally confidently wrong —
 * "walnut orchard" once resolved to a photograph of a walnut pie. A slot can
 * therefore pin an exact file with `pick: 'File:Something.jpg'`, which skips
 * searching entirely.
 */
async function fetchByTitle(title, thumbWidth = 2000) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(thumbWidth),
  });

  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
    if (response.status !== 429) break;
    await sleep(1500 * 2 ** attempt);
  }
  if (!response.ok) throw new Error(`Commons lookup failed: ${response.status}`);

  const data = await response.json();
  const page = Object.values(data?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) throw new Error(`pinned file not found: ${title}`);

  return normalise(page);
}

async function searchCommons(query, limit = 20, thumbWidth = 2000) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo|categories',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(thumbWidth),
    cllimit: '80',
    clshow: '!hidden',
  });

  // Commons throttles aggressively. Back off and retry rather than giving up —
  // a 429 says "later", not "no".
  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
    if (response.status !== 429) break;
    await sleep(1500 * 2 ** attempt);
  }
  if (!response.ok) throw new Error(`Commons search failed: ${response.status}`);

  const data = await response.json();
  const pages = data?.query?.pages ?? {};

  return Object.values(pages).map(normalise).filter(Boolean);
}

/** Flatten a Commons API page into the shape the rest of this script uses. */
function normalise(page) {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    title: page.title,
    categories: (page.categories ?? []).map((c) => c.title).join(' | '),
    year: yearOf(meta),
    mime: info.mime,
    width: info.width,
    height: info.height,
    url: info.thumburl || info.url,
    descriptionUrl: info.descriptionurl,
    licence: plain(meta.LicenseShortName?.value) || 'Unknown',
    licenceUrl: plain(meta.LicenseUrl?.value) || '',
    artist: plain(meta.Artist?.value) || 'Unknown',
    credit: plain(meta.Credit?.value) || '',
    restrictions: plain(meta.Restrictions?.value) || '',
    description: plain(meta.ImageDescription?.value) || '',
  };
}

/**
 * Hard eligibility. Kept separate from ranking on purpose: a candidate that
 * merely has an awkward aspect ratio is still perfectly usable, and must not
 * be discarded just because its ranking score went negative.
 */
function eligible(candidate, slot) {
  // Content safety before anything else.
  const haystack = `${candidate.title} ${candidate.categories ?? ''} ${candidate.description ?? ''}`;
  if (UNSAFE.test(haystack)) return false;

  if (!/^image\/(jpeg|png|webp)$/.test(candidate.mime ?? '')) return false;
  if (TITLE_BLOCKLIST.test(candidate.title)) return false;
  if (candidate.restrictions) return false;

  // Must be big enough to cover the slot without upscaling badly.
  if (!candidate.width || !candidate.height) return false;
  if (candidate.width < Math.min(1000, slot.w * 0.6)) return false;

  // Non-commercial and no-derivatives files are not usable on a booking site.
  if (/\bNC\b|\bND\b|non-commercial|noncommercial|no derivative/i.test(candidate.licence)) {
    return false;
  }
  if (/^unknown$/i.test(candidate.licence)) return false;

  // Reject archival material — see yearOf() above.
  if (candidate.year !== null && candidate.year < 1995) return false;
  if (CATEGORY_BLOCKLIST.test(candidate.categories ?? '')) return false;

  // Never let the same photograph fill two slots.
  if (usedTitles.has(candidate.title)) return false;

  return true;
}

/** Every Commons file already committed to a slot in this or a previous run. */
const usedTitles = new Set();

/** Preference ordering among eligible candidates. May be negative. */
function score(candidate, slot) {
  let points = 0;
  if (/^(CC0|Public domain|PD)/i.test(candidate.licence)) points += 5; // no attribution needed
  else if (/CC BY(?!-SA)/i.test(candidate.licence)) points += 3;
  else if (/CC BY-SA/i.test(candidate.licence)) points += 2;

  if (candidate.width >= 2000) points += 2;
  if (candidate.width >= 3000) points += 1;

  // Prefer sources whose aspect ratio is close to the slot's, so cover-cropping
  // throws away as little of the photograph as possible.
  const target = slot.w / slot.h;
  const actual = candidate.width / candidate.height;
  const ratioPenalty = Math.abs(Math.log(actual / target));
  points -= ratioPenalty * 3;

  return points;
}

async function download(url, destination) {
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (response.status !== 429) break;
    // Thumbnail rendering is rate limited separately from the API. Wait it out.
    await sleep(2000 * 2 ** attempt);
  }
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 8000) throw new Error('file suspiciously small');
  await fs.writeFile(destination, buffer);
  return buffer.length;
}

/** Cover-crop to exact dimensions, strip metadata, encode a sensible JPEG. */
async function transcode(source, destination, w, h) {
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', source,
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
    '-map_metadata', '-1',
    '-q:v', '4',
    destination,
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

  const only = flag('--only')?.split(',') ?? null;
  // Re-fetch named slots specifically, e.g. --files gallery/05.jpg,stay/pool.jpg
  const files = flag('--files')?.split(',') ?? null;

  let slots = SLOTS;
  if (only) slots = slots.filter((s) => only.includes(s.group));
  if (files) slots = slots.filter((s) => files.includes(s.file));

  const tmp = path.join(ROOT, '.media-tmp');
  await fs.mkdir(tmp, { recursive: true });

  const creditsPath = path.join(MEDIA, 'CREDITS.json');
  let credits = {};
  try {
    credits = JSON.parse(await fs.readFile(creditsPath, 'utf8'));
  } catch {
    credits = {};
  }

  // Seed the dedupe set from slots we are *keeping*, so a re-fetch cannot pick
  // a photograph that is already in use elsewhere on the site.
  const targeted = new Set(slots.map((s) => s.file));
  for (const [file, meta] of Object.entries(credits)) {
    if (!targeted.has(file) && meta.title) usedTitles.add(`File:${meta.title}`);
  }

  let fetched = 0;
  let skipped = 0;
  const failures = [];

  for (const slot of slots) {
    const destination = path.join(MEDIA, slot.file);
    await fs.mkdir(path.dirname(destination), { recursive: true });

    if (!force) {
      try {
        await fs.access(destination);
        skipped += 1;
        continue;
      } catch {
        /* not present — fetch it */
      }
    }

    try {
      // A pinned file skips search entirely.
      if (slot.pick) {
        const pinned = await fetchByTitle(slot.pick, Math.max(slot.w, 1200));
        const raw = path.join(tmp, `${slot.file.replace(/\//g, '_')}.src`);
        await download(pinned.url, raw);
        await transcode(raw, destination, slot.w, slot.h);
        await fs.unlink(raw).catch(() => {});

        credits[slot.file] = {
          title: pinned.title.replace(/^File:/, ''),
          artist: pinned.artist,
          licence: pinned.licence,
          licenceUrl: pinned.licenceUrl,
          source: pinned.descriptionUrl,
          query: 'pinned',
        };
        usedTitles.add(pinned.title);
        fetched += 1;
        console.log(`  ✓ ${slot.file.padEnd(32)} ${pinned.licence.padEnd(14)} ${pinned.title.replace(/^File:/, '').slice(0, 52)}  [pinned]`);
        await sleep(700);
        continue;
      }

      // Try each query in turn — Commons' search rewards short, concrete terms,
      // so slots carry a specific query first and broader fallbacks after it.
      const queries = Array.isArray(slot.q) ? slot.q : [slot.q];
      let pick = null;
      let usedQuery = null;

      for (const query of queries) {
        // Ask for only the width this slot needs — larger thumbnails force
        // Commons to render on demand, which is what gets throttled.
        const candidates = await searchCommons(query, 20, Math.max(slot.w, 1200));
        const ranked = candidates
          .filter((c) => eligible(c, slot))
          .map((c) => ({ ...c, score: score(c, slot) }))
          .sort((a, b) => b.score - a.score);

        if (ranked.length > 0) {
          pick = ranked[0];
          usedQuery = query;
          break;
        }
        await sleep(400);
      }

      if (!pick) throw new Error(`no usable result for ${queries.map((q) => `"${q}"`).join(' / ')}`);

      const raw = path.join(tmp, `${slot.file.replace(/\//g, '_')}.src`);

      await download(pick.url, raw);
      await transcode(raw, destination, slot.w, slot.h);
      await fs.unlink(raw).catch(() => {});

      credits[slot.file] = {
        title: pick.title.replace(/^File:/, ''),
        artist: pick.artist,
        licence: pick.licence,
        licenceUrl: pick.licenceUrl,
        source: pick.descriptionUrl,
        query: usedQuery,
      };

      usedTitles.add(pick.title);
      fetched += 1;
      console.log(`  ✓ ${slot.file.padEnd(32)} ${pick.licence.padEnd(14)} ${pick.title.replace(/^File:/, '').slice(0, 52)}`);
    } catch (error) {
      failures.push({ file: slot.file, reason: error.message });
      console.log(`  ✗ ${slot.file.padEnd(32)} ${error.message}`);
    }

    await sleep(700); // be a polite API citizen
  }

  await fs.writeFile(creditsPath, `${JSON.stringify(credits, null, 2)}\n`);
  await writeAttribution(credits);
  await fs.rm(tmp, { recursive: true, force: true });

  console.log(`\n  ${fetched} fetched, ${skipped} already present, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log('\n  Failed slots (re-run, or set a different search term in scripts/fetch-media.mjs):');
    for (const f of failures) console.log(`    ${f.file} — ${f.reason}`);
  }
  console.log(`\n  Credits written to client/public/media/CREDITS.json`);
}

async function writeAttribution(credits) {
  const entries = Object.entries(credits).sort(([a], [b]) => a.localeCompare(b));

  const byLicence = entries.reduce((acc, [, meta]) => {
    acc[meta.licence] = (acc[meta.licence] ?? 0) + 1;
    return acc;
  }, {});

  const lines = [
    '# Image attribution',
    '',
    '> **These are placeholders.** Every photograph below shows someone else’s',
    '> property, animals or garden. They are here so the site can be reviewed and',
    '> demonstrated with real imagery. Replace them with photographs of the actual',
    '> farm before taking bookings — see the “Replacing these” section below.',
    '',
    'All files were retrieved from [Wikimedia Commons](https://commons.wikimedia.org)',
    'by `scripts/fetch-media.mjs`, filtered to licences that permit commercial use',
    'and derivative works. Files under CC BY or CC BY-SA require the attribution',
    'given here to be reproduced wherever the image is published.',
    '',
    '## Licence summary',
    '',
    '| Licence | Files | Attribution required |',
    '| --- | --- | --- |',
    ...Object.entries(byLicence)
      .sort((a, b) => b[1] - a[1])
      .map(([licence, count]) => {
        const needsCredit = !/^(CC0|Public domain|PD)/i.test(licence);
        return `| ${licence} | ${count} | ${needsCredit ? 'Yes' : 'No'} |`;
      }),
    '',
    '## Replacing these',
    '',
    '1. Photograph the farm. Match the shapes listed in `client/public/media/`:',
    '   heroes are wide (16:9), animal portraits are tall (4:5), gallery is mixed.',
    '2. Either overwrite the files in `client/public/media/` keeping the same',
    '   names, or upload through `/admin → Gallery & media` and paste the URLs in.',
    '3. Remove that file’s row from `CREDITS.json`, then regenerate this file',
    '   with `node scripts/fetch-media.mjs` (it only fetches what is missing, so',
    '   your own photographs are never overwritten).',
    '4. Once no rows remain, delete `CREDITS.json`, this file, and',
    '   `scripts/fetch-media.mjs` — none of them are needed after that.',
    '',
    '## Files',
    '',
    '| File | Photograph | Author | Licence |',
    '| --- | --- | --- | --- |',
    ...entries.map(([file, meta]) => {
      const title = meta.source ? `[${meta.title}](${meta.source})` : meta.title;
      const licence = meta.licenceUrl ? `[${meta.licence}](${meta.licenceUrl})` : meta.licence;
      return `| \`${file}\` | ${title} | ${meta.artist} | ${licence} |`;
    }),
    '',
  ];

  await fs.writeFile(path.join(MEDIA, 'ATTRIBUTION.md'), lines.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
