const Room = require('./Room');

/**
 * MessageHandler class
 * Centralises WebSocket event routing, validation, and room broadcasting.
 * Each method corresponds to one client → server event.
 */
class MessageHandler {
  /**
   * @param {import('socket.io').Server} io
   * @param {Map<string, Room>} rooms  - Shared rooms registry
   */
  constructor(io, rooms) {
    this.io = io;
    this.rooms = rooms;
  }

  // ── Connection events ───────────────────────────────────────────────────────

  /**
   * Handle a user joining or creating a room.
   * - If the room doesn't exist, the user becomes Host.
   * - If the room exists, the user joins as Participant.
   * Emits `room_joined` to the joining socket and `user_joined` to the room.
   */
  handleJoinRoom(socket, { roomId, username }) {
    if (!roomId || !username || typeof roomId !== 'string' || typeof username !== 'string') {
      socket.emit('error', { message: 'roomId and username are required.' });
      return;
    }

    const sanitisedUsername = username.trim().slice(0, 30);
    const sanitisedRoomId = roomId.trim().toUpperCase().slice(0, 12);

    let room = this.rooms.get(sanitisedRoomId);
    const isNewRoom = !room;

    if (isNewRoom) {
      room = new Room(sanitisedRoomId, socket.id, sanitisedUsername);
      this.rooms.set(sanitisedRoomId, room);
      console.log(`[Room] Created "${sanitisedRoomId}" by ${sanitisedUsername}`);
    } else {
      room.addParticipant(socket.id, sanitisedUsername);
      console.log(`[Room] ${sanitisedUsername} joined "${sanitisedRoomId}"`);
    }

    socket.join(sanitisedRoomId);
    socket.data.roomId = sanitisedRoomId;
    socket.data.username = sanitisedUsername;

    const participant = room.getParticipant(socket.id);
    const participants = room.getParticipantList();

    // Send full room state to the joining user
    socket.emit('room_joined', {
      roomId: sanitisedRoomId,
      userId: socket.id,
      role: participant.role,
      participants,
      videoState: {
        ...room.videoState,
        currentTime: room.getEstimatedCurrentTime(),
      },
    });

    // Broadcast new arrival to existing members
    if (!isNewRoom) {
      socket.to(sanitisedRoomId).emit('user_joined', {
        username: sanitisedUsername,
        userId: socket.id,
        role: participant.role,
        participants,
      });
    }
  }

  /** Handle an explicit leave_room event */
  handleLeaveRoom(socket) {
    this._cleanupParticipant(socket);
  }

  /** Handle socket disconnection */
  handleDisconnect(socket) {
    console.log(`[-] Client disconnected: ${socket.id}`);
    this._cleanupParticipant(socket);
  }

  // ── Playback control events (require Host or Moderator) ────────────────────

