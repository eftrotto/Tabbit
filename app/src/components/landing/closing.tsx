import Link from "next/link";
import { TabbitMark, Wordmark } from "@/components/brand";
import { LiveMark } from "./live-mark";
import { Reveal } from "./primitives";

const WAITLIST_URL = process.env.NEXT_PUBLIC_WAITLIST_URL;

const TICKER = ["Rules enforced on-chain", "Paid in seconds", "0.8% fee", "USDC on Solana", "Auditable by anyone", "No chargebacks", "Built for Brazil, ready for the world"];

export function Ticker() {
  return (
    <div className="relative z-10 -mt-8 -rotate-2 overflow-hidden border-y border-ink/10 bg-brand py-4 text-ink shadow-xl shadow-brand/20">
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap font-display text-lg font-black uppercase tracking-wide">
        {[...TICKER, ...TICKER].map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            {t} <span aria-hidden>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Waitlist() {
  return (
    <section id="waitlist" className="scroll-mt-24 px-3 pb-6 sm:px-5">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-night px-6 py-20 text-center text-white sm:py-28">
        <div className="bg-grid absolute inset-0" />
        <div className="animate-drift absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand/30 blur-3xl" />
        <div className="animate-drift absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl [animation-delay:-6s]" />
        <Reveal className="relative mx-auto max-w-2xl">
          <LiveMark className="mx-auto h-28 w-auto drop-shadow-[0_16px_32px_rgba(30,232,138,0.4)]" id="cta-mark" />
          <h2 className="mt-8 font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Lunch is on the <span className="text-gradient">blockchain.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/60">Be the first to offer Tabbit to your team, or to accept it at your restaurant.</p>
          {WAITLIST_URL ? (
            <iframe src={WAITLIST_URL} title="Tabbit waitlist form" loading="lazy" className="mt-10 h-[28rem] w-full rounded-2xl bg-white" />
          ) : (
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/employer" className="rounded-2xl bg-brand px-7 py-4 font-bold text-ink shadow-[0_0_40px_-8px] shadow-brand transition hover:scale-[1.03]">
                Try the live demo →
              </Link>
              <span className="glass rounded-2xl px-7 py-4 font-semibold text-white/60">Waitlist opening soon</span>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="px-5 py-12">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 text-sm text-ink/60">
        <Link href="/" className="flex items-center gap-2 text-xl text-ink">
          <TabbitMark className="h-7 w-auto" id="footer-mark" />
          <Wordmark />
        </Link>
        <span>Smart spending, verified.</span>
        <span className="ml-auto">Built on Solana for Colosseum 2026</span>
        <a href="https://github.com/eftrotto/tabbit" target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-deep">
          GitHub ↗
        </a>
      </div>
    </footer>
  );
}
