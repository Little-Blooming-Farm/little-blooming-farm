import mongoose from 'mongoose';

const { Schema } = mongoose;

const mediaSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, trim: true, default: '' },
    publicId: { type: String, trim: true, default: '' }, // Cloudinary handle
    provider: { type: String, enum: ['cloudinary', 'local'], default: 'cloudinary' },

    type: { type: String, enum: ['image', 'video'], required: true },
    format: { type: String, trim: true, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },

    alt: { type: String, trim: true, maxlength: 300, default: '' },
    caption: { type: String, trim: true, maxlength: 300, default: '' },

    /** Which surface this asset belongs to: gallery, the-land, hero, … */
    collectionName: { type: String, trim: true, lowercase: true, default: 'gallery' },
    tags: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

mediaSchema.index({ collectionName: 1, isActive: 1, order: 1 });
mediaSchema.index({ publicId: 1 }, { sparse: true });

mediaSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    url: this.url,
    thumbnailUrl: this.thumbnailUrl || this.url,
    type: this.type,
    width: this.width,
    height: this.height,
    durationSeconds: this.durationSeconds,
    alt: this.alt || this.caption,
    caption: this.caption,
    collectionName: this.collectionName,
    tags: this.tags,
    order: this.order,
  };
};

export const Media = mongoose.model('Media', mediaSchema);
export default Media;