  handlePlay(socket) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertCanControl(socket, room)) return;

    const currentTime = room.getEstimatedCurrentTime();
    room.updateVideoState({ playState: 'playing', currentTime });
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState, currentTime });
  }

  handlePause(socket, { currentTime } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertCanControl(socket, room)) return;

    const time = typeof currentTime === 'number' ? currentTime : room.getEstimatedCurrentTime();
    room.updateVideoState({ playState: 'paused', currentTime: time });
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState });
  }

  handleSeek(socket, { time } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertCanControl(socket, room)) return;
    if (typeof time !== 'number') {
      socket.emit('error', { message: 'seek requires a numeric `time` field.' });
      return;
    }

    room.updateVideoState({ currentTime: time });
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState, currentTime: time });
  }

  handleChangeVideo(socket, { videoId } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertCanControl(socket, room)) return;
    if (!videoId || typeof videoId !== 'string') {
      socket.emit('error', { message: 'change_video requires a videoId string.' });
      return;
    }

    room.updateVideoState({ videoId: videoId.trim(), currentTime: 0, playState: 'paused' });
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState });
  }

  // ── Host-only events ────────────────────────────────────────────────────────

  handleAssignRole(socket, { userId, role } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertIsHost(socket, room)) return;

    const validRoles = ['moderator', 'participant'];
    if (!validRoles.includes(role)) {
      socket.emit('error', { message: `Invalid role "${role}". Valid: ${validRoles.join(', ')}` });
      return;
    }

    const success = room.assignRole(userId, role);
    if (!success) {
      socket.emit('error', { message: 'Could not assign role. User may not exist or is the host.' });
      return;
    }

    const target = room.getParticipant(userId);
    const participants = room.getParticipantList();

    this.io.to(room.roomId).emit('role_assigned', {
      userId,
      username: target?.username,
      role,
      participants,
    });

    console.log(`[Role] ${target?.username} assigned "${role}" in "${room.roomId}"`);
  }

  handleRemoveParticipant(socket, { userId } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertIsHost(socket, room)) return;

    if (userId === socket.id) {
      socket.emit('error', { message: 'The host cannot remove themselves.' });
      return;
    }

    const target = room.getParticipant(userId);
    if (!target) {
      socket.emit('error', { message: 'Participant not found.' });
      return;
    }

    room.removeParticipant(userId);
    const participants = room.getParticipantList();

    // Notify the removed user first
    this.io.to(userId).emit('removed_from_room', {
      message: 'You were removed from the room by the host.',
    });

    // Notify the room
    this.io.to(room.roomId).emit('participant_removed', { userId, participants });

    // Kick them from the Socket.IO room
    const targetSocket = this.io.sockets.sockets.get(userId);
    if (targetSocket) {
      targetSocket.leave(room.roomId);
      targetSocket.data.roomId = null;
    }

    console.log(`[Room] ${target.username} removed from "${room.roomId}"`);
  }

  handleTransferHost(socket, { userId } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!this._assertIsHost(socket, room)) return;

    const success = room.transferHost(socket.id, userId);
    if (!success) {
      socket.emit('error', { message: 'Could not transfer host.' });
      return;
    }

    const newHost = room.getParticipant(userId);
    const participants = room.getParticipantList();

    this.io.to(room.roomId).emit('role_assigned', {
      userId,
      username: newHost?.username,
      role: 'host',
      participants,
    });

    // Also broadcast that previous host changed role
    this.io.to(room.roomId).emit('role_assigned', {
      userId: socket.id,
      username: socket.data.username,
      role: 'participant',
      participants,
    });

    console.log(`[Host] ${socket.data.username} transferred host to ${newHost?.username} in "${room.roomId}"`);
  }

  // ── Chat (bonus) ────────────────────────────────────────────────────────────

  handleChat(socket, { message } = {}) {
    const room = this._getRoom(socket);
    if (!room) return;
    if (!message || typeof message !== 'string') return;

    const participant = room.getParticipant(socket.id);
    if (!participant) return;

    const chatMessage = {
      userId: socket.id,
      username: participant.username,
      message: message.trim().slice(0, 500),
      timestamp: Date.now(),
    };

    this.io.to(room.roomId).emit('chat_message', chatMessage);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _getRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  _assertCanControl(socket, room) {
    if (!room.canControl(socket.id)) {
      socket.emit('error', { message: 'Permission denied. Only Host/Moderator can control playback.' });
      return false;
    }
    return true;
  }

  _assertIsHost(socket, room) {
    if (!room.isHost(socket.id)) {
      socket.emit('error', { message: 'Permission denied. Only Host can perform this action.' });
      return false;
    }
    return true;
  }

  _cleanupParticipant(socket) {
    const roomId = socket.data?.roomId;
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.getParticipant(socket.id);
    room.removeParticipant(socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;

    if (room.isEmpty()) {
      this.rooms.delete(roomId);
      console.log(`[Room] "${roomId}" is empty — removed from registry`);
    } else {
      const participants = room.getParticipantList();
      this.io.to(roomId).emit('user_left', {
        username: participant?.username,
        userId: socket.id,
        participants,
      });
      console.log(`[Room] ${participant?.username} left "${roomId}"`);
    }
  }
}

module.exports = MessageHandler;
