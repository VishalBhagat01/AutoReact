import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
      default: null,
    },
    figmaFileKey: {
      type: String,
      required: [true, 'Figma file key is required'],
      index: true,
      trim: true,
    },
    figmaNodeId: {
      type: String,
      required: [true, 'Figma node ID is required'],
      index: true,
      trim: true,
    },
    assetType: {
      type: String,
      enum: ['image', 'vector_svg', 'icon', 'render'],
      default: 'image',
    },
    format: {
      type: String,
      enum: ['png', 'svg', 'jpg', 'jpeg', 'pdf'],
      default: 'png',
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
      trim: true,
    },
    publicUrl: {
      type: String,
      required: [true, 'Public URL is required'],
      trim: true,
    },
    dimensions: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },
    exportScale: {
      type: Number,
      default: 1,
      min: 0.01,
      max: 4,
    },
    imageRef: {
      type: String,
      default: null,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    checksum: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index so re-exporting same node at same scale/format updates record
assetSchema.index(
  { figmaFileKey: 1, figmaNodeId: 1, format: 1, exportScale: 1 },
  { unique: true }
);

// Index for listing project assets
assetSchema.index({ projectId: 1, createdAt: -1 });

export const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);
export default Asset;

