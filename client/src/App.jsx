import { useGame } from './context/GameContext';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import ResultsScreen from './screens/ResultsScreen';
import ToastStack from './components/ToastStack';
import ConnectionBanner from './components/ConnectionBanner';

// Invisible SVG filter used by every `.wobble-card` element to give panels
// a subtly hand-drawn, displaced border instead of a perfect machine edge.
function GlobalSvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export default function App() {
  const { view, connecting, connected } = useGame();

  return (
    <div className="app-root">
      <GlobalSvgDefs />
      <ToastStack />
      {!connected && !connecting ? <ConnectionBanner /> : null}

      {view === 'home' ? <HomeScreen /> : null}
      {view === 'lobby' ? <LobbyScreen /> : null}
      {view === 'game' ? <GameScreen /> : null}
      {view === 'results' ? <ResultsScreen /> : null}
    </div>
  );
}
