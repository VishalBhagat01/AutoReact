import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import figmaRoutes from './src/routes/figmaRoutes.js';
import projectRoutes from './src/routes/projectRoutes.js';
import assetRoutes from './src/routes/assetRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import { connectDB, isDbConnected, setupGracefulShutdown } from './src/config/database.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env and current working directory
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/figma', figmaRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Figma Design Parser API is running',
    database: isDbConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

// Connect to MongoDB and start listening if executed directly
export const startServer = async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Initial MongoDB connection error:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  setupGracefulShutdown(server);
  return server;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
