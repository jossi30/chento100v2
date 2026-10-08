import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import userRouter from './routes/user.route.js';
import authRouter from './routes/auth.route.js';
import listingRouter from './routes/listing.route.js';
import adminRouter from './routes/admin.route.js';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

import { initFirebaseStore, getFirebaseConfig } from './utils/firebaseStore.js';

dotenv.config();

// Initialize Firebase Backend Store for chento100
const fbConfig = getFirebaseConfig();
console.log(`[Backend] Initializing Firebase backend for Project: ${fbConfig.projectId} (${fbConfig.firestoreDatabaseId})`);
initFirebaseStore()
  .then(() => console.log(`[Backend] Firebase persistent store active for chento100!`))
  .catch((e) => console.warn(`[Backend] Firebase store warning:`, e.message));

// Mongoose connection setup with fast failover
mongoose.set('bufferCommands', false);

// Extract clean MongoDB URI if formatted with variable names, quotes, or whitespace
const extractMongoUri = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.match(/(mongodb(?:\+srv)?:\/\/[^\s"';\n\r]+)/i);
  return match ? match[1] : null;
};

// Also extract JWT_SECRET if accidentally bundled in the MONGO variable string
if (!process.env.JWT_SECRET) {
  const jwtMatch = (process.env.MONGO || '').match(/JWT_SECRET=([^\s"';]+)/);
  if (jwtMatch) {
    process.env.JWT_SECRET = jwtMatch[1];
  }
}

const rawUri = process.env.MONGO || process.env.MONGODB_URI;
const mongoUri = extractMongoUri(rawUri);

// Check if the URI is a mock/documentation placeholder (e.g. cluster0.example.mongodb.net)
const isPlaceholderUri = (uri) => {
  if (!uri) return true;
  return /example\.(mongodb\.net|com|org)/i.test(uri) || /username:password/i.test(uri);
};

if (mongoUri && !isPlaceholderUri(mongoUri)) {
  mongoose
    .connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      console.log('Connected to MongoDB!');
    })
    .catch((err) => {
      console.log('MongoDB connection unavailable, using in-memory store:', err.message);
    });
} else {
  console.log('In-memory database store active.');
}

const __dirname = path.resolve();

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// API routes FIRST
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/listing', listingRouter);
app.use('/api/admin', adminRouter);

// Ensure static frontends exist before serving
const adminDistPath = path.join(__dirname, 'admin-app', 'dist');
const clientDistPath = path.join(__dirname, 'client', 'dist');

if (!fs.existsSync(path.join(clientDistPath, 'index.html')) || !fs.existsSync(path.join(adminDistPath, 'index.html'))) {
  console.log('[Startup] Frontend dist not found. Triggering build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[Startup] Frontends built successfully.');
  } catch (err) {
    console.error('[Startup] Failed to build frontends:', err.message);
  }
}

// Serve static admin app assets from admin-app/dist
app.use('/admin', express.static(adminDistPath));
app.get(['/admin', '/admin/*'], (req, res, next) => {
  const adminIndex = path.join(adminDistPath, 'index.html');
  if (fs.existsSync(adminIndex)) {
    return res.sendFile(adminIndex);
  }
  next();
});

// Serve public images
app.use('/images', express.static(path.join(__dirname, 'client', 'public', 'images')));

// Serve static frontend assets from client/dist
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  const clientIndex = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }
  return res.status(200).send('<!doctype html><html><head><meta charset="utf-8"><title>chento 100</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Starting application...</h2><p>Please refresh the page in a few moments.</p><script>setTimeout(() => window.location.reload(), 2500);</script></body></html>');
});

// Database offline / Mongoose error fallback middleware
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      statusCode: 413,
      message: 'Uploaded payload or image is too large. Please select a compressed or smaller image.',
    });
  }
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    console.log('[AI Studio] Database offline — returning mock empty response');
    if (req.method === 'GET') {
      return res.json([]);
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

const server = app.listen(3000, '0.0.0.0', () => {
  console.log('Server is running on port 3000 (0.0.0.0)!');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('Port 3000 already in use, exiting cleanly for orchestrator restart...');
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
