import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { useGame } from '../context/GameContext';

export default function PredictionOverlay() {
  const { room, sendPrediction } = useGame();
  const [secondsLeft, setSecondsLeft] = useState(6);

  useEffect(() => {
    setSecondsLeft(6);
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const totalGuessers = room.players.filter((p) => p.connected).length - 1;
  const maxPrediction = Math.max(1, totalGuessers);
  const options = Array.from({ length: maxPrediction + 1 }, (_, i) => i);

  return (
    <div className="overlay-scrim">
      <div className="wobble-card word-choice-card">
        <div className="wobble-card-inner">
          <span className="eyebrow">
            <Target size={13} /> Bonus Prediction
          </span>
          <p className="round-end-word" style={{ fontSize: 18, marginTop: 14, marginBottom: 8 }}>
            How many players will guess correctly?
          </p>
          <p className="word-choice-timer">Skipping in {secondsLeft}s</p>
          <div className="word-choice-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {options.map((num) => (
              <button
                key={num}
                className="word-choice-btn"
                style={{ padding: '12px 18px' }}
                onClick={() => sendPrediction(num)}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
