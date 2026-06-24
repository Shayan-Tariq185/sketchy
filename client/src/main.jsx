import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { GameProvider } from './context/GameContext.jsx';
import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import './styles/home.css';
import './styles/lobby.css';
import './styles/game.css';
import './styles/results.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>
);