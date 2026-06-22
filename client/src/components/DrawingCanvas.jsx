import { useEffect } from 'react';
import { Eraser, Paintbrush, RotateCcw, Trash2 } from 'lucide-react';

const PALETTE = [
  '#1a1a2e', '#ffffff', '#ff5d5d', '#ffc93c', '#3ddc97',
  '#4d6bfe', '#b26bff', '#ff8fb1', '#33c9c9', '#ff9f4d'
];

const BRUSH_SIZES = [3, 6, 12, 22];

export default function DrawingCanvas({ canvasState, canDraw, resetKey }) {
  const {
    canvasRef,
    color,
    setColor,
    size,
    setSize,
    isEraser,
    setIsEraser,
    beginStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    undo,
    resetLocalCanvas,
    CANVAS_W,
    CANVAS_H
  } = canvasState;

  useEffect(() => {
    resetLocalCanvas();
  }, [resetKey, resetLocalCanvas]);

  return (
    <div className="canvas-panel">
      {canDraw ? (
        <div className="toolbar">
          <div className="palette-row">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`color-dot ${color === c && !isEraser ? 'active' : ''}`}
                style={{ background: c, borderColor: c === '#ffffff' ? '#d9d2bf' : '#1a1a2e' }}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          <div className="toolbar-divider" />

          <div className="brush-row">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                className={`brush-dot ${size === s ? 'active' : ''}`}
                onClick={() => setSize(s)}
                aria-label={`Brush size ${s}`}
              >
                <span style={{ width: s, height: s }} />
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-actions">
            <button
              className={`tool-btn ${isEraser ? 'active' : ''}`}
              onClick={() => setIsEraser((v) => !v)}
              title="Eraser"
            >
              <Eraser size={16} />
            </button>
            <button className="tool-btn" onClick={undo} title="Undo last stroke">
              <RotateCcw size={16} />
            </button>
            <button className="tool-btn tool-btn-danger" onClick={clearCanvas} title="Clear canvas">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="toolbar toolbar-locked">
          <Paintbrush size={14} /> Watching the drawer — grab your guesses ready!
        </div>
      )}

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={canDraw ? 'draw-canvas drawable' : 'draw-canvas'}
          onMouseDown={beginStroke}
          onMouseMove={continueStroke}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={beginStroke}
          onTouchMove={continueStroke}
          onTouchEnd={endStroke}
        />
      </div>
    </div>
  );
}
