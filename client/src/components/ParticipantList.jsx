import { useState } from 'react';

const ROLE_LABELS = {
  host: '👑 Host',
  moderator: '🛡 Mod',
  participant: '👤 Viewer',
};

const ROLE_OPTIONS = [
  { value: 'moderator', label: '🛡 Moderator' },
  { value: 'participant', label: '👤 Participant' },
];

export default function ParticipantList({
  participants,
  myUserId,
  myRole,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const isHost = myRole === 'host';

  function toggleExpanded(userId) {
    setExpandedId(prev => (prev === userId ? null : userId));
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>PARTICIPANTS</span>
        <span style={styles.count}>{participants.length}</span>
      </div>

      <div style={styles.list}>
        {participants.map((p, i) => {
          const isMe = p.userId === myUserId;
          const expanded = expandedId === p.userId;

          return (
            <div
              key={p.userId}
              style={{
                ...styles.item,
                ...(isMe ? styles.itemMe : {}),
                animationDelay: `${i * 0.05}s`,
              }}
              className="animate-fadeInUp"
            >
              <div
                style={styles.itemMain}
                onClick={() => isHost && !isMe && toggleExpanded(p.userId)}
              >
                {/* Avatar */}
                <div style={{ ...styles.avatar, background: avatarColor(p.username) }}>
                  {p.username[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Name + role */}
                <div style={styles.nameBlock}>
                  <span style={styles.username} className="truncate">
                    {p.username}
                    {isMe && <span style={styles.youLabel}> (you)</span>}
                  </span>
                  <span className={`badge badge-${p.role}`}>{ROLE_LABELS[p.role]}</span>
                </div>

                {/* Expand caret (host only, not self) */}
                {isHost && !isMe && p.role !== 'host' && (
                  <span style={{ ...styles.caret, transform: expanded ? 'rotate(180deg)' : 'none' }}>
                    ▾
                  </span>
                )}
              </div>

              {/* Expanded actions (host-only) */}
              {expanded && isHost && !isMe && (
                <div style={styles.actions} className="animate-fadeIn">
                  <p style={styles.actionsTitle}>Assign Role</p>
                  <div style={styles.roleButtons}>
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={p.role === opt.value ? 'btn-secondary' : 'btn-ghost'}
                        style={{
                          fontSize: 12,
                          padding: '6px 12px',
                          ...(p.role === opt.value ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}),
                        }}
                        onClick={() => { onAssignRole(p.userId, opt.value); setExpandedId(null); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={styles.dangerActions}>
                    <button
                      className="btn-danger"
                      onClick={() => { onTransferHost(p.userId); setExpandedId(null); }}
                    >
                      👑 Transfer Host
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => { onRemoveParticipant(p.userId); setExpandedId(null); }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Deterministic colour from username string */
function avatarColor(name) {
  const colours = [
    '#ff6b35', '#ffd23f', '#3ddc84', '#4ecdc4',
    '#a855f7', '#3b82f6', '#ec4899', '#f59e0b',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colours[Math.abs(hash) % colours.length];
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  count: {
    fontSize: 11,
    background: 'var(--surface-3)',
    color: 'var(--text-muted)',
    borderRadius: 20,
    padding: '1px 8px',
    fontFamily: 'var(--font-mono)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  item: {
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    transition: 'background 0.15s ease',
  },
  itemMe: {
    background: 'var(--accent-dim)',
  },
  itemMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    cursor: 'default',
    borderRadius: 'var(--radius)',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#0a0a0e',
    flexShrink: 0,
  },
  nameBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  username: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    lineHeight: 1,
  },
  youLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  caret: {
    fontSize: 14,
    color: 'var(--text-dim)',
    transition: 'transform 0.2s ease',
    cursor: 'pointer',
  },
  actions: {
    padding: '4px 10px 10px 50px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actionsTitle: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  roleButtons: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  dangerActions: {
    display: 'flex',
    gap: 6,
    paddingTop: 4,
    borderTop: '1px solid var(--border)',
  },
};
