import { useState } from 'react';
import { Crown, Home, RotateCcw, Trophy } from 'lucide-react';
import { useGame } from '../context/GameContext';
import RoundEndOverlay from '../components/RoundEndOverlay';

// Badge emoji mapping for visual flair
const BADGE_EMOJI = {
  'The Minimalist': '✏️',
  'Colorful Chaos': '🎨',
  'The Speedrunner': '⚡',
  'The Overthinker': '🤔',
  'Creative Interpretation Award': '🌟',
  'All-Round Sketcher': '🖊️',
};

function PersonalityCard({ player, badge, description, isMe }) {
  const emoji = BADGE_EMOJI[badge] || '🎭';
  return (
    <div className={`personality-card ${isMe ? 'personality-card--me' : ''}`}>
      <div className="personality-card__avatar" style={{ background: player.color }}>
        {player.animal || player.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="personality-card__body">
        <p className="personality-card__name">
          {player.name}{isMe ? ' (you)' : ''}
        </p>
        <p className="personality-card__badge">
          <span className="personality-card__emoji">{emoji}</span>
          {badge}
        </p>
        <p className="personality-card__desc">{description}</p>
      </div>
    </div>
  );
}

export default function ResultsScreen() {
  const { gameResult, room, playerId, leaveRoom, startGame } = useGame();
  const [openRecap, setOpenRecap] = useState(null);
  const leaderboard = gameResult?.leaderboard || room.players;
  const me = room.players.find((p) => p.id === playerId);
  const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  // Build a lookup map from leaderboard player id → player object
  const playerById = Object.fromEntries(leaderboard.map((p) => [p.id, p]));
  const playerBadges = gameResult?.playerBadges || {};

  return (
    <main className="screen screen-narrow">
      <div className="results-trophy">
        <Trophy size={40} color="#FFC93C" />
      </div>
      <h1 className="results-headline">
        {winner ? (
          <>
            <span className="pencil-underline">{winner.name}</span> wins!
          </>
        ) : (
          'Game over'
        )}
      </h1>
      <p className="home-subline" style={{ marginBottom: 22 }}>
        {room.maxRounds} round{room.maxRounds !== 1 ? 's' : ''},{' '}
        {room.players.length} player{room.players.length !== 1 ? 's' : ''},
        countless questionable sketches.
      </p>

      {/* ── Leaderboard ── */}
      <div className="paper-card results-board">
        {sorted.map((p, i) => (
          <div key={p.id} className={`results-row ${p.id === playerId ? 'is-me' : ''}`}>
            <span className="results-rank">
              {i === 0 ? <Crown size={16} color="#FFC93C" /> : `#${i + 1}`}
            </span>
            <span className="avatar-dot" style={{ background: p.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="results-name">
              {p.name}
              {p.id === playerId ? ' (you)' : ''}
            </span>
            <strong className="results-score">{p.score}</strong>
          </div>
        ))}
      </div>

      {/* ── Personality cards ── */}
      {Object.keys(playerBadges).length > 0 && (
        <section className="paper-card lobby-section personality-section">
          <div className="lobby-section-head">
            <span style={{ fontSize: 15 }}>🎭</span>
            <h3>Player Personalities</h3>
          </div>
          <p className="lobby-hint" style={{ marginTop: -6, marginBottom: 14 }}>
            How did everyone really play?
          </p>
          <div className="personality-grid">
            {sorted.map((p) => {
              const badgeInfo = playerBadges[p.id];
              if (!badgeInfo) return null;
              return (
                <PersonalityCard
                  key={p.id}
                  player={playerById[p.id] || p}
                  badge={badgeInfo.badge}
                  description={badgeInfo.description}
                  isMe={p.id === playerId}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Drawing replays ── */}
      {gameResult?.recaps?.length ? (
        <section className="paper-card lobby-section">
          <div className="lobby-section-head">
            <RotateCcw size={15} />
            <h3>Drawing replays</h3>
          </div>
          <p className="lobby-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            Tap any round to rewatch the drawing as a timelapse.
          </p>
          <div className="recap-grid">
            {gameResult.recaps.map((recap) => (
              <button key={recap.round} className="recap-chip" onClick={() => setOpenRecap(recap)}>
                <span className="recap-round">R{recap.round}</span>
                <span className="recap-word">{recap.word}</span>
                <span className="recap-drawer">by {recap.drawerName}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="results-actions">
        {me?.isHost ? (
          <button className="btn btn-primary btn-block" onClick={startGame}>
            <RotateCcw size={16} /> Play again
          </button>
        ) : (
          <div className="waiting-banner">Waiting for the host to start a new game…</div>
        )}
        <button className="btn btn-ghost btn-block" onClick={leaveRoom}>
          <Home size={16} /> Leave room
        </button>
      </div>

      {openRecap ? (
        <RoundEndOverlay
          info={{ result: { type: 'recap' }, word: openRecap.word, strokes: openRecap.strokes }}
          onDone={() => setOpenRecap(null)}
        />
      ) : null}
    </main>
  );
}