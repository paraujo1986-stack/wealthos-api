import 'dotenv/config';
import express        from 'express';
import helmet         from 'helmet';
import cors           from 'cors';
import { rateLimit }  from 'express-rate-limit';
import { readFile }   from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import authRouter     from './routes/auth.js';
import dataRouter     from './routes/data.js';
import { prisma }     from './lib/prisma.js';

const app  = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Frontend SPA (ANTES do helmet — sem CSP restritiva para o HTML) ─
// O Express serve o wealth-os.html com Content-Type: text/html correcto.
// Cacheado em memória após o primeiro carregamento.
let _htmlCache = null;
app.get('/', async (_req, res) => {
  try {
    if (!_htmlCache) {
      _htmlCache = await readFile(join(__dirname, '../public/index.html'), 'utf-8');
      console.log('✅ WealthOS HTML carregado em cache');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(_htmlCache);
  } catch (err) {
    console.error('[FRONTEND]', err.message);
    res.status(503).send('<h1>WealthOS em manutenção. Tenta novamente em breve.</h1>');
  }
});

// ── Proxy trust (Railway / Render ficam atrás de proxy) ───────────
app.set('trust proxy', 1);

// ── Segurança base ────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Sem origin = Postman / app mobile nativa / mesmo servidor
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origem não permitida — ${origin}`));
    },
    credentials: true,
  })
);

// ── Body parser ───────────────────────────────────────────────────
// 6MB = ligeiramente acima do limite de snapshot (5MB)
app.use(express.json({ limit: '6mb' }));

// ── Rate limiting geral ───────────────────────────────────────────
app.use(
  rateLimit({
    windowMs:       15 * 60 * 1000, // 15 min
    max:            300,
    standardHeaders: true,
    legacyHeaders:  false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Demasiados pedidos. Aguarda.' },
  })
);

// Rate limiting agressivo só para auth (brute force protection)
app.use(
  '/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      20,
    message:  { error: 'TOO_MANY_REQUESTS', message: 'Demasiadas tentativas. Aguarda 15 minutos.' },
  })
);

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status:    'ok',
    app:       'wealthos-api',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Rotas ─────────────────────────────────────────────────────────
app.use('/auth',     authRouter);
app.use('/api/data', dataRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
});

// ── Error handler global ──────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // CORS errors
  if (err.message?.startsWith('CORS')) {
    return res.status(403).json({ error: 'CORS', message: err.message });
  }

  console.error('[ERROR]', new Date().toISOString(), err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);

  res.status(500).json({
    error:   'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Erro interno. Tenta novamente.'
      : err.message,
  });
});

// ── Boot ──────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma — base de dados ligada');

    app.listen(PORT, () => {
      console.log(`🚀 WealthOS API a correr na porta ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Env:    ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('💥 Erro ao arrancar:', err.message);
    process.exit(1);
  }
}

start();
