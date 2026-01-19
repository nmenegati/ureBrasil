import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CreditCard, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  payment_method: string;
  installments?: number | null;
  card_last_digits?: string | null;
  card_brand?: string | null;
  gateway_reference_id?: string | null;
  metadata: any;
}

export default function MeusPagamentos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [digitalPayment, setDigitalPayment] = useState<Payment | null>(null);
  const [physicalPayment, setPhysicalPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const loadPayments = async () => {
      if (!user) return;

      try {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError || !profile) {
          toast.error("Perfil não encontrado");
          navigate("/dashboard");
          return;
        }

        const { data: payments, error } = await supabase
          .from("payments")
          .select("*")
          .eq("student_id", profile.id)
          .order("created_at", { ascending: false });

        if (error) {
          toast.error("Erro ao carregar pagamentos");
          return;
        }

        const digital = payments?.find(
          (p) => !p.metadata?.is_upsell && !p.metadata?.is_physical_upsell
        ) as Payment | undefined;

        const physical = payments?.find(
          (p) => p.metadata?.is_upsell || p.metadata?.is_physical_upsell
        ) as Payment | undefined;

        setDigitalPayment(digital || null);
        setPhysicalPayment(physical || null);
      } catch {
        toast.error("Erro ao carregar pagamentos");
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, [user, navigate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatPaymentMethod = (method: string | undefined) => {
    if (!method) return "-";
    if (method === "pix") return "PIX";
    if (method === "credit_card") return "Cartão de crédito";
    if (method === "debit_card") return "Cartão de débito";
    if (method === "boleto") return "Boleto";
    return method;
  };

  const getCardLastDigits = (payment: Payment | null) => {
    if (!payment) return null;
    return (
      payment.card_last_digits ||
      payment.metadata?.card_last_digits ||
      null
    );
  };

  const formatInstallmentsInfo = (payment: Payment | null) => {
    if (!payment) return null;
    if (
      payment.payment_method !== "credit_card" &&
      payment.payment_method !== "debit_card"
    ) {
      return null;
    }
    const installments = payment.installments || 1;
    if (installments <= 1) {
      return "À vista";
    }
    const perInstallment = payment.amount / installments;
    return `${installments}x de ${formatCurrency(perInstallment)}`;
  };

  const renderDetails = (payment: Payment | null) => {
    if (!payment) return null;

    const methodLabel = formatPaymentMethod(payment.payment_method);
    const installmentsInfo = formatInstallmentsInfo(payment);
    const lastDigits = getCardLastDigits(payment);
    const transactionId = payment.gateway_reference_id;

    return (
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>
          Forma de pagamento:{" "}
          <span className="text-foreground font-medium">{methodLabel}</span>
        </p>
        {(payment.payment_method === "credit_card" ||
          payment.payment_method === "debit_card") && (
          <>
            {lastDigits && (
              <p>
                Cartão final{" "}
                <span className="text-foreground font-medium">
                  {lastDigits}
                </span>
              </p>
            )}
            {installmentsInfo && <p>{installmentsInfo}</p>}
          </>
        )}
        {transactionId && (
          <p className="truncate">
            ID da transação:{" "}
            <span className="text-foreground">{transactionId}</span>
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar ao Dashboard
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Meus Pagamentos
        </h1>

        <div className="space-y-4">
          <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 shadow-xl shadow-black/10">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-lg text-foreground">
                  Carteirinha Digital
                </h2>
                {digitalPayment ? (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      Valor:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(digitalPayment.amount)}
                      </span>
                    </p>
                    <p>Data: {formatDate(digitalPayment.created_at)}</p>
                    <p className="flex items-center gap-1">
                      {digitalPayment.status === "approved" ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-green-600 font-medium">
                            Aprovado
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-yellow-500" />
                          <span className="text-yellow-600 font-medium">
                            {digitalPayment.status}
                          </span>
                        </>
                      )}
                    </p>
                    {renderDetails(digitalPayment)}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum pagamento de carteirinha digital encontrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 shadow-xl shadow-black/10">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-lg text-foreground">
                  Carteirinha Física
                </h2>
                {physicalPayment ? (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      Valor:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(physicalPayment.amount)}
                      </span>
                    </p>
                    <p>Data: {formatDate(physicalPayment.created_at)}</p>
                    <p className="flex items-center gap-1">
                      {physicalPayment.status === "approved" ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-green-600 font-medium">
                            Aprovado
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-yellow-500" />
                          <span className="text-yellow-600 font-medium">
                            {physicalPayment.status}
                          </span>
                        </>
                      )}
                    </p>
                    {renderDetails(physicalPayment)}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum pagamento de carteirinha física encontrado.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="pt-2">
            <Button
              className="w-full"
              onClick={() => navigate("/dashboard")}
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
