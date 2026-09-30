"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { MarkEyes, TabbitMark } from "@/components/brand";

// Mascote com olhos que seguem o cursor e piscam de vez em quando.
export function LiveMark({ className, id = "live-mark" }: { className?: string; id?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 14 });
  const sy = useSpring(y, { stiffness: 120, damping: 14 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth - 0.5) * 44);
      y.set((e.clientY / window.innerHeight - 0.5) * 36);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y]);

  return (
    <TabbitMark
      id={id}
      className={className}
      eyes={
        <motion.g style={{ x: sx, y: sy }}>
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            animate={{ scaleY: [1, 1, 0.08, 1, 1, 0.08, 1] }}
            transition={{ duration: 5.2, times: [0, 0.8, 0.83, 0.86, 0.9, 0.93, 0.96], repeat: Infinity, repeatDelay: 1.5 }}
          >
            <MarkEyes />
          </motion.g>
        </motion.g>
      }
    />
  );
}
