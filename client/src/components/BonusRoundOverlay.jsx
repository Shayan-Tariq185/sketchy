import { useEffect, useRef, useState } from 'react';
import { Check, Send, Users } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useBonusCanvas } from '../hooks/useBonusCanvas';

const COLORS = ['#1a1a2e', '#FF5D5D', '#3DDC97', '#FFC93C', '#4D6BFE', '#B26BFF'];

function MiniReplay({ strokes, width = 320, height = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes?.length) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const scaleX = width / 1280;
    const scaleY = height / 800;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    for (const stroke of strokes) {
      if (!stroke?.points?.length) continue;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      if (stroke.points.length === 1) {
        const [p] = stroke.points;
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }, [strokes, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="bonus-mini-canvas" />;
}

function BonusDrawingPhase({ room, bonusWord, timeLeft }) {
  const canvas = useBonusCanvas({ roomCode: room.code, enabled: room.status === 'bonus-drawing' });
  const submittedCount = room.bonusSubmittedCount || 0;
  const total = room.bonusTotalPlayers || room.players.length;

  return (
    <div className="bonus-phase">
      <span className="eyebrow">🎁 Bonus round — everyone draws!</span>
      <h2 className="bonus-headline">
        Draw: <span className="pencil-underline">{bonusWord}</span>
      </h2>
      <p className="bonus-subline">
        Same word, secret sketches. Then guess who drew what!{' '}
        <strong>{timeLeft}s</strong> left · {submittedCount}/{total} submitted
      </p>

      <div className="bonus-canvas-wrap">
        <canvas
          ref={canvas.canvasRef}
          width={canvas.CANVAS_W}
          height={canvas.CANVAS_H}
          className="draw-canvas bonus-canvas"
          onPointerDown={canvas.beginStroke}
          onPointerMove={canvas.continueStroke}
          onPointerUp={canvas.endStroke}
          onPointerLeave={canvas.endStroke}
        />
      </div>

      <div className="bonus-toolbar">
        <div className="color-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${canvas.color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => canvas.setColor(c)}
            />
          ))}
        </div>
        <input
          type="range"
          min="2"
          max="18"
          value={canvas.size}
          onChange={(e) => canvas.setSize(Number(e.target.value))}
        />
        <button
          className="btn btn-primary"
          type="button"
          disabled={canvas.submitted}
          onClick={canvas.submitDrawing}
        >
          {canvas.submitted ? <><Check size={15} /> Submitted</> : <><Send size={15} /> Submit drawing</>}
        </button>
      </div>
    </div>
  );
}

function BonusGuessingPhase({ room, timeLeft, playerId, onSubmit }) {
  const drawings = room.bonusDrawings || [];
  const [assignments, setAssignments] = useState({});
  const [busy, setBusy] = useState(false);

  // Drawings where isOwn === true are shown but can't be voted on
  const votableDrawings = drawings.filter((d) => !d.isOwn);
  const ownDrawing = drawings.find((d) => d.isOwn);

  // Rule: each player name can only be assigned once across all votable drawings
  const usedPlayerIds = new Set(Object.values(assignments).filter(Boolean));

  const allFilled = votableDrawings.every((d) => assignments[d.anonId]);

  const handleAssign = (anonId, newPlayerId) => {
    setAssignments((prev) => {
      const next = { ...prev };
      // Clear any other drawing that had this player assigned
      for (const [aid, pid] of Object.entries(next)) {
        if (pid === newPlayerId && aid !== anonId) delete next[aid];
      }
      if (newPlayerId) next[anonId] = newPlayerId;
      else delete next[anonId];
      return next;
    });
  };

  const handleSubmit = () => {
    if (!allFilled || busy) return;
    setBusy(true);
    onSubmit(assignments);
  };

  // Per drawing: eligible players = not yourself, not already assigned elsewhere
  const eligibleFor = (anonId) => {
    const currentForThis = assignments[anonId];
    return room.players.filter((p) => {
      if (p.id === playerId) return false;
      if (usedPlayerIds.has(p.id) && p.id !== currentForThis) return false;
      return true;
    });
  };

  return (
    <div className="bonus-phase">
      <span className="eyebrow">🕵️ Who drew what?</span>
      <h2 className="bonus-headline">Match each sketch to its artist</h2>
      <p className="bonus-subline">
        <strong>{timeLeft}s</strong> left · {room.bonusGuessesSubmittedCount || 0}/{room.bonusTotalPlayers} voted
      </p>
      <p className="bonus-rules-note">
        💡 Each player can only be assigned once. You can see your own drawing but can't vote on it.
      </p>

      {/* Own drawing shown at top, greyed out */}
      {ownDrawing && (
        <div className="bonus-own-drawing">
          <span className="bonus-drawing-label">Your drawing ✏️</span>
          <MiniReplay strokes={ownDrawing.strokes} />
        </div>
      )}

      <div className="bonus-guess-grid">
        {votableDrawings.map((d) => (
          <div key={d.anonId} className="bonus-guess-card paper-card">
            <span className="bonus-drawing-label">Drawing {d.label}</span>
            <MiniReplay strokes={d.strokes} />
            <select
              className="input-field"
              value={assignments[d.anonId] || ''}
              onChange={(e) => handleAssign(d.anonId, e.target.value)}
            >
              <option value="">Who drew this?</option>
              {eligibleFor(d.anonId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary btn-block"
        type="button"
        disabled={!allFilled || busy}
        onClick={handleSubmit}
      >
        <Users size={16} /> Lock in my guesses
      </button>
    </div>
  );
}

function BonusResultsPhase({ bonusResults, bonusWord, playerId }) {
  const me = bonusResults?.results?.find((r) => r.voterId === playerId);

  return (
    <div className="bonus-phase">
      <span className="eyebrow">🎉 Bonus round results</span>
      <h2 className="bonus-headline">
        The word was <span className="pencil-underline">{bonusWord}</span>
      </h2>
      {me ? (
        <p className="bonus-subline">
          You matched <strong>{me.correct}</strong> of {me.total} artists — <strong>+{me.points}</strong> pts!
        </p>
      ) : null}

      <div className="bonus-reveal-grid">
        {(bonusResults?.reveal || []).map((item) => (
          <div key={item.anonId} className="bonus-reveal-card paper-card">
            <span className="bonus-drawing-label">{item.label} → {item.playerName}</span>
            <MiniReplay strokes={item.strokes} />
          </div>
        ))}
      </div>
      <p className="round-end-note">Final scores loading…</p>
    </div>
  );
}

export default function BonusRoundOverlay() {
  const { room, playerId, bonusWord, bonusResults, submitBonusGuess } = useGame();
  const timeLeft = room.bonusTimeLeft ?? 0;

  if (!room.status?.startsWith('bonus')) return null;

  return (
    <div className="overlay-scrim bonus-overlay">
      <div className="wobble-card round-end-card bonus-card">
        <div className="wobble-card-inner">
          {room.status === 'bonus-drawing' ? (
            <BonusDrawingPhase room={room} bonusWord={bonusWord || room.bonusWord} timeLeft={timeLeft} />
          ) : null}
          {room.status === 'bonus-guessing' ? (
            <BonusGuessingPhase room={room} timeLeft={timeLeft} playerId={playerId} onSubmit={submitBonusGuess} />
          ) : null}
          {room.status === 'bonus-results' && bonusResults ? (
            <BonusResultsPhase bonusResults={bonusResults} bonusWord={bonusResults.word} playerId={playerId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}