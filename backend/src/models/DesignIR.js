import mongoose from 'mongoose';
import { IR_VERSION } from '../ir/schema.js';

const designIRSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID reference is required'],
      index: true,
      unique: true,
    },
    fileKey: {
      type: String,
      required: [true, 'Figma file key is required'],
      index: true,
      trim: true,
    },
    documentId: {
      type: String,
      required: [true, 'Document ID is required'],
      index: true,
      trim: true,
    },
    fileName: {
      type: String,
      default: 'Untitled Design',
      trim: true,
    },
    irVersion: {
      type: String,
      default: IR_VERSION,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    tokens: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    components: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    assets: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    relationships: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalNodeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pageSummaries: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, default: 'Page' },
          dimensions: { type: mongoose.Schema.Types.Mixed, default: {} },
          sectionCount: { type: Number, default: 0 },
          nodeCount: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    isChunked: {
      type: Boolean,
      default: false,
      index: true,
    },
    pages: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

designIRSchema.index({ fileKey: 1, createdAt: -1 });

export const DesignIR = mongoose.models.DesignIR || mongoose.model('DesignIR', designIRSchema);
export default DesignIR;

