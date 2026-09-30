import type { ReactNode, SVGProps } from "react";

// Mascote Tabbit em SVG (redesenho do logo oficial em public/brand/tabbit-mark.png).
// `eyes` permite animar os olhos (ex.: seguir o mouse na landing).
export function TabbitMark({ eyes, id = "tm", ...props }: SVGProps<SVGSVGElement> & { eyes?: ReactNode; id?: string }) {
  return (
    <svg viewBox="-12 -12 538 728" aria-hidden {...props}>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#55f3a0" />
          <stop offset="0.5" stopColor="#18cf88" />
          <stop offset="1" stopColor="#0b8a6a" />
        </linearGradient>
        <linearGradient id={`${id}-a`} x1="0.1" y1="0.05" x2="0.7" y2="1">
          <stop offset="0" stopColor="#46f29c" />
          <stop offset="0.5" stopColor="#1fcf88" />
          <stop offset="1" stopColor="#0c7d63" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#159a73" />
          <stop offset="0.5" stopColor="#07574f" />
          <stop offset="1" stopColor="#03202a" />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d="M0 110 A110 110 0 0 1 220 110 L220 600 L0 600 Z" fill={`url(#${id}-s)`} />
      <path d={BODY} fill={`url(#${id}-a)`} />
      <path
        d="M120 720 C 170 600 250 330 390 292 C 450 276 505 300 545 345 L 560 800 L 100 800 Z"
        fill={`url(#${id}-b)`}
        clipPath={`url(#${id}-c)`}
      />
      {eyes ?? <MarkEyes />}
    </svg>
  );
}

export function MarkEyes() {
  return (
    <g fill="#f7fbf9">
      <rect x="296" y="407" width="42" height="96" rx="21" />
      <rect x="387" y="407" width="42" height="96" rx="21" />
    </g>
  );
}

const BODY = "M0 560 C 12 390 190 247 330 247 C 450 247 514 360 514 480 C 514 610 430 704 262 704 C 110 704 0 650 0 560 Z";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-black tracking-tight ${className}`}>
      Tabb<span className="relative">ı<span className="absolute left-1/2 top-[0.08em] h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full bg-brand" /></span>t
    </span>
  );
}
