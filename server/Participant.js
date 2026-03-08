/**
 * Participant class
 * Represents a single user connected to a Watch Party room.
 */
class Participant {
  /**
   * @param {string} socketId  - Socket.IO socket ID (doubles as userId)
   * @param {string} username  - Display name chosen by the user
   * @param {string} role      - 'host' | 'moderator' | 'participant'
   */
  constructor(socketId, username, role = 'participant') {
    this.socketId = socketId;
    this.userId = socketId; // socketId used as stable userId for this session
    this.username = username;
    this.role = role;
    this.joinedAt = Date.now();
  }

  /** @returns {boolean} True if this participant can control playback */
  canControl() {
    return this.role === 'host' || this.role === 'moderator';
  }

  /** @returns {boolean} True if this participant is the room host */
  isHost() {
    return this.role === 'host';
  }

  /** Serialise to a plain object safe to send over the wire */
  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
    };
  }
}

module.exports = Participant;
