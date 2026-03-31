import React from 'react';

const MobileWarning: React.FC = () => {
  return (
    <div className="mobile-warning">
      <h2>Desktop Only</h2>
      <p>This game requires a Keyboard and Mouse to play.</p>
      <p>Please access from a desktop PC.</p>
      <style>{`
        .mobile-warning {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          text-align: center;
          padding: 20px;
        }
      `}</style>
    </div>
  );
};

export default MobileWarning;
