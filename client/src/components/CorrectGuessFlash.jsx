import { Flame, Zap } from 'lucide-react';

export default function CorrectGuessFlash({ payload }) {
  if (!payload) return null;
  const { playerName, color, pointsAwarded, streak } = payload;

  return (
    <div className="correct-flash" key={`${playerName}-${pointsAwarded}-${Date.now()}`}>
      <Zap size={14} />
      <span style={{ color }}>{playerName}</span>
      <span>+{pointsAwarded}</span>
      {streak > 1 ? (
        <span className="flash-streak">
          <Flame size={12} /> {streak}x streak
        </span>
      ) : null}
    </div>
  );
}
