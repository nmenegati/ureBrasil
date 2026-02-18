import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check, CheckCircle, Copy, Clock, QrCode } from "lucide-react";

interface PaymentPixState {
  paymentData?: {
    pix_code?: string;
    qr_code_base64?: string | null;
    payment_id?: string;
    amount?: number;
  };
  returnTo?: string;
  successMessage?: string;
}

export default function PagamentoPix() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as PaymentPixState) || {};
  const { paymentData, returnTo, successMessage } = state;

  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutos em segundos

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const amount = paymentData?.amount ?? 0;
  const pixCode = paymentData?.pix_code ?? "";
  const qrCodeBase64 = paymentData?.qr_code_base64 ?? "";
  const paymentId = paymentData?.payment_id;

  const formattedAmount = useMemo(() => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount || 0);
  }, [amount]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0",
    )}`;
  }, [timeLeft]);

  useEffect(() => {
    if (!paymentId) return;

    pollRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("status")
        .eq("id", paymentId)
        .single();

      if (error) {
        console.error("[PIX] Erro ao consultar status:", error.message);
        return;
      }
      if (data?.status === "approved") {
        if (pollRef.current) clearInterval(pollRef.current);
        setPaymentConfirmed(true);
  
        // Salvar payment_id para PaymentSuccessPage poder ler
        if (paymentId) {
          localStorage.setItem("recent_payment_id", paymentId);
        }
  
        toast.success(successMessage || "Pagamento confirmado!");
        setTimeout(() => {
          window.location.href = returnTo || "/upload-documentos";
        }, 2000);
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paymentId, returnTo, successMessage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (pollRef.current) clearInterval(pollRef.current);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setExpired(true);
    }, 10 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, []);

  const handleCopy = async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o código PIX.");
    }
  };

  const handleCancel = () => {
    navigate("/pagamento", { replace: true });
  };

  const showWaiting = !paymentConfirmed && !expired;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header variant="app" />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl font-semibold">
              Pagamento via PIX
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Use o QR Code ou o código copia e cola para concluir o pagamento
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Valor</p>
              <p className="text-3xl font-bold text-primary">
                {formattedAmount}
              </p>
            </div>

            {qrCodeBase64 ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border border-border overflow-hidden">
                  <img
                    src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Escaneie o QR Code com o app do seu banco
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full border flex items-center justify-center bg-muted">
                  <QrCode className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  QR Code não disponível. Use o código PIX copia e cola abaixo.
                </p>
              </div>
            )}

            {pixCode && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Código PIX copia e cola
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <textarea
                      className="w-full text-xs border rounded-md px-2 py-2 bg-muted resize-none h-16"
                      readOnly
                      value={pixCode}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Expira em {formattedTime}</span>
              </div>
              {showWaiting && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Aguardando confirmação...</span>
                </div>
              )}
              {paymentConfirmed && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Pagamento confirmado!</span>
                </div>
              )}
              {expired && !paymentConfirmed && (
                <div className="flex items-center gap-2 text-red-600">
                  <Clock className="w-4 h-4" />
                  <span>Tempo esgotado</span>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Abra o app do seu banco, escolha pagar com PIX e escaneie o QR
                Code ou cole o código copia e cola.
              </p>
              <p>
                Assim que o pagamento for confirmado pelo banco, vamos avançar
                automaticamente.
              </p>
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={handleCancel}
                disabled={paymentConfirmed}
              >
                Cancelar e voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

