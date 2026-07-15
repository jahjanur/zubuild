/**
 * AEM Residence Operations API
 * Node.js + Express + TypeScript, session auth, SQLite (local) / optional Postgres (production)
 */
import 'express-session';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { config } from './config';
import { logRequest, logError } from './lib/logger';

import authRoutes from './routes/auth';
import suppliersRoutes from './routes/suppliers';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import reconciliationsRoutes from './routes/reconciliations';
import controlRoutes from './routes/control';
import analyticsRoutes from './routes/analytics';
import inventoryRoutes from './routes/inventory';
import teamRoutes from './routes/team';
import organizationRoutes from './routes/organization';
import costCalcRoutes from './routes/costCalc';
import debugRoutes from './routes/debug';
import { sanitizeBody } from './middleware/sanitize';
import { assertPdfFontsAvailable } from './lib/pdf';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { prisma } from './lib/prisma';

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: false, // allow inline scripts if needed for SPA
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Session: httpOnly cookies, stored in the DB (survives restarts, shared across
// instances). Uses whatever DB Prisma points at — SQLite locally, Postgres in staging.
app.use(
  session({
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, // prune expired sessions every 2 min
      dbRecordIdIsSessionId: true,
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: config.isProduction ? 'lax' : 'lax',
    },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logRequest(req.method, req.path, res.statusCode, Date.now() - start);
  });
  next();
});

// Routes (rate limit applied only to login inside auth router)
app.use('/auth', authRoutes);
app.use('/suppliers', suppliersRoutes);
app.use('/products', productsRoutes);
app.use('/orders', ordersRoutes);
app.use('/reconciliations', reconciliationsRoutes);
app.use('/control', controlRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/team', teamRoutes);
app.use('/organization', organizationRoutes);
app.use('/cost-calc', costCalcRoutes);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Dev-only debug (disabled in production)
if (!config.isProduction) {
  app.use('/debug', debugRoutes);
}

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logError('Unhandled error', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start the server only when run directly (not when imported by tests via supertest).
if (require.main === module) {
  // Fail fast if the bundled PDF fonts are missing — better a loud crash at boot
  // than silent 500s on every order PDF once a request hits Cyrillic labels.
  try {
    assertPdfFontsAvailable();
  } catch (err) {
    logError('PDF font check failed at startup', err);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`API listening on port ${config.port} (${config.nodeEnv})`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${config.port} is already in use. Kill the process with:\n  npm run dev:kill\nor:\n  lsof -ti:${config.port} | xargs kill -9\n`);
    }
    throw err;
  });
}

export { app };
