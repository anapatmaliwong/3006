/**
 * 3006 AC Library — Backend Server
 * All secrets live here: Firebase keys, admin creds, Gemini key
 */
require('dotenv').config();

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const path     = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const apiRoutes  = require('./routes/api');
const aiRoutes   = require('./routes/ai');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",   // needed for inline scripts we control
        'https://www.gstatic.com',
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https://img.youtube.com'],
      mediaSrc: ["'self'"],
      frameSrc: ['https://www.youtube.com'],
      connectSrc: ["'self'"],
    },
  },
}));

// ── CORS (adjust origin in production) ──────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
    : '*',
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

// ── Rate limits ──────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: { error: 'Too many login attempts, please try again later.' },
});
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || 120,
  message: { error: 'Rate limit exceeded.' },
});

// ── API routes ───────────────────────────────────────────────────
app.use('/api/auth',   authLimiter, authRoutes);
app.use('/api/data',   apiLimiter, requireAuth, apiRoutes);
app.use('/api/ai',     apiLimiter, requireAuth, aiRoutes);

// ── Serve frontend ────────────────────────────────────────────────
const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC));

// admin.html is protected — server verifies token before serving
app.get('/admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(PUBLIC, 'admin.html'));
});

// All other HTML pages (unauthenticated pages redirect to index)
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/lobby.html',     requireAuth, (req, res) => res.sendFile(path.join(PUBLIC, 'lobby.html')));
app.get('/library.html',   requireAuth, (req, res) => res.sendFile(path.join(PUBLIC, 'library.html')));
app.get('/community.html', requireAuth, (req, res) => res.sendFile(path.join(PUBLIC, 'community.html')));
app.get('/settings.html',  requireAuth, (req, res) => res.sendFile(path.join(PUBLIC, 'settings.html')));

// ── Global error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 3006 Backend running at http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend: ${PUBLIC}\n`);
});
