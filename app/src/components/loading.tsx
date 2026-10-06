"use client";
// Carregamento padrão do app: o orb "solving" no verde da marca.
// "page" para a tela inteira esperando; "inline" dentro de cartões e tabelas.
import { ThinkingOrb } from "thinking-orbs";

const COLOR = "#07574f";

export function Loading({ message = "Loading…", hint, variant = "page" }: { message?: string; hint?: string; variant?: "page" | "inline" }) {
  if (variant === "inline")
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-3 py-2 text-sm opacity-80">
        <ThinkingOrb state="solving" size={32} theme="light" color={COLOR} aria-label={message} />
        <span>{message}</span>
      </div>
    );
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {/* Desenho de 64 px ampliado: o componente só tem presets de 20, 32 e 64 */}
      <ThinkingOrb state="solving" size={64} theme="light" color={COLOR} style={{ width: 96, height: 96 }} aria-label={message} />
      <p className="font-semibold">{message}</p>
      {hint && <p className="max-w-sm text-sm opacity-60">{hint}</p>}
    </div>
  );
}
