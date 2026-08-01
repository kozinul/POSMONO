import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      auth: {
        token: localStorage.getItem('accessToken'),
      },
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  if (!socket) {
    socket = getSocket();
    socket.connect();
  }
  return socket;
}

export function updateSocketAuth(): void {
  const token = localStorage.getItem('accessToken');
  if (socket) {
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
