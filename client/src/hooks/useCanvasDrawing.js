import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket';

const CANVAS_W = 1280;
const CANVAS_H = 800;

// Renders one stroke object {points, color, size} onto a canvas context.
function paintStroke(ctx, stroke) {
  if (!stroke?.points?.length) return;
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
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

export function useCanvasDrawing({ roomCode, canDraw }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const allStrokesRef = useRef([]);

  const [color, setColor] = useState('#1a1a2e');
  const [size, setSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of allStrokesRef.current) paintStroke(ctx, stroke);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    function onStroke(stroke) {
      allStrokesRef.current.push(stroke);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) paintStroke(ctx, stroke);
    }
    function onClear() {
      allStrokesRef.current = [];
      redrawAll();
    }
    function onBulk({ strokes }) {
      allStrokesRef.current = strokes || [];
      redrawAll();
    }

    socket.on('canvas:stroke', onStroke);
    socket.on('canvas:clear', onClear);
    socket.on('canvas:bulk', onBulk);
    return () => {
      socket.off('canvas:stroke', onStroke);
      socket.off('canvas:clear', onClear);
      socket.off('canvas:bulk', onBulk);
    };
  }, [redrawAll]);

  // Reset local stroke cache whenever a fresh round starts drawing
  const resetLocalCanvas = useCallback(() => {
    allStrokesRef.current = [];
    redrawAll();
  }, [redrawAll]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return {
      x: ((clientX - rect.left) * (canvas.width / rect.width)) | 0,
      y: ((clientY - rect.top) * (canvas.height / rect.height)) | 0
    };
  };

  const beginStroke = (event) => {
    if (!canDraw) return;
    event.preventDefault();
    const point = getPoint(event);
    isDrawingRef.current = true;
    const strokeColor = isEraser ? '#ffffff' : color;
    const strokeSize = isEraser ? size * 2.4 : size;
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    currentStrokeRef.current = {
      strokeId,
      points: [point],
      color: strokeColor,
      size: strokeSize
    };

    const dotSegment = { strokeId, points: [point], color: strokeColor, size: strokeSize };
    allStrokesRef.current.push(dotSegment);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) paintStroke(ctx, dotSegment);

    socket.emit('canvas:stroke', { code: roomCode, stroke: dotSegment });
  };

  const continueStroke = (event) => {
    if (!canDraw || !isDrawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    const stroke = currentStrokeRef.current;
    stroke.points.push(point);

    const ctx = canvasRef.current.getContext('2d');
    const pts = stroke.points;

    if (pts.length >= 2) {
      const segment = {
        strokeId: stroke.strokeId,
        points: pts.slice(-2),
        color: stroke.color,
        size: stroke.size
      };
      paintStroke(ctx, segment);

      allStrokesRef.current.push(segment);
      socket.emit('canvas:stroke', { code: roomCode, stroke: segment });
    }
  };

  const endStroke = () => {
    if (!canDraw || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
    // No emit needed here anymore — every segment was already streamed
    // live during continueStroke (and the initial dot during beginStroke).
  };

  const clearCanvas = () => {
    allStrokesRef.current = [];
    redrawAll();
    socket.emit('canvas:clear', { code: roomCode });
  };

  const undo = () => {
    socket.emit('canvas:undo', { code: roomCode });
  };

  return {
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
  };
}
