"use client";
import Link from "next/link";
import { Card, DemoBanner, ErrorText, Money } from "@/components/ui";
import { formatWindow } from "@/lib/time";
import { friendlyError } from "@/lib/errors";
import { explorerTxUrl, useLoad, useTabbit } from "@/lib/tabbit";
import { availableToday, CategoryBadge, ConnectCard, fmtTime, NotLinked } from "./shared";

export default function EmployeePage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("employee");
  const { data, error, loading } = useLoad(async () => {
    if (!actor) return null;
    const [employee, merchants] = await Promise.all([client.getEmployeeByWallet(actor), client.listMerchants()]);
    const payments = employee ? await client.listPayments({ employee: actor, limit: 10 }) : [];
    return { employee, merchants, payments };
  }, [client, actor]);

  const banner = <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="João (employee)" />;
  if (!actor) return <div className="mx-auto max-w-md">{banner}<ConnectCard what="Connect the wallet your employer registered to see your meal benefit." /></div>;
  if (error) return <div className="mx-auto max-w-md">{banner}<ErrorText>{friendlyError(error)}</ErrorText></div>;
  if (loading || !data) return <div className="mx-auto max-w-md">{banner}<p className="opacity-60">Loading your benefit…</p></div>;

  const { employee: e, merchants, payments } = data;
  if (!e)
    return (
      <div className="mx-auto max-w-md">
        {banner}
        <NotLinked
          title="No meal benefit linked to this wallet"
          hint="Send this wallet address to your employer so they can add you."
          address={actor.toBase58()}
        />
      </div>
    );

  const names = new Map(merchants.map((m) => [m.wallet.toBase58(), m.name]));
  const spentPct = e.dailyCap > 0n ? Number((e.spentToday * 100n) / e.dailyCap) : 100;

  return (
    <div className="mx-auto max-w-md space-y-5">
      {banner}

      <section className={`rounded-3xl p-6 text-paper ${e.active ? "bg-ink" : "bg-ink/60"}`}>
        {e.active ? (
          <>
            <p className="text-sm opacity-70">Meal balance</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-brand"><Money base={e.balance} /></p>
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
          </>
        ) : (
          <>
            <p className="text-xl font-semibold">Benefit inactive</p>
            <p className="mt-1 text-sm opacity-80">Your employer has turned off this benefit. Contact them to get it back.</p>
          </>
        )}
      </section>

      <Link href="/pay?scan=1" className="btn-primary w-full !py-4 text-lg">Scan to pay</Link>

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

      <Card title="Recent payments">
        {payments.length === 0 && <p className="text-sm opacity-60">No payments yet. Scan a restaurant QR to make your first one.</p>}
        <ul className="divide-y divide-ink/10">
          {payments.map((p) => (
            <li key={p.signature} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{names.get(p.merchant.toBase58()) ?? "Restaurant"}</p>
                <p className="text-xs opacity-60">
                  {fmtTime(p.timestamp)} ·{" "}
                  <a className="underline" href={explorerTxUrl(p.signature)} target="_blank" rel="noreferrer">Explorer</a>
                </p>
              </div>
              <Money base={p.amount} className="shrink-0 font-semibold" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
