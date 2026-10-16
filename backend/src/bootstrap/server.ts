import path from 'path';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { tenantContext } from '../@shared/interfaces/middleware/tenantContext';
import { notFoundApiHandler } from '../@shared/interfaces/middleware/notFoundApi';
import { errorHandler } from '../@shared/interfaces/middleware/errorHandler';
import { registerRoutes } from './routes';
import type { DIContainer } from './container';
import { UPLOAD_DIR } from '../core/upload/application/services/UploadService';
import { env } from '../@shared/config/env';

export function createServer(container: DIContainer): Express {
  const app = express();

  // Caddy is the only hop in front of the app in production (docker/docker-compose.caddy.yml),
  // so trusting exactly one hop makes `req.ip` the real client — which both the rate limiter
  // and the audit log depend on. Outside production the process is reached directly, so
  // trusting a forwarded header there would only let callers spoof their own address.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan('short'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const frontendDist = path.resolve(__dirname, '../../../frontend/dist');
  app.use(express.static(frontendDist));

  const uploadsDir = UPLOAD_DIR;
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  app.use(tenantContext);

  registerRoutes(app, container);

  // Unmatched `/api/*` must answer as JSON; the SPA fallback below would otherwise
  // reply `200 text/html` for an endpoint that does not exist.
  app.use('/api', notFoundApiHandler());

  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}
