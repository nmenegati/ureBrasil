'use client';
import { cn } from '@/lib/utils';
import { motion, Transition, useReducedMotion } from 'framer-motion';

type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  delay?: number;
  initialOffset?: number;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
};

export function BorderTrail({
  className,
  size = 60,
  transition,
  delay,
  initialOffset = 0,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const reduce = useReducedMotion();
  const BASE_TRANSITION = {
    repeat: Infinity,
    duration: 5,
    ease: 'linear',
  };

  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className={cn('absolute aspect-square bg-zinc-500', className)}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        initial={{
          offsetDistance: `${initialOffset}%`,
        }}
        animate={reduce ? { offsetDistance: `${initialOffset}%` } : { offsetDistance: ['0%', '100%'] }}
        transition={
          reduce
            ? undefined
            : {
                ...(transition ?? BASE_TRANSITION),
                delay: delay,
              }
        }
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}
