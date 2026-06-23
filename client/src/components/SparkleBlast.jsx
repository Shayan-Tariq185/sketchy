import { useEffect, useRef } from 'react';

// Generates N confetti particles with random positions, colors, sizes and delays
const COLORS = ['#FF5D5D', '#FFC93C', '#3DDC97', '#4D6BFE', '#B26BFF', '#FF8FB1', '#33C9C9', '#FF9F4D'];
const SHAPES = ['✦', '★', '✿', '◆', '●', '▲', '✸'];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function SparkleBlast({
  burstKey,
  active,
  particleCount = 48,
  cleanupMs = 2400,
  fallDurationMin = 0.8,
  fallDurationMax = 1.8
}) {
  const containerRef = useRef(null);
  const trigger = burstKey ?? (active ? 'on' : null);

  useEffect(() => {
    if (!trigger || !containerRef.current) return;
    const el = containerRef.current;
    // Clear previous particles
    el.innerHTML = '';

    const count = particleCount;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = 'sparkle-particle';
      particle.textContent = SHAPES[Math.floor(Math.random() * SHAPES.length)];

      const startX = randomBetween(10, 90); // vw %
      const endX = startX + randomBetween(-20, 20);
      const duration = randomBetween(fallDurationMin, fallDurationMax);
      const delay = randomBetween(0, 0.4);
      const size = randomBetween(14, 28);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const endY = randomBetween(55, 105); // vh %

      particle.style.cssText = `
        left: ${startX}vw;
        top: -20px;
        font-size: ${size}px;
        color: ${color};
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
        --end-x: ${endX}vw;
        --end-y: ${endY}vh;
      `;
      el.appendChild(particle);
    }

    // Clean up after longest animation
    const timer = setTimeout(() => {
      if (el) el.innerHTML = '';
    }, cleanupMs);
    return () => clearTimeout(timer);
  }, [trigger, particleCount, cleanupMs, fallDurationMin, fallDurationMax]);

  return <div className="sparkle-container" ref={containerRef} aria-hidden="true" />;
}
