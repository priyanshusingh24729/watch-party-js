import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState('create');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('wp_username');
    if (saved) setUsername(saved);
  }, []);

  function handleCreate() {
    const name = username.trim();
    if (!name) { setError('Please enter a display name.'); return; }
    localStorage.setItem('wp_username', name);
    navigate(`/room/${generateRoomId()}`);
  }

  function handleJoin() {
    const name = username.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) { setError('Please enter a display name.'); return; }
    if (!code) { setError('Please enter a room code.'); return; }
    if (code.length < 4) { setError('Room code looks too short.'); return; }
    localStorage.setItem('wp_username', name);
    navigate(`/room/${code}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') tab === 'create' ? handleCreate() : handleJoin();
  }

  return (
    <div style={styles.page}>
      {/* Background glow */}
      <div style={styles.glow} />

      <div style={styles.container} className="animate-fadeInUp">
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🎬</span>
          <span style={styles.logoText}>WATCHTOGETHER</span>
        </div>
        <p style={styles.tagline}>Sync YouTube videos with friends — in real time</p>

        {/* Card */}
        <div style={styles.card}>
          {/* Tab switcher */}
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(tab === 'create' ? styles.tabActive : {}) }}
              onClick={() => { setTab('create'); setError(''); }}
            >
              Create Room
            </button>
            <button
              style={{ ...styles.tab, ...(tab === 'join' ? styles.tabActive : {}) }}
              onClick={() => { setTab('join'); setError(''); }}
            >
              Join Room
            </button>
          </div>

          <div style={styles.cardBody} onKeyDown={handleKeyDown}>
            {/* Username */}
            <div style={styles.field}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                placeholder="Enter your name…"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                maxLength={30}
                autoFocus
              />
            </div>

            {/* Join code (join tab only) */}
            {tab === 'join' && (
              <div style={styles.field}>
                <label style={styles.label}>Room Code</label>
                <input
                  type="text"
                  placeholder="e.g. A3F7K2"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                  maxLength={12}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', fontSize: 16 }}
                />
              </div>
            )}

            {error && <p style={styles.error}>{error}</p>}

            <button
              className="btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: 15 }}
              onClick={tab === 'create' ? handleCreate : handleJoin}
            >
              {tab === 'create' ? '+ Create New Room' : '→ Join Room'}
            </button>
          </div>
        </div>

        {/* Feature list */}
        <div style={styles.features}>
          {['Real-time sync', 'Role-based control', 'Live chat', 'Any YouTube video'].map(f => (
            <span key={f} style={styles.featurePill}>✓ {f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  container: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 28,
    position: 'relative',
    zIndex: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    fontSize: 36,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 38,
    letterSpacing: '0.08em',
    color: 'var(--text)',
  },
  tagline: {
    fontSize: 14,
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: -16,
  },
  card: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: '14px 0',
    borderRadius: 0,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.03em',
    border: 'none',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
    background: 'rgba(255,107,53,0.04)',
  },
  cardBody: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  error: {
    fontSize: 13,
    color: 'var(--danger)',
    textAlign: 'center',
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featurePill: {
    fontSize: 12,
    color: 'var(--text-dim)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '4px 12px',
  },
};
