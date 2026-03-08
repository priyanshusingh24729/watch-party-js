import { useState, useEffect, useRef } from 'react';

export default function Chat({ messages, myUserId, onSend }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const msg = input.trim();
    if (!msg) return;
    onSend(msg);
    setInput('');
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>CHAT</span>
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <p style={styles.empty}>No messages yet. Say hello! 👋</p>
        )}
        {messages.map((m) => {
          const isMe = m.userId === myUserId;
          return (
            <div
              key={m.timestamp + m.userId}
              style={{ ...styles.message, ...(isMe ? styles.messageMe : {}) }}
              className="animate-fadeIn"
            >
              {!isMe && <span style={styles.sender}>{m.username}</span>}
              <span style={{ ...styles.bubble, ...(isMe ? styles.bubbleMe : {}) }}>
                {m.message}
              </span>
              <span style={styles.time}>{formatTime(m.timestamp)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <input
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          maxLength={500}
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn-primary"
          style={{ padding: '10px 14px', flexShrink: 0 }}
          onClick={handleSend}
          disabled={!input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--border)',
    flex: '0 0 220px',
    minHeight: 0,
  },
  header: {
    padding: '10px 14px 8px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 0,
  },
  empty: {
    fontSize: 12,
    color: 'var(--text-dim)',
    textAlign: 'center',
    marginTop: 12,
  },
  message: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    alignItems: 'flex-start',
  },
  messageMe: {
    alignItems: 'flex-end',
  },
  sender: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 600,
    paddingLeft: 4,
  },
  bubble: {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: '10px 10px 10px 2px',
    padding: '6px 10px',
    fontSize: 13,
    maxWidth: 200,
    wordBreak: 'break-word',
    lineHeight: 1.4,
  },
  bubbleMe: {
    background: 'var(--accent-dim)',
    borderColor: 'rgba(255,107,53,0.25)',
    borderRadius: '10px 10px 2px 10px',
    color: 'var(--text)',
  },
  time: {
    fontSize: 10,
    color: 'var(--text-dim)',
    paddingLeft: 4,
    paddingRight: 4,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 10px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
};
