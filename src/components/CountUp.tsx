import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

/** Animates a number from its previous value to `value` with anime.js; instant under reduced motion. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.current = value;
      el.textContent = format(value);
      return;
    }
    const state = { n: shown.current };
    const anim = animate(state, {
      n: value,
      duration: 900,
      ease: 'outExpo',
      onUpdate: () => {
        shown.current = state.n;
        el.textContent = format(Math.round(state.n));
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = format(value);
      },
    });
    return () => {
      anim.pause();
    };
  }, [value, format]);

  return <span ref={ref}>{format(value)}</span>;
}
