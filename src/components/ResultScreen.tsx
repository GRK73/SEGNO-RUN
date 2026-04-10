import React, { useEffect } from 'react';
import './ResultScreen.css';

interface Stats {
  perfect: number;
  great: number;
  miss: number;
  maxCombo: number;
  totalDeviation: number;
  totalHits: number;
  totalScore: number;
  health: number;
}

interface Props {
  stats: Stats;
  onMain: () => void;
  onRetry: () => void;
}

const ResultScreen: React.FC<Props> = ({ stats, onMain, onRetry }) => {
  const getAssetPath = (path: string) => {
    const base = import.meta.env.BASE_URL.endsWith('/') 
      ? import.meta.env.BASE_URL 
      : `${import.meta.env.BASE_URL}/`;
    return `${base}${path.startsWith('/') ? path.slice(1) : path}`;
  };

  const total = stats.perfect + stats.great + stats.miss;
  const avgDev = total > 0 ? stats.totalDeviation / total : 0;
  const accuracy = Number(Math.max(0, 100 - (avgDev / 150) * 100).toFixed(2));

  // Grade based on note ratio: Perfect=1pt, Great=0.5pt, Miss=0pt
  // Great = 200pt, Perfect = 300pt → Great weight = 2/3
  const noteScore = total > 0 ? (stats.perfect + stats.great * (2 / 3)) / total : 0;

  let grade = 'C';
  if (stats.health === 0) grade = 'F';
  else if (noteScore >= 0.94) grade = 'S';
  else if (noteScore >= 0.85) grade = 'A';
  else if (noteScore >= 0.70) grade = 'B';

  useEffect(() => {
    const bgm = new Audio(getAssetPath('assets/audio/OutSong.mp3'));
    bgm.loop = true;
    bgm.volume = 0.5;
    bgm.play().catch(e => console.warn("Result BGM blocked by browser.", e));

    const sfx = new Audio(getAssetPath(`assets/audio/${grade}.mp3`));
    sfx.volume = 0.8;
    sfx.play().catch(e => console.warn("Result SFX blocked by browser.", e));

    return () => {
      bgm.pause();
      bgm.src = "";
      sfx.pause();
      sfx.src = "";
    };
  }, [grade]);

  return (
    <div className="result-screen">
      <div className="result-container">
        <h1 className="result-title">{grade === 'F' ? 'GAME OVER' : 'STAGE CLEAR'}</h1>
        <div className="grade-circle">
          {grade}
        </div>
        
        <div className="stats-board">
          <div className="stat-row">
            <span className="stat-label">SCORE</span>
            <span className="stat-value highlight">{stats.totalScore.toLocaleString()}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">ACCURACY</span>
            <span className="stat-value">{accuracy}% <small>(Avg Error: {avgDev.toFixed(1)}ms)</small></span>
          </div>
          <div className="stat-row">
            <span className="stat-label">MAX COMBO</span>
            <span className="stat-value">{stats.maxCombo}</span>
          </div>
          <div className="details-box">
            <div className="detail-item perfect">PERFECT: {stats.perfect}</div>
            <div className="detail-item great">GREAT: {stats.great}</div>
            <div className="detail-item miss">MISS: {stats.miss}</div>
          </div>
        </div>

        <div className="result-actions">
          <button className="btn-main" onClick={onMain}>MAIN MENU</button>
          <button className="btn-retry" onClick={onRetry}>RETRY</button>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;
