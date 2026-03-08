const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const MessageHandler = require('./MessageHandler');

// ── App setup ────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== 'production';

const io = new Server(server, {
  cors: isDev
    ? {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      }
    : { origin: false },
  transports: ['websocket', 'polling'],
});

app.use(cors());
app.use(express.json());

// ── Serve built frontend in production ───────────────────────────────────────

if (!isDev) {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, uptime: process.uptime() });
});

// ── Rooms registry + handler ─────────────────────────────────────────────────

/** @type {Map<string, import('./Room')>} */
const rooms = new Map();
const handler = new MessageHandler(io, rooms);

// ── Socket.IO event routing ──────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // Suppress abrupt-disconnect write errors (ECONNABORTED, ECONNRESET, etc.)
  // These are expected when a client closes the tab or loses network mid-write.
  socket.conn.on('error', (err) => {
    if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) return;
    console.error(`[socket error] ${socket.id}:`, err.message);
  });

  socket.on('join_room',            (d) => handler.handleJoinRoom(socket, d));
  socket.on('leave_room',           ()  => handler.handleLeaveRoom(socket));

  // Playback (Host/Moderator only)
  socket.on('play',                 ()  => handler.handlePlay(socket));
  socket.on('pause',                (d) => handler.handlePause(socket, d));
  socket.on('seek',                 (d) => handler.handleSeek(socket, d));
  socket.on('change_video',         (d) => handler.handleChangeVideo(socket, d));

  // Room management (Host only)
  socket.on('assign_role',          (d) => handler.handleAssignRole(socket, d));
  socket.on('remove_participant',   (d) => handler.handleRemoveParticipant(socket, d));
  socket.on('transfer_host',        (d) => handler.handleTransferHost(socket, d));

  // Bonus: Chat
  socket.on('chat',                 (d) => handler.handleChat(socket, d));

  socket.on('disconnect',           ()  => handler.handleDisconnect(socket));
});

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎬 Watch Party server running on port ${PORT}`);
  console.log(`   Mode: ${isDev ? 'development' : 'production'}\n`);
});
