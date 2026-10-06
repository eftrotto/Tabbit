"use client";
// Página pública de transparência: a rede Tabbit ao vivo, com números lidos da Solana.
// Modo real: /api/network (o servidor lê a cadeia uma vez para todos) + pagamentos novos ao vivo.
// Modo demo: os mesmos números calculados a partir do mock.
import { useEffect, useState } from "react";
import { PROGRAM_ID, type Payment } from "@tabbit/sdk";
import { ThinkingOrb } from "thinking-orbs";
import { Card, ErrorText, Money } from "@/components/ui";
import { useCurrency } from "@/components/providers";
import { friendlyError } from "@/lib/errors";
import { addPayment, computeStats, marketFee, statsFromJson, type NetworkStats } from "@/lib/network";
import { explorerAddressUrl, explorerTxUrl, useTabbit, type TabbitContext } from "@/lib/tabbit";

const REFRESH_MS = 60_000;
const BAR = "#12a36a"; // verde da marca com contraste >= 3:1 no fundo claro

export default function TransparencyPage() {
  const tabbit = useTabbit("merchant"); // só leitura: qualquer papel serve
  const { stats, error, fresh } = useNetworkStats(tabbit);

  return (
    <div className="space-y-6">
      {tabbit.isMock && (
        <p className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm">Demo mode: these numbers come from the demo data in this browser, not from the blockchain.</p>
      )}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Tabbit network, live</h1>
          <p className="mt-1 max-w-2xl text-sm opacity-70">
            Every number on this page is read from the Solana blockchain. Nothing here depends on trusting us: follow any link to check it yourself.
          </p>
        </div>
        <LivePill />
      </header>

      {error && !stats ? <ErrorText>{friendlyError(error)}</ErrorText>
        : !stats ? <Loading />
        : <Dashboard stats={stats} fresh={fresh} isMock={tabbit.isMock} />}
    </div>
  );
}

function useNetworkStats({ client, isMock }: TabbitContext) {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    // Pagamentos recebidos ao vivo: a leitura do servidor (em cache por alguns segundos) pode
    // ainda não ter os mais novos, então eles são reaplicados sobre cada leitura (sem duplicar).
    let live: Payment[] = [];
    const withLive = (s: NetworkStats) => live.reduce(addPayment, s);
    const load = async () => {
      try {
        const next = isMock
          ? await (async () => {
              const [payments, employers, merchants] = await Promise.all([client.listPayments({ limit: 1000 }), client.listEmployers(), client.listMerchants()]);
              return computeStats({ payments, employers, merchants, vaultBalances: employers.map((e) => e.totalDeposited), complete: true });
            })()
          : await fetch("/api/network").then(async (r) => {
              if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Could not read the network");
              return statsFromJson(await r.text());
            });
        if (alive) {
          setStats(withLive(next));
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e);
      }
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    // Pagamento novo aparece na hora, sem esperar a próxima leitura
    const stop = client.onPayment((p) => {
      live = [...live, p].slice(-50);
      setStats((s) => (s ? addPayment(s, p) : s));
      setFresh((f) => [...f, p.signature]);
      setTimeout(() => setFresh((f) => f.filter((x) => x !== p.signature)), 4000);
    });
    return () => {
      alive = false;
      clearInterval(timer);
      stop();
    };
  }, [client, isMock]);

  return { stats, error, fresh };
}

// A primeira leitura na RPC pública pode levar ~20 s: a mensagem avança para não parecer travado
const LOADING_STEPS: [number, string][] = [
  [0, "Reading the Solana blockchain…"],
  [4, "Collecting payments from every restaurant…"],
  [10, "Checking company vault balances…"],
  [16, "The public devnet is slow. Almost there…"],
];

function Loading() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const message = LOADING_STEPS.filter(([at]) => elapsed >= at).at(-1)![1];
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ThinkingOrb state="searching" size={64} theme="light" color="#07574f" aria-label="Loading network data" />
      <p className="text-lg font-semibold">{message}</p>
      <p className="max-w-sm text-sm opacity-60">Every number is read live from the chain, nothing is pre-computed.</p>
    </div>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-brand">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-brand" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>
      Live on Solana devnet
    </span>
  );
}

