"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import type { MerchantAccount } from "@tabbit/sdk";
import { Card, DemoBanner, ErrorText, Money, ResultIcon, shortKey } from "@/components/ui";
import { parseUsdc } from "@/lib/currency";
import { friendlyError } from "@/lib/errors";
import { explorerTxUrl, useLoad, useTabbit, type TabbitContext } from "@/lib/tabbit";
import { availableToday, CategoryBadge, EmployeeSignIn, fmtTime, NotLinked } from "../employee/shared";
import { DemoOffer, useDemo } from "../employee/demo";

// Scanner só no cliente (usa câmera).
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), { ssr: false });

const isKey = (s: string | null) => {
  try {
    return !!s && !!new PublicKey(s);
  } catch {
    return false;
  }
};

export default function PayPage() {
  return (
    <Suspense fallback={<p className="opacity-60">Loading…</p>}>
      <PayRouter />
    </Suspense>
  );
}

function PayRouter() {
  const tabbit = useTabbit("employee");
  const sp = useSearchParams();
  const merchant = sp.get("merchant");
  const amount = sp.get("amount") ?? "";

  return (
    <div className="mx-auto max-w-md">
      <DemoBanner isMock={tabbit.isMock} isDemoPersona={tabbit.isDemoPersona} persona="João (employee)" />
      {!tabbit.actor ? (
        <EmployeeSignIn what="Sign in to pay with your meal benefit." walletWhat="Connect your wallet to pay with your meal benefit." />
      ) : merchant && isKey(merchant) && sp.get("scan") !== "1" ? (
        <PayFlow key={merchant} tabbit={tabbit} merchant={new PublicKey(merchant)} initialAmount={amount} />
      ) : (
        <ScanStep tabbit={tabbit} invalid={!!merchant && sp.get("scan") !== "1"} />
      )}
    </div>
  );
}

