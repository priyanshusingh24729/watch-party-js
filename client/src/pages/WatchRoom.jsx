import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import YouTubePlayer from '../components/YouTubePlayer';
import Controls from '../components/Controls';
import ParticipantList from '../components/ParticipantList';
import Chat from '../components/Chat';

// ── Toast system ──────────────────────────────────────────────────────────────
let toastCounter = 0;

// ── Component ─────────────────────────────────────────────────────────────────

export default function WatchRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [username] = useState(() => localStorage.getItem('wp_username') || '');
  const [userId, setUserId] = useState('');
  const [myRole, setMyRole] = useState('participant');
  const [participants, setParticipants] = useState([]);
  const [videoState, setVideoState] = useState({
    videoId: '',
    playState: 'paused',
    currentTime: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('participants');
  const [copied, setCopied] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const playerRef = useRef(null);
  /**
   * Set to true before we programmatically change player state so the
   * onStateChange callback doesn't re-emit the event back to the server.
   */
  const isApplyingRemote = useRef(false);
  /** Pending sync to apply once the player is ready */
  const pendingSync = useRef(null);
  /** Tracks the last videoId loaded into the player (avoids stale closure in applySync) */
  const prevVideoIdRef = useRef('');

  const canControl = myRole === 'host' || myRole === 'moderator';

  // ── Utilities ──────────────────────────────────────────────────────────────

  function addToast(text, type = 'info') {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  // ── Apply a sync_state from server to the player ───────────────────────────

  const applySync = useCallback((state) => {
    // Nothing to sync if there's no valid video yet
    if (!state.videoId || !state.videoId.trim()) return;

    const player = playerRef.current;
    if (!player) {
      pendingSync.current = state;
      return;
    }

    isApplyingRemote.current = true;

    // Read the currently-loaded video directly from the ref rather than stale state
    const currentVideoId = prevVideoIdRef.current;

    if (state.videoId !== currentVideoId) {
      // New video — loadVideoById starts buffering (and auto-plays due to autoplay:1).
      // We seek to the correct time and enforce the correct play/pause state after buffering.
      player.loadVideoById(state.videoId, state.currentTime);
      setTimeout(() => {
        player.seekTo(state.currentTime);
        if (state.playState === 'playing') player.playVideo();
        else player.pauseVideo();
        setTimeout(() => { isApplyingRemote.current = false; }, 600);
      }, 1500);
    } else {
      // Same video — just seek and set play state
      player.seekTo(state.currentTime);
      if (state.playState === 'playing') player.playVideo();
      else player.pauseVideo();
      setTimeout(() => { isApplyingRemote.current = false; }, 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket setup ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!username) {
      navigate('/', { replace: true });
      return;
    }

    socket.connect();

    // ── Connection events ────────────────────────────────
    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId, username });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('connect_error', () => {
      addToast('Connection error — retrying…', 'error');
    });

    // ── Room events ──────────────────────────────────────
    socket.on('room_joined', (data) => {
      setUserId(data.userId);
      setMyRole(data.role);
      setParticipants(data.participants);
      setVideoState(data.videoState);
      if (data.videoState.videoId) {
        // Will be applied once player is ready
        pendingSync.current = {
          videoId: data.videoState.videoId,
          playState: data.videoState.playState,
          currentTime: data.videoState.currentTime,
        };
      }
      addToast(
        data.role === 'host'
          ? `Room created! Share code: ${roomId}`
          : 'Joined the room',
        'success'
      );
    });

    socket.on('sync_state', (data) => {
      if (data.videoId) prevVideoIdRef.current = data.videoId;
      setVideoState({
        videoId: data.videoId,
        playState: data.playState,
        currentTime: data.currentTime,
      });
      applySync(data);
    });

    socket.on('user_joined', (data) => {
      setParticipants(data.participants);
      addToast(`${data.username} joined the room`);
    });

    socket.on('user_left', (data) => {
      setParticipants(data.participants);
      addToast(`${data.username} left the room`);
    });

    socket.on('role_assigned', (data) => {
      setParticipants(data.participants);
      // Update own role if we were the target
      socket.id && data.userId === socket.id && setMyRole(data.role);
      if (data.userId === socket.id) {
        addToast(`Your role changed to: ${data.role}`, 'info');
      } else {
        addToast(`${data.username} is now ${data.role}`);
      }
    });

    socket.on('participant_removed', (data) => {
      setParticipants(data.participants);
    });

    socket.on('removed_from_room', () => {
      addToast('You were removed from the room by the host.', 'error');
      setTimeout(() => navigate('/', { replace: true }), 2000);
    });

    socket.on('chat_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('error', (data) => {
      addToast(data.message, 'error');
    });

    return () => {
      socket.emit('leave_room');
      socket.removeAllListeners();
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, username]);

  // ── Player ready: apply any pending sync ──────────────────────────────────

  const handlePlayerReady = useCallback(() => {
    setPlayerReady(true);
    if (pendingSync.current) {
      applySync(pendingSync.current);
      pendingSync.current = null;
    }
  }, [applySync]);

  // ── Player state change ───────────────────────────────────────────────────

  const handlePlayerStateChange = useCallback(
    (state, currentTime) => {
      // If we caused this change programmatically, ignore it
      if (isApplyingRemote.current) return;

      // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0
      if (!canControl) return;

      if (state === 1) {
        socket.emit('play');
      } else if (state === 2) {
        socket.emit('pause', { currentTime });
      }
    },
    [canControl]
  );

  // ── Control handlers ──────────────────────────────────────────────────────

  function handlePlay() {
    if (!canControl) return;
    socket.emit('play');
  }

  function handlePause(currentTime) {
    if (!canControl) return;
    socket.emit('pause', { currentTime });
  }

  function handleSeek(time) {
    if (!canControl) return;
    socket.emit('seek', { time });
  }

  function handleChangeVideo(videoId) {
    if (!canControl) return;
    socket.emit('change_video', { videoId });
  }

  function handleAssignRole(userId, role) {
    socket.emit('assign_role', { userId, role });
  }

  function handleRemoveParticipant(userId) {
    socket.emit('remove_participant', { userId });
  }

  function handleTransferHost(userId) {
    socket.emit('transfer_host', { userId });
  }

  function handleSendChat(message) {
    socket.emit('chat', { message });
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomId ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!username) return null;

  return (
    <div style={styles.root}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>🎬</span>
          <span style={styles.roomCode} onClick={handleCopyCode} title="Click to copy room code">
            <span style={styles.roomCodeLabel}>ROOM</span>
            <code style={styles.roomCodeValue}>{roomId}</code>
            <span style={styles.copyHint}>{copied ? '✓ Copied' : '⎘ Copy'}</span>
          </span>
        </div>

        <div style={styles.headerCentre}>
          <div style={{ ...styles.dot, background: isConnected ? 'var(--success)' : 'var(--danger)' }} />
          <span style={styles.connLabel}>{isConnected ? 'Connected' : 'Connecting…'}</span>
        </div>

        <div style={styles.headerRight}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={styles.myRoleBadge} className={`badge badge-${myRole}`}>
              {myRole === 'host' ? '👑' : myRole === 'moderator' ? '🛡' : '👤'} {username}
            </span>
          </span>
          <button
            className="btn-ghost"
            style={{ fontSize: 13, padding: '7px 14px' }}
            onClick={() => { socket.emit('leave_room'); navigate('/'); }}
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div style={styles.main}>
        {/* Left: video + controls */}
        <div style={styles.videoColumn}>
          {/* Video */}
          <div style={styles.videoWrapper}>
            {!videoState.videoId && playerReady && canControl && (
              <div style={styles.noVideoOverlay}>
                <div style={styles.noVideoContent}>
                  <span style={{ fontSize: 48 }}>📺</span>
                  <p style={styles.noVideoTitle}>No video loaded</p>
                  <p style={styles.noVideoSub}>Paste a YouTube URL in the controls below</p>
                </div>
              </div>
            )}
            {!videoState.videoId && !canControl && (
              <div style={styles.noVideoOverlay}>
                <div style={styles.noVideoContent}>
                  <span style={{ fontSize: 48 }}>⏳</span>
                  <p style={styles.noVideoTitle}>Waiting for host…</p>
                  <p style={styles.noVideoSub}>The host will load a video shortly</p>
                </div>
              </div>
            )}
            <YouTubePlayer
              ref={playerRef}
              videoId={videoState.videoId}
              onStateChange={handlePlayerStateChange}
              onReady={handlePlayerReady}
            />
          </div>

          {/* Controls */}
          <Controls
            canControl={canControl}
            isPlaying={videoState.playState === 'playing'}
            videoId={videoState.videoId}
            playerRef={playerRef}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onChangeVideo={handleChangeVideo}
          />
        </div>

        {/* Right: sidebar */}
        <aside style={styles.sidebar}>
          {/* Sidebar tabs */}
          <div style={styles.sidebarTabs}>
            <button
              style={{ ...styles.sidebarTab, ...(sidebarTab === 'participants' ? styles.sidebarTabActive : {}) }}
              onClick={() => setSidebarTab('participants')}
            >
              👥 People ({participants.length})
            </button>
            <button
              style={{ ...styles.sidebarTab, ...(sidebarTab === 'chat' ? styles.sidebarTabActive : {}) }}
              onClick={() => setSidebarTab('chat')}
            >
              💬 Chat
              {messages.length > 0 && sidebarTab !== 'chat' && (
                <span style={styles.chatBadge}>{messages.length}</span>
              )}
            </button>
          </div>

          {sidebarTab === 'participants' ? (
            <ParticipantList
              participants={participants}
              myUserId={userId}
              myRole={myRole}
              onAssignRole={handleAssignRole}
              onRemoveParticipant={handleRemoveParticipant}
              onTransferHost={handleTransferHost}
            />
          ) : (
            <Chat
              messages={messages}
              myUserId={userId}
              onSend={handleSendChat}
            />
          )}
        </aside>
      </div>

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type === 'info' ? '' : t.type}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 52,
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    flexShrink: 0,
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logo: {
    fontSize: 22,
    lineHeight: 1,
  },
  roomCode: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '4px 10px',
    transition: 'border-color 0.15s ease',
  },
  roomCodeLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-dim)',
    letterSpacing: '0.1em',
  },
  roomCodeValue: {
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    color: 'var(--gold)',
    letterSpacing: '0.12em',
  },
  copyHint: {
    fontSize: 10,
    color: 'var(--text-dim)',
    borderLeft: '1px solid var(--border)',
    paddingLeft: 8,
  },
  headerCentre: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  connLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },
  myRoleBadge: {
    fontSize: 12,
  },

  // Main layout
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  videoColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  videoWrapper: {
    flex: 1,
    background: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  noVideoOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface)',
    zIndex: 2,
  },
  noVideoContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    textAlign: 'center',
  },
  noVideoTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    letterSpacing: '0.06em',
    color: 'var(--text)',
  },
  noVideoSub: {
    fontSize: 14,
    color: 'var(--text-muted)',
  },

  // Sidebar
  sidebar: {
    width: 280,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--border)',
    background: 'var(--surface)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidebarTabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  sidebarTab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    padding: '10px 4px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
  },
  sidebarTabActive: {
    color: 'var(--accent)',
    borderBottom: '2px solid var(--accent)',
    background: 'rgba(255,107,53,0.04)',
  },
  chatBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    borderRadius: 10,
    padding: '1px 5px',
  },
};