function Dashboard({ stats, fresh, isMock }: { stats: NetworkStats; fresh: string[]; isMock: boolean }) {
  const { volume, fees, count } = stats.totals;
  const market = marketFee(volume);
  const { inVaults, allocated } = stats.reserves;
  const coverage = allocated > 0n ? Number((inVaults * 1000n) / allocated) / 10 : null;

  return (
    <>
      <section className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-3xl bg-night p-5 text-paper">
          <p className="text-sm opacity-70">Paid to restaurants</p>
          <p className="mt-1 font-display text-4xl font-black tracking-tight text-brand sm:text-5xl"><Money base={volume} /></p>
        </div>
        <Tile label="Payments" value={count.toLocaleString()} />
        <Tile label="Restaurants accepting" value={stats.restaurants.active.toLocaleString()} />
        <Tile label="Companies on the network" value={stats.companies.approved.toLocaleString()} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="What restaurants keep">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand/20 p-4">
              <dt className="text-xs opacity-70">Fees paid on Tabbit (0.8%)</dt>
              <dd className="mt-1 text-xl font-bold"><Money base={fees} /></dd>
            </div>
            <div className="rounded-2xl bg-ink/5 p-4">
              <dt className="text-xs opacity-70">Same sales at the market cap (3.6%)</dt>
              <dd className="mt-1 text-xl font-bold"><Money base={market} /></dd>
            </div>
          </dl>
          <p className="mt-4 text-lg">
            <b><Money base={market - fees} /></b> more in restaurants&apos; pockets.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/10 pt-4 text-sm">
            <div><dt className="opacity-60">Money reaches the restaurant</dt><dd className="font-semibold">In the same transaction (seconds)</dd></div>
            <div><dt className="opacity-60">Traditional meal-voucher networks</dt><dd className="font-semibold">Up to 15 days</dd></div>
          </dl>
        </Card>

        <Card title="Every benefit is backed">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-ink/5 p-4">
              <dt className="text-xs opacity-70">Held in company vaults</dt>
              <dd className="mt-1 text-xl font-bold"><Money base={inVaults} /></dd>
            </div>
            <div className="rounded-2xl bg-ink/5 p-4">
              <dt className="text-xs opacity-70">Promised to employees</dt>
              <dd className="mt-1 text-xl font-bold"><Money base={allocated} /></dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-lg">
            {coverage === null ? (
              <span className="opacity-70">No balances allocated yet.</span>
            ) : coverage >= 100 ? (
              <>
                <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-brand text-sm font-black text-ink">✓</span>
                <span><b>{coverage >= 1000 ? "10×+" : `${coverage.toLocaleString()}%`}</b> covered by money already in the vaults</span>
              </>
            ) : (
              <span className="font-semibold text-red-700">Only {coverage}% covered</span>
            )}
          </p>
          <p className="mt-3 text-sm opacity-70">
            Vaults are controlled by the Tabbit program, not by Tabbit the company: money can only leave to a registered restaurant or back to the company.{" "}
            {!isMock && <a className="underline" href={explorerAddressUrl(PROGRAM_ID)} target="_blank" rel="noreferrer">See the program on Solana Explorer</a>}
          </p>
        </Card>
      </div>

      <Card title="Paid per day">
        <DailyChart daily={stats.daily} />
      </Card>

      <Card title="Latest payments">
        {stats.recent.length === 0 ? (
          <p className="text-sm opacity-60">No payments yet. They show up here the moment someone pays.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {stats.recent.map((p) => {
              const isNew = fresh.includes(p.signature);
              return (
                <li key={p.signature} className={`-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors duration-1000 ${isNew ? "bg-brand/40" : ""}`}>
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {stats.restaurants.names[p.merchant] ?? "Restaurant"}
                      {isNew && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs text-brand">Just now</span>}
                    </p>
                    <p className="text-xs opacity-60">
                      {new Date(p.timestamp * 1000).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {" · "}fee <Money base={p.fee} />
                      {!isMock && <>{" · "}<a className="underline" href={explorerTxUrl(p.signature)} target="_blank" rel="noreferrer">Explorer</a></>}
                    </p>
                  </div>
                  <Money base={p.amount} className="shrink-0 font-semibold" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs opacity-60">
        Updated {new Date(stats.generatedAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        {!stats.complete && " Totals cover the most recent transactions only."} Employees and companies are never shown here, only totals.
      </p>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-paper/70 p-5">
      <p className="text-sm opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

const dayLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** Colunas finas (uma série só: o título diz o que é), valor do maior dia direto na coluna, o resto no hover e na tabela. */
function DailyChart({ daily }: { daily: NetworkStats["daily"] }) {
  const { fiat } = useCurrency();
  const [hover, setHover] = useState<number | null>(null);
  const max = daily.reduce((m, d) => (d.volume > m ? d.volume : m), 0n);
  const peak = max > 0n ? daily.findIndex((d) => d.volume === max) : -1;
  const H = 160;

  return (
    <div>
      <div className="relative flex items-end gap-1 border-b border-ink/15 pt-8" style={{ height: H + 32 }} onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => {
          const h = max > 0n ? Math.max(d.volume > 0n ? 3 : 0, Math.round((Number(d.volume) / Number(max)) * H)) : 0;
          return (
            <div
              key={d.day}
              tabIndex={0}
              role="img"
              aria-label={`${dayLabel(d.day)}: ${fiat(d.volume)}, ${d.count} payments`}
              className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              {i === peak && hover === null && (
                <span className="absolute whitespace-nowrap text-xs font-semibold" style={{ bottom: h + 4 }}>{fiat(d.volume)}</span>
              )}
              <div className="w-full max-w-6 rounded-t" style={{ height: h, background: BAR, opacity: hover === null || hover === i ? 1 : 0.45 }} />
              {hover === i && (
                <div className="absolute z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg" style={{ bottom: h + 6 }}>
                  <b className="block text-sm">{fiat(d.volume)}</b>
                  {dayLabel(d.day)} · {d.count} {d.count === 1 ? "payment" : "payments"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[11px] opacity-60">
        {daily.map((d, i) => (
          <span key={d.day} className="flex-1 text-center">{(daily.length - 1 - i) % 2 === 0 ? dayLabel(d.day) : ""}</span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer opacity-70">Show as table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead className="text-xs opacity-60"><tr><th className="py-1 font-medium">Day</th><th className="py-1 font-medium">Payments</th><th className="py-1 font-medium">Paid</th></tr></thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-ink/5"><td className="py-1">{dayLabel(d.day)}</td><td className="py-1">{d.count}</td><td className="py-1">{fiat(d.volume)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
