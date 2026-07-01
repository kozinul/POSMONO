import path from 'path';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { tenantContext } from '../@shared/interfaces/middleware/tenantContext';
import { errorHandler } from '../@shared/interfaces/middleware/errorHandler';
import { registerRoutes } from './routes';
import type { DIContainer } from './container';

export function createServer(container: DIContainer): Express {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan('short'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const frontendDist = path.resolve(__dirname, '../../../frontend/dist');
  app.use(express.static(frontendDist));

  app.use(tenantContext);

  registerRoutes(app, container);

  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}
