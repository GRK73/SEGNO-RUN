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

  const totalJudgments = stats.perfect + stats.great + stats.miss;
  const avgDev = totalJudgments > 0 ? stats.totalDeviation / totalJudgments : 0;

  let accuracy = 100 - (avgDev / 150) * 100;
  if (accuracy < 0) accuracy = 0;
  accuracy = Number(accuracy.toFixed(2));

  let grade = 'C';
  if (accuracy >= 95) grade = 'S';
  else if (accuracy >= 85) grade = 'A';
  else if (accuracy >= 70) grade = 'B';

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
        <h1 className="result-title">STAGE CLEAR</h1>
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
