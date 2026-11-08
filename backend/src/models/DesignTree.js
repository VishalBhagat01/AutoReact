import mongoose from 'mongoose';

const designTreeSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID reference is required'],
      index: true,
      unique: true, // One active design tree per project
    },
    figmaFileKey: {
      type: String,
      required: [true, 'Figma file key is required'],
      index: true,
      trim: true,
    },
    schemaVersion: {
      type: String,
      default: '1.0.0',
    },
    totalNodeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Array of canvas pages with normalized nodes
    pages: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Primary page normalized tree (convenience reference for single-page inspection)
    normalizedTree: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Semantic classification summary & breakdown
    semanticTree: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Design metadata (colors, typography, processing options)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookup by file key and project
designTreeSchema.index({ figmaFileKey: 1, createdAt: -1 });

export const DesignTree = mongoose.models.DesignTree || mongoose.model('DesignTree', designTreeSchema);
export default DesignTree;
