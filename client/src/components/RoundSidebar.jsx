import { Eye, Lightbulb, Timer } from 'lucide-react';
import { useGame } from '../context/GameContext';
import PlayerList from './PlayerList';

export default function RoundSidebar({ isDrawer }) {
  const { room, secretWord } = useGame();
  const drawer = room.players.find((p) => p.id === room.drawerId);
  const timePct = room.drawTime ? Math.max(0, Math.min(100, (room.timeLeft / room.drawTime) * 100)) : 100;
  const urgent = room.timeLeft <= 10;
  const timeDisplay = Math.ceil(room.timeLeft);

  // Hint: how many seconds until the hint fires (50% of drawTime)
  const halfTime = room.drawTime ? room.drawTime * 0.5 : 40;
  const timeUntilHint = room.timeLeft > halfTime ? Math.ceil(room.timeLeft - halfTime) : 0;

  return (
    <aside className="round-sidebar">
      {/* Round + Drawer info */}
      <div className="paper-card sidebar-block">
        <span className="eyebrow">
          Round {room.round} / {room.maxRounds}
        </span>
        <div className="sidebar-drawer-row">
          <span className="sidebar-drawer-animal">{drawer?.animal || '🎨'}</span>
          <h3 className="sidebar-drawer-name">
            {drawer?.name || '...'}{' '}
            <span className="sidebar-drawer-action">
              {room.status === 'drawing' ? 'is drawing' : room.status === 'choosing' ? 'is thinking…' : ''}
            </span>
          </h3>
        </div>
      </div>

      {/* Word display */}
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

      {/* Timer */}
      <div className={`paper-card sidebar-block timer-block ${urgent ? 'timer-urgent' : ''}`}>
        <div className="timer-row">
          <Timer size={16} />
          <strong className="timer-number">{timeDisplay}s</strong>
        </div>
        <div className="timer-track">
          <div className="timer-fill" style={{ width: `${timePct}%` }} />
        </div>
      </div>

      {/* Hint status — guessers during drawing */}
      {!isDrawer && room.status === 'drawing' ? (
        <div className={`paper-card sidebar-block hint-block ${room.hintGiven ? 'hint-active' : ''}`}>
          <div className="hint-row">
            <Lightbulb size={14} />
            {room.settings.smartHints ? (
              room.narratorHints?.length ? (
                <div className="narrator-hints">
                  {room.narratorHints.map((hint, i) => (
                    <p key={i} className="hint-text hint-revealed narrator-line">
                      {hint}
                    </p>
                  ))}
                </div>
              ) : timeUntilHint > 0 ? (
                <span className="hint-text">
                  Sketchy hints in <strong>{timeUntilHint}s</strong>
                </span>
              ) : (
                <span className="hint-text">A hint is coming…</span>
              )
            ) : room.hintGiven ? (
              <span className="hint-text hint-revealed">
                💡 {room.revealedCount} letter{room.revealedCount !== 1 ? 's' : ''} revealed!
              </span>
            ) : timeUntilHint > 0 ? (
              <span className="hint-text">
                Hint in <strong>{timeUntilHint}s</strong>
              </span>
            ) : (
              <span className="hint-text">Hint coming…</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Leaderboard */}
      <div className="paper-card sidebar-block scroll-fade sidebar-players">
        <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>
          Leaderboard
        </span>
        <PlayerList showScores drawerId={room.drawerId} />
      </div>
    </aside>
  );
}
