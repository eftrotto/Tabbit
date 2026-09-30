import { Header } from "@/components/header";

// Telas do app (empresa, funcionário, restaurante). A landing em / tem layout próprio.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
