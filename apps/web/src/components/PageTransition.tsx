import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

/** Shared easing for every page/stagger transition (cubic-bezier). */
export const EASE = [0.25, 0.1, 0.25, 1] as const;

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE } },
};

/**
 * Fades/slides the route content in and fades it out. Only the content area is
 * wrapped — the sidebar and top bar live outside it and never re-animate.
 * Under prefers-reduced-motion it renders a plain wrapper (no motion).
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;
  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit">
      {children}
    </motion.div>
  );
}

/**
 * Slim 2px accent progress bar pinned to the top of the content area — shown as
 * the Suspense fallback while a lazy route chunk loads, instead of a blank flash
 * or spinner. Its parent (<main>) is positioned so it spans the content width.
 */
export function RouteProgress() {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" role="progressbar" aria-label="Loading">
      <motion.div
        className="h-full bg-app-accent"
        initial={{ width: reduce ? '100%' : '10%' }}
        animate={{ width: reduce ? '100%' : '90%' }}
        transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut' }}
      />
    </div>
  );
}
