import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

export function PWAInstallBanner() {
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return;
    const diffMs = Date.now() - dismissedAt;
    if (diffMs < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      handleDismiss();
    }
  };

  const isAdminPath = location.pathname.startsWith("/admin");
  const shouldShow = canInstall && !isInstalled && !dismissed && !isAdminPath;

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-xl">
        <div className="rounded-xl border bg-white shadow-lg shadow-black/15 px-4 py-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Instalar URE Brasil
            </p>
            <p className="text-xs text-slate-600 truncate">
              Acesse mais rápido pela tela inicial do seu dispositivo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold"
              onClick={handleInstall}
            >
              Instalar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleDismiss}
              aria-label="Fechar banner de instalação"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

