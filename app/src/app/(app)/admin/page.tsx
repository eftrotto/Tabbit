"use client";
// Painel da plataforma (Tabbit): aprova empresas, credencia restaurantes, pausa a rede e acompanha o fee payer.
// A tela só abre para a carteira `Config.authority`, mas quem garante isso de verdade é o programa:
// toda ação aqui falha on-chain se outra carteira assinar.
import { useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import type { Category, ConfigAccount, EmployerAccount, MerchantAccount, TabbitClient } from "@tabbit/sdk";
import { Card, DemoBanner, ErrorText, Money, shortKey } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { explorerAddressUrl, useLoad, useTabbit } from "@/lib/tabbit";
import { TxStatus, useTx } from "../employer/tx";
import { CategoryBadge, ConnectCard, CopyButton } from "../employee/shared";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "grocery", label: "Grocery" },
  { value: "other", label: "Other" },
];
const LOW_SPONSOR_LAMPORTS = 50_000_000; // 0,05 SOL ≈ 5.000 pagamentos

export default function AdminPage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("admin");
  const data = useLoad(async () => {
    const [config, employers, merchants] = await Promise.all([client.getConfig(), client.listEmployers(), client.listMerchants()]);
    return { config, employers, merchants };
  }, [client]);

  const banner = <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="Tabbit (platform)" />;
  if (!actor) return <div className="mx-auto max-w-2xl">{banner}<ConnectCard what="Connect the Tabbit platform wallet to manage the network." /></div>;
  if (data.error) return <div>{banner}<ErrorText>{friendlyError(data.error)}</ErrorText></div>;
  if (!data.data) return <div>{banner}<p className="opacity-60">Loading…</p></div>;

  const { config, employers, merchants } = data.data;
  if (!config.authority.equals(actor))
    return (
      <div className="mx-auto max-w-2xl">
        {banner}
        <Card title="Platform only">
          <p className="text-sm opacity-70">This area is for the Tabbit team. The connected wallet is not the platform authority.</p>
          <p className="mt-2 font-mono text-xs opacity-60">{actor.toBase58()}</p>
        </Card>
      </div>
    );

  return (
    <div className="space-y-6">
      {banner}
      <h1 className="text-2xl font-bold">Tabbit network</h1>
      <Overview config={config} employers={employers} merchants={merchants} isMock={isMock} />
      <Companies client={client} config={config} employers={employers} isMock={isMock} reload={data.reload} />
      <Restaurants client={client} merchants={merchants} isMock={isMock} reload={data.reload} />
      <System client={client} config={config} isMock={isMock} reload={data.reload} />
    </div>
  );
}

function Overview({ config, employers, merchants, isMock }: { config: ConfigAccount; employers: EmployerAccount[]; merchants: MerchantAccount[]; isMock: boolean }) {
  const approved = employers.filter((e) => e.approved);
  const inVaults = approved.reduce((s, e) => s + e.totalDeposited, 0n);
  const allocated = approved.reduce((s, e) => s + e.totalAllocated, 0n);
  const sponsor = useLoad(async () => {
    if (isMock) return null;
    const res = await fetch("/api/sponsor");
    return res.ok ? ((await res.json()) as { publicKey: string; lamports: number | null }) : null;
  }, [isMock]);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Companies" value={`${approved.length} active`} hint={`${employers.length - approved.length} pending or suspended`} />
      <Stat label="Restaurants" value={`${merchants.filter((m) => m.active).length} active`} hint={`${merchants.length} registered`} />
      <Stat label="Funds in vaults" value={<Money base={inVaults} />} hint={<>allocated <Money base={allocated} /></>} />
      <Stat
        label="Network"
        value={config.paused ? "Paused" : "Live"}
        hint={
          sponsor.data
            ? sponsor.data.lamports === null
              ? "fee payer: balance unknown"
              : `fee payer: ${(sponsor.data.lamports / 1e9).toFixed(3)} SOL${sponsor.data.lamports < LOW_SPONSOR_LAMPORTS ? " ⚠ refill" : ""}`
            : isMock ? `fee ${config.feeBps / 100}%` : "fee payer: off"
        }
        alert={config.paused || (!!sponsor.data?.lamports && sponsor.data.lamports < LOW_SPONSOR_LAMPORTS)}
      />
    </div>
  );
}

function Stat({ label, value, hint, alert }: { label: string; value: React.ReactNode; hint?: React.ReactNode; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alert ? "border-red-300 bg-red-50" : "border-ink/10 bg-paper/70"}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-60">{hint}</p>}
    </div>
  );
}

