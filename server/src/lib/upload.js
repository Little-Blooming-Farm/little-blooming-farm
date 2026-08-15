import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

import env from '../config/env.js';
import logger from './logger.js';
import { badRequest } from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.resolve(__dirname, '../../uploads');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

const ALLOWED = new Map([
  ['image/jpeg', { ext: 'jpg', kind: 'image' }],
  ['image/png', { ext: 'png', kind: 'image' }],
  ['image/webp', { ext: 'webp', kind: 'image' }],
  ['image/avif', { ext: 'avif', kind: 'image' }],
  ['image/gif', { ext: 'gif', kind: 'image' }],
  ['video/mp4', { ext: 'mp4', kind: 'video' }],
  ['video/webm', { ext: 'webm', kind: 'video' }],
  ['video/quicktime', { ext: 'mov', kind: 'video' }],
]);

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Multer, in memory, with a declared-type filter. The declared MIME type is
 * attacker-controlled, so it is only a cheap first pass — `sniffKind` below
 * re-checks the actual bytes before anything is stored.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 12 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(badRequest(`Unsupported file type: ${file.mimetype}`));
    }
    return cb(null, true);
  },
});

/** Identify a file by its magic bytes rather than by what the client claimed. */
export function sniffKind(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  const hex = buffer.subarray(0, 12).toString('hex').toLowerCase();
  const ascii = buffer.subarray(0, 12).toString('latin1');

  if (hex.startsWith('ffd8ff')) return { kind: 'image', format: 'jpg' };
  if (hex.startsWith('89504e470d0a1a0a')) return { kind: 'image', format: 'png' };
  if (hex.startsWith('47494638')) return { kind: 'image', format: 'gif' };
  if (ascii.startsWith('RIFF') && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { kind: 'image', format: 'webp' };
  }
  if (hex.startsWith('1a45dfa3')) return { kind: 'video', format: 'webm' };

  // ISO base media (mp4 / mov / avif) — 'ftyp' at byte 4, brand follows.
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('latin1');
    if (brand.startsWith('avif') || brand.startsWith('avis')) {
      return { kind: 'image', format: 'avif' };
    }
    if (brand.startsWith('qt')) return { kind: 'video', format: 'mov' };
    return { kind: 'video', format: 'mp4' };
  }

  return null;
}

export function assertUploadIsValid(file) {
  const declared = ALLOWED.get(file.mimetype);
  if (!declared) throw badRequest(`Unsupported file type: ${file.mimetype}`);

  const sniffed = sniffKind(file.buffer);
  if (!sniffed) {
    throw badRequest(`${file.originalname} does not look like a real image or video.`);
  }
  if (sniffed.kind !== declared.kind) {
    // e.g. an .mp4 renamed to .jpg, or a script with an image extension.
    throw badRequest(`${file.originalname} does not match its file type.`);
  }

  const limit = sniffed.kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) {
    throw badRequest(
      `${file.originalname} is too large (max ${Math.round(limit / 1024 / 1024)} MB).`
    );
  }

  return sniffed;
}

/**
 * Store one validated file and return a normalised descriptor.
 * Cloudinary in production; local disk only as a development convenience
 * (env validation refuses to boot production without Cloudinary configured).
 */
export async function storeFile(file, { folder = env.CLOUDINARY_FOLDER } = {}) {
  const sniffed = assertUploadIsValid(file);

  if (!env.cloudinaryEnabled) return storeLocally(file, sniffed);

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: sniffed.kind === 'video' ? 'video' : 'image',
        // Never execute the client's filename as a path.
        public_id: `${Date.now()}-${randomUUID()}`,
        overwrite: false,
        // Modern format + quality negotiation, done at the CDN edge.
        ...(sniffed.kind === 'image' ? { format: undefined, quality: 'auto' } : {}),
      },
      (error, uploaded) => (error ? reject(error) : resolve(uploaded))
    );
    stream.end(file.buffer);
  });

  return {
    provider: 'cloudinary',
    url: result.secure_url,
    thumbnailUrl:
      sniffed.kind === 'image'
        ? result.secure_url.replace('/upload/', '/upload/c_fill,w_600,q_auto,f_auto/')
        : result.secure_url.replace('/upload/', '/upload/so_1,w_600,c_fill/').replace(/\.\w+$/, '.jpg'),
    publicId: result.public_id,
    type: sniffed.kind,
    format: result.format ?? sniffed.format,
    width: result.width ?? 0,
    height: result.height ?? 0,
    bytes: result.bytes ?? file.size,
    durationSeconds: Math.round(result.duration ?? 0),
  };
}

async function storeLocally(file, sniffed) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });

  // Filename is generated, never derived from user input — no traversal, no
  // double extensions, no overwriting.
  const name = `${Date.now()}-${randomUUID()}.${sniffed.format}`;
  await fs.writeFile(path.join(LOCAL_DIR, name), file.buffer);

  logger.warn('Stored upload on local disk — configure Cloudinary before launch', { name });

  return {
    provider: 'local',
    url: `${env.SERVER_URL}/uploads/${name}`,
    thumbnailUrl: `${env.SERVER_URL}/uploads/${name}`,
    publicId: name,
    type: sniffed.kind,
    format: sniffed.format,
    width: 0,
    height: 0,
    bytes: file.size,
    durationSeconds: 0,
  };
}

export async function deleteStoredFile({ provider, publicId, type }) {
  if (!publicId) return;

  if (provider === 'local') {
    await fs.unlink(path.join(LOCAL_DIR, publicId)).catch(() => {});
    return;
  }
  if (!env.cloudinaryEnabled) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: type === 'video' ? 'video' : 'image',
    });
  } catch (err) {
    logger.warn('Failed to delete remote asset', { publicId, error: err.message });
  }
}

export const LOCAL_UPLOAD_DIR = LOCAL_DIR;
