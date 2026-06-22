import { Crown, Eye, Timer } from 'lucide-react';
import { useGame } from '../context/GameContext';
import PlayerList from './PlayerList';

export default function RoundSidebar({ isDrawer }) {
  const { room, secretWord } = useGame();
  const drawer = room.players.find((p) => p.id === room.drawerId);
  const timePct = room.drawTime ? Math.max(0, Math.min(100, (room.timeLeft / room.drawTime) * 100)) : 100;
  const urgent = room.timeLeft <= 10;

  return (
    <aside className="round-sidebar">
      <div className="paper-card sidebar-block">
        <span className="eyebrow">
          Round {room.round} / {room.maxRounds}
        </span>
        <h3 className="sidebar-drawer-name">
          <Crown size={15} /> {drawer?.name || '...'} is drawing
        </h3>
      </div>

      <div className="paper-card sidebar-block">
        <div className="word-display-row">
          <span className="eyebrow">{isDrawer ? 'Your word' : 'Guess the word'}</span>
          {isDrawer ? <Eye size={13} /> : null}
        </div>
        <p className="word-display">
          {isDrawer ? secretWord || room.maskedWord : room.maskedWord}
        </p>
        <span className="word-length-hint">{room.wordLength} letters</span>
      </div>

      <div className={`paper-card sidebar-block timer-block ${urgent ? 'timer-urgent' : ''}`}>
        <div className="timer-row">
          <Timer size={16} />
          <strong>{room.timeLeft}s</strong>
        </div>
        <div className="timer-track">
          <div className="timer-fill" style={{ width: `${timePct}%` }} />
        </div>
      </div>

      <div className="paper-card sidebar-block scroll-fade sidebar-players">
        <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>
          Leaderboard
        </span>
        <PlayerList showScores drawerId={room.drawerId} />
      </div>
    </aside>
  );
}
