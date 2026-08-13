import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../@shared/config/env';

let io: Server;

export function initSocketServer(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    path: env.SOCKET_PATH || '/socket.io',
    cors: { origin: true, credentials: true },
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        const tenantId = payload.tenant || payload.tenantId || payload.tenant_id;
        if (tenantId) {
          socket.join(tenantId);
        }
      } catch {
        socket.disconnect();
      }
    }
  });

  return io;
}

export function getIO(): Server {
  return io;
}
