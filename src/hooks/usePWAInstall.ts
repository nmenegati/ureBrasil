import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [wasPromptAvailable, setWasPromptAvailable] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.localStorage.getItem("pwa-prompt-available") === "true") {
      setWasPromptAvailable(true);
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const navStandalone = (navigator as any).standalone;
    if (navStandalone === true) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      setWasPromptAvailable(true);
      try {
        window.localStorage.setItem("pwa-prompt-available", "true");
      } catch {
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    const handleInstalled = () => {
      setCanInstall(false);
      setIsInstalled(true);
      deferredPrompt.current = null;
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt.current) return false;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    return outcome === "accepted";
  };

  return { canInstall, isInstalled, promptInstall, wasPromptAvailable };
}
