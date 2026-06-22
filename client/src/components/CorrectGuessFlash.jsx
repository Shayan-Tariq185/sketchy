import { Flame, Zap } from 'lucide-react';
import SparkleBlast from './SparkleBlast';

export default function CorrectGuessFlash({ payload }) {
  if (!payload) return null;
  const { playerName, color, pointsAwarded, streak, animal } = payload;

  return (
    <>
      {/* Confetti burst from top */}
      <SparkleBlast active={!!payload} />

      {/* Bottom banner */}
      <div className="correct-flash" key={`${playerName}-${pointsAwarded}-${Date.now()}`}>
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