// ---------- 1. Escolher restaurante: QR ou lista ----------
function ScanStep({ tabbit, invalid }: { tabbit: TabbitContext; invalid: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState(invalid ? "That link doesn't point to a valid restaurant." : "");
  const [camOff, setCamOff] = useState(false);
  const { data: merchants } = useLoad(() => tabbit.client.listMerchants(), [tabbit.client]);

  const onScan = (codes: { rawValue: string }[]) => {
    try {
      const u = new URL(codes[0].rawValue);
      const m = u.searchParams.get("merchant");
      if (!u.pathname.startsWith("/pay") || !isKey(m)) throw new Error();
      const a = u.searchParams.get("amount");
      router.replace(`/pay?merchant=${m}${a ? `&amount=${encodeURIComponent(a)}` : ""}`);
    } catch {
      setMsg("This QR code is not a Tabbit restaurant code. Try another one.");
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Pay a restaurant</h1>
      {!camOff && (
        <div className="overflow-hidden rounded-3xl border-4 border-ink bg-ink shadow-[0_20px_50px_-20px] shadow-brand/60">
          <Scanner
            onScan={onScan}
            onError={() => setCamOff(true)}
            formats={["qr_code"]}
            sound={false}
            components={{ finder: true }}
          />
        </div>
      )}
      {camOff && <p className="rounded-xl bg-ink/5 p-3 text-sm">Camera unavailable. Allow camera access in your browser, or pick a restaurant below.</p>}
      <ErrorText>{msg}</ErrorText>
      <Card title={camOff ? "Choose a restaurant" : "Or choose a restaurant"}>
        <ul className="divide-y divide-ink/10">
          {(merchants ?? []).filter((m) => m.active).map((m) => (
            <li key={m.wallet.toBase58()}>
              <Link href={`/pay?merchant=${m.wallet.toBase58()}`} className="flex items-center justify-between gap-2 py-3 hover:opacity-70">
                <span className="font-medium">{m.name}</span>
                <CategoryBadge category={m.category} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------- 2. Valor → confirmar → resultado ----------
type Step = "edit" | "confirm" | "pending" | "blocked" | "done";

function PayFlow({ tabbit, merchant, initialAmount }: { tabbit: TabbitContext; merchant: PublicKey; initialAmount: string }) {
  const { client, actor } = tabbit;
  const { data, error, loading, reload } = useLoad(async () => {
    const [m, e] = await Promise.all([client.getMerchant(merchant), client.getEmployeeByWallet(actor!)]);
    return { m, e };
  }, [client, actor, merchant]);

  const demo = useDemo(!tabbit.isMock);
  const [amountStr, setAmountStr] = useState(initialAmount);
  const [step, setStep] = useState<Step>("edit");
  const [inputErr, setInputErr] = useState("");
  const [failure, setFailure] = useState("");
  const [receipt, setReceipt] = useState<{ sig: string; ts: number } | null>(null);

  if (error) return <ErrorText>{friendlyError(error)}</ErrorText>;
  if (loading && !data) return <p className="opacity-60">Loading…</p>;
  const m: MerchantAccount | null | undefined = data?.m;
  const e = data?.e;

  if (!m || !m.active)
    return (
      <Blocked title="Restaurant not available" text="This restaurant is not registered or is not accepting Tabbit right now." />
    );
  if (!e)
    return demo?.enabled ? (
      <DemoOffer demo={demo} wallet={actor!} onEnrolled={reload} />
    ) : (
      <NotLinked
        title="No meal benefit linked to this wallet"
        hint="Send this wallet address to your employer so they can add you."
        address={actor!.toBase58()}
      />
    );

  const amount = parseUsdc(amountStr);

  const confirm = async () => {
    if (!amount) return;
    setStep("pending");
    try {
      const sig = await client.pay({ merchant, amount });
      setReceipt({ sig, ts: Math.floor(Date.now() / 1000) });
      setStep("done");
    } catch (err) {
      setFailure(friendlyError(err));
      setStep("blocked");
    }
    reload();
  };

  if (step === "done" && receipt && amount)
    return (
      <Card className="text-center">
        <ResultIcon ok />
        <h1 className="text-2xl font-bold">Payment sent</h1>
        <p className="mt-1 font-display text-4xl font-black"><Money base={amount} /></p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="opacity-60">Paid to</dt><dd className="font-medium">{m.name}</dd></div>
          <div className="flex justify-between"><dt className="opacity-60">When</dt><dd>{fmtTime(receipt.ts)}</dd></div>
          <div className="flex justify-between"><dt className="opacity-60">Transaction</dt><dd className="font-mono">{shortKey(receipt.sig)}{tabbit.isMock && " (simulated transaction)"}</dd></div>
        </dl>
        <a className="mt-4 inline-block text-sm underline" href={explorerTxUrl(receipt.sig)} target="_blank" rel="noreferrer">View on Solana Explorer</a>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/employee" className="btn-primary">Done</Link>
          <button className="btn-secondary" onClick={() => { setAmountStr(""); setStep("edit"); }}>Pay again</button>
        </div>
      </Card>
    );

  if (step === "blocked")
    return (
      <div role="alert" className="rounded-3xl border-2 border-red-500 bg-red-50 p-6 text-center">
        <ResultIcon ok={false} />
        <h1 className="text-2xl font-bold text-red-800">Payment blocked</h1>
        <p className="mt-2 text-lg font-semibold text-red-700">{failure}</p>
        <p className="mt-1 text-sm text-red-700/80">The rule was enforced by the program. Nothing was charged.</p>
        <button className="btn-danger mt-5 w-full" onClick={() => setStep("edit")}>Try another amount</button>
      </div>
    );

  if (step === "confirm" || step === "pending")
    return (
      <Card title="Confirm payment">
        <dl className="space-y-2">
          <div className="flex justify-between"><dt className="opacity-60">Restaurant</dt><dd className="font-medium">{m.name}</dd></div>
          <div className="flex justify-between"><dt className="opacity-60">Amount</dt><dd className="font-semibold"><Money base={amount!} /></dd></div>
        </dl>
        <button className="btn-primary mt-5 w-full !py-3.5 text-lg" disabled={step === "pending"} onClick={confirm}>
          {step === "pending" ? "Confirming…" : "Confirm payment"}
        </button>
        <button className="btn-secondary mt-2 w-full" disabled={step === "pending"} onClick={() => setStep("edit")}>Back</button>
      </Card>
    );

  return (
    <Card>
      <p className="text-sm opacity-60">Paying</p>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{m.name}</h1>
        <CategoryBadge category={m.category} />
      </div>
      <form
        className="mt-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!amount || amount === 0n) return setInputErr("Enter an amount in USDC, for example 12.50");
          setInputErr("");
          setStep("confirm");
        }}
      >
        <label className="label" htmlFor="amount">Amount (USDC)</label>
        <input id="amount" className="input !py-3 text-2xl font-semibold" inputMode="decimal" autoFocus placeholder="0.00" value={amountStr} onChange={(ev) => setAmountStr(ev.target.value)} />
        {amount ? <p className="mt-1 text-sm opacity-70">≈ <Money base={amount} /></p> : null}
        <ErrorText>{inputErr}</ErrorText>
        <p className="mt-3 text-sm opacity-70">Available today: <b><Money base={availableToday(e)} /></b></p>
        <button className="btn-primary mt-5 w-full !py-3.5 text-lg" type="submit">Continue</button>
      </form>
    </Card>
  );
}

function Blocked({ title, text }: { title: string; text: string }) {
  return (
    <div role="alert" className="rounded-3xl border-2 border-red-500 bg-red-50 p-6 text-center">
      <h1 className="text-xl font-bold text-red-800">{title}</h1>
      <p className="mt-2 text-red-700">{text}</p>
      <Link href="/pay?scan=1" className="btn-danger mt-5 w-full">Pick another restaurant</Link>
    </div>
  );
}
