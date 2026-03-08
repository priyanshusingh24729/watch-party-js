import { useState, useEffect } from 'react';

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function extractVideoId(input) {
  const trimmed = input.trim();
  // Already a video ID (no slashes or dots)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function Controls({
  canControl,
  isPlaying,
  videoId,
  playerRef,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo,
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlError, setUrlError] = useState('');

  // Poll current time
  useEffect(() => {
    const tick = () => {
      if (!playerRef.current || isDragging) return;
      const ct = playerRef.current.getCurrentTime();
      const dur = playerRef.current.getDuration();
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [playerRef, isDragging]);

  // Sync volume to player
  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume, playerRef]);

  function handleSeekStart(e) {
    setIsDragging(true);
    setDragValue(Number(e.target.value));
  }

  function handleSeekMove(e) {
    setDragValue(Number(e.target.value));
  }

  function handleSeekEnd() {
    setIsDragging(false);
    setCurrentTime(dragValue);
    onSeek(dragValue);
  }

  function toggleMute() {
    if (isMuted) {
      playerRef.current?.unMute();
      setIsMuted(false);
    } else {
      playerRef.current?.mute();
      setIsMuted(true);
    }
  }

  function handleUrlSubmit() {
    const id = extractVideoId(urlInput);
    if (!id) { setUrlError('Could not parse a YouTube video ID from that URL.'); return; }
    onChangeVideo(id);
    setUrlInput('');
    setShowUrlInput(false);
    setUrlError('');
  }

  const progress = duration > 0 ? (isDragging ? dragValue : currentTime) / duration : 0;

  return (
    <div style={styles.wrapper}>
      {/* Seek bar */}
      <div style={styles.seekRow}>
        <span style={styles.timeLabel}>{formatTime(isDragging ? dragValue : currentTime)}</span>
        <div style={styles.seekTrack}>
          {/* Filled portion */}
          <div
            style={{
              ...styles.seekFill,
              width: `${progress * 100}%`,
            }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={isDragging ? dragValue : currentTime}
            disabled={!canControl || duration === 0}
            onChange={handleSeekMove}
            onMouseDown={() => { setIsDragging(true); setDragValue(currentTime); }}
            onTouchStart={() => { setIsDragging(true); setDragValue(currentTime); }}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            onInput={handleSeekStart}
            style={{ ...styles.seekInput, opacity: canControl ? 1 : 0.4, cursor: canControl ? 'pointer' : 'not-allowed' }}
          />
        </div>
        <span style={styles.timeLabel}>{formatTime(duration)}</span>
      </div>

      {/* Controls row */}
      <div style={styles.controlsRow}>
        {/* Left: playback */}
        <div style={styles.leftControls}>
          {/* Play / Pause */}
          <button
            className="btn-icon"
            style={{ ...styles.playBtn, ...(canControl ? {} : { opacity: 0.35, cursor: 'not-allowed' }) }}
            disabled={!canControl}
            onClick={() => isPlaying ? onPause(currentTime) : onPlay()}
            title={canControl ? (isPlaying ? 'Pause' : 'Play') : 'Only Host/Moderator can control playback'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Volume */}
          <button
            className="btn-icon"
            style={{ fontSize: 14 }}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={e => { setVolume(Number(e.target.value)); setIsMuted(false); }}
            style={{ width: 70, cursor: 'pointer' }}
            title="Volume"
          />
        </div>

        {/* Centre: role indicator */}
        <div style={styles.centreInfo}>
          {!canControl && (
            <span style={styles.watchOnlyLabel}>👁 Watch only</span>
          )}
          {videoId && (
            <span style={styles.videoIdLabel} title={`Video: ${videoId}`}>
              ▶ {videoId.slice(0, 8)}…
            </span>
          )}
        </div>

        {/* Right: change video */}
        <div style={styles.rightControls}>
          {canControl && (
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={() => { setShowUrlInput(v => !v); setUrlError(''); }}
            >
              📺 Change Video
            </button>
          )}
        </div>
      </div>

      {/* URL input panel */}
      {showUrlInput && canControl && (
        <div style={styles.urlPanel}>
          <input
            type="text"
            placeholder="Paste YouTube URL or video ID…"
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
            autoFocus
            style={{ flex: 1 }}
          />
          <button className="btn-primary" style={{ padding: '10px 18px', whiteSpace: 'nowrap' }} onClick={handleUrlSubmit}>
            Load
          </button>
          <button className="btn-ghost" style={{ padding: '10px' }} onClick={() => { setShowUrlInput(false); setUrlError(''); }}>
            ✕
          </button>
          {urlError && <p style={styles.urlError}>{urlError}</p>}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    padding: '10px 16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flexShrink: 0,
  },
  seekRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    minWidth: 38,
    textAlign: 'center',
  },
  seekTrack: {
    flex: 1,
    position: 'relative',
    height: 4,
    display: 'flex',
    alignItems: 'center',
  },
  seekFill: {
    position: 'absolute',
    left: 0,
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
    pointerEvents: 'none',
    transition: 'width 0.1s linear',
  },
  seekInput: {
    position: 'absolute',
    width: '100%',
    margin: 0,
    zIndex: 1,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    fontSize: 16,
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    flexShrink: 0,
  },
  centreInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  watchOnlyLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '3px 10px',
  },
  videoIdLabel: {
    fontSize: 11,
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
  },
  rightControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  urlPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
  },
  urlError: {
    width: '100%',
    fontSize: 12,
    color: 'var(--danger)',
    marginTop: 2,
  },
};
