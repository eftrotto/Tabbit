// Torna o Tabbit instalável no celular ("Adicionar à tela inicial"). Abre na tela do funcionário,
// que é quem usa o app no dia a dia; empresa e restaurante usam pelo navegador.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tabbit",
    short_name: "Tabbit",
    description: "Meal benefits on Solana. Pay by QR, restaurants get paid in seconds.",
    start_url: "/employee",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#1ee88a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
