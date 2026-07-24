// Trigger Vercel redeployment after reverting Device & Login Session Management to resolve automatic logout
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './config/logger.js';
import authRoutes from './routes/authRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import { errorHandler } from './middlewares/errorMiddleware.js';

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable trust proxy to correctly identify client IPs for rate limiting
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';

// 1. Security Headers (Relaxed CSP to allow CDN fonts, maps, styles)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 2. CORS Whitelist Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://crowdcity.co.in', 'https://www.crowdcity.co.in'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || !isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// 3. Compress Response Payloads (gzip)
app.use(compression());

// 4. Request Logging using Winston
const morganStream = {
  write: (message) => logger.info(message.trim())
};
app.use(morgan(isProduction ? 'combined' : 'dev', { stream: morganStream }));

app.use(express.json());

// 5. Rate Limiting Configurations
// Rate limiting is only active in production to avoid 429 errors during local development.
if (isProduction) {
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
  });

  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts on this sensitive endpoint, please try again after 15 minutes.' }
  });

  // Apply general rate limiting to all API routes
  app.use('/api', generalLimiter);

  // Apply strict rate limiting to heavy/sensitive routes (AI, creation routes)
  app.use('/api/ai', strictLimiter);
  app.use('/api/issues', (req, res, next) => {
    if (req.method === 'POST') {
      return strictLimiter(req, res, next);
    }
    next();
  });
} else {
  console.log('[Dev] Rate limiting is DISABLED in development mode.');
}

// Bind API Router endpoints
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/departments', departmentRoutes);

// Static client file server with caching
app.use(express.static(path.join(__dirname, '../client'), {
  maxAge: isProduction ? '1d' : '0'
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'CrowdCity Server is running smoothly' });
});

// Serve public config credentials to client
app.get('/api/config', (req, res) => {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'placeholder',
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
  });
});

// Serve frontend SPA fallback (if required) or 404 for missing APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Fallback to index.html for other unhandled routes (client navigation support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Centralized Error Handler (Must be registered last)
app.use(errorHandler);

export default app;
