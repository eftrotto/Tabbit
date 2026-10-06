"use client";
// Cartaz para imprimir e colar no balcão: QR grande do restaurante e o passo a passo.
// /merchant/poster?merchant=<carteira>. O restaurante abre pela própria tela; o admin, pela lista.
import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { QRCodeSVG } from "qrcode.react";
import { TabbitMark, Wordmark } from "@/components/brand";
import { ErrorText } from "@/components/ui";
import { useLoad, useTabbit } from "@/lib/tabbit";

export default function PosterPage() {
  return (
    <Suspense fallback={<p className="opacity-60">Loading…</p>}>
      <Poster />
    </Suspense>
  );
}

const walletFrom = (s: string | null) => {
  try {
    return s ? new PublicKey(s) : null;
  } catch {
    return null;
  }
};

function Poster() {
  const { client } = useTabbit("merchant");
  const wallet = walletFrom(useSearchParams().get("merchant"));
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const { data: merchant, error, loading } = useLoad(async () => (wallet ? client.getMerchant(wallet) : null), [client, wallet?.toBase58()]);

  if (!wallet) return <ErrorText>Open this page from the Restaurant screen.</ErrorText>;
  if (error) return <ErrorText>Could not load the restaurant.</ErrorText>;
  if (loading) return <p className="opacity-60">Loading…</p>;
  if (!merchant) return <ErrorText>This wallet is not a registered restaurant.</ErrorText>;

  const url = `${origin}/pay?merchant=${wallet.toBase58()}`;
  return (
    <div>
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/merchant" className="text-sm underline">← Back</Link>
        <button className="btn-primary" onClick={() => print()}>Print poster</button>
      </div>

      <article className="mx-auto flex max-w-[180mm] flex-col items-center rounded-[2rem] border-4 border-ink bg-white px-10 py-12 text-center text-ink print:rounded-none print:border-0 print:p-0">
        <div className="flex items-center gap-3 text-4xl">
          <TabbitMark className="h-14 w-auto" id="poster-mark" />
          <Wordmark />
        </div>
        <p className="mt-6 font-display text-5xl font-black leading-tight">Pay your meal with Tabbit</p>
        <p className="mt-2 text-xl opacity-70">Benefício refeição aceito aqui</p>

        <div className="mt-10 rounded-3xl border-[6px] border-brand p-5">
          {origin && <QRCodeSVG value={url} size={320} level="M" marginSize={0} />}
        </div>
        <p className="mt-6 font-display text-3xl font-black">{merchant.name}</p>

        <ol className="mt-8 grid w-full grid-cols-3 gap-4 text-left text-base">
          {[
            ["1", "Scan", "Point your phone camera at the code"],
            ["2", "Type the amount", "Or it comes filled in"],
            ["3", "Confirm", "Paid in seconds, nothing to install"],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-2xl bg-ink/[0.04] p-4">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand font-black">{n}</span>
              <b className="mt-2 block">{title}</b>
              <span className="text-sm opacity-70">{text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm opacity-60">Meal benefits on Solana · rules checked on-chain · tabbit-sol.vercel.app</p>
      </article>
    </div>
  );
}
