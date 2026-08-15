import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Block types the front end knows how to render. Adding a new one means adding
 * a renderer in client/src/components/content/BlockRenderer.jsx — the schema
 * itself stays open so the admin can compose pages without a redeploy.
 */
export const BLOCK_TYPES = Object.freeze([
  'hero', // { eyebrow, heading, body, image, video }
  'richText', // { heading, body }
  'imageText', // { heading, body, image, imagePosition }
  'fullBleedImage', // { image, caption }
  'quote', // { body, attribution }
  'grid', // { heading, intro, items: [{ title, body, image }] }
  'gallery', // { heading, images: [{ url, alt }] }
  'list', // { heading, items: [string] }
  'cta', // { heading, body, buttonLabel, buttonHref }
  'spacer', // { size }
]);

const sectionSchema = new Schema(
  {
    type: { type: String, required: true, enum: BLOCK_TYPES },
    order: { type: Number, default: 0 },
    // Free-form per block type; shape is validated at the route layer with zod.
    content: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const contentPageSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'],
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, trim: true, maxlength: 400, default: '' },

    seo: {
      title: { type: String, trim: true, maxlength: 200, default: '' },
      description: { type: String, trim: true, maxlength: 400, default: '' },
      image: { type: String, trim: true, default: '' },
    },

    heroImage: { type: String, trim: true, default: '' },
    heroVideo: { type: String, trim: true, default: '' },

    sections: { type: [sectionSchema], default: [] },

    isPublished: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

contentPageSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    slug: this.slug,
    title: this.title,
    subtitle: this.subtitle,
    seo: this.seo,
    heroImage: this.heroImage,
    heroVideo: this.heroVideo,
    sections: (this.sections ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s._id.toString(), type: s.type, content: s.content })),
    updatedAt: this.updatedAt,
  };
};

export const ContentPage = mongoose.model('ContentPage', contentPageSchema);
export default ContentPage;
