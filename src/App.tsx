import { useState, useEffect, useRef, useCallback } from 'react';
import PixiCanvas from './core/PixiCanvas'
import SongSelect from './components/SongSelect'
import ChartEditor from './components/ChartEditor'
import MobileWarning from './components/MobileWarning'
import { isMobile } from './utils/device'
import SettingsModal from './components/SettingsModal'
import ResultScreen from './components/ResultScreen'
import { GameEngine } from './core/GameEngine'
import './App.css'

interface GameStats {
  perfect: number;
  great: number;
  miss: number;
  maxCombo: number;
  totalDeviation: number;
  totalHits: number;
  totalScore: number;
}

function App() {
  const [gameState, setGameState] = useState<'LOBBY' | 'LOADING' | 'INGAME' | 'EDITOR' | 'RESULT'>('LOBBY');
  const [isPaused, setIsPaused] = useState(false);
  const [showMobileWarning] = useState(isMobile());
  const [showSettings, setShowSettings] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [gameSessionId, setGameSessionId] = useState(0);
  const selectedSongRef = useRef<string>('');
  const selectedChartRef = useRef<string>('');

  const handleStartSong = async (songUrl: string, chartUrl: string) => {
    selectedSongRef.current = songUrl;
    selectedChartRef.current = chartUrl;
    setGameSessionId(prev => prev + 1);
    setIsPaused(false);
    setGameState('LOADING');
  };

  const handleRetry = () => {
    setIsPaused(false);
    setGameSessionId(prev => prev + 1);
    setGameState('LOADING');
  };

  const handleMain = () => {
    setIsPaused(false);
    setGameState('LOBBY');
  };

  const togglePause = useCallback(() => {
    if (gameState !== 'INGAME') return;
    
    const engine = GameEngine.getInstance();
    if (!isPaused) {
      engine.pause();
      setIsPaused(true);
    } else {
      engine.resume();
      setIsPaused(false);
    }
  }, [gameState, isPaused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause]);

  useEffect(() => {
    if (gameState === 'LOADING') {
      const loadGame = async () => {
        const offset = parseInt(localStorage.getItem('audioOffset') || '0', 10);
        const engine = GameEngine.getInstance();
        engine.setOffset(offset);
        
        engine.onGameEnd = (stats: GameStats) => {
          setGameStats(stats);
          setGameState('RESULT');
        };

        // Wait for PixiCanvas to mount and initialize the engine
        while (!engine.initialized) {
          await new Promise(r => setTimeout(r, 50));
        }

        // Show the loading screen for at least 2.5 seconds to feel natural
        await new Promise(r => setTimeout(r, 2500));

        // Start song: This will download assets, initialize textures, decode audio, and play.
        await engine.startSong(selectedSongRef.current, selectedChartRef.current);
        
        // Once everything is loaded and game has started, hide the loading screen
        setGameState('INGAME');
      };
      
      loadGame();
    }
  }, [gameState]);

  if (showMobileWarning) {
    return <MobileWarning />;
  }

  return (
    <div className="App">
      {(gameState === 'LOADING' || gameState === 'INGAME' || gameState === 'RESULT') && (
        <PixiCanvas key={gameSessionId} />
      )}
      <div className="ui-overlay">
        {gameState === 'LOBBY' && (
          <div className="center-overlay">
            <SongSelect onStart={handleStartSong} />
            <button className="editor-entry-btn" onClick={() => setGameState('EDITOR')}>
              Chart Editor
            </button>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>
              ⚙
            </button>
          </div>
        )}

        {gameState === 'LOADING' && (
          <div className="loading-screen">
            <h1>NOW LOADING...</h1>
          </div>
        )}
        
        {gameState === 'INGAME' && isPaused && (
          <div className="pause-menu">
            <div className="pause-content">
              <h1>PAUSED</h1>
              <div className="pause-buttons">
                <button className="resume-btn" onClick={togglePause}>RESUME</button>
                <button className="retry-btn" onClick={handleRetry}>RETRY</button>
                <button className="quit-btn" onClick={handleMain}>QUIT</button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'RESULT' && gameStats && (
          <ResultScreen 
            stats={gameStats} 
            onMain={handleMain} 
            onRetry={handleRetry} 
          />
        )}

        {gameState === 'EDITOR' && (
          <ChartEditor onBack={() => setGameState('LOBBY')} />
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
