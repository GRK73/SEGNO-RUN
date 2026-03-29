import { useState, useEffect, useRef } from 'react';
import PixiCanvas from './core/PixiCanvas'
import SongSelect from './components/SongSelect'
import ChartEditor from './components/ChartEditor'
import MobileWarning, { isMobile } from './components/MobileWarning'
import SettingsModal from './components/SettingsModal'
import { GameEngine } from './core/GameEngine'
import './App.css'

function App() {
  const [gameState, setGameState] = useState<'LOBBY' | 'LOADING' | 'INGAME' | 'EDITOR'>('LOBBY');
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const selectedSongRef = useRef<string>('');
  const selectedChartRef = useRef<string>('');

  useEffect(() => {
    if (isMobile()) {
      setShowMobileWarning(true);
    }
  }, []);

  const handleStartSong = async (songUrl: string, chartUrl: string) => {
    selectedSongRef.current = songUrl;
    selectedChartRef.current = chartUrl;
    setGameState('LOADING');
  };

  useEffect(() => {
    if (gameState === 'LOADING') {
      const loadGame = async () => {
        const offset = parseInt(localStorage.getItem('audioOffset') || '0', 10);
        const engine = GameEngine.getInstance();
        engine.setOffset(offset);
        
        // Wait for PixiCanvas to mount and initialize the engine
        while (!(engine as any).initialized) {
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
      {(gameState === 'LOADING' || gameState === 'INGAME') && <PixiCanvas />}
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
        
        {gameState === 'INGAME' && (
          <div className="ingame-hud">
            <button className="back-btn" onClick={() => {
              GameEngine.getInstance().destroy();
              setGameState('LOBBY');
            }}>Quit</button>
          </div>
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

