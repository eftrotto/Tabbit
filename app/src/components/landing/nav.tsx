"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { TabbitMark, Wordmark } from "@/components/brand";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#rules", label: "Rules" },
  { href: "#restaurants", label: "Restaurants" },
  { href: "/transparency", label: "Live network" },
];

// Transparente sobre o hero escuro; vira vidro claro depois de rolar.
export function LandingNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 80));

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3"
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center gap-6 rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          solid ? "border border-ink/10 bg-paper/80 text-ink shadow-lg shadow-ink/5 backdrop-blur-xl" : "border border-transparent text-white"
        }`}
      >
        <Link href="/" className="flex items-center gap-2 text-2xl">
          <TabbitMark className="h-8 w-auto" id="nav-mark" />
          <Wordmark />
        </Link>
        <div className="hidden gap-6 text-sm font-medium md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="opacity-70 transition hover:opacity-100">
              {l.label}
            </a>
          ))}
        </div>
        <Link
          href="/employer"
          className="group ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-ink shadow-[0_0_24px_-4px] shadow-brand/60 transition hover:shadow-brand"
        >
          Launch app
          <span className="transition group-hover:translate-x-0.5">→</span>
        </Link>
      </nav>
    </motion.header>
  );
}
