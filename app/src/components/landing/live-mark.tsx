"use client";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { MarkEyes, TabbitMark } from "@/components/brand";

// Mascote com olhos que seguem o cursor e piscam de vez em quando.
export function LiveMark({ className, id = "live-mark" }: { className?: string; id?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const ref = useRef<SVGSVGElement>(null);
  const sx = useSpring(x, { stiffness: 380, damping: 24 });
  const sy = useSpring(y, { stiffness: 380, damping: 24 });

  useEffect(() => {
    // Olha na direção do cursor a partir do próprio mascote, com alcance bem visível.
    const onMove = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width * 0.68);
      const dy = e.clientY - (r.top + r.height * 0.62);
      const k = Math.min(1, Math.hypot(dx, dy) / 260);
      const a = Math.atan2(dy, dx);
      x.set(Math.cos(a) * k * 62);
      y.set(Math.sin(a) * k * 48);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y]);

  return (
    <TabbitMark
      ref={ref}
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
