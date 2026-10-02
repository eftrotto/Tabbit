// Lado do app do fee payer: descobre a chave do patrocinador e manda os pagamentos para /api/sponsor.
import { PublicKey, type Transaction } from "@solana/web3.js";
import type { TabbitSponsor } from "@tabbit/sdk";

let sponsorKey: Promise<PublicKey | null> | null = null;

/** Chave pública do patrocinador, ou null se o servidor não tiver um configurado. Busca uma vez só. */
export function fetchSponsorKey(): Promise<PublicKey | null> {
  sponsorKey ??= fetch("/api/sponsor")
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { publicKey?: string } | null) => (body?.publicKey ? new PublicKey(body.publicKey) : null))
    .catch(() => null);
  return sponsorKey;
}

export function sponsorFor(publicKey: PublicKey): TabbitSponsor {
  return {
    publicKey,
    async signAndSend(tx: Transaction) {
      const res = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: tx.serialize({ requireAllSignatures: false }).toString("base64") }),
      });
      const body = (await res.json().catch(() => ({}))) as { signature?: string; error?: string };
      if (!res.ok || !body.signature) throw new Error(body.error ?? "Payment could not be sent");
      return body.signature;
    },
  };
}
