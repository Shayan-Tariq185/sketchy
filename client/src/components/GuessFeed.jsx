import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useGame } from '../context/GameContext';

// Heat level config
const HEAT_LEVELS = [
  { min: 75, label: 'So close! 🚨', cls: 'heat-hot' },
  { min: 45, label: 'Warm 🔥', cls: 'heat-warm' },
  { min: 20, label: 'Lukewarm 🌤️', cls: 'heat-mild' },
  { min: 0,  label: 'Cold 🥶', cls: 'heat-cold' }
];

function getHeatLevel(heat) {
  return HEAT_LEVELS.find((l) => heat >= l.min) || HEAT_LEVELS[HEAT_LEVELS.length - 1];
}

function HeatBar({ heat }) {
  if (heat === null || heat === undefined) return null;
  const level = getHeatLevel(heat);

  return (
    <div className={`heat-indicator ${level.cls}`}>
      <div className="heat-label">{level.label}</div>
      <div className="heat-track">
        <div className="heat-fill" style={{ width: `${heat}%` }} />
      </div>
      <span className="heat-pct">{heat}%</span>
    </div>
  );
}

export default function GuessFeed({ isDrawer, canGuess }) {
  const { room, sendGuess, sendChat, heat, playerId } = useGame();
  const [text, setText] = useState('');
  const feedRef = useRef(null);

  // Has this player already guessed correctly?
  const alreadyGuessed = !isDrawer && room.correctGuessers?.includes(playerId);
  const inputEnabled = isDrawer || (canGuess && !alreadyGuessed);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [room.guesses]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || !inputEnabled) return;
    if (isDrawer) {
      sendChat(text.trim());
    } else {
      sendGuess(text.trim());
    }
    setText('');
  };

  // Determine panel glow class based on heat
  let panelHeatClass = '';
  if (!isDrawer && heat !== null && heat !== undefined) {
    if (heat >= 75) panelHeatClass = 'panel-heat-hot';
    else if (heat >= 45) panelHeatClass = 'panel-heat-warm';
    else if (heat >= 20) panelHeatClass = 'panel-heat-mild';
  }

  const placeholder = isDrawer
    ? room.status === 'drawing'
      ? 'Chat costs −20 pts while drawing…'
      : 'Say something...'
    : alreadyGuessed
    ? '🎉 You guessed it!'
    : canGuess
    ? 'Type your guess…'
    : 'Guessing closed';

  return (
    <div className={`guess-panel ${panelHeatClass}`}>
      <h3 className="guess-panel-title">{isDrawer ? '💬 Chat' : '🎯 Guesses'}</h3>

      <div className="guess-feed scroll-fade" ref={feedRef}>
        {room.guesses.length === 0 ? (
          <p className="empty-feed">{isDrawer ? 'Chat will show up here.' : 'No guesses yet — be the first!'}</p>
        ) : (
          room.guesses.map((g) => {
            const guessedRight = g.correct;
            return (
              <div
                key={g.id}
                className={`guess-bubble ${guessedRight ? 'is-correct' : ''} ${g.playerId === playerId ? 'is-mine' : ''}`}
              >
                <span className="guess-animal">{g.animal || ''}</span>
                <span className="guess-author" style={{ color: g.color }}>
                  {g.playerName}
                </span>
                <span className="guess-text">
                  {guessedRight ? '🎉 guessed the word!' : g.text}
                  {g.drawerPenalty ? ` (−${g.drawerPenalty} drawer pts)` : ''}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!isDrawer && heat !== null ? <HeatBar heat={heat} /> : null}

      <form className="guess-input-row" onSubmit={submit}>
        <input
          className="input-field"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!inputEnabled}
          maxLength={60}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!inputEnabled}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
