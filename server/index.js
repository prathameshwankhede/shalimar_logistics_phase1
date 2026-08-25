import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
});

// Static File Serving for Hostinger Production Build (dist folder)
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`📂 Serving static production files from: ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback route for React Router / client routes
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && req.method === 'GET') {
      return res.sendFile(path.resolve(distPath, 'index.html'));
    }
    next();
  });
}

const HOST = process.env.HOST || '0.0.0.0';

// Start Server
app.listen(PORT, HOST, async () => {
  console.log(`==================================================`);
  console.log(`🚀 TransFlow Logistics Express Server Running`);
  console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
  console.log(`==================================================`);
  await testConnection();
});
