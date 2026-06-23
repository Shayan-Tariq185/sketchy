let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getCtx();
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function tone({ frequency, duration = 0.12, volume = 0.07, type = 'sine', when = 0 }) {
  const ctx = getCtx();
  if (!ctx) return;

  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Short tick during the final seconds of a round. */
export function playTimerTick(urgent = false) {
  unlockAudio();
  tone({
    frequency: urgent ? 920 : 740,
    duration: urgent ? 0.1 : 0.08,
    volume: urgent ? 0.09 : 0.06,
    type: urgent ? 'square' : 'sine'
  });
}

/** Cheerful fanfare when the match ends with a winner. */
export function playVictoryFanfare() {
  unlockAudio();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    tone({ frequency: freq, duration: 0.22, volume: 0.08, type: 'triangle', when: i * 0.12 });
  });
  tone({ frequency: 1318.5, duration: 0.35, volume: 0.06, type: 'sine', when: 0.5 });
}
