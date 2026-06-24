import { memo } from 'react';
import { Flame, Zap } from 'lucide-react';
import SparkleBlast from './SparkleBlast';

function CorrectGuessFlash({ payload }) {
  if (!payload) return null;
  const { playerName, color, pointsAwarded, streak, animal, guessId, playerId } = payload;
  const flashKey = guessId || `${playerId}-${pointsAwarded}`;

  return (
    <>
      {/* Confetti burst from top */}
      <SparkleBlast burstKey={flashKey} />

      {/* Bottom banner — stable key so timer re-renders don't restart the animation */}
      <div className="correct-flash" key={flashKey}>
        <span className="flash-animal">{animal || '🎉'}</span>
        <Zap size={14} />
        <span style={{ color }}>{playerName}</span>
        <span>guessed it!</span>
        <span className="flash-points">+{pointsAwarded}</span>
        {streak > 1 ? (
          <span className="flash-streak">
            <Flame size={12} /> {streak}x streak
          </span>
        ) : null}
      </div>
    </>
  );
}

export default memo(CorrectGuessFlash);