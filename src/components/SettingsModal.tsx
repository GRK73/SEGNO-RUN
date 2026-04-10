import React, { useState, useRef, useEffect, useCallback } from 'react';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [offset, setOffset] = useState(() =>
    parseInt(localStorage.getItem('audioOffset') || '0', 10)
  );
  const [volume, setVolume] = useState(() =>
    parseFloat(localStorage.getItem('masterVolume') || '1')
  );
  const [noteSpeed, setNoteSpeed] = useState(() =>
    parseInt(localStorage.getItem('noteSpeed') || '3', 10)
  );
  const [openSection, setOpenSection] = useState<'audio' | 'gameplay' | null>('audio');
  const [openAudioSub, setOpenAudioSub] = useState<'offset' | 'calibration' | null>(null);

  const [calibrating, setCalibrating] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [calibBpm] = useState(120);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextTickRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const tickCountRef = useRef<number>(0);

  const msPerBeat = (60 / calibBpm) * 1000;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const playTick = useCallback((ctx: AudioContext) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.025);
  }, []);

  const startCalibration = () => {
    setCalibrating(true);
    setTapTimes([]);
    tickCountRef.current = 0;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    startTimeRef.current = performance.now();
    nextTickRef.current = 0;
    playTick(ctx);
    tickCountRef.current = 1;
    nextTickRef.current = msPerBeat;
    const timer = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      if (elapsed >= nextTickRef.current) {
        playTick(ctx);
        tickCountRef.current++;
        nextTickRef.current += msPerBeat;
      }
    }, 1);
    timerRef.current = timer as unknown as number;
  };

  const stopCalibration = () => {
    setCalibrating(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (tapTimes.length >= 4) {
      const diffs = tapTimes.map(t => {
        const beatIndex = Math.round(t / msPerBeat);
        return t - beatIndex * msPerBeat;
      });
      const trimmed = diffs.slice(1);
      const avgDiff = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      const newOffset = Math.round(avgDiff);
      setOffset(newOffset);
      localStorage.setItem('audioOffset', String(newOffset));
    }
  };

  const handleTap = () => {
    if (!calibrating) return;
    setTapTimes(prev => [...prev, performance.now() - startTimeRef.current]);
  };

  const handleOffsetChange = (val: number) => {
    setOffset(val);
    localStorage.setItem('audioOffset', String(val));
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    localStorage.setItem('masterVolume', String(val));
  };

  const handleNoteSpeedChange = (level: number) => {
    setNoteSpeed(level);
    localStorage.setItem('noteSpeed', String(level));
  };

  const SPEED_LABELS = ['느림', '보통-', '보통', '빠름', '매우 빠름'];

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        {/* ── AUDIO ── */}
        <div className="settings-category">
          <button
            className={`category-title ${openSection === 'audio' ? 'open' : ''}`}
            onClick={() => setOpenSection(openSection === 'audio' ? null : 'audio')}
          >
            🎵 오디오 {openSection === 'audio' ? '▲' : '▼'}
          </button>

          {openSection === 'audio' && (
            <div className="category-body">
              {/* Volume */}
              <div className="settings-row">
                <span className="row-label">음량</span>
                <div className="volume-control">
                  <span className="offset-value">{Math.round(volume * 100)}%</span>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={volume}
                    onChange={e => handleVolumeChange(Number(e.target.value))}
                    className="offset-slider"
                  />
                </div>
              </div>

              {/* Offset sub-section */}
              <div className="sub-section">
                <button
                  className={`sub-title ${openAudioSub === 'offset' ? 'open' : ''}`}
                  onClick={() => setOpenAudioSub(openAudioSub === 'offset' ? null : 'offset')}
                >
                  오디오 오프셋 {openAudioSub === 'offset' ? '▲' : '▼'}
                </button>
                {openAudioSub === 'offset' && (
                  <div className="sub-body">
                    <p className="settings-desc">노트 판정 타이밍을 조절합니다. 양수는 늦게, 음수는 빠르게 판정합니다.</p>
                    <div className="offset-control">
                      <button onClick={() => handleOffsetChange(offset - 5)}>-5</button>
                      <button onClick={() => handleOffsetChange(offset - 1)}>-1</button>
                      <div className="offset-value">{offset}ms</div>
                      <button onClick={() => handleOffsetChange(offset + 1)}>+1</button>
                      <button onClick={() => handleOffsetChange(offset + 5)}>+5</button>
                    </div>
                    <input
                      type="range" min="-200" max="200" value={offset}
                      onChange={e => handleOffsetChange(Number(e.target.value))}
                      className="offset-slider"
                    />
                  </div>
                )}
              </div>

              {/* Calibration sub-section */}
              <div className="sub-section">
                <button
                  className={`sub-title ${openAudioSub === 'calibration' ? 'open' : ''}`}
                  onClick={() => setOpenAudioSub(openAudioSub === 'calibration' ? null : 'calibration')}
                >
                  오프셋 자동 보정 {openAudioSub === 'calibration' ? '▲' : '▼'}
                </button>
                {openAudioSub === 'calibration' && (
                  <div className="sub-body">
                    <p className="settings-desc">메트로놈 소리에 맞춰 탭하면 자동으로 오프셋을 계산합니다.</p>
                    {!calibrating ? (
                      <button className="calibrate-btn" onClick={startCalibration}>🎵 Start Calibration</button>
                    ) : (
                      <div className="calibration-area">
                        <div className="tap-count">Taps: {tapTimes.length} / 8+</div>
                        <button className="tap-btn" onClick={handleTap}>TAP</button>
                        <p className="tap-hint">메트로놈 소리에 맞춰 TAP 버튼을 누르세요</p>
                        <button className="calibrate-stop-btn" onClick={stopCalibration}>Stop & Apply</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── GAMEPLAY ── */}
        <div className="settings-category">
          <button
            className={`category-title ${openSection === 'gameplay' ? 'open' : ''}`}
            onClick={() => setOpenSection(openSection === 'gameplay' ? null : 'gameplay')}
          >
            🎮 게임플레이 {openSection === 'gameplay' ? '▲' : '▼'}
          </button>

          {openSection === 'gameplay' && (
            <div className="category-body">
              <div className="settings-row">
                <span className="row-label">채보 속도</span>
                <span className="speed-label-text">{SPEED_LABELS[noteSpeed - 1]}</span>
              </div>
              <div className="speed-buttons">
                {[1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    className={`speed-btn ${noteSpeed === level ? 'active' : ''}`}
                    onClick={() => handleNoteSpeedChange(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="settings-desc">속도가 높을수록 채보 간격이 넓어집니다. 기본값: 3</p>
            </div>
          )}
        </div>

        <style>{`
          .settings-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); }
          .settings-modal { background: #1e1e2e; border: 1px solid #3d3d5c; border-radius: 16px; padding: 28px; width: 420px; max-width: 90vw; color: white; font-family: 'Segoe UI', sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 85vh; overflow-y: auto; }
          .settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #333; padding-bottom: 12px; }
          .settings-header h2 { margin: 0; font-size: 1.3rem; }
          .settings-close { background: none; border: none; color: #888; font-size: 1.4rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
          .settings-close:hover { color: white; background: #333; }

          .settings-category { margin-bottom: 8px; border: 1px solid #2d2d4d; border-radius: 10px; overflow: hidden; }
          .category-title { width: 100%; text-align: left; background: #252540; border: none; color: #ccc; font-size: 0.95rem; font-weight: bold; padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; }
          .category-title:hover, .category-title.open { background: #2e2e55; color: white; }
          .category-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; background: #1a1a30; }

          .sub-section { border: 1px solid #2d2d4d; border-radius: 8px; overflow: hidden; }
          .sub-title { width: 100%; text-align: left; background: #222238; border: none; color: #aaa; font-size: 0.85rem; font-weight: bold; padding: 9px 14px; cursor: pointer; display: flex; justify-content: space-between; }
          .sub-title:hover, .sub-title.open { background: #282850; color: white; }
          .sub-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; background: #181830; }

          .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
          .row-label { font-size: 0.9rem; color: #bbb; white-space: nowrap; }
          .settings-desc { font-size: 0.78rem; color: #666; margin: 0; line-height: 1.4; }

          .volume-control { flex: 1; display: flex; align-items: center; gap: 10px; }
          .offset-control { display: flex; align-items: center; justify-content: center; gap: 8px; }
          .offset-control button { padding: 6px 12px; background: #2a2a4a; border: 1px solid #444; color: white; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
          .offset-control button:hover { background: #3a3a6a; }
          .offset-value { font-size: 1.3rem; font-weight: bold; font-family: monospace; color: #00d2ff; min-width: 72px; text-align: center; }
          .offset-slider { width: 100%; accent-color: #00d2ff; }

          .speed-buttons { display: flex; gap: 8px; }
          .speed-btn { flex: 1; padding: 10px 0; background: #2a2a4a; border: 2px solid #444; color: #aaa; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: bold; transition: all 0.15s; }
          .speed-btn:hover { background: #3a3a6a; color: white; }
          .speed-btn.active { background: #5533aa; border-color: #9955cc; color: white; }
          .speed-label-text { font-size: 0.85rem; color: #9955cc; font-weight: bold; }

          .calibrate-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; color: white; font-weight: bold; font-size: 0.95rem; border-radius: 8px; cursor: pointer; }
          .calibrate-btn:hover { filter: brightness(1.1); }
          .calibration-area { display: flex; flex-direction: column; align-items: center; gap: 10px; }
          .tap-count { font-size: 0.9rem; color: #aaa; font-family: monospace; }
          .tap-btn { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #ef4444); border: 4px solid rgba(255,255,255,0.2); color: white; font-size: 1.4rem; font-weight: bold; cursor: pointer; user-select: none; transition: transform 0.05s; }
          .tap-btn:active { transform: scale(0.92); }
          .tap-hint { font-size: 0.75rem; color: #888; margin: 0; }
          .calibrate-stop-btn { padding: 8px 20px; background: #e74c3c; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
        `}</style>
      </div>
    </div>
  );
};

export default SettingsModal;
