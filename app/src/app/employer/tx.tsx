"use client";
// Estado de uma escrita (pendente / erro / assinatura) + mensagem de resultado, comum a todos os formulários.
import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { explorerTxUrl } from "@/lib/tabbit";
import { ErrorText } from "@/components/ui";

export function useTx() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sig, setSig] = useState<string>();
  /** Roda a escrita; `onOk` só roda se der certo (ex.: recarregar dados). */
  async function run(write: () => Promise<string>, onOk?: () => void | Promise<unknown>) {
    setPending(true);
    setError(undefined);
    setSig(undefined);
    try {
      setSig(await write());
      await onOk?.();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPending(false);
    }
  }
  return { pending, error, sig, setError, run };
}

export function TxStatus({ error, sig, isMock }: { error?: string; sig?: string; isMock: boolean }) {
  return (
    <>
      <ErrorText>{error}</ErrorText>
      {sig && !error && (
        <p role="status" className="text-sm font-medium text-emerald-800">
          Done.{" "}
          <a className="underline" href={explorerTxUrl(sig)} target="_blank" rel="noreferrer">
            View transaction{isMock ? " (simulated)" : ""}
          </a>
        </p>
      )}
    </>
  );
}
