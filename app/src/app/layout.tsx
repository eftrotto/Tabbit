import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Fonte arredondada, próxima do wordmark do logo. latin-ext traz o "ı" usado no Wordmark.
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext"], weight: ["700", "800", "900"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tabbit-sol.vercel.app"),
  title: "Tabbit — Smart spending, verified.",
  description: "On-chain meal benefits on Solana. Employers fund in USDC, workers pay by QR, restaurants get paid in seconds.",
  openGraph: {
    title: "Tabbit — Smart spending, verified.",
    description: "Meal benefits with rules enforced on-chain. Restaurants get paid in seconds, for a 0.8% fee.",
  },
};

export const viewport: Viewport = { themeColor: "#1EE88A" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
