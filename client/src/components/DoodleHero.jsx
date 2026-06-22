import { useEffect, useRef } from 'react';

// A handful of simple line paths that get "drawn" stroke by stroke on loop,
// like a flipbook of doodles. Pure canvas + requestAnimationFrame, no deps.
const DOODLES = [
  // house
  [
    [40, 140], [40, 90], [90, 50], [140, 90], [140, 140], [40, 140]
  ],
  [
    [60, 140], [60, 105], [85, 105], [85, 140]
  ],
  // sun
  [
    [200, 60], [200, 60]
  ],
  // cat face (rough)
  [
    [230, 130], [225, 100], [240, 110], [255, 100], [250, 130], [230, 130]
  ],
  [
    [237, 118], [237, 118]
  ],
  [
    [245, 118], [245, 118]
  ]
];

function buildPath(points) {
  // resample with constant point density for a steady "drawing speed" feel
  if (points.length < 2) return points;
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const steps = 24;
    for (let s = 0; s <= steps; s++) {
      out.push([x1 + ((x2 - x1) * s) / steps, y1 + ((y2 - y1) * s) / steps]);
    }
  }
  return out;
}

export default function DoodleHero() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 300;
    const H = 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const allPaths = DOODLES.map(buildPath);
    const totalPoints = allPaths.reduce((sum, p) => sum + p.length, 0);

    let frame = 0;
    let raf;
    const speed = 2.6; // points revealed per frame

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let remaining = frame;
      for (const path of allPaths) {
        if (remaining <= 0) break;
        const count = Math.min(path.length, Math.floor(remaining));
        remaining -= path.length;
        if (count < 2) continue;
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < count; i++) ctx.lineTo(path[i][0], path[i][1]);
        ctx.stroke();
      }

      // sun fill (drawn as a special-case circle once its "path" index is reached)
      const sunStart = allPaths[0].length + allPaths[1].length;
      if (frame > sunStart + 5) {
        const reveal = Math.min(1, (frame - sunStart) / 40);
        ctx.beginPath();
        ctx.arc(200, 60, 18 * reveal, 0, Math.PI * 2);
        ctx.fillStyle = '#FFC93C';
        ctx.fill();
        ctx.stroke();
      }

      // cat eyes as dots once reached
      const eyesStart = allPaths.slice(0, 4).reduce((s, p) => s + p.length, 0);
      if (frame > eyesStart) {
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(237, 118, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (frame > eyesStart + 10) {
        ctx.beginPath();
        ctx.arc(245, 118, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      frame += speed;
      if (frame > totalPoints + 60) {
        frame = 0; // loop
      }
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="doodle-hero-canvas" aria-hidden="true" />;
}
