import { Eye, Lightbulb, Timer } from 'lucide-react';
import { useGame } from '../context/GameContext';
import PlayerList from './PlayerList';

/** Renders the masked word for guessers (blank letters show only an underline,
 * revealed letters show in colour). The drawer sees the real word as plain
 * text instead -- it must never be passed through the letter-box renderer,
 * since that renderer assumes single-character "_" tokens, and a real word
 * like "Bunsen burner" would get crammed whole words into single-letter-sized
 * boxes. */
function MaskedWordDisplay({ masked, isDrawer, secretWord }) {
  if (isDrawer) {
    if (!secretWord) return <span className="word-display-blanks">…</span>;
    return <div className="word-display-plain">{secretWord}</div>;
  }

  if (!masked) return <span className="word-display-blanks">…</span>;

  // Server sends "_ _ _   _ _ _ _"
  // triple-space = word boundary, single-space = letter separator
  const wordChunks = masked.split('   ');
  return (
    <div className="word-display-line">
      {wordChunks.map((chunk, wi) => (
        <span key={wi} className="word-display-chunk">
          {chunk.split(' ').map((letter, li) => {
            const isBlank = letter === '_';
            return (
              <span key={li} className={`word-letter${isBlank ? '' : ' revealed'}`}>
                {/* blank = empty string, border-bottom is the underline */}
                {isBlank ? '' : letter}
              </span>
            );
          })}
          {wi < wordChunks.length - 1 && <span className="word-gap" />}
        </span>
      ))}
    </div>
  );
}

export default function RoundSidebar({ isDrawer }) {
  const { room, secretWord } = useGame();
  const drawer = room.players.find((p) => p.id === room.drawerId);
  const timePct = room.drawTime ? Math.max(0, Math.min(100, (room.timeLeft / room.drawTime) * 100)) : 100;
  const urgent = room.timeLeft <= 10;
  const timeDisplay = Math.ceil(room.timeLeft);

  const firstHintAt = room.drawTime ? room.drawTime / 3 : 27; // 1st letter at ~2/3 elapsed
  const timeUntilHint = room.timeLeft > firstHintAt ? Math.ceil(room.timeLeft - firstHintAt) : 0;

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
            {drawer?.name || '...'}
            <span className="sidebar-drawer-action">
              {room.status === 'drawing' ? 'is drawing' : room.status === 'choosing' ? 'is thinking…' : ''}
            </span>
          </h3>
        </div>
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

      {/* Hint status */}
      {!isDrawer && room.status === 'drawing' && room.settings.hints ? (
        <div className={`paper-card sidebar-block hint-block ${room.hintGiven ? 'hint-active' : ''}`}>
          <div className="hint-row">
            <Lightbulb size={14} />
            {room.hintGiven ? (
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