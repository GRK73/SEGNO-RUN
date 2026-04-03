import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChartData, NoteData } from '../game/ChartLoader';

const SONG_LIST = [
  { id: 'planb',       title: 'Plan B',           artist: 'Plan B(한세긴, 나비, 송밤)', roster: '1, 3, 2', audio: 'assets/audio/Plan B.mp3' },
  { id: 'snaptime',    title: 'SNAP TIME',         artist: 'Plan B(한세긴, 나비, 송밤)', roster: '1, 3, 2', audio: 'assets/audio/SNAP TIME.mp3' },
  { id: 'mvp',         title: 'MVP',               artist: 'Plan B(한세긴, 나비, 송밤)', roster: '1, 3, 2', audio: 'assets/audio/MVP.mp3' },
  { id: 'monthly1',    title: '월간싸이퍼 Vol.1',  artist: '빕어, 한세긴, 나비, 송밤',   roster: '0, 1, 3, 2', audio: 'assets/audio/월간싸이퍼 Vol.1.mp3' },
  { id: 'monthly2',    title: '월간싸이퍼 Vol.2',  artist: '빕어, 한세긴, 나비, 송밤',   roster: '0, 1, 3, 2', audio: 'assets/audio/월간싸이퍼 Vol.2.mp3' },
  { id: 'monthly3',    title: '월간싸이퍼 Vol.3',  artist: '빕어, 한세긴, 나비, 송밤',   roster: '0, 1, 3, 2', audio: 'assets/audio/월간싸이퍼 Vol.3.mp3' },
  { id: 'monthly4',    title: '월간싸이퍼 Vol.4',  artist: '빕어, 한세긴, 나비, 크앙희', roster: '0, 1, 3, 4', audio: 'assets/audio/월간싸이퍼 Vol.4.mp3' },
  { id: 'monthly5',    title: '월간싸이퍼 Vol.5',  artist: '빕어, 한세긴, 나비, 크앙희', roster: '0, 1, 3, 4', audio: 'assets/audio/월간싸이퍼 Vol.5.mp3' },
  { id: 'saynomore',   title: 'Say No More',       artist: '나비',                       roster: '3',          audio: 'assets/audio/Say No More.mp3' },
  { id: 'switch',      title: 'SWITCH',            artist: '한세긴',                     roster: '1',          audio: 'assets/audio/SWITCH.mp3' },
  { id: 'convergence', title: '수렴',              artist: '빕어',                       roster: '0',          audio: 'assets/audio/수렴.mp3' },
  { id: 'stamp',       title: '찍어내',            artist: '빕어',                       roster: '0',          audio: 'assets/audio/찍어내.mp3' },
  { id: 'objective',   title: '객관',              artist: '빕어',                       roster: '0',          audio: 'assets/audio/객관.mp3' },
  { id: 'finally',     title: '이제야',            artist: '빕어',                       roster: '0',          audio: 'assets/audio/이제야.mp3' },
  { id: 'ramble',      title: '주절',              artist: '빕어',                       roster: '0',          audio: 'assets/audio/주절.mp3' },
  { id: 'turning',     title: '전환점',            artist: '빕어',                       roster: '0',          audio: 'assets/audio/전환점.mp3' },
  { id: 'worthy',      title: '마땅한가',          artist: '빕어',                       roster: '0',          audio: 'assets/audio/마땅한가.mp3' },
  { id: 'jump',        title: '뛰어',              artist: '빕어',                       roster: '0',          audio: 'assets/audio/뛰어.mp3' },
  { id: 'miserable',   title: '궁상',              artist: '빕어',                       roster: '0',          audio: 'assets/audio/궁상.mp3' },
  { id: 'mainwork',    title: '본업행동',          artist: '빕어',                       roster: '0',          audio: 'assets/audio/본업행동.mp3' },
];

const LEAD_IN_MS = 1000;

const CHAR_DATA = [
  { id: 0, name: '빕어', color: '#cacdd1' },
  { id: 1, name: '한세긴', color: '#4abeff' },
  { id: 2, name: '송밤', color: '#bec8fd' },
  { id: 3, name: '나비', color: '#ffa670' },
  { id: 4, name: '크앙희', color: '#c296e8' },
];

