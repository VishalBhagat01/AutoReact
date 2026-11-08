import mongoose from 'mongoose';

const fileManifestItemSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    language: {
      type: String,
      default: 'javascript',
    },
    contentSnippet: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const generatedCodeSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    generationMode: {
      type: String,
      enum: ['component', 'project'],
      default: 'component',
      index: true,
    },
    selectedNodeIds: {
      type: [String],
      default: [],
    },
    artifactName: {
      type: String,
      required: [true, 'Artifact name is required'],
      trim: true,
    },
    artifactType: {
      type: String,
      enum: ['react_component', 'full_application', 'design_system', 'zip_archive'],
      default: 'react_component',
    },
    fileManifest: {
      type: [fileManifestItemSchema],
      default: [],
    },
    // Filesystem path or storage location (Never store large binary blobs in MongoDB)
    storageLocation: {
      type: String,
      default: null,
      trim: true,
    },
    generationStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    validationStatus: {
      type: String,
      enum: ['unvalidated', 'passed', 'warnings', 'failed'],
      default: 'unvalidated',
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

// Indexes
generatedCodeSchema.index({ projectId: 1, generationMode: 1, createdAt: -1 });

export const GeneratedCode = mongoose.models.GeneratedCode || mongoose.model('GeneratedCode', generatedCodeSchema);
export default GeneratedCode;
