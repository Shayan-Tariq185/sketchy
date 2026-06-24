import { Crown, Flame, UserX, WifiOff } from 'lucide-react';
import { useGame } from '../context/GameContext';

// Animated animal avatar — shows different states based on player's game role
function AnimalAvatar({ player, isDrawing, isThinking, hasGuessed }) {
  let stateClass = '';
  let overlay = null;
  if (isDrawing) {
    stateClass = 'avatar-drawing';
    overlay = <span className="avatar-overlay">✏️</span>;
  } else if (isThinking) {
    stateClass = 'avatar-thinking';
    overlay = <span className="avatar-overlay">💭</span>;
  } else if (hasGuessed) {
    stateClass = 'avatar-guessed';
    overlay = <span className="avatar-overlay">✅</span>;
  }

  return (
    <span
      className={`animal-avatar ${stateClass}`}
      style={{ background: player.color }}
      title={player.name}
    >
      <span className="animal-emoji">{player.animal || '🐱'}</span>
      {overlay}
    </span>
  );
}

export default function PlayerList({ showScores = false, showKick = false, drawerId = null }) {
  const { room, playerId, kickPlayer } = useGame();
  const me = room.players.find((p) => p.id === playerId);

  return (
    <ul className="player-list">
      {room.players.map((player) => {
        const isMe = player.id === playerId;
        const isDrawing = drawerId === player.id && room.status === 'drawing';
        const isThinking = drawerId === player.id && room.status === 'choosing';
        const hasGuessed = room.correctGuessers?.includes(player.id) && !isDrawing;

        return (
          <li key={player.id} className={`player-row ${!player.connected ? 'is-disconnected' : ''} ${hasGuessed ? 'has-guessed' : ''}`}>
            <AnimalAvatar
              player={player}
              isDrawing={isDrawing}
              isThinking={isThinking}
              hasGuessed={hasGuessed}
            />
            <div className="player-meta">
              <span className="player-name">
                {player.name}
                {isMe ? ' (you)' : ''}
              </span>
              <span className="player-tags">
                {player.isHost ? (
                  <span className="mini-tag">
                    <Crown size={10} /> Host
                  </span>
                ) : null}
                {isDrawing ? <span className="mini-tag mini-tag-drawing">✏️ Drawing</span> : null}
                {isThinking ? <span className="mini-tag mini-tag-thinking">💭 Thinking…</span> : null}
                {hasGuessed ? <span className="mini-tag mini-tag-guessed">✅ Guessed!</span> : null}
                {!player.connected ? (
                  <span className="mini-tag">
                    <WifiOff size={10} /> Offline
                  </span>
                ) : null}
              </span>
            </div>

            {showScores ? (
              <div className="player-score">
                <strong>{player.score}</strong>
                {player.streak > 1 ? (
                  <span className="streak-badge">
                    <Flame size={11} /> {player.streak}
                  </span>
                ) : null}
              </div>
            ) : null}

            {showKick && me?.isHost && !isMe ? (
              <button className="kick-btn" onClick={() => kickPlayer(player.id)} title={`Remove ${player.name}`}>
                <UserX size={15} />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}