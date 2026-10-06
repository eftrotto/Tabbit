"use client";
// Convite para instalar o Tabbit no celular. Android/Chrome: botão (evento beforeinstallprompt).
// iPhone: o Safari não tem esse evento, então mostra o caminho pelo menu Compartilhar.
import { useEffect, useState, useSyncExternalStore } from "react";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const noSubscribe = () => () => {};
const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallApp() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  // No servidor não dá para saber: conta como instalado, para não mostrar nada antes da hora
  const standalone = useSyncExternalStore(noSubscribe, isStandalone, () => true);
  const ios = useSyncExternalStore(noSubscribe, isIos, () => false);
  const installed = standalone || justInstalled;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!event && !ios)) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-paper/70 p-4 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0" />
      {event ? (
        <>
          <p className="flex-1">Add Tabbit to your home screen and pay like with any app.</p>
          <button
            className="btn-primary shrink-0 !px-3 !py-1.5 text-sm"
            onClick={async () => {
              await event.prompt();
              if ((await event.userChoice).outcome === "accepted") setJustInstalled(true);
              setEvent(null);
            }}
          >
            Install
          </button>
        </>
      ) : (
        <p className="flex-1">
          Use Tabbit like an app: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.
        </p>
      )}
    </div>
  );
}
