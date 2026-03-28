import { useState, useEffect } from 'react';
import PixiCanvas from './core/PixiCanvas'
import SongSelect from './components/SongSelect'
import ChartEditor from './components/ChartEditor'
import MobileWarning, { isMobile } from './components/MobileWarning'
import { GameEngine } from './core/GameEngine'
import './App.css'

function App() {
  const [gameState, setGameState] = useState<'LOBBY' | 'INGAME' | 'EDITOR'>('LOBBY');
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  useEffect(() => {
    if (isMobile()) {
      setShowMobileWarning(true);
    }
  }, []);

  const handleStartSong = async (songUrl: string, chartUrl: string) => {
    setGameState('INGAME');
    setTimeout(() => {
      GameEngine.getInstance().startSong(songUrl, chartUrl);
    }, 100);
  };

  if (showMobileWarning) {
    return <MobileWarning />;
  }

  return (
    <div className="App">
      {gameState !== 'EDITOR' && <PixiCanvas />}
      <div className="ui-overlay">
        {gameState === 'LOBBY' && (
          <div className="center-overlay">
            <SongSelect onStart={handleStartSong} />
            <button className="editor-entry-btn" onClick={() => setGameState('EDITOR')}>
              Chart Editor
            </button>
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
    </div>
  )
}

export default App
