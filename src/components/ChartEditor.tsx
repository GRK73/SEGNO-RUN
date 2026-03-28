import React, { useState, useEffect, useRef } from 'react';
import type { ChartData, NoteData } from '../game/ChartLoader';

const ChartEditor: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [bpm, setBpm] = useState(120);
  const [title, setTitle] = useState('New Song');
  const [artist, setArtist] = useState('Artist');
  const [roster, setRoster] = useState('0, 1, 2');
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [zoom, setZoom] = useState(20); 
  const [selectedNoteType, setSelectedNoteType] = useState<NoteData['type'] | 'eraser'>('normal');
  const [selectedCharId, setSelectedCharId] = useState<number>(0);
  
  const CHAR_DATA = [
    { id: 0, name: '빕어', color: '#cacdd1' },
    { id: 1, name: '한세긴', color: '#4abeff' },
    { id: 2, name: '송밤', color: '#bec8fd' },
    { id: 3, name: '나비', color: '#ffa670' },
    { id: 4, name: '크앙희', color: '#c296e8' },
  ];

  const [pendingLongNote, setPendingLongNote] = useState<{ time: number, lane: 0 | 1 } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const seekerRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  const msPerBeat = (60 / bpm) * 1000;
  const gridStep = msPerBeat / 4; 

  const timeToX = (timeMs: number) => timeMs * (zoom / 100);
  const xToTime = (x: number) => x / (zoom / 100);

  useEffect(() => {
    const ctx = new window.AudioContext();
    audioCtxRef.current = ctx;
    
    fetch(`${import.meta.env.BASE_URL}assets/audio/test.mp3`)
      .then(res => res.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        audioBufferRef.current = decoded;
      })
      .catch(e => console.error('Audio load failed:', e));

    return () => {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current.disconnect();
      }
      ctx.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const updateLoop = () => {
    if (audioCtxRef.current && isPlaying && !isDragging) {
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      let currentSec = pauseTimeRef.current + elapsed;

      if (audioBufferRef.current && currentSec >= audioBufferRef.current.duration) {
        setIsPlaying(false);
        pauseTimeRef.current = 0;
        if (sourceNodeRef.current) {
          try { sourceNodeRef.current.stop(); } catch(e) {}
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
      requestRef.current = requestAnimationFrame(updateLoop);
    }
  };

  useEffect(() => {
    if (isPlaying && !isDragging) {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      requestRef.current = requestAnimationFrame(updateLoop);
    } else if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, [isPlaying, isDragging, zoom]);

  const togglePlay = () => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;
    
    if (isPlaying) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      pauseTimeRef.current += elapsed;
    } else {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      
      const ctx = audioCtxRef.current;
      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(ctx.destination);
      
      const offset = pauseTimeRef.current;
      source.start(0, offset);
      startTimeRef.current = ctx.currentTime;
      sourceNodeRef.current = source;
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent | MouseEvent) => {
    if (!scrollRef.current || !audioCtxRef.current || !audioBufferRef.current) return;
    const containerRect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left + scrollRef.current.scrollLeft;
    const newTimeMs = Math.max(0, xToTime(x));
    let newTimeSec = newTimeMs / 1000;
    
    newTimeSec = Math.min(newTimeSec, audioBufferRef.current.duration);
    
    if (isPlaying && sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect();
      
      const ctx = audioCtxRef.current;
      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(ctx.destination);
      
      source.start(0, newTimeSec);
      startTimeRef.current = ctx.currentTime;
      pauseTimeRef.current = newTimeSec;
      sourceNodeRef.current = source;
    } else {
      pauseTimeRef.current = newTimeSec;
    }
    
    if (seekerRef.current) seekerRef.current.style.transform = `translateX(${timeToX(newTimeSec * 1000)}px)`;
    if (timeDisplayRef.current) timeDisplayRef.current.innerText = newTimeSec.toFixed(2) + 's';
  };

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
  }, [isDragging]);

  const removeNoteAt = (time: number, lane: 0 | 1 | 'any') => {
    setNotes(prev => prev.filter(n => !(Math.abs(n.time - time) < 10 && (n.lane === lane || n.lane === 'any'))));
  };

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

  const audioDurationMs = audioBufferRef.current ? audioBufferRef.current.duration * 1000 : 120000;
  const totalDuration = Math.max(audioDurationMs + 5000, ...notes.map(n => n.time + (n.duration || 0) + 10000));

  return (
    <div className="editor-container">
      <div className="editor-sidebar">
        <button className="back-to-lobby" onClick={onBack}>← Lobby</button>
        <button className={`play-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>
        <div className="time-display" ref={timeDisplayRef}>0.00s</div>
        
        <div className="input-group">
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Artist</label>
          <input type="text" value={artist} onChange={e => setArtist(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Roster (IDs)</label>
          <input type="text" value={roster} onChange={e => setRoster(e.target.value)} placeholder="0, 1, 2" />
        </div>
        <div className="input-group">
          <label>BPM</label>
          <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} />
        </div>
        <div className="input-group">
          <label>Zoom</label>
          <input type="range" min="5" max="100" value={zoom} onChange={e => setZoom(Number(e.target.value))} />
        </div>

        <div className="tool-group">
          <p>Target Character</p>
          <div className="char-selector">
            {CHAR_DATA.map(char => (
              <button 
                key={char.id} 
                className={`char-btn ${selectedCharId === char.id ? 'active' : ''}`}
                style={{ borderLeft: `4px solid ${char.color}` }}
                onClick={() => setSelectedCharId(char.id)}
              >
                {char.name}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-group">
          <p>Note Tools</p>
          <button className={selectedNoteType === 'normal' ? 'active' : ''} 
                  onClick={() => { setSelectedNoteType('normal'); setPendingLongNote(null); }}>Normal Note</button>
          <button className={selectedNoteType === 'long' ? 'active' : ''} 
                  onClick={() => { setSelectedNoteType('long'); setPendingLongNote(null); }}>Long Note</button>
          <button className={selectedNoteType === 'switch_up' ? 'active' : ''} 
                  onClick={() => { setSelectedNoteType('switch_up'); setPendingLongNote(null); }}>Wheel Up</button>
          <button className={selectedNoteType === 'switch_down' ? 'active' : ''} 
                  onClick={() => { setSelectedNoteType('switch_down'); setPendingLongNote(null); }}>Wheel Down</button>
          <button className={`eraser-btn ${selectedNoteType === 'eraser' ? 'active' : ''}`} 
                  onClick={() => { setSelectedNoteType('eraser'); setPendingLongNote(null); }}>ERASER</button>
        </div>
        <div className="file-ops">
          <button className="export-btn" onClick={exportJSON}>EXPORT JSON</button>
          <label className="import-label">
            LOAD JSON
            <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
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
            <div className="playback-seeker" ref={seekerRef} />

            {Array.from({ length: Math.ceil(totalDuration / gridStep) }).map((_, i) => {
              const time = i * gridStep;
              const isBeat = i % 4 === 0;
              const isBar = i % 16 === 0;
              return (
                <div key={i} className={`grid-line ${isBeat ? 'beat' : ''} ${isBar ? 'bar' : ''}`} style={{ left: timeToX(time) }}>
                  {isBeat && <span className="time-label">{(time/1000).toFixed(1)}s</span>}
                </div>
              );
            })}

            <div className="lane-click-area upper" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const time = Math.round(xToTime(e.clientX - rect.left) / gridStep) * gridStep;
              handleGridClick(time, 1);
            }} />
            <div className="lane-click-area middle" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const time = Math.round(xToTime(e.clientX - rect.left) / gridStep) * gridStep;
              handleGridClick(time, 'any');
            }} />
            <div className="lane-click-area lower" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const time = Math.round(xToTime(e.clientX - rect.left) / gridStep) * gridStep;
              handleGridClick(time, 0);
            }} />

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
                         width: timeToX(note.duration || 0) + 24, 
                         marginLeft: -12,
                         borderColor: noteColor,
                         backgroundColor: noteColor ? `${noteColor}4D` : undefined
                       }}
                       onClick={(e) => {
                         if (selectedNoteType === 'eraser') { e.stopPropagation(); removeNoteAt(note.time, note.lane as any); }
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
                       if (selectedNoteType === 'eraser') { e.stopPropagation(); removeNoteAt(note.time, note.lane as any); }
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
        .editor-sidebar { width: 200px; padding: 12px; background: #2c2c2c; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid #3d3d3d; z-index: 100; overflow-y: auto; flex-shrink: 0; }
        .back-to-lobby { padding: 6px; background: #444; border: none; color: #fff; cursor: pointer; border-radius: 4px; font-size: 0.8rem; flex-shrink: 0; }
        .play-btn { padding: 10px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 2px; flex-shrink: 0; }
        .play-btn.playing { background: #e74c3c; }
        .time-display { font-size: 1.2rem; font-family: monospace; text-align: center; color: #00d2ff; background: #111; padding: 5px; border-radius: 4px; }
        .input-group { display: flex; flex-direction: column; gap: 2px; }
        .input-group label { font-size: 0.7rem; color: #888; text-transform: uppercase; font-weight: bold; }
        .input-group input { background: #3d3d3d; border: 1px solid #4d4d4d; color: white; padding: 5px; border-radius: 4px; font-size: 0.9rem; }
        .tool-group { display: flex; flex-direction: column; gap: 3px; margin-top: 2px; }
        .tool-group p { font-size: 0.75rem; color: #888; margin: 0; font-weight: bold; text-transform: uppercase; }
        .tool-group button { padding: 7px; background: #3d3d3d; border: none; color: #bbb; cursor: pointer; text-align: left; border-radius: 4px; font-size: 0.8rem; }
        .tool-group button.active { background: #00aaff; color: white; }
        .char-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; }
        .char-btn { padding: 4px 8px !important; font-size: 0.7rem !important; background: #333 !important; text-align: center !important; }
        .char-btn.active { background: #555 !important; box-shadow: inset 0 0 5px rgba(255,255,255,0.2); }
        .export-btn { background: #f39c12 !important; color: white !important; font-weight: bold; padding: 10px !important; margin-top: auto; border: none; border-radius: 4px; cursor: pointer; text-align: center; }
        .file-ops { display: flex; flex-direction: column; gap: 5px; margin-top: auto; }
        .import-label { background: #3498db; color: white; font-weight: bold; padding: 10px; border-radius: 4px; cursor: pointer; text-align: center; font-size: 0.8rem; }
        .import-label:hover { background: #2980b9; }
        .editor-main { flex: 1; display: flex; flex-direction: row; overflow: hidden; position: relative; background: #111; }
        .timeline-labels { width: 70px; display: flex; flex-direction: column; background: #1a1a1a; border-right: 1px solid #333; z-index: 10; }
        .timeline-labels .label { height: 100px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #555; border-bottom: 1px solid #252525; }
        .timeline-labels .label.header { height: 40px; background: #222; color: #888; }
        .timeline-scroll { flex: 1; overflow-x: auto; overflow-y: hidden; position: relative; }
        .timeline-grid { height: 100%; position: relative; }
        .timeline-header { position: absolute; top: 0; left: 0; right: 0; height: 40px; background: #222; border-bottom: 1px solid #333; cursor: ew-resize; }
        .playback-seeker { position: absolute; top: 0; bottom: 0; width: 2px; background: #ff4444; z-index: 20; box-shadow: 0 0 8px rgba(255,0,0,0.6); pointer-events: none; will-change: transform; }
        .grid-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #222; pointer-events: none; }
        .grid-line.beat { background: #333; width: 1px; }
        .grid-line.bar { background: #444; width: 2px; }
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
      `}</style>
    </div>
  );
};

export default ChartEditor;
