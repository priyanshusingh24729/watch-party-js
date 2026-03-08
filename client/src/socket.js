import { io } from 'socket.io-client';

// In development, Vite proxies /socket.io → localhost:3001
// In production, the backend and frontend share the same origin
const URL = import.meta.env.PROD ? window.location.origin : '/';

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
