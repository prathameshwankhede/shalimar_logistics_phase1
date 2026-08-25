import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before modules initialize
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    db_host: process.env.DB_HOST || process.env.DATABASE_HOST || '127.0.0.1',
    db_user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
    db_name: process.env.DB_NAME || process.env.DATABASE_NAME || 'transflow_db'
  });
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

// Hostinger Production Express Listener (Binds immediately to prevent 503 Service Unavailable)
console.log(`==================================================`);
console.log(`🚀 Starting TransFlow Logistics Hostinger Express App`);
console.log(`📌 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`==================================================`);

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Express HTTP Server Listening on Port: ${PORT}`);
  console.log(`==================================================`);

  // Asynchronously test MySQL Connection & Run Self-Healing Schema Init in background
  testConnection()
    .then((dbConnected) => {
      if (dbConnected) {
        console.log('✅ MySQL Database ready and 6 core tables verified.');
      } else {
        console.warn('⚠️ MySQL connection check returned false. Verify Hostinger DB environment variables.');
      }
    })
    .catch((err) => {
      console.error('⚠️ Async MySQL Connection Error:', err.message);
    });
});
