import React, { useState, useEffect, useRef } from 'react';
import './SongSelect.css';

interface SongSelectProps {
  onStart: (songUrl: string, chartUrl: string) => void;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  audio: string;
  cover: string;
  charts: {
    easy: string;
    hard: string;
  };
}

const SONGS: Song[] = [
  {
    id: 'mvp',
    title: 'MVP',
    artist: 'Plan-B',
    audio: 'assets/audio/MVP.mp3',
    cover: 'assets/images/MVP.jpg',
    charts: {
      easy: 'assets/charts/MVP_easy.json',
      hard: 'assets/charts/MVP_hard.json'
    }
  },
  {
    id: 'snaptime',
    title: 'SNAP TIME',
    artist: 'Plan-B',
    audio: 'assets/audio/SNAP TIME.mp3',
    cover: 'assets/images/SNAP TIME.jpg',
    charts: {
      easy: 'assets/charts/SNAP TIME_easy.json',
      hard: 'assets/charts/SNAP TIME_hard.json'
    }
  }
];

const SongSelect: React.FC<SongSelectProps> = ({ onStart }) => {
  const [selectedSong, setSelectedSong] = useState<Song>(SONGS[0]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'hard' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const targetAudioRef = useRef<string | null>(null);

  const getAssetPath = (path: string) => {
    const base = import.meta.env.BASE_URL.endsWith('/') 
      ? import.meta.env.BASE_URL 
      : `${import.meta.env.BASE_URL}/`;
    return `${base}${path.startsWith('/') ? path.slice(1) : path}`;
  };

  useEffect(() => {
    targetAudioRef.current = selectedSong.audio;
    
    const playTarget = () => {
      if (!targetAudioRef.current) return;
      const newAudio = new Audio(getAssetPath(targetAudioRef.current));
      newAudio.loop = true;
      newAudio.volume = 0;
      audioRef.current = newAudio;
      
      newAudio.play().then(() => {
        if (!targetAudioRef.current) {
          newAudio.pause();
          return;
        }
        let vol = 0;
        const fade = setInterval(() => {
          vol += 0.05;
          if (vol >= 0.5 || audioRef.current !== newAudio) {
            if (audioRef.current === newAudio) newAudio.volume = 0.5;
            clearInterval(fade);
          } else {
            newAudio.volume = vol;
          }
        }, 50);
      }).catch(e => console.warn("Audio autoplay blocked by browser. Click anywhere to allow.", e));
    };

    if (audioRef.current) {
      const oldAudio = audioRef.current;
      let vol = oldAudio.volume;
      const fade = setInterval(() => {
        vol -= 0.1;
        if (vol <= 0) {
          oldAudio.pause();
          clearInterval(fade);
          if (targetAudioRef.current === selectedSong.audio) {
             playTarget();
          }
        } else {
          oldAudio.volume = Math.max(0, vol);
        }
      }, 50);
    } else {
      playTarget();
    }
  }, [selectedSong]);

  useEffect(() => {
    // Cleanup on unmount (e.g. game starts)
    return () => {
      targetAudioRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      className="song-select-wrapper" 
      style={{ backgroundImage: `url("${getAssetPath('assets/images/backgroud.png')}")` }} 
    >
      <div className="song-select-container">
        <div className="song-list-panel">
          <div className="song-list">
            {SONGS.map(song => (
              <div 
                key={song.id} 
                className={`song-item ${selectedSong.id === song.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSong(song);
                  setSelectedDifficulty(null);
                }}
              >
                <div className="song-item-title">{song.title}</div>
                <div className="song-item-artist">{song.artist}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="song-detail-panel">
          <div className="album-cover-wrapper">
            <img src={getAssetPath(selectedSong.cover)} alt="Cover" className="album-cover" />
          </div>
          <h2 className="detail-title">{selectedSong.title}</h2>
          
          <div className="difficulty-buttons">
            <button 
              className={`diff-btn easy ${selectedDifficulty === 'easy' ? 'selected' : ''}`} 
              onClick={() => setSelectedDifficulty('easy')}
            >
              EASY
            </button>
            <button 
              className={`diff-btn hard ${selectedDifficulty === 'hard' ? 'selected' : ''}`} 
              onClick={() => setSelectedDifficulty('hard')}
            >
              HARD
            </button>
          </div>

          <button 
            className={`start-game-btn ${selectedDifficulty ? 'ready' : ''}`}
            disabled={!selectedDifficulty}
            onClick={() => {
              if (selectedDifficulty) {
                onStart(
                  getAssetPath(selectedSong.audio), 
                  getAssetPath(selectedSong.charts[selectedDifficulty])
                );
              }
            }}
          >
            GAME START!
          </button>
        </div>
      </div>
    </div>
  );
};

export default SongSelect;
