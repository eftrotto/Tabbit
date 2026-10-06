"use client";
// Extrato mensal da empresa: todos os funcionários, com resumo por pessoa e CSV para a contabilidade.
import { Card, DemoBanner, ErrorText } from "@/components/ui";
import { StatementView } from "@/components/statement-view";
import { friendlyError } from "@/lib/errors";
import { useLoad, useTabbit } from "@/lib/tabbit";

export default function EmployerStatementPage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("employer");
  const employer = useLoad(() => (actor ? client.getEmployer(actor) : Promise.resolve(null)), [client, actor]);
  return (
    <div>
      <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="Acme Corp (employer)" />
      {!actor ? (
        <Card title="Connect your wallet"><p className="text-sm opacity-70">Connect the wallet that owns your company vault, using the button in the header.</p></Card>
      ) : employer.error ? (
        <ErrorText>{friendlyError(employer.error)}</ErrorText>
      ) : employer.data === undefined ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : employer.data === null ? (
        <ErrorText>This wallet has no company on Tabbit.</ErrorText>
      ) : (
        <StatementView client={client} filter={{ employer: employer.data.address }} title={`${employer.data.name}: meal benefits statement`} back="/employer" byEmployee fileName="tabbit-company-statement" isMock={isMock} />
      )}
    </div>
  );
}
