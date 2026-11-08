import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      default: 'Untitled Design',
    },
    figmaFileKey: {
      type: String,
      required: [true, 'Figma file key is required'],
      unique: true,
      index: true,
      trim: true,
    },
    figmaFileUrl: {
      type: String,
      required: [true, 'Figma file URL is required'],
      trim: true,
    },
    figmaVersion: {
      type: String,
      default: '1.0',
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['imported', 'processing', 'completed', 'failed'],
      default: 'imported',
      index: true,
    },
    settings: {
      styling: {
        type: String,
        enum: ['tailwind', 'css_modules', 'inline_styles'],
        default: 'tailwind',
      },
      language: {
        type: String,
        enum: ['jsx', 'tsx'],
        default: 'jsx',
      },
      framework: {
        type: String,
        enum: ['vite_react', 'nextjs'],
        default: 'vite_react',
      },
    },
    lastImportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying by status and creation date
projectSchema.index({ status: 1, createdAt: -1 });

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
export default Project;
