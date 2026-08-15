import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

const BCRYPT_ROUNDS = 12;

const adminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'invalid email address'],
    },
    name: { type: String, trim: true, maxlength: 120, default: '' },

    // Never selected by default — a stray `.find()` cannot leak the hash.
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: ['owner', 'admin'], default: 'owner' },

    /**
     * Incremented on password change. Issued JWTs carry the version they were
     * signed with, so changing the password invalidates every existing session.
     */
    tokenVersion: { type: Number, default: 0 },

    // Simple online-guessing brake, on top of the route-level rate limiter.
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

adminSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
};

adminSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

adminSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
};

adminSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    role: this.role,
    lastLoginAt: this.lastLoginAt,
  };
};

export const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
