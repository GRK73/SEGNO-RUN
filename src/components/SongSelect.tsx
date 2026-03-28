import React from 'react';

interface SongSelectProps {
  onStart: (songUrl: string, chartUrl: string) => void;
}

const SongSelect: React.FC<SongSelectProps> = ({ onStart }) => {
  const getAssetPath = (path: string) => {
    // Ensure we don't have double slashes
    const base = import.meta.env.BASE_URL.endsWith('/') 
      ? import.meta.env.BASE_URL 
      : `${import.meta.env.BASE_URL}/`;
    return `${base}${path.startsWith('/') ? path.slice(1) : path}`;
  };

  const testSong = {
    title: 'Test Song',
    audio: getAssetPath('assets/audio/test.mp3'),
    chart: getAssetPath('assets/charts/test.json')
  };

  return (
    <div className="song-select">
      <h1>Plan-B RHYTHM</h1>
      <button onClick={() => onStart(testSong.audio, testSong.chart)}>
        Start Test Song
      </button>
      <style>{`
        .song-select {
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 2rem;
          border-radius: 1rem;
          text-align: center;
          pointer-events: auto;
        }
        button {
          padding: 1rem 2rem;
          font-size: 1.2rem;
          cursor: pointer;
          background: #00aaff;
          border: none;
          color: white;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default SongSelect;
