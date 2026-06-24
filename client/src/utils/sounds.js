/**
 * sounds.js — All game audio, synthesised via Web Audio API.
 * Uses proper ADSR envelopes and gentle waveforms to avoid distortion.
 */

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
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

/**
 * Low-level tone builder with proper ADSR envelope.
 * attack/decay/sustain/release in seconds, sustainLevel 0-1.
 */
function tone({
  frequency,
  type = 'sine',
  volume = 0.12,
  attack = 0.01,
  decay = 0.08,
  sustainLevel = 0.6,
  release = 0.15,
  when = 0,
  filterFreq = null,
}) {
  const ctx = getCtx();
  if (!ctx) return;

  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);

  // ADSR
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.linearRampToValueAtTime(volume * sustainLevel, start + attack + decay);
  gain.gain.setValueAtTime(volume * sustainLevel, start + attack + decay);
  gain.gain.linearRampToValueAtTime(0, start + attack + decay + release);

  let node = gain;

  // Optional low-pass to soften harsh waveforms
  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    gain.connect(filter);
    filter.connect(ctx.destination);
    node = null; // already connected
  }

  osc.connect(gain);
  if (node) gain.connect(ctx.destination);

  const totalDuration = attack + decay + release + 0.05;
  osc.start(start);
  osc.stop(start + totalDuration);
}

/**
 * Soft metronome tick for the final 10 seconds.
 * urgent = last 5 seconds → slightly higher pitch.
 */
export function playTimerTick(urgent = false) {
  unlockAudio();
  tone({
    frequency: urgent ? 660 : 520,
    type: 'sine',
    volume: urgent ? 0.13 : 0.09,
    attack: 0.005,
    decay: 0.04,
    sustainLevel: 0.2,
    release: 0.08,
    filterFreq: 2200,
  });
}

/**
 * Cheerful ascending fanfare when the game ends.
 * Four notes in a major arpeggio, soft triangle wave.
 */
export function playVictoryFanfare() {
  unlockAudio();
  const melody = [
    { freq: 523.25, when: 0 },      // C5
    { freq: 659.25, when: 0.14 },   // E5
    { freq: 783.99, when: 0.28 },   // G5
    { freq: 1046.5, when: 0.42 },   // C6
    { freq: 1318.5, when: 0.60 },   // E6 (high finish)
  ];
  melody.forEach(({ freq, when }) => {
    tone({
      frequency: freq,
      type: 'triangle',
      volume: 0.10,
      attack: 0.02,
      decay: 0.1,
      sustainLevel: 0.7,
      release: 0.25,
      when,
      filterFreq: 4000,
    });
  });
}

/**
 * Short pleasant chime when a player guesses correctly.
 */
export function playCorrectGuess() {
  unlockAudio();
  tone({ frequency: 880,  type: 'sine', volume: 0.10, attack: 0.01, decay: 0.06, sustainLevel: 0.5, release: 0.18, when: 0 });
  tone({ frequency: 1108, type: 'sine', volume: 0.07, attack: 0.02, decay: 0.06, sustainLevel: 0.4, release: 0.18, when: 0.07 });
}

/**
 * Gentle thud when a new drawing turn starts.
 */
export function playRoundStart() {
  unlockAudio();
  tone({ frequency: 330, type: 'triangle', volume: 0.09, attack: 0.01, decay: 0.12, sustainLevel: 0.3, release: 0.12, when: 0 });
  tone({ frequency: 440, type: 'triangle', volume: 0.07, attack: 0.02, decay: 0.10, sustainLevel: 0.3, release: 0.12, when: 0.1 });
}