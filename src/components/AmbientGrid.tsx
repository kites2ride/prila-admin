import { useReducedMotion } from 'motion/react';
import { AnimatedGridPattern } from './fx/AnimatedGridPattern';

/** Very faint animated grid fading out under the page header. Decorative; skipped under reduced motion. */
export function AmbientGrid() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
    >
      <AnimatedGridPattern
        numSquares={10}
        maxOpacity={0.07}
        duration={6}
        width={44}
        height={44}
        className="!fill-slate-500/20 !stroke-slate-400/15"
      />
    </div>
  );
}
