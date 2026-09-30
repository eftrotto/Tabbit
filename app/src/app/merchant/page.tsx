"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PublicKey } from "@solana/web3.js";
import type { Payment, TabbitClient } from "@tabbit/sdk";
import { Card, DemoBanner, ErrorText, Money, shortKey } from "@/components/ui";
import { parseUsdc, usdcToInput } from "@/lib/currency";
import { friendlyError } from "@/lib/errors";
import { explorerTxUrl, useLoad, useTabbit } from "@/lib/tabbit";
import { ConnectCard, CopyButton, NotLinked } from "../employee/shared";

export default function MerchantPage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("merchant");
  const { data: merchant, error, loading } = useLoad(async () => (actor ? client.getMerchant(actor) : null), [client, actor]);
  const banner = <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="Cantina da Vila (restaurant)" />;

  if (!actor) return <div className="mx-auto max-w-2xl">{banner}<ConnectCard what="Connect your restaurant wallet to get your QR code and see sales." /></div>;
  if (error) return <div className="mx-auto max-w-2xl">{banner}<ErrorText>{friendlyError(error)}</ErrorText></div>;
  if (loading) return <div className="mx-auto max-w-2xl">{banner}<p className="opacity-60">Loading…</p></div>;
  if (!merchant)
    return (
      <div className="mx-auto max-w-2xl">
        {banner}
        <NotLinked
          title="This wallet is not a registered restaurant yet"
          hint="Send this wallet address to the Tabbit team to get registered."
          address={actor.toBase58()}
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {banner}
      <h1 className="text-2xl font-bold">{merchant.name}</h1>
      <QrCard wallet={actor.toBase58()} name={merchant.name} />
      <Sales client={client} actor={actor} />
    </div>
  );
}

function QrCard({ wallet, name }: { wallet: string; name: string }) {
  // origin só existe no cliente: snapshot de servidor vazio evita mismatch de hidratação
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const [amountStr, setAmountStr] = useState("");

  const amount = parseUsdc(amountStr);
  const url = `${origin}/pay?merchant=${wallet}${amount ? `&amount=${usdcToInput(amount)}` : ""}`;

  return (
    <Card title="Your payment QR">
      <div className="mx-auto max-w-xs rounded-3xl bg-ink p-4 text-center">
        <div className="rounded-2xl bg-white p-3">
          {origin && <QRCodeSVG value={url} size={256} level="M" className="h-auto w-full" />}
        </div>
        <p className="mt-3 font-semibold text-brand">{name}</p>
        <p className="text-xs text-paper/70">Scan with Tabbit to pay</p>
      </div>
      <div className="mt-5">
        <label className="label" htmlFor="charge">Charge a specific amount (optional, USDC)</label>
        <input id="charge" className="input" inputMode="decimal" placeholder="Leave empty to let the customer type it" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        {amountStr && !amount && <ErrorText>Enter a valid amount, for example 12.50</ErrorText>}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-ink/5 px-3 py-2 text-xs">{url}</code>
        <CopyButton text={url} />
      </div>
    </Card>
  );
}

function Sales({ client, actor }: { client: TabbitClient; actor: PublicKey }) {
  const { data: initial } = useLoad(() => client.listPayments({ merchant: actor, limit: 50 }), [client, actor]);
  const [live, setLive] = useState<Payment[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    return client.onPayment((p) => {
      if (!p.merchant.equals(actor)) return;
      setLive((l) => (l.some((x) => x.signature === p.signature) ? l : [p, ...l]));
      setFresh((f) => [...f, p.signature]);
      setTimeout(() => setFresh((f) => f.filter((s) => s !== p.signature)), 3000);
    });
  }, [client, actor]);

  // Só hoje (dia local do navegador), sem duplicados, mais novas primeiro.
  const startOfDay = new Date().setHours(0, 0, 0, 0) / 1000;
  const seen = new Set<string>();
  const today = [...live, ...(initial ?? [])]
    .filter((p) => p.timestamp >= startOfDay && !seen.has(p.signature) && seen.add(p.signature))
    .sort((a, b) => b.timestamp - a.timestamp);

  const gross = today.reduce((s, p) => s + p.amount, 0n);
  const fees = today.reduce((s, p) => s + p.fee, 0n);

  return (
    <Card title="Today's sales">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Gross sales" value={<Money base={gross} />} />
        <Stat label="Net received" value={<Money base={gross - fees} />} strong />
        <Stat label="Fees paid (0.8%)" value={<Money base={fees} />} />
        <Stat label="Sales" value={today.length} />
      </div>
      {today.length === 0 && <p className="mt-4 text-sm opacity-60">No sales yet today. New payments appear here instantly.</p>}
      <ul className="mt-4 divide-y divide-ink/10">
        {today.map((p) => {
          const isNew = fresh.includes(p.signature);
          return (
            <li key={p.signature} className={`-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors duration-1000 ${isNew ? "bg-brand/40" : ""}`}>
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {new Date(p.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {shortKey(p.employee)}
                  {isNew && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs text-brand">New payment!</span>}
                </p>
                <p className="text-xs opacity-60">
                  Fee <Money base={p.fee} /> ·{" "}
                  <a className="underline" href={explorerTxUrl(p.signature)} target="_blank" rel="noreferrer">Explorer</a>
                </p>
              </div>
              <Money base={p.amount} className="shrink-0 font-semibold" />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Stat({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? "bg-brand/25" : "bg-ink/5"}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
