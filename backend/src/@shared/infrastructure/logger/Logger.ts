import pino from 'pino';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const logDir = path.resolve(process.cwd(), 'logs');

const targets: pino.TransportTargetOptions[] = [
  { target: 'pino/file', options: { destination: path.join(logDir, 'app.log'), mkdir: true } },
];

if (!isProduction) {
  targets.push({ target: 'pino-pretty', options: { colorize: true } });
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { targets },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      tenantId: req.tenantId,
    }),
    err: pino.stdSerializers.err,
  },
});
