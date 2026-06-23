import { useEffect, useRef } from 'react';
import { playTimerTick } from '../utils/sounds';

/** Plays a tick each second while the round timer is in its final stretch. */
export function useTimerSounds(timeLeft, isActive) {
  const lastSecondRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      lastSecondRef.current = null;
      return;
    }

    const second = Math.ceil(timeLeft);
    if (second > 10 || second <= 0) {
      if (second <= 0) lastSecondRef.current = null;
      return;
    }
    if (lastSecondRef.current === second) return;

    lastSecondRef.current = second;
    playTimerTick(second <= 5);
  }, [timeLeft, isActive]);
}
