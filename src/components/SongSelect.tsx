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
    id: 'planb',
    title: 'Plan B',
    artist: 'Plan B(한세긴, 나비, 송밤)',
    audio: 'assets/audio/Plan B.mp3',
    cover: 'assets/images/coverimg/Plan B.png',
    charts: {
      easy: 'assets/charts/Plan B_easy.json',
      hard: 'assets/charts/Plan B_hard.json'
    }
  },
  {
    id: 'snaptime',
    title: 'SNAP TIME',
    artist: 'Plan B(한세긴, 나비, 송밤)',
    audio: 'assets/audio/SNAP TIME.mp3',
    cover: 'assets/images/coverimg/SNAP TIME.png',
    charts: {
      easy: 'assets/charts/SNAP TIME_easy.json',
      hard: 'assets/charts/SNAP TIME_hard.json'
    }
  },
  {
    id: 'mvp',
    title: 'MVP',
    artist: 'Plan B(한세긴, 나비, 송밤)',
    audio: 'assets/audio/MVP.mp3',
    cover: 'assets/images/coverimg/MVP.png',
    charts: {
      easy: 'assets/charts/MVP_easy.json',
      hard: 'assets/charts/MVP_hard.json'
    }
  },
  {
    id: 'monthly1',
    title: '월간싸이퍼 Vol.1',
    artist: '빕어, 한세긴, 나비, 송밤',
    audio: 'assets/audio/월간싸이퍼 Vol.1.mp3',
    cover: 'assets/images/coverimg/월간싸이퍼 Vol.1.png',
    charts: {
      easy: 'assets/charts/월간싸이퍼 Vol.1_easy.json',
      hard: 'assets/charts/월간싸이퍼 Vol.1_hard.json'
    }
  },
  {
    id: 'monthly2',
    title: '월간싸이퍼 Vol.2',
    artist: '빕어, 한세긴, 나비, 송밤',
    audio: 'assets/audio/월간싸이퍼 Vol.2.mp3',
    cover: 'assets/images/coverimg/월간싸이퍼 Vol.2.png',
    charts: {
      easy: 'assets/charts/월간싸이퍼 Vol.2_easy.json',
      hard: 'assets/charts/월간싸이퍼 Vol.2_hard.json'
    }
  },
  {
    id: 'monthly3',
    title: '월간싸이퍼 Vol.3',
    artist: '빕어, 한세긴, 나비, 송밤',
    audio: 'assets/audio/월간싸이퍼 Vol.3.mp3',
    cover: 'assets/images/coverimg/월간싸이퍼 Vol.3.png',
    charts: {
      easy: 'assets/charts/월간싸이퍼 Vol.3_easy.json',
      hard: 'assets/charts/월간싸이퍼 Vol.3_hard.json'
    }
  },
  {
    id: 'monthly4',
    title: '월간싸이퍼 Vol.4',
    artist: '빕어, 한세긴, 나비, 크앙희',
    audio: 'assets/audio/월간싸이퍼 Vol.4.mp3',
    cover: 'assets/images/coverimg/월간싸이퍼 Vol.4.png',
    charts: {
      easy: 'assets/charts/월간싸이퍼 Vol.4_easy.json',
      hard: 'assets/charts/월간싸이퍼 Vol.4_hard.json'
    }
  },
  {
    id: 'monthly5',
    title: '월간싸이퍼 Vol.5',
    artist: '빕어, 한세긴, 나비, 크앙희',
    audio: 'assets/audio/월간싸이퍼 Vol.5.mp3',
    cover: 'assets/images/coverimg/월간싸이퍼 Vol.5.png',
    charts: {
      easy: 'assets/charts/월간싸이퍼 Vol.5_easy.json',
      hard: 'assets/charts/월간싸이퍼 Vol.5_hard.json'
    }
  },
  {
    id: 'saynomore',
    title: 'Say No More',
    artist: '나비',
    audio: 'assets/audio/Say No More.mp3',
    cover: 'assets/images/coverimg/Say No More.png',
    charts: {
      easy: 'assets/charts/Say No More_easy.json',
      hard: 'assets/charts/Say No More_hard.json'
    }
  },
  {
    id: 'switch',
    title: 'SWITCH',
    artist: '한세긴',
    audio: 'assets/audio/SWITCH.mp3',
    cover: 'assets/images/coverimg/SWITCH.png',
    charts: {
      easy: 'assets/charts/SWITCH_easy.json',
      hard: 'assets/charts/SWITCH_hard.json'
    }
  },
  {
    id: 'convergence',
    title: '수렴',
    artist: '빕어',
    audio: 'assets/audio/수렴.mp3',
    cover: 'assets/images/coverimg/수렴.png',
    charts: {
      easy: 'assets/charts/수렴_easy.json',
      hard: 'assets/charts/수렴_hard.json'
    }
  },
  {
    id: 'stamp',
    title: '찍어내',
    artist: '빕어',
    audio: 'assets/audio/찍어내.mp3',
    cover: 'assets/images/coverimg/찍어내.png',
    charts: {
      easy: 'assets/charts/찍어내_easy.json',
      hard: 'assets/charts/찍어내_hard.json'
    }
  },
  {
    id: 'objective',
    title: '객관',
    artist: '빕어',
    audio: 'assets/audio/객관.mp3',
    cover: 'assets/images/coverimg/객관.png',
    charts: {
      easy: 'assets/charts/객관_easy.json',
      hard: 'assets/charts/객관_hard.json'
    }
  },
  {
    id: 'finally',
    title: '이제야',
    artist: '빕어',
    audio: 'assets/audio/이제야.mp3',
    cover: 'assets/images/coverimg/이제야.png',
    charts: {
      easy: 'assets/charts/이제야_easy.json',
      hard: 'assets/charts/이제야_hard.json'
    }
  },
  {
    id: 'ramble',
    title: '주절',
    artist: '빕어',
    audio: 'assets/audio/주절.mp3',
    cover: 'assets/images/coverimg/주절.png',
    charts: {
      easy: 'assets/charts/주절_easy.json',
      hard: 'assets/charts/주절_hard.json'
    }
  },
  {
    id: 'turning',
    title: '전환점',
    artist: '빕어',
    audio: 'assets/audio/전환점.mp3',
    cover: 'assets/images/coverimg/전환점.png',
    charts: {
      easy: 'assets/charts/전환점_easy.json',
      hard: 'assets/charts/전환점_hard.json'
    }
  },
  {
    id: 'worthy',
    title: '마땅한가',
    artist: '빕어',
    audio: 'assets/audio/마땅한가.mp3',
    cover: 'assets/images/coverimg/마땅한가.png',
    charts: {
      easy: 'assets/charts/마땅한가_easy.json',
      hard: 'assets/charts/마땅한가_hard.json'
    }
  },
  {
    id: 'jump',
    title: '뛰어',
    artist: '빕어',
    audio: 'assets/audio/뛰어.mp3',
    cover: 'assets/images/coverimg/뛰어.png',
    charts: {
      easy: 'assets/charts/뛰어_easy.json',
      hard: 'assets/charts/뛰어_hard.json'
    }
  },
  {
    id: 'miserable',
    title: '궁상',
    artist: '빕어',
    audio: 'assets/audio/궁상.mp3',
    cover: 'assets/images/coverimg/궁상.png',
    charts: {
      easy: 'assets/charts/궁상_easy.json',
      hard: 'assets/charts/궁상_hard.json'
    }
  },
  {
    id: 'mainwork',
    title: '본업행동',
    artist: '빕어',
    audio: 'assets/audio/본업행동.mp3',
    cover: 'assets/images/coverimg/본업행동.png',
    charts: {
      easy: 'assets/charts/본업행동_easy.json',
      hard: 'assets/charts/본업행동_hard.json'
    }
  },
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