const ChartEditor: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [bpm, setBpm] = useState(120);
  const [title, setTitle] = useState('New Song');
  const [artist, setArtist] = useState('Artist');
  const [roster, setRoster] = useState('0, 1, 2');
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [zoom, setZoom] = useState(20); 
  const [selectedNoteType, setSelectedNoteType] = useState<NoteData['type'] | 'eraser'>('normal');
  const [selectedCharId, setSelectedCharId] = useState<number>(0);
  const [oldBpm, setOldBpm] = useState<number>(97.5);
  const [openSections, setOpenSections] = useState({ meta: true, tools: true, ops: false });
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const [pendingLongNote, setPendingLongNote] = useState<{ time: number, lane: 0 | 1 } | null>(null);
  const [eraseRect, setEraseRect] = useState<{ left: number; width: number; lane: 0 | 1 | 'any' } | null>(null);
  const eraseStartRef = useRef<{ x: number; lane: 0 | 1 | 'any' } | null>(null);
  const eraseDidDragRef = useRef(false);

  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [audioDurationMs, setAudioDurationMs] = useState(120000);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(-LEAD_IN_MS / 1000);
  const seekerRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const playedNotesRef = useRef<Set<number>>(new Set());
  const lastMetronomeBeatRef = useRef<number>(-1);
  const playbackRateRef = useRef<number>(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const currentZoom = zoomRef.current;
      const timeAtMouse = (mouseX + el.scrollLeft) / (currentZoom / 100);
      const newZoom = Math.min(100, Math.max(5, currentZoom + (e.deltaY < 0 ? 2 : -2)));
      zoomRef.current = newZoom;
      setZoom(newZoom);
      requestAnimationFrame(() => {
        el.scrollLeft = timeAtMouse * (newZoom / 100) - mouseX;
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const msPerBeat = useMemo(() => (60 / bpm) * 1000, [bpm]);
  const stepsPerBeat = zoom >= 50 ? 8 : 4;
  const gridStep = useMemo(() => msPerBeat / stepsPerBeat, [msPerBeat, stepsPerBeat]);

  const timeToX = useCallback((timeMs: number) => (timeMs + LEAD_IN_MS) * (zoom / 100), [zoom]);
  const xToTime = useCallback((x: number) => x / (zoom / 100) - LEAD_IN_MS, [zoom]);
  const durationToW = useCallback((ms: number) => ms * (zoom / 100), [zoom]);

  const updateLoopRef = useRef<() => void>(() => {});

  const updateLoop = useCallback(() => {
    if (audioCtxRef.current && isPlaying && !isDragging) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRateRef.current;
      const currentSec = pauseTimeRef.current + elapsed;

      if (audioBufferRef.current && currentSec >= audioBufferRef.current.duration) {
        setIsPlaying(false);
        pauseTimeRef.current = -LEAD_IN_MS / 1000;
        if (sourceNodeRef.current) {
          try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }
        if (seekerRef.current) seekerRef.current.style.transform = `translateX(0px)`;
        if (timeDisplayRef.current) timeDisplayRef.current.innerText = '0.00s';
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
        return;
      }

      const timeMs = currentSec * 1000;
      const x = timeToX(timeMs);
      if (seekerRef.current) seekerRef.current.style.transform = `translateX(${x}px)`;
      if (timeDisplayRef.current) timeDisplayRef.current.innerText = currentSec.toFixed(2) + 's';
      if (scrollRef.current) {
        const scroll = scrollRef.current;
        if (x > scroll.scrollLeft + scroll.clientWidth * 0.7) scroll.scrollLeft = x - scroll.clientWidth * 0.3;
      }

      // Play beep when notes pass the seeker
      if (audioCtxRef.current) {
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (note.time > timeMs) break;
          if (note.time >= timeMs - 80 && !playedNotesRef.current.has(i)) {
            playedNotesRef.current.add(i);
            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = note.lane === 0 ? 700 : 1000;
            gain.gain.value = 0.3;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const dur = note.type === 'long' && note.duration ? note.duration / 1000 : 0.03;
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + dur);
          }
        }

        // Metronome tick
        if (metronomeOn) {
          const currentBeat = Math.floor(timeMs / msPerBeat);
          if (currentBeat > lastMetronomeBeatRef.current) {
            lastMetronomeBeatRef.current = currentBeat;
            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = currentBeat % 4 === 0 ? 1800 : 1400;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.02);
          }
        }
      }

      requestRef.current = requestAnimationFrame(updateLoopRef.current);
    }
  }, [isPlaying, isDragging, notes, metronomeOn, msPerBeat, timeToX]);

  useEffect(() => {
    updateLoopRef.current = updateLoop;
  }, [updateLoop]);

  useEffect(() => {
    if (isPlaying && !isDragging) {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      requestRef.current = requestAnimationFrame(updateLoop);
    } else if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, [isPlaying, isDragging, updateLoop]);

  const stopSource = useCallback(() => {
    if (!sourceNodeRef.current) return;
    try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
  }, []);

  const startSource = useCallback((ctx: AudioContext, buffer: AudioBuffer, offsetSec: number, rate: number) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(ctx.destination);
    const audioDelay = offsetSec < 0 ? (-offsetSec) / rate : 0;
    source.start(ctx.currentTime + audioDelay, Math.max(0, offsetSec));
    startTimeRef.current = ctx.currentTime;
    sourceNodeRef.current = source;
  }, []);

  const loadAudio = useCallback((audioPath: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (isPlaying) {
      stopSource();
      setIsPlaying(false);
    }
    pauseTimeRef.current = 0;
    audioBufferRef.current = null;
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    fetch(`${base}${audioPath}`)
      .then(res => res.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        audioBufferRef.current = decoded;
        setAudioDurationMs(decoded.duration * 1000);
      })
      .catch(err => console.error('Audio load failed:', err));
  }, [isPlaying]);

  useEffect(() => {
    const ctx = new window.AudioContext();
    audioCtxRef.current = ctx;
    return () => {
      stopSource();
      ctx.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const changeRate = (rate: number) => {
    if (isPlaying && audioCtxRef.current && audioBufferRef.current) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRateRef.current;
      pauseTimeRef.current += elapsed;
      stopSource();
      startSource(audioCtxRef.current, audioBufferRef.current, pauseTimeRef.current, rate);
    }
    playbackRateRef.current = rate;
    setPlaybackRate(rate);
  };

  const togglePlay = () => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;
    
    if (isPlaying) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRateRef.current;
      pauseTimeRef.current += elapsed;
      stopSource();
    } else {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      playedNotesRef.current.clear();
      lastMetronomeBeatRef.current = Math.floor((pauseTimeRef.current * 1000) / msPerBeat) - 1;
      startSource(audioCtxRef.current, audioBufferRef.current, pauseTimeRef.current, playbackRateRef.current);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!scrollRef.current || !audioCtxRef.current || !audioBufferRef.current) return;
    const containerRect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left + scrollRef.current.scrollLeft;
    let newTimeSec = xToTime(x) / 1000;
    newTimeSec = Math.max(-LEAD_IN_MS / 1000, Math.min(newTimeSec, audioBufferRef.current.duration));

    if (isPlaying) {
      stopSource();
      startSource(audioCtxRef.current, audioBufferRef.current, newTimeSec, playbackRateRef.current);
      pauseTimeRef.current = newTimeSec;
    } else {
      pauseTimeRef.current = newTimeSec;
    }
    playedNotesRef.current.clear();
    lastMetronomeBeatRef.current = Math.floor((Math.max(0, newTimeSec) * 1000) / msPerBeat) - 1;

    if (seekerRef.current) seekerRef.current.style.transform = `translateX(${timeToX(newTimeSec * 1000)}px)`;
    if (timeDisplayRef.current) timeDisplayRef.current.innerText = Math.max(0, newTimeSec).toFixed(2) + 's';
  }, [isPlaying, msPerBeat, timeToX, xToTime]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientY - rect.top < 40) {
      setIsDragging(true);
      handleSeek(e);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { if (isDragging) handleSeek(e); };
    const handleMouseUp = () => { setIsDragging(false); };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleSeek]);

  const handleLaneMouseDown = useCallback((e: React.MouseEvent, lane: 0 | 1 | 'any') => {
    if (selectedNoteType !== 'eraser') return;
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    eraseStartRef.current = { x, lane };
    eraseDidDragRef.current = false;
    setEraseRect({ left: x, width: 0, lane });
  }, [selectedNoteType]);

  useEffect(() => {
    if (!eraseRect) return; // 드래그 활성 시에만 등록
    const handleMove = (e: MouseEvent) => {
      if (!eraseStartRef.current || !scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
      const start = eraseStartRef.current.x;
      setEraseRect({ left: Math.min(start, x), width: Math.abs(x - start), lane: eraseStartRef.current.lane });
    };
    const handleUp = (e: MouseEvent) => {
      if (!eraseStartRef.current || !scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
      const dist = Math.abs(x - eraseStartRef.current.x);
      if (dist > 8) {
        eraseDidDragRef.current = true;
        const t1 = xToTime(Math.min(eraseStartRef.current.x, x));
        const t2 = xToTime(Math.max(eraseStartRef.current.x, x));
        const lane = eraseStartRef.current.lane;
        setNotes(prev => prev.filter(n => {
          const noteEnd = n.time + (n.duration || 0);
          const overlaps = n.time <= t2 && noteEnd >= t1;
          const laneMatch = n.lane === lane;
          return !(overlaps && laneMatch);
        }));
      } else {
        eraseDidDragRef.current = false;
      }
      eraseStartRef.current = null;
      setEraseRect(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [eraseRect, xToTime]);

  const removeNoteAt = useCallback((time: number, lane: 0 | 1 | 'any') => {
    setNotes(prev => prev.filter(n => !(Math.abs(n.time - time) < 10 && (n.lane === lane || n.lane === 'any'))));
  }, []);

  const handleGridClick = (time: number, lane: 0 | 1 | 'any') => {
    if (selectedNoteType === 'eraser') {
      removeNoteAt(time, lane);
      return;
    }

    if (selectedNoteType === 'long') {
      if (lane === 'any') return;
      if (!pendingLongNote) {
        setPendingLongNote({ time, lane });
      } else {
        const startTime = Math.min(pendingLongNote.time, time);
        const duration = Math.abs(time - pendingLongNote.time);
        if (duration > 50) {
          const newNote: NoteData = {
            time: startTime,
            lane: pendingLongNote.lane,
            type: 'long',
            duration,
            characterId: selectedCharId
          };
          setNotes([...notes, newNote].sort((a, b) => a.time - b.time));
        }
        setPendingLongNote(null);
      }
      return;
    }

    const existingIndex = notes.findIndex(n => Math.abs(n.time - time) < 10 && (n.lane === lane || n.lane === 'any'));
    if (existingIndex !== -1) {
      setNotes(notes.filter((_, i) => i !== existingIndex));
    } else {
      const newNote: NoteData = {
        time, lane, type: selectedNoteType as NoteData['type'],
        characterId: selectedNoteType === 'normal' ? selectedCharId : undefined,
      };
      setNotes([...notes, newNote].sort((a, b) => a.time - b.time));
    }
  };

  const exportJSON = () => {
    const data: ChartData = {
      meta: { title, artist, bpm, offset: 0, roster: roster.split(',').map(s => parseInt(s.trim())) },
      notes
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s+/g, '_')}.json`; a.click();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ChartData;
        if (data.meta) {
          setBpm(data.meta.bpm || 120);
          setRoster(data.meta.roster?.join(', ') || '0, 1, 2');
          setTitle(data.meta.title || 'Unknown Title');
          setArtist(data.meta.artist || 'Unknown Artist');
        }
        if (data.notes) {
          setNotes(data.notes.sort((a, b) => a.time - b.time));
        }
      } catch (err) {
        alert('Failed to parse chart JSON');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const totalDuration = useMemo(
    () => Math.max(audioDurationMs + 5000, ...notes.map(n => n.time + (n.duration || 0) + 10000)),
    [audioDurationMs, notes]
  );

  return (
    <div className="editor-container">
      <div className="editor-sidebar">
        {/* 상단 고정 컨트롤 */}
        <button className="back-to-lobby" onClick={onBack}>← Lobby</button>
        <div className="play-row">
          <button className={`play-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
            {isPlaying ? '⏹ STOP' : '▶ PLAY'}
          </button>
          <div className="time-display" ref={timeDisplayRef}>0.00s</div>
        </div>

        {/* 그룹 1: SONG META */}
        <div className="accordion">
          <button className="accordion-header" onClick={() => toggleSection('meta')}>
            <span>SONG META</span><span>{openSections.meta ? '▲' : '▼'}</span>
          </button>
          {openSections.meta && (
            <div className="accordion-body">
              <table className="props-table">
                <tbody>
                  <tr>
                    <td>Song</td>
                    <td>
                      <select value={selectedSongId} onChange={e => {
                        const song = SONG_LIST.find(s => s.id === e.target.value);
                        if (song) {
                          setSelectedSongId(song.id);
                          setTitle(song.title);
                          setArtist(song.artist);
                          setRoster(song.roster);
                          loadAudio(song.audio);
                        }
                      }}>
                        <option value="">-- 선택 --</option>
                        {SONG_LIST.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>Title</td>
                    <td><input type="text" value={title} onChange={e => setTitle(e.target.value)} /></td>
                  </tr>
                  <tr>
                    <td>Artist</td>
                    <td><input type="text" value={artist} onChange={e => setArtist(e.target.value)} /></td>
                  </tr>
                  <tr>
                    <td>Roster</td>
                    <td><input type="text" value={roster} onChange={e => setRoster(e.target.value)} placeholder="0,1,2" /></td>
                  </tr>
                  <tr>
                    <td>BPM</td>
                    <td><input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 그룹 2: EDIT TOOLS */}
        <div className="accordion">
          <button className="accordion-header" onClick={() => toggleSection('tools')}>
            <span>EDIT TOOLS</span><span>{openSections.tools ? '▲' : '▼'}</span>
          </button>
          {openSections.tools && (
            <div className="accordion-body">
              <div className="props-label">Target Character</div>
              <div className="char-selector">
                {CHAR_DATA.map(char => (
                  <button key={char.id}
                    className={`char-btn ${selectedCharId === char.id ? 'active' : ''}`}
                    style={{ borderLeft: `4px solid ${char.color}` }}
                    onClick={() => setSelectedCharId(char.id)}>
                    {char.name}
                  </button>
                ))}
              </div>
              <div className="props-label">Note Tools</div>
              <div className="note-tools-grid">
                {([['normal','Normal'],['long','Long'],['switch_up','Wheel↑'],['switch_down','Wheel↓'],['eraser','Eraser']] as [string, string][]).map(([type, label]) => (
                  <button key={type}
                    className={selectedNoteType === type ? 'active' : ''}
                    onClick={() => { setSelectedNoteType(type as NoteData['type'] | 'eraser'); setPendingLongNote(null); }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="props-label">BPM Recalculate</div>
              <table className="props-table">
                <tbody>
                  <tr>
                    <td>Old BPM</td>
                    <td><input type="number" step="0.1" value={oldBpm} onChange={e => setOldBpm(Number(e.target.value))} /></td>
                  </tr>
                </tbody>
              </table>
              <button className="snap-btn" onClick={() => {
                const oldGrid = (60 / oldBpm) * 1000 / 4;
                const newGrid = gridStep;
                setNotes(prev => prev.map(n => {
                  const beatIndex = Math.round(n.time / oldGrid);
                  const newTime = beatIndex * newGrid;
                  let newDur = n.duration;
                  if (n.duration) { const durBeats = Math.round(n.duration / oldGrid); newDur = durBeats * newGrid; }
                  return { ...n, time: newTime, duration: newDur && newDur > 0 ? newDur : n.duration };
                }).sort((a, b) => a.time - b.time));
                setOldBpm(bpm);
              }}>RECALC</button>
            </div>
          )}
        </div>

        {/* 그룹 3: PLAYBACK & FILE */}
        <div className="accordion">
          <button className="accordion-header" onClick={() => toggleSection('ops')}>
            <span>PLAYBACK & FILE</span><span>{openSections.ops ? '▲' : '▼'}</span>
          </button>
          {openSections.ops && (
            <div className="accordion-body">
              <table className="props-table">
                <tbody>
                  <tr>
                    <td>Speed</td>
                    <td>
                      <select value={playbackRate} onChange={e => changeRate(Number(e.target.value))}>
                        <option value={0.5}>0.5x</option>
                        <option value={0.75}>0.75x</option>
                        <option value={1.0}>1.0x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2.0}>2.0x</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>Zoom</td>
                    <td><input type="range" min="5" max="100" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></td>
                  </tr>
                </tbody>
              </table>
              <button className={`metronome-btn ${metronomeOn ? 'active' : ''}`} onClick={() => setMetronomeOn(!metronomeOn)}>
                🔔 METRONOME {metronomeOn ? 'ON' : 'OFF'}
              </button>
              <button className="export-btn" onClick={exportJSON}>EXPORT JSON</button>
              <label className="import-label">
                LOAD JSON
                <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="editor-main">
        <div className="timeline-labels">
          <div className="label header">Time</div>
          <div className="label">Upper</div>
          <div className="label">Wheel</div>
          <div className="label">Lower</div>
        </div>
        
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-grid" ref={timelineRef} onMouseDown={handleMouseDown} style={{ width: timeToX(totalDuration) }}>
            <div className="timeline-header" />
            <div className="lead-in-zone" style={{ width: timeToX(0) }} />
            <div className="playback-seeker" ref={seekerRef} />

            {Array.from({ length: Math.ceil(totalDuration / gridStep) }).map((_, i) => {
              const time = i * gridStep;
              const isBeat = i % stepsPerBeat === 0;
              const isBar = i % (stepsPerBeat * 4) === 0;
              const isSubBeat = zoom >= 50 && (i % 2 !== 0);
              return (
                <div key={i} className={`grid-line ${isBeat ? 'beat' : ''} ${isBar ? 'bar' : ''} ${isSubBeat ? 'sub-beat' : ''}`} style={{ left: timeToX(time) }}>
                  {isBeat && <span className="time-label">{(time/1000).toFixed(1)}s</span>}
                </div>
              );
            })}

            <div className="lane-click-area upper"
              onMouseDown={e => handleLaneMouseDown(e, 1)}
              onClick={(e) => {
                if (eraseDidDragRef.current) { eraseDidDragRef.current = false; return; }
                const rect = e.currentTarget.getBoundingClientRect();
                const time = Math.max(0, Math.round(xToTime(e.clientX - rect.left) / gridStep) * gridStep);
                handleGridClick(time, 1);
              }} />
            <div className="lane-click-area middle"
              onMouseDown={e => handleLaneMouseDown(e, 'any')}
              onClick={(e) => {
                if (eraseDidDragRef.current) { eraseDidDragRef.current = false; return; }
                const rect = e.currentTarget.getBoundingClientRect();
                const time = Math.max(0, Math.round(xToTime(e.clientX - rect.left) / gridStep) * gridStep);
                handleGridClick(time, 'any');
              }} />
            <div className="lane-click-area lower"
              onMouseDown={e => handleLaneMouseDown(e, 0)}
              onClick={(e) => {
                if (eraseDidDragRef.current) { eraseDidDragRef.current = false; return; }
                const rect = e.currentTarget.getBoundingClientRect();
                const time = Math.max(0, Math.round(xToTime(e.clientX - rect.left) / gridStep) * gridStep);
                handleGridClick(time, 0);
              }} />

            {eraseRect && (
              <div className="erase-selection" style={{
                left: eraseRect.left,
                width: eraseRect.width,
                top: eraseRect.lane === 1 ? 40 : eraseRect.lane === 0 ? 240 : 140,
                height: 100,
              }} />
            )}

            {pendingLongNote && (
              <div className="note-marker long pending" style={{ left: timeToX(pendingLongNote.time), top: pendingLongNote.lane === 1 ? 78 : 278 }}>
                START
              </div>
            )}

            {notes.map((note, i) => {
              const laneClass = note.lane === 1 ? 'upper' : note.lane === 0 ? 'lower' : 'middle';
              const noteColor = note.characterId !== undefined ? CHAR_DATA.find(c => c.id === note.characterId)?.color : undefined;
              if (note.type === 'long') {
                return (
                  <div key={i} className={`note-marker long ${laneClass} ${selectedNoteType === 'eraser' ? 'erasable' : ''}`}
                       style={{ 
                         left: timeToX(note.time),
                         width: durationToW(note.duration || 0) + 24,
                         marginLeft: -12,
                         borderColor: noteColor,
                         backgroundColor: noteColor ? `${noteColor}4D` : undefined
                       }}
                       onClick={(e) => {
                         if (selectedNoteType === 'eraser') { e.stopPropagation(); removeNoteAt(note.time, note.lane as NoteData['lane']); }
                       }}>
                    <div className="long-body" style={{ backgroundColor: noteColor }} />
                  </div>
                );
              }
              return (
                <div key={i} className={`note-marker ${note.type} ${laneClass} ${selectedNoteType === 'eraser' ? 'erasable' : ''}`}
                     style={{ 
                       left: timeToX(note.time),
                       backgroundColor: note.type === 'normal' ? noteColor : undefined,
                       boxShadow: note.type === 'normal' && noteColor ? `0 0 5px ${noteColor}` : undefined
                     }}
                     onClick={(e) => {
                       if (selectedNoteType === 'eraser') { e.stopPropagation(); removeNoteAt(note.time, note.lane as NoteData['lane']); }
                     }}>
                  {note.type === 'switch_up' ? '▲' : note.type === 'switch_down' ? '▼' : ''}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .editor-container { display: flex; width: 100vw; height: 100vh; background: #1a1a1a; color: white; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        .editor-sidebar { width: 210px; padding: 8px; background: #2c2c2c; display: flex; flex-direction: column; gap: 6px; border-right: 1px solid #3d3d3d; z-index: 100; overflow-y: auto; flex-shrink: 0; }
        .back-to-lobby { padding: 5px 8px; background: #444; border: none; color: #ccc; cursor: pointer; border-radius: 4px; font-size: 0.75rem; }
        .play-row { display: flex; gap: 5px; align-items: center; }
        .play-btn { flex: 1; padding: 7px 4px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.78rem; }
        .play-btn.playing { background: #e74c3c; }
        .time-display { flex: 1; font-size: 0.85rem; font-family: monospace; text-align: center; color: #00d2ff; background: #111; padding: 5px 3px; border-radius: 4px; }
        .accordion { border: 1px solid #3a3a3a; border-radius: 4px; overflow: hidden; }
        .accordion-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #353535; border: none; color: #bbb; cursor: pointer; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
        .accordion-header:hover { background: #3e3e3e; }
        .accordion-body { padding: 7px; background: #272727; display: flex; flex-direction: column; gap: 4px; }
        .props-table { width: 100%; border-collapse: collapse; }
        .props-table td { padding: 3px 3px; font-size: 0.72rem; vertical-align: middle; }
        .props-table td:first-child { color: #777; width: 42%; white-space: nowrap; }
        .props-table input, .props-table select { width: 100%; box-sizing: border-box; background: #3d3d3d; border: 1px solid #4d4d4d; color: white; padding: 3px 5px; border-radius: 3px; font-size: 0.78rem; outline: none; }
        .props-label { font-size: 0.65rem; color: #555; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; padding-top: 5px; border-top: 1px solid #333; margin-top: 2px; }
        .props-label:first-child { border-top: none; padding-top: 0; margin-top: 0; }
        .char-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
        .char-btn { padding: 4px 5px; font-size: 0.68rem; background: #333; border: none; color: #bbb; cursor: pointer; border-radius: 3px; text-align: left; }
        .char-btn.active { background: #484848; color: #fff; box-shadow: inset 0 0 4px rgba(255,255,255,0.15); }
        .note-tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
        .note-tools-grid button { padding: 5px 4px; background: #3d3d3d; border: none; color: #bbb; cursor: pointer; border-radius: 3px; font-size: 0.68rem; text-align: center; }
        .note-tools-grid button.active { background: #0088cc; color: white; }
        .snap-btn { padding: 6px; background: #7d3cc8; border: none; color: white; cursor: pointer; border-radius: 3px; font-size: 0.75rem; font-weight: bold; width: 100%; }
        .snap-btn:hover { background: #9050dd; }
        .metronome-btn { padding: 6px; background: #3d3d3d; border: none; color: #aaa; cursor: pointer; border-radius: 3px; font-size: 0.72rem; font-weight: bold; width: 100%; }
        .metronome-btn.active { background: #e67e22; color: white; }
        .export-btn { background: #c87800; color: white; font-weight: bold; padding: 7px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.75rem; width: 100%; }
        .export-btn:hover { background: #e08800; }
        .import-label { background: #2a6099; color: white; font-weight: bold; padding: 7px; border-radius: 3px; cursor: pointer; text-align: center; font-size: 0.75rem; display: block; }
        .import-label:hover { background: #3479b5; }
        .editor-main { flex: 1; display: flex; flex-direction: row; overflow: hidden; position: relative; background: #111; }
        .timeline-labels { width: 70px; display: flex; flex-direction: column; background: #1a1a1a; border-right: 1px solid #333; z-index: 10; }
        .timeline-labels .label { height: 100px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #555; border-bottom: 1px solid #252525; }
        .timeline-labels .label.header { height: 40px; background: #222; color: #888; }
        .timeline-scroll { flex: 1; overflow-x: auto; overflow-y: hidden; position: relative; }
        .timeline-grid { height: 100%; position: relative; }
        .timeline-header { position: absolute; top: 0; left: 0; right: 0; height: 40px; background: #222; border-bottom: 1px solid #333; cursor: ew-resize; }
        .lead-in-zone { position: absolute; top: 40px; bottom: 0; left: 0; background: rgba(255,255,255,0.025); border-right: 2px solid rgba(255,200,0,0.4); pointer-events: none; z-index: 1; }
        .playback-seeker { position: absolute; top: 0; bottom: 0; width: 2px; background: #ff4444; z-index: 20; box-shadow: 0 0 8px rgba(255,0,0,0.6); pointer-events: none; will-change: transform; }
        .grid-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #222; pointer-events: none; }
        .grid-line.beat { background: #333; width: 1px; }
        .grid-line.bar { background: #444; width: 2px; }
        .grid-line.sub-beat { background: transparent; border-left: 1px dashed #333; width: 0; z-index: 0; }
        .time-label { position: absolute; top: 12px; left: 4px; font-size: 10px; color: #555; font-weight: bold; }
        .lane-click-area { position: absolute; left: 0; right: 0; height: 100px; cursor: crosshair; }
        .lane-click-area.upper { top: 40px; }
        .lane-click-area.middle { top: 140px; background: rgba(255,0,255,0.015); }
        .lane-click-area.lower { top: 240px; }
        
        .note-marker { position: absolute; width: 24px; height: 24px; margin-left: -12px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 5; pointer-events: auto; cursor: pointer; }
        .note-marker.normal { background: white; top: 78px; color: black; box-shadow: 0 0 5px rgba(255,255,255,0.3); }
        .note-marker.normal.lower { top: 278px; }
        .note-marker.long { background: rgba(255,255,255,0.3); height: 24px; top: 78px; border: 1px solid white; border-radius: 12px; justify-content: flex-start; padding-left: 5px; }
        .note-marker.long.lower { top: 278px; }
        .note-marker.long .long-body { width: 100%; height: 10px; background: white; border-radius: 5px; opacity: 0.8; }
        .note-marker.long.pending { background: #f1c40f; color: black; font-size: 8px; width: auto; padding: 0 5px; }
        .note-marker.switch_up { background: #00ff00; top: 178px; color: black; border-radius: 50% 50% 0 0; }
        .note-marker.switch_down { background: #ff00ff; top: 178px; color: white; border-radius: 0 0 50% 50%; }
        .note-marker.erasable:hover { opacity: 0.5; outline: 2px solid #e74c3c; }
        .erase-selection { position: absolute; background: rgba(255,50,50,0.15); border: 1px solid rgba(255,80,80,0.55); pointer-events: none; z-index: 10; }
      `}</style>
    </div>
  );
};

export default ChartEditor;