function Companies({ client, config, employers, isMock, reload }: {
  client: TabbitClient; config: ConfigAccount; employers: EmployerAccount[]; isMock: boolean; reload: () => Promise<unknown>;
}) {
  const tx = useTx();
  const [busy, setBusy] = useState<string | null>(null);
  // Pendentes primeiro: é o que pede ação
  const sorted = [...employers].sort((a, b) => Number(a.approved) - Number(b.approved) || a.name.localeCompare(b.name));

  function setApproved(e: EmployerAccount, approved: boolean) {
    if (!approved && !confirm(`Suspend ${e.name}? Its employees will not be able to pay until you approve it again.`)) return;
    setBusy(e.owner.toBase58());
    void tx.run(() => client.setEmployerApproved(e.owner, approved), reload).finally(() => setBusy(null));
  }

  return (
    <Card title="Companies">
      <p className="mb-3 text-sm opacity-70">
        Companies sign up on their own and stay pending. Approve them after the contract, KYB and onboarding: only then can they fund benefits and their employees pay.
      </p>
      <TxStatus error={tx.error} sig={tx.sig} isMock={isMock} />
      {sorted.length === 0 ? (
        <p className="text-sm opacity-60">No companies yet.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-ink/10 text-xs opacity-70">
              <tr>{["Company", "Owner wallet", "In vault", "Status", ""].map((h, i) => <th key={i} className="px-2 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const wrongMint = !e.mint.equals(config.mint);
                const key = e.owner.toBase58();
                return (
                  <tr key={key} className="border-b border-ink/5 last:border-0">
                    <td className="px-2 py-2.5 font-medium">{e.name}</td>
                    <td className="px-2 py-2.5 font-mono">
                      <a className="underline decoration-ink/30" href={explorerAddressUrl(e.owner)} target="_blank" rel="noreferrer">{shortKey(e.owner)}</a>
                    </td>
                    <td className="px-2 py-2.5"><Money base={e.totalDeposited} /></td>
                    <td className="px-2 py-2.5">
                      {wrongMint ? <Chip tone="red">Unofficial token</Chip> : e.approved ? <Chip tone="green">Approved</Chip> : <Chip tone="amber">Pending</Chip>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right">
                      {e.approved ? (
                        <button className="text-red-700 underline disabled:opacity-50" disabled={busy !== null} onClick={() => setApproved(e, false)}>
                          {busy === key ? "…" : "Suspend"}
                        </button>
                      ) : (
                        <button className="btn-primary !px-3 !py-1 text-sm" disabled={busy !== null || wrongMint} onClick={() => setApproved(e, true)}>
                          {busy === key ? "…" : "Approve"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Chip({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  const cls = { green: "bg-brand/25", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-700" }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function Restaurants({ client, merchants, isMock, reload }: { client: TabbitClient; merchants: MerchantAccount[]; isMock: boolean; reload: () => Promise<unknown> }) {
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("restaurant");
  const add = useTx();
  const toggle = useTx();

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    let pk: PublicKey;
    try {
      pk = new PublicKey(wallet.trim());
    } catch {
      return add.setError("Enter the restaurant's Solana wallet address (they see it on the Restaurant screen)");
    }
    const n = name.trim();
    if (!n || n.length > 32) return add.setError("Name must be 1 to 32 characters");
    void add.run(() => client.registerMerchant({ wallet: pk, name: n, category }), async () => {
      setWallet("");
      setName("");
      await reload();
    });
  }

  return (
    <Card title="Restaurants">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-ink/[0.03] p-4 md:grid-cols-[2fr_1.3fr_1fr_auto] md:items-end">
        <div>
          <label className="label" htmlFor="m-wallet">Restaurant wallet</label>
          <input id="m-wallet" className="input font-mono text-sm" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Address the restaurant sent you" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="m-name">Name</label>
          <input id="m-name" className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="Cantina da Vila" />
        </div>
        <div>
          <label className="label" htmlFor="m-cat">Category</label>
          <select id="m-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={add.pending}>{add.pending ? "…" : "Register"}</button>
      </form>
      <div className="mt-2"><TxStatus error={add.error} sig={add.sig} isMock={isMock} /></div>
      <TxStatus error={toggle.error} sig={toggle.sig} isMock={isMock} />

      <ul className="mt-3 divide-y divide-ink/10">
        {merchants.map((m) => (
          <li key={m.wallet.toBase58()} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">{m.name} <CategoryBadge category={m.category} /></p>
              <p className="flex items-center gap-2 font-mono text-xs opacity-60">
                {shortKey(m.wallet)} <CopyButton text={m.wallet.toBase58()} />
              </p>
            </div>
            <div className="flex items-center gap-3">
              {m.active ? <Chip tone="green">Active</Chip> : <Chip tone="red">Inactive</Chip>}
              <Link className="underline" href={`/merchant/poster?merchant=${m.wallet.toBase58()}`}>Poster</Link>
              <button className="underline disabled:opacity-50" disabled={toggle.pending} onClick={() => void toggle.run(() => client.setMerchantActive(m.wallet, !m.active), reload)}>
                {m.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function System({ client, config, isMock, reload }: { client: TabbitClient; config: ConfigAccount; isMock: boolean; reload: () => Promise<unknown> }) {
  const tx = useTx();
  function toggle() {
    const msg = config.paused ? "Resume all payments on the network?" : "Pause ALL payments on the network? Use only in an emergency.";
    if (!confirm(msg)) return;
    void tx.run(() => client.setPaused(!config.paused), reload);
  }
  return (
    <Card title="System">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="opacity-60">Platform fee</dt><dd className="font-semibold">{config.feeBps / 100}%</dd></div>
        <div><dt className="opacity-60">Benefit token</dt><dd className="font-mono"><a className="underline" href={explorerAddressUrl(config.mint)} target="_blank" rel="noreferrer">{shortKey(config.mint)}</a></dd></div>
        <div><dt className="opacity-60">Treasury</dt><dd className="font-mono"><a className="underline" href={explorerAddressUrl(config.treasury)} target="_blank" rel="noreferrer">{shortKey(config.treasury)}</a></dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={config.paused ? "btn-primary" : "btn-danger"} disabled={tx.pending} onClick={toggle}>
          {tx.pending ? "…" : config.paused ? "Resume payments" : "Pause all payments"}
        </button>
        <TxStatus error={tx.error} sig={tx.sig} isMock={isMock} />
      </div>
    </Card>
  );
}
