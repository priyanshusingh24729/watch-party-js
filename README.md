# 🎬 WatchTogether — YouTube Watch Party

Real-time synchronized YouTube watch party with role-based access control.

**Live Demo:** `https://your-app.onrender.com` ← replace after deployment

---

## Features

- **Real-time sync** — Play, pause, seek, and video changes propagate instantly to all participants via WebSockets
- **Room-based** — Unique 6-character room codes; shareable links
- **Role-based access control** — Host → Moderator → Participant hierarchy with backend-enforced permissions
- **Live chat** — Text chat alongside the video
- **Auto host transfer** — If the host disconnects, the next participant inherits the role

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express |
| Real-time | Socket.IO v4 |
| Video | YouTube IFrame Player API |
| Styling | Pure CSS (no framework) |

---

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# Clone / download the project, then:

# Install all dependencies
cd watch-party
npm run install:all

# Start both server and client in development mode
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001

The Vite dev server proxies `/socket.io` to the backend automatically.

---

## Project Structure

```
watch-party/
├── server/
│   ├── index.js          # Express app + Socket.IO setup + event routing
│   ├── Room.js           # Room class: participants, video state, role logic
│   ├── Participant.js    # Participant class: role, permissions
│   ├── MessageHandler.js # Handles all WS events with validation
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx       # Create / join room landing page
│   │   │   └── WatchRoom.tsx  # Main room: socket logic + layout
│   │   ├── components/
│   │   │   ├── YouTubePlayer.tsx  # IFrame API wrapper (forwardRef)
│   │   │   ├── Controls.tsx       # Play/pause, seek bar, volume, video URL
│   │   │   ├── ParticipantList.tsx # Role badges + host actions
│   │   │   └── Chat.tsx           # Live chat panel
│   │   ├── socket.ts         # Socket.IO singleton
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── index.css         # Global styles + design tokens
│   └── package.json
└── package.json              # Root: dev script + build helpers
```

---

## WebSocket Event Reference

### Client → Server

| Event | Payload | Permission |
|-------|---------|-----------|
| `join_room` | `{ roomId, username }` | Anyone |
| `leave_room` | — | Anyone |
| `play` | — | Host / Moderator |
| `pause` | `{ currentTime }` | Host / Moderator |
| `seek` | `{ time }` | Host / Moderator |
| `change_video` | `{ videoId }` | Host / Moderator |
| `assign_role` | `{ userId, role }` | Host only |
| `remove_participant` | `{ userId }` | Host only |
| `transfer_host` | `{ userId }` | Host only |
| `chat` | `{ message }` | Anyone in room |

### Server → Client

| Event | Payload | Trigger |
|-------|---------|---------|
| `room_joined` | `{ roomId, userId, role, participants, videoState }` | Sent to joining user |
| `sync_state` | `{ videoId, playState, currentTime }` | Broadcast on any state change |
| `user_joined` | `{ username, userId, role, participants }` | New participant |
| `user_left` | `{ username, userId, participants }` | Participant left/disconnected |
| `role_assigned` | `{ userId, username, role, participants }` | Role change |
| `participant_removed` | `{ userId, participants }` | Host removed someone |
| `removed_from_room` | `{ message }` | Sent to removed participant |
| `chat_message` | `{ userId, username, message, timestamp }` | Chat |
| `error` | `{ message }` | Permission denied / bad input |

---

## Architecture Overview

### How WebSockets enable real-time sync

```
User A (Host)          Server                 User B / C / D
    │                     │                          │
    │── play ────────────►│                          │
    │                     │  validate: canControl?   │
    │                     │── sync_state ───────────►│
    │◄─ sync_state ───────│                          │
    │   (echo back)       │                          │
    │                     │                          │
    │── seek { t:42 } ───►│                          │
    │                     │── sync_state { t:42 } ──►│
    │◄─ sync_state ───────│                          │
```

1. **Single source of truth** — The server holds the canonical `videoState` (videoId, playState, currentTime, lastUpdated).  
2. **Permission gate** — The server checks `canControl()` before processing any playback event.  
3. **Echo to sender** — `io.to(roomId).emit(...)` includes the sender, so the emitter's UI updates from the server broadcast too (consistent state).  
4. **Late-join sync** — `Room.getEstimatedCurrentTime()` adds elapsed wall-clock time since `lastUpdated` to estimate where a playing video actually is when a new user joins.

### Role enforcement

```
Backend Role Check:
  canControl(socketId) → participant.role === 'host' || 'moderator'
  isHost(socketId)     → participant.role === 'host'

Frontend:
  canControl prop → show/hide controls, disable seek bar
  Role badge displayed on participant list
```

### OOP design (bonus)
- **`Participant`** — Encapsulates user identity, role, and permission helpers (`canControl()`, `isHost()`)  
- **`Room`** — Manages participant map, video state, role assignment, host transfer, and time estimation  
- **`MessageHandler`** — Validates inputs, checks permissions, mutates room state, and broadcasts events

---

## Deployment on Render

1. Push code to GitHub  
2. Create a **new Web Service** on [render.com](https://render.com):
   - **Root directory:** `watch-party`
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Environment:** `NODE_ENV=production`, `PORT=10000`
3. Set `NODE_ENV=production` in Render's environment variables  
4. The server will serve the built React app as static files from `client/dist`

> **WebSockets on Render:** Socket.IO works out of the box. The free tier may spin down after inactivity, which breaks persistent WebSocket connections — upgrade to a paid tier or use Railway/Fly.io for always-on rooms.

---

## Roles at a Glance

| Role | Play/Pause | Seek | Change Video | Assign Roles | Remove Users |
|------|-----------|------|--------------|--------------|--------------|
| **Host** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Moderator** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Participant** | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Trade-offs & Known Limitations

- **No database** — Rooms live in server memory; they're lost on server restart. For persistence, add SQLite/PostgreSQL with a `rooms` table.
- **Single server** — No Redis Pub/Sub; scaling horizontally would break sync. Add the Socket.IO Redis adapter for multi-instance deployments.
- **No auth** — Any user can claim any username. Add JWT/session auth for production use.
- **Seek drift** — Time estimation on late-join is approximate (~500ms error). A periodic host heartbeat would improve accuracy.
- **YouTube API** — `controls: 0` hides native YouTube controls; the embed may behave differently for age-restricted or geo-blocked videos.
