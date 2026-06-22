import { Crown, Flame, UserX, WifiOff } from 'lucide-react';
import { useGame } from '../context/GameContext';

export default function PlayerList({ showScores = false, showKick = false, drawerId = null }) {
  const { room, playerId, kickPlayer } = useGame();
  const me = room.players.find((p) => p.id === playerId);

  return (
    <ul className="player-list">
      {room.players.map((player) => {
        const isMe = player.id === playerId;
        const isDrawing = drawerId === player.id;
        return (
          <li key={player.id} className={`player-row ${!player.connected ? 'is-disconnected' : ''}`}>
            <span className="avatar-dot" style={{ background: player.color }}>
              {player.name.slice(0, 1).toUpperCase()}
            </span>
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
                {isDrawing ? <span className="mini-tag mini-tag-drawing">Drawing</span> : null}
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
