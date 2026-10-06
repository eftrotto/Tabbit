import { Header } from "@/components/header";
import { EmployeeLoginProvider } from "@/lib/employee-wallet";

// Telas do app (empresa, funcionário, restaurante). A landing em / tem layout próprio
// e não carrega o login do funcionário (Privy), que é pesado.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmployeeLoginProvider>
      {/* Fundo com brilho suave da marca */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
        <div className="animate-drift absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand/20 blur-3xl" />
        <div className="animate-drift absolute -bottom-48 -right-32 h-[36rem] w-[36rem] rounded-full bg-teal-300/20 blur-3xl [animation-delay:-8s]" />
      </div>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 print:p-0">{children}</main>
    </EmployeeLoginProvider>
  );
}
