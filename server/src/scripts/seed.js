/**
 * Idempotent seed. Safe to re-run: content is upserted by slug, so re-seeding
 * restores the shipped copy without duplicating anything or touching bookings.
 *
 *   npm run seed
 */
import mongoose from 'mongoose';

import env from '../config/env.js';
import logger from '../lib/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Property } from '../models/Property.js';
import { Animal } from '../models/Animal.js';
import { Experience } from '../models/Experience.js';
import { ContentPage } from '../models/ContentPage.js';
import { Media } from '../models/Media.js';
import { Admin } from '../models/Admin.js';
import { animals, contentPages, experiences, gallery, properties } from './seedData.js';

async function upsertAll(Model, docs, key = 'slug') {
  const result = await Model.bulkWrite(
    docs.map((doc) => ({
      updateOne: {
        filter: { [key]: doc[key] },
        update: { $set: doc },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  return {
    inserted: result.upsertedCount ?? 0,
    updated: result.modifiedCount ?? 0,
  };
}

async function seedGallery() {
  let created = 0;
  for (const item of gallery) {
    const existing = await Media.findOne({ url: item.url }).lean();
    if (existing) continue;
    await Media.create({
      url: item.url,
      thumbnailUrl: item.url,
      type: 'image',
      alt: item.alt,
      caption: item.alt,
      collectionName: 'gallery',
      order: item.order,
      provider: 'local',
    });
    created += 1;
  }
  return created;
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    const count = await Admin.countDocuments();
    if (count === 0) {
      logger.warn(
        'No admin account exists. Create one with: npm run create-admin -- --email you@example.com'
      );
    }
    return null;
  }

  if (password.length < 12) {
    logger.error('SEED_ADMIN_PASSWORD must be at least 12 characters — skipping admin creation');
    return null;
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    logger.info('Admin already exists — leaving it untouched', { email });
    return existing;
  }

  const admin = await Admin.create({
    email: email.toLowerCase(),
    passwordHash: await Admin.hashPassword(password),
    role: 'owner',
  });
  logger.info('Admin account created', { email: admin.email });
  return admin;
}

async function main() {
  await connectDatabase();

  const propertyResult = await upsertAll(Property, properties);
  const animalResult = await upsertAll(Animal, animals);
  const experienceResult = await upsertAll(Experience, experiences);
  const pageResult = await upsertAll(ContentPage, contentPages);
  const galleryCreated = await seedGallery();
  await seedAdmin();

  // Indexes are built lazily in development; make sure they exist after a seed.
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));

  logger.info('Seed complete', {
    properties: propertyResult,
    animals: animalResult,
    experiences: experienceResult,
    contentPages: pageResult,
    galleryItemsCreated: galleryCreated,
    database: mongoose.connection.name,
    env: env.NODE_ENV,
  });

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error('Seed failed', { error: err.message, stack: err.stack });
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
