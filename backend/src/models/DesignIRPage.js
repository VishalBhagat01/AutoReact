import mongoose from 'mongoose';

const designIRPageSchema = new mongoose.Schema(
  {
    irId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DesignIR',
      required: [true, 'DesignIR reference ID is required'],
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference ID is required'],
      index: true,
    },
    pageId: {
      type: String,
      required: [true, 'Page ID is required'],
      index: true,
      trim: true,
    },
    name: {
      type: String,
      default: 'Page',
      trim: true,
    },
    dimensions: {
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    sections: {
      type: [String],
      default: [],
    },
    children: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    nodeCount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring one page record per project and pageId
designIRPageSchema.index({ projectId: 1, pageId: 1 }, { unique: true });
designIRPageSchema.index({ irId: 1, pageId: 1 }, { unique: true });

export const DesignIRPage = mongoose.models.DesignIRPage || mongoose.model('DesignIRPage', designIRPageSchema);
export default DesignIRPage;

