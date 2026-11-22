import { timingSafeEqual, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { tasksRouter } from './tasks.js';
import { DbError } from './db.js';
import { ValidationError } from './validate.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const digest = (s) => createHash('sha256').update(s).digest();
const tokenDigest = digest(config.apiToken);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.get('/login/', (req, res) => {
    res.type('text/plain').send(config.authorLogin);
  });

  const api = express.Router();

  api.use((req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    if (!m || !timingSafeEqual(digest(m[1]), tokenDigest)) {
      return res.status(401).json({ error: 'Invalid or missing token' });
    }
    next();
  });

  api.use(express.json({ limit: '10kb', strict: false, type: () => true }));

  api.get('/author/', (req, res) => {
    res.json({ login: config.authorLogin, fullName: config.authorFullName });
  });

  api.use('/tasks', tasksRouter);

  api.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use('/api', api);

  app.use(express.static(publicDir));

  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
    if (err.type === 'entity.too.large') return res.status(400).json({ error: 'Body too large' });
    if (err instanceof DbError) return res.status(503).json({ error: 'Database unavailable' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
