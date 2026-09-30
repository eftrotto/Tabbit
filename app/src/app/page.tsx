import Link from "next/link";
import { Logo } from "@/components/header";

const WAITLIST_URL = process.env.NEXT_PUBLIC_WAITLIST_URL;

const STEPS = [
  ["The employer funds the vault", "Deposit USDC once. The money stays in a Solana vault the company controls."],
  ["Rules live on-chain", "Per worker: balance, max per meal, daily cap and optional meal hours. No one can bend them."],
  ["The worker scans a QR code", "At any registered restaurant. The program checks every rule before the payment goes through."],
  ["The restaurant is paid in seconds", "Straight to its wallet, with a 0.8% fee. No waiting for a settlement cycle."],
];

const DEMOS = [
  { href: "/employer", title: "I'm an employer", text: "Fund the vault and set meal rules for your team." },
  { href: "/employee", title: "I'm a worker", text: "See your balance and pay for lunch with a QR code." },
  { href: "/merchant", title: "I'm a restaurant", text: "Get paid instantly and watch sales arrive." },
];

// Barras proporcionais: taxa (0,8% vs 3,6%) e prazo (segundos vs 15 dias).
function Bar({ label, width, tabbit, value }: { label: string; width: string; tabbit?: boolean; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`h-7 rounded-md ${tabbit ? "bg-brand" : "bg-paper/30"}`} style={{ width, minWidth: "0.5rem" }} />
        <span className="whitespace-nowrap text-sm font-semibold">{value}</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-16 pb-8 sm:space-y-24">
      <section className="grid items-center gap-8 pt-4 sm:grid-cols-[1fr_auto] sm:pt-10">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">Tabbit</h1>
          <p className="mt-2 text-2xl font-semibold sm:text-3xl">Smart spending, verified.</p>
          <p className="mt-5 max-w-xl text-lg opacity-80">
            A meal benefit in USDC on Solana. Employers set the rules, workers pay by QR code, and restaurants get their money
            instantly.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/employer" className="btn-primary">Try the demo</Link>
            <a href="#how" className="btn-secondary">How it works</a>
          </div>
        </div>
        <div className="flex justify-center rounded-[2rem] bg-ink p-8 sm:p-12">
          <Logo className="h-32 w-32 sm:h-48 sm:w-48" />
        </div>
      </section>

      <section id="how" className="scroll-mt-6">
        <h2 className="mb-6 text-3xl font-bold">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="card flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand font-bold">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm opacity-75">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[2rem] bg-ink p-6 text-paper sm:p-10">
        <h2 className="text-3xl font-bold">Cheaper for restaurants, faster too</h2>
        <p className="mt-2 max-w-xl opacity-75">Meal-card incumbents charge more and pay late. Tabbit settles on Solana.</p>
        <div className="mt-8 space-y-7">
          <div className="space-y-2">
            <p className="font-semibold">Fee per payment</p>
            <Bar label="Tabbit" width="22%" tabbit value="0.8%" />
            <Bar label="Incumbents" width="100%" value="up to 3.6%" />
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Time until the restaurant is paid</p>
            <Bar label="Tabbit" width="1%" tabbit value="seconds" />
            <Bar label="Incumbents" width="100%" value="up to 15 days" />
          </div>
        </div>
        <p className="mt-8 border-t border-paper/20 pt-4 text-sm opacity-80">
          Every rule check and every payment is public and auditable on Solana.
        </p>
      </section>

      <section>
        <h2 className="mb-6 text-3xl font-bold">Try the demo</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {DEMOS.map((d) => (
            <Link key={d.href} href={d.href} className="card group flex flex-col justify-between gap-6 transition hover:-translate-y-0.5 hover:border-ink/40">
              <div>
                <h3 className="text-xl font-bold">{d.title}</h3>
                <p className="mt-2 text-sm opacity-75">{d.text}</p>
              </div>
              <span className="btn-primary w-full group-hover:brightness-95">Open demo</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-3xl font-bold">Join the waitlist</h2>
        <p className="mt-2 max-w-xl opacity-75">Be first to offer Tabbit to your team or your restaurant.</p>
        {WAITLIST_URL ? (
          <iframe src={WAITLIST_URL} title="Tabbit waitlist form" loading="lazy" className="mt-5 h-[28rem] w-full rounded-xl border border-ink/10" />
        ) : (
          <button className="btn-primary mt-5" disabled>Waitlist opening soon</button>
        )}
      </section>
    </div>
  );
}
