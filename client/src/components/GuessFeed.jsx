import { useEffect, useRef, useState } from 'react';
import { Send, Thermometer } from 'lucide-react';
import { useGame } from '../context/GameContext';

function HeatBar({ heat }) {
  if (heat === null || heat === undefined) return null;
  let label = 'Cold';
  let cls = 'heat-cold';
  if (heat >= 75) {
    label = 'So close!';
    cls = 'heat-hot';
  } else if (heat >= 45) {
    label = 'Warm';
    cls = 'heat-warm';
  } else if (heat >= 20) {
    label = 'Lukewarm';
    cls = 'heat-mild';
  }
  return (
    <div className={`heat-indicator ${cls}`}>
      <Thermometer size={13} />
      <div className="heat-track">
        <div className="heat-fill" style={{ width: `${heat}%` }} />
      </div>
      <span>{label}</span>
    </div>
  );
}

export default function GuessFeed({ isDrawer, canGuess }) {
  const { room, sendGuess, sendChat, heat, playerId } = useGame();
  const [text, setText] = useState('');
  const feedRef = useRef(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [room.guesses]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (isDrawer) {
      sendChat(text.trim());
    } else {
      sendGuess(text.trim());
    }
    setText('');
  };

  return (
    <div className="guess-panel">
      <h3 className="guess-panel-title">{isDrawer ? 'Chat' : 'Guesses'}</h3>

      <div className="guess-feed scroll-fade" ref={feedRef}>
        {room.guesses.length === 0 ? (
          <p className="empty-feed">{isDrawer ? 'Chat will show up here.' : 'No guesses yet — be the first!'}</p>
        ) : (
          room.guesses.map((g) => {
            const guessedRight = room.correctGuessers?.includes(g.playerId);
            return (
              <div
                key={g.id}
                className={`guess-bubble ${guessedRight ? 'is-correct' : ''} ${g.playerId === playerId ? 'is-mine' : ''}`}
              >
                <span className="guess-author" style={{ color: g.color }}>
                  {g.playerName}
                </span>
                <span className="guess-text">{guessedRight ? 'guessed the word!' : g.text}</span>
              </div>
            );
          })
        )}
      </div>

      {!isDrawer && heat !== null ? <HeatBar heat={heat} /> : null}

      <form className="guess-input-row" onSubmit={submit}>
        <input
          className="input-field"
          placeholder={isDrawer ? 'Say something...' : canGuess ? 'Type your guess...' : 'Guessing closed'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!isDrawer && !canGuess}
          maxLength={60}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!isDrawer && !canGuess}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
