import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tabbit — Smart spending, verified.",
  description: "On-chain meal benefits on Solana. Employers fund in USDC, workers pay by QR, restaurants get paid in seconds.",
};

export const viewport: Viewport = { themeColor: "#1EE88A" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
