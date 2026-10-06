"use client";
// Extrato mensal do funcionário.
import { DemoBanner } from "@/components/ui";
import { StatementView } from "@/components/statement-view";
import { useTabbit } from "@/lib/tabbit";
import { EmployeeSignIn } from "../shared";

export default function EmployeeStatementPage() {
  const { client, actor, isMock, isDemoPersona } = useTabbit("employee");
  return (
    <div className="mx-auto max-w-2xl">
      <DemoBanner isMock={isMock} isDemoPersona={isDemoPersona} persona="João (employee)" />
      {!actor ? (
        <EmployeeSignIn what="Sign in to see your monthly statement." walletWhat="Connect your wallet to see your monthly statement." />
      ) : (
        <StatementView client={client} filter={{ employee: actor }} title="My meal statement" back="/employee" byEmployee={false} fileName="tabbit-statement" isMock={isMock} />
      )}
    </div>
  );
}
