import { useEffect, useState } from 'react';
import { PencilLine } from 'lucide-react';

export default function WordChoiceOverlay({ choices, onChoose }) {
  const [secondsLeft, setSecondsLeft] = useState(12);

  useEffect(() => {
    setSecondsLeft(12);
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [choices]);

  if (!choices?.length) return null;

  return (
    <div className="overlay-scrim">
      <div className="wobble-card word-choice-card">
        <div className="wobble-card-inner">
          <span className="eyebrow">
            <PencilLine size={13} /> Your turn to draw — pick a word
          </span>
          <p className="word-choice-timer">Auto-picking in {secondsLeft}s</p>
          <div className="word-choice-grid">
            {choices.map((word) => (
              <button key={word} className="word-choice-btn" onClick={() => onChoose(word)}>
                {word}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
