
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { RequestHandler } from 'express';
import router from './routes/index.js';
import { errorHandler } from './middlewares/error-handler.js';

const app = express();
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', router);
app.use(express.static(publicDir));

const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
};

app.use(notFound);
app.use(errorHandler);

export default app;
