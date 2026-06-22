import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Trophy } from 'lucide-react';

function ReplayCanvas({ strokes }) {
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    if (!strokes?.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    let strokeIndex = 0;
    let pointIndex = 0;
    setPlaying(true);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pointsPerFrame = Math.max(1, Math.floor(strokes.reduce((s, st) => s + st.points.length, 0) / 90));

    function step() {
      let budget = pointsPerFrame;
      while (budget > 0 && strokeIndex < strokes.length) {
        const stroke = strokes[strokeIndex];
        const pts = stroke.points;
        if (pointIndex === 0) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          pointIndex = 1;
        }
        while (budget > 0 && pointIndex < pts.length) {
          ctx.lineTo(pts[pointIndex].x, pts[pointIndex].y);
          pointIndex++;
          budget--;
        }
        ctx.stroke();
        if (pointIndex >= pts.length) {
          strokeIndex++;
          pointIndex = 0;
        }
      }

      if (strokeIndex < strokes.length) {
        raf = requestAnimationFrame(step);
      } else {
        setPlaying(false);
      }
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [strokes, playKey]);

  const replay = () => setPlayKey((k) => k + 1);

  if (!strokes?.length) {
    return <div className="replay-empty">No drawing was captured for this round.</div>;
  }

  return (
    <div className="replay-wrap">
      <canvas ref={canvasRef} width={1280} height={800} className="replay-canvas" />
      {!playing ? (
        <button className="btn btn-sm btn-ghost replay-replay-btn" onClick={replay}>
          <RotateCcw size={13} /> Watch again
        </button>
      ) : (
        <span className="replay-playing-badge">
          <Play size={11} /> Replaying timelapse
        </span>
      )}
    </div>
  );
}

export default function RoundEndOverlay({ info, onDone }) {
  if (!info) return null;
  const { result, word, strokes } = info;

  const headline =
    result?.type === 'all-correct'
      ? 'Everyone got it!'
      : result?.type === 'timeout'
      ? "Time's up!"
      : 'Round over';

  return (
    <div className="overlay-scrim">
      <div className="wobble-card round-end-card">
        <div className="wobble-card-inner">
          <span className="eyebrow">
            <Trophy size={13} /> {headline}
          </span>
          <h2 className="round-end-word">
            The word was <span className="pencil-underline">{word}</span>
          </h2>

          <ReplayCanvas strokes={strokes} key={JSON.stringify(strokes).length} />

          {result?.type !== 'recap' ? <p className="round-end-note">Next round starting shortly…</p> : (
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 14 }} onClick={onDone}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
