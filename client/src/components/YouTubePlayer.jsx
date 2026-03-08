import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

let ytApiLoaded = false;
let ytApiCallbacks = [];

function loadYouTubeAPI(callback) {
  if (ytApiLoaded && window.YT?.Player) {
    callback();
    return;
  }
  ytApiCallbacks.push(callback);
  if (document.getElementById('yt-iframe-api')) return;
  const tag = document.createElement('script');
  tag.id = 'yt-iframe-api';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytApiLoaded = true;
    ytApiCallbacks.forEach(cb => cb());
    ytApiCallbacks = [];
  };
}

const YouTubePlayer = forwardRef(({ videoId, onStateChange, onReady }, ref) => {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  useImperativeHandle(ref, () => ({
    playVideo:      () => playerRef.current?.playVideo(),
    pauseVideo:     () => playerRef.current?.pauseVideo(),
    seekTo:         (s) => playerRef.current?.seekTo(s, true),
    loadVideoById:  (id, start) => playerRef.current?.loadVideoById(id, start ?? 0),
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    getDuration:    () => playerRef.current?.getDuration() ?? 0,
    setVolume:      (v) => playerRef.current?.setVolume(v),
    isMuted:        () => playerRef.current?.isMuted() ?? false,
    mute:           () => playerRef.current?.mute(),
    unMute:         () => playerRef.current?.unMute(),
  }));

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let destroyed = false;

    loadYouTubeAPI(() => {
      if (destroyed || !containerRef.current) return;

      // IMPORTANT: Never pass videoId here — the API throws "Invalid video id"
      // for empty strings or undefined in some versions. Always load via loadVideoById.
      playerRef.current = new window.YT.Player(containerRef.current, {
        playerVars: {
          autoplay: 1,        // Grants iframe autoplay permission from the browser
          controls: 0,        // We use custom controls
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,     // Needed on iOS to avoid fullscreen autoplay
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true);
            onReadyRef.current();
          },
          onStateChange: (e) => {
            const ct = playerRef.current?.getCurrentTime() ?? 0;
            onStateChangeRef.current(e.data, ct);
          },
          onError: (e) => {
            console.warn('[YT Player error]', e.data);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load video whenever videoId prop changes after player is ready
  const prevVideoId = useRef('');
  useEffect(() => {
    const cleanId = videoId?.trim();
    if (!isPlayerReady || !cleanId) return;
    if (cleanId !== prevVideoId.current) {
      prevVideoId.current = cleanId;
      playerRef.current?.loadVideoById(cleanId, 0);
    }
  }, [videoId, isPlayerReady]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* Transparent overlay prevents stray clicks hitting the iframe */}
      {isPlayerReady && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      )}
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
