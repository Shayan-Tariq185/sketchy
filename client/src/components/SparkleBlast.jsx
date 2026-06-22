import { useEffect, useRef } from 'react';

// Generates N confetti particles with random positions, colors, sizes and delays
const COLORS = ['#FF5D5D', '#FFC93C', '#3DDC97', '#4D6BFE', '#B26BFF', '#FF8FB1', '#33C9C9', '#FF9F4D'];
const SHAPES = ['✦', '★', '✿', '◆', '●', '▲', '✸'];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function SparkleBlast({ active }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    // Clear previous particles
    el.innerHTML = '';

    const count = 48;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = 'sparkle-particle';
      particle.textContent = SHAPES[Math.floor(Math.random() * SHAPES.length)];

      const startX = randomBetween(10, 90); // vw %
      const endX = startX + randomBetween(-20, 20);
      const duration = randomBetween(0.8, 1.8);
      const delay = randomBetween(0, 0.4);
      const size = randomBetween(14, 28);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const endY = randomBetween(40, 90); // vh %

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
    }, 2400);
    return () => clearTimeout(timer);
  }, [active]);

  return <div className="sparkle-container" ref={containerRef} aria-hidden="true" />;
}
