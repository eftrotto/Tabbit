// Prova de que quem pede o diretório é o dono da empresa: ele assina uma mensagem com a carteira
// (Sign in with Solana, sem servidor de sessão). O navegador monta e assina; o servidor confere.
import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

export const AUTH_HEADER = "x-tabbit-auth";
export const AUTH_VALID_SECONDS = 12 * 3600;
const CLOCK_SKEW_SECONDS = 120;

export function authMessage(wallet: string, issuedAt: number): string {
  return `Tabbit: open my company's employee directory\n\nWallet: ${wallet}\nIssued at: ${new Date(issuedAt * 1000).toISOString()}\n\nThis does not move any money.`;
}

interface AuthPayload {
  wallet: string;
  issuedAt: number; // unix
  signature: string; // base64
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function encodeAuth(wallet: string, issuedAt: number, signature: Uint8Array): string {
  return toB64(new TextEncoder().encode(JSON.stringify({ wallet, issuedAt, signature: toB64(signature) } satisfies AuthPayload)));
}

/** Confere o cabeçalho. Devolve a carteira autenticada ou o motivo da recusa. */
export function verifyAuth(header: string | null, now = Math.floor(Date.now() / 1000)): { wallet: PublicKey } | { error: string } {
  if (!header) return { error: "Sign in with your company wallet first" };
  let payload: AuthPayload;
  let wallet: PublicKey;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64(header)));
    wallet = new PublicKey(payload.wallet);
  } catch {
    return { error: "Invalid sign-in" };
  }
  if (typeof payload.issuedAt !== "number" || payload.issuedAt > now + CLOCK_SKEW_SECONDS) return { error: "Invalid sign-in" };
  if (now - payload.issuedAt > AUTH_VALID_SECONDS) return { error: "Sign-in expired, sign again" };
  let ok = false;
  try {
    ok = ed25519.verify(fromB64(payload.signature), new TextEncoder().encode(authMessage(payload.wallet, payload.issuedAt)), wallet.toBytes());
  } catch {
    ok = false;
  }
  return ok ? { wallet } : { error: "Invalid signature" };
}
