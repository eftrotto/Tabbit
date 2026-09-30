// Janela de horário: minutos do dia (0–1440) <-> "HH:MM" do <input type="time">.
export function minToHHMM(min: number): string {
  const m = Math.min(Math.max(min, 0), 1439);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "11:30–14:00" ou "Any time" quando não há janela (ambos 0). */
export function formatWindow(start: number, end: number): string {
  return start === 0 && end === 0 ? "Any time" : `${minToHHMM(start)}–${minToHHMM(end)}`;
}
