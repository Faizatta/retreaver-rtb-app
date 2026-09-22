import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Load and validate config on startup
import config from './config.js';
import rtbRouter from './routes/rtb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));

// Cross-Origin Resource Sharing
app.use(cors());

// Parse JSON request bodies with size guard
app.use(express.json({ limit: '10kb' }));

// Rate Limiting: 30 requests per minute per IP
const rtbLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait a minute and try again.'
  }
});

// Mount API routes with rate limiting
app.use('/api', rtbLimiter, rtbRouter);

// Health check endpoint (does not leak config/credentials)
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route for SPA / static index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal error occurred. Please try again.'
  });
});

// Start listener only when executed directly
if (process.argv[1] === __filename) {
  const PORT = config ? config.port : 3000;
  app.listen(PORT, () => {
    console.log(`[RTB Server] Running on http://localhost:${PORT}`);
    console.log(`[RTB Server] Environment verified. Secrets securely isolated.`);
  });
}
