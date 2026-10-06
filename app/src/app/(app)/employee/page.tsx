"use client";
import Link from "next/link";
import { Card, DemoBanner, ErrorText, Money } from "@/components/ui";
import { LiveMark } from "@/components/landing/live-mark";
import { formatWindow } from "@/lib/time";
import { friendlyError } from "@/lib/errors";
import { useEmployeeLogin } from "@/lib/employee-wallet";
import { InstallApp } from "./install";
import { explorerAddressUrl, explorerTxUrl, useLoad, useTabbit } from "@/lib/tabbit";
import { availableToday, CategoryBadge, CopyButton, EmployeeSignIn, fmtTime, NotLinked } from "./shared";
import { DemoOffer, DemoRefill, useDemo } from "./demo";

export default function EmployeePage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("employee");
  const demo = useDemo(!isMock && !!actor);
  const { data, error, loading, reload } = useLoad(async () => {
    if (!actor) return null;
    const [employee, merchants] = await Promise.all([client.getEmployeeByWallet(actor), client.listMerchants()]);
    const [payments, refunds] = employee
      ? await Promise.all([client.listPayments({ employee: actor, limit: 10 }), client.listRefunds({ employee: actor, limit: 10 })])
      : [[], []];
    // Pagamentos e estornos numa linha do tempo só, mais novos primeiro
    const history = [
      ...payments.map((p) => ({ kind: "payment" as const, signature: p.signature, merchant: p.merchant, amount: p.amount, timestamp: p.timestamp })),
      ...refunds.map((r) => ({ kind: "refund" as const, signature: r.signature, merchant: r.merchant, amount: r.amount, timestamp: r.timestamp })),
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
    return { employee, merchants, payments: history };
  }, [client, actor]);

  const banner = <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="João (employee)" />;
  if (!actor) return <div className="mx-auto max-w-md">{banner}<EmployeeSignIn what="Sign in with email or Google to see your meal benefit. New here? You get a demo benefit to try it." walletWhat="Connect the wallet your employer registered to see your meal benefit." /></div>;
  if (error) return <div className="mx-auto max-w-md">{banner}<ErrorText>{friendlyError(error)}</ErrorText></div>;
  if (loading || !data) return <div className="mx-auto max-w-md">{banner}<p className="opacity-60">Loading your benefit…</p></div>;

  const { employee: e, merchants, payments } = data;
  if (!e)
    return (
      <div className="mx-auto max-w-md">
        {banner}
        <div className="space-y-5">
          {demo?.enabled && <DemoOffer demo={demo} wallet={actor} onEnrolled={reload} />}
          <NotLinked
            title={demo?.enabled ? "Or use your real employer" : "No meal benefit linked to this wallet"}
            hint="Send this wallet address to your employer so they can add you."
            address={actor.toBase58()}
          />
        </div>
      </div>
    );

  const names = new Map(merchants.map((m) => [m.wallet.toBase58(), m.name]));
  const spentPct = e.dailyCap > 0n ? Number((e.spentToday * 100n) / e.dailyCap) : 100;

  return (
    <div className="mx-auto max-w-md space-y-5">
      {banner}

      <section className={`relative overflow-hidden rounded-3xl p-6 text-paper shadow-[0_24px_60px_-24px] shadow-ink/60 ${e.active ? "bg-night" : "bg-ink/60"}`}>
        <div aria-hidden className="animate-drift pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/30 blur-3xl" />
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
        {e.active && <LiveMark id="balance-mark" className="pointer-events-none absolute -bottom-7 right-5 h-24 w-auto rotate-[-6deg]" />}
        {e.active ? (
          <div className="relative">
            <p className="text-sm opacity-70">Meal balance</p>
            <p className="mt-1 font-display text-4xl font-black tracking-tight text-brand sm:text-5xl"><Money base={e.balance} /></p>
            <div className="mt-5 rounded-2xl bg-paper/10 p-4">
              <p className="text-sm opacity-70">Available today</p>
              <p className="text-2xl font-semibold"><Money base={availableToday(e)} /></p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/20" role="progressbar" aria-label="Daily spending" aria-valuenow={Math.min(spentPct, 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(spentPct, 100)}%` }} />
              </div>
              <p className="mt-2 text-xs opacity-70">
                Spent <Money base={e.spentToday} /> of daily cap <Money base={e.dailyCap} />
              </p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="opacity-70">Per meal</dt><dd className="font-semibold"><Money base={e.maxPerMeal} /></dd></div>
              <div><dt className="opacity-70">Meal hours</dt><dd className="font-semibold">{formatWindow(e.windowStartMin, e.windowEndMin)}</dd></div>
            </dl>
          </div>
        ) : (
          <>
            <p className="text-xl font-semibold">Benefit inactive</p>
            <p className="mt-1 text-sm opacity-80">Your employer has turned off this benefit. Contact them to get it back.</p>
          </>
        )}
      </section>

      {demo?.employer === e.employer.toBase58() && e.active && e.balance < e.maxPerMeal && <DemoRefill wallet={actor} onRefilled={reload} />}

      <Link href="/pay?scan=1" className="btn-primary w-full !py-4 text-lg">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" />
        </svg>
        Scan to pay
      </Link>

      <Card title="Restaurants">
        {merchants.filter((m) => m.active).length === 0 && <p className="text-sm opacity-60">No restaurants yet.</p>}
        <ul className="divide-y divide-ink/10">
          {merchants.filter((m) => m.active).map((m) => (
            <li key={m.wallet.toBase58()}>
              <Link href={`/pay?merchant=${m.wallet.toBase58()}`} className="flex items-center justify-between gap-2 py-3 hover:opacity-70">
                <span className="font-medium">{m.name}</span>
                <CategoryBadge category={m.category} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={<span className="flex items-baseline justify-between gap-3">Recent payments<Link href="/employee/statement" className="text-sm font-semibold underline">Monthly statement</Link></span>}>
        {payments.length === 0 && <p className="text-sm opacity-60">No payments yet. Scan a restaurant QR to make your first one.</p>}
        <ul className="divide-y divide-ink/10">
          {payments.map((p) => (
            <li key={p.signature} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {p.kind === "refund" && <span className="mr-1.5 rounded-full bg-brand/25 px-2 py-0.5 text-xs font-semibold">Refund</span>}
                  {names.get(p.merchant.toBase58()) ?? "Restaurant"}
                </p>
                <p className="text-xs opacity-60">
                  {fmtTime(p.timestamp)} ·{" "}
                  <a className="underline" href={explorerTxUrl(p.signature)} target="_blank" rel="noreferrer">Explorer</a>
                </p>
              </div>
              <span className="shrink-0 font-semibold">{p.kind === "refund" && "+ "}<Money base={p.amount} /></span>
            </li>
          ))}
        </ul>
      </Card>

      {!isMock && <WalletCard address={actor.toBase58()} />}
      <InstallApp />
    </div>
  );
}

/** A carteira é do funcionário: endereço público, link para o Explorer e, no login por e-mail, exportar a chave. */
function WalletCard({ address }: { address: string }) {
  const { status, exportKey } = useEmployeeLogin();
  return (
    <Card title="Your wallet">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-ink/5 px-3 py-2 text-xs">{address}</code>
        <CopyButton text={address} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a className="underline" href={explorerAddressUrl(address)} target="_blank" rel="noreferrer">View on Solana Explorer</a>
        {status === "ready" && (
          <button className="underline" onClick={() => void exportKey()}>Export private key</button>
        )}
      </div>
    </Card>
  );
}
