const Participant = require('./Participant');

/**
 * Room class
 * Encapsulates all state and logic for a single Watch Party room,
 * including participant management, role assignment, and video state.
 */
class Room {
  /**
   * @param {string} roomId          - Unique room identifier
   * @param {string} hostSocketId    - Socket ID of the room creator (becomes Host)
   * @param {string} hostUsername    - Display name of the host
   */
  constructor(roomId, hostSocketId, hostUsername) {
    this.roomId = roomId;
    this.createdAt = Date.now();

    /** @type {Map<string, Participant>} socketId → Participant */
    this.participants = new Map();

    this.videoState = {
      videoId: '',          // YouTube video ID
      playState: 'paused',  // 'playing' | 'paused'
      currentTime: 0,       // seconds
      lastUpdated: Date.now(),
    };

    // Seed the host
    const host = new Participant(hostSocketId, hostUsername, 'host');
    this.participants.set(hostSocketId, host);
    this.hostSocketId = hostSocketId;
  }

  // ── Participant management ──────────────────────────────────────────────────

  /**
   * Add a new participant (default role: 'participant').
   * @returns {Participant}
   */
  addParticipant(socketId, username) {
    const p = new Participant(socketId, username, 'participant');
    this.participants.set(socketId, p);
    return p;
  }

  /**
   * Remove a participant from the room.
   * If the host leaves, the oldest remaining participant is promoted to host.
   * @returns {Participant|null} The removed participant, or null if not found.
   */
  removeParticipant(socketId) {
    const participant = this.participants.get(socketId);
    if (!participant) return null;

    this.participants.delete(socketId);

    // Auto-promote a new host if needed
    if (socketId === this.hostSocketId && this.participants.size > 0) {
      const [newHostId, newHost] = this.participants.entries().next().value;
      newHost.role = 'host';
      this.hostSocketId = newHostId;
    }

    return participant;
  }

  /** @returns {Participant|undefined} */
  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  /** @returns {object[]} Plain-object array suitable for socket broadcast */
  getParticipantList() {
    return Array.from(this.participants.values()).map(p => p.toJSON());
  }

  // ── Role management ─────────────────────────────────────────────────────────

  /**
   * Assign a role to a participant.
   * Cannot demote the host via this method (use transferHost instead).
   * @param {string} targetSocketId
   * @param {'moderator'|'participant'} role
   * @returns {boolean} Success
   */
  assignRole(targetSocketId, role) {
    const participant = this.participants.get(targetSocketId);
    if (!participant) return false;
    if (participant.role === 'host') return false; // Host role is protected
    participant.role = role;
    return true;
  }

  /**
   * Transfer the Host role from one participant to another.
   * The previous host becomes a regular participant.
   * @returns {boolean} Success
   */
  transferHost(fromSocketId, toSocketId) {
    const from = this.participants.get(fromSocketId);
    const to = this.participants.get(toSocketId);
    if (!from || !to || from.role !== 'host') return false;
    from.role = 'participant';
    to.role = 'host';
    this.hostSocketId = toSocketId;
    return true;
  }

  // ── Permission checks ───────────────────────────────────────────────────────

  /** @returns {boolean} Whether the socket can control playback */
  canControl(socketId) {
    return this.participants.get(socketId)?.canControl() === true;
  }

  /** @returns {boolean} Whether the socket is the room host */
  isHost(socketId) {
    return this.participants.get(socketId)?.isHost() === true;
  }

  // ── Video state ─────────────────────────────────────────────────────────────

  /** Merge partial updates into the video state and stamp lastUpdated */
  updateVideoState(update) {
    this.videoState = { ...this.videoState, ...update, lastUpdated: Date.now() };
  }

  /**
   * Compute an estimated current playback time, accounting for elapsed wall-clock
   * time since the last state update (useful when a new participant joins mid-stream).
   * @returns {number} Estimated current time in seconds
   */
  getEstimatedCurrentTime() {
    if (this.videoState.playState === 'playing') {
      const elapsed = (Date.now() - this.videoState.lastUpdated) / 1000;
      return this.videoState.currentTime + elapsed;
    }
    return this.videoState.currentTime;
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  /** @returns {boolean} True when there are no participants left */
  isEmpty() {
    return this.participants.size === 0;
  }
}

module.exports = Room;
