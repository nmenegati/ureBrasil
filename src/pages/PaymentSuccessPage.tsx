import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { CheckCircle, Loader2, CreditCard, Truck, Shield, X, Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { useAuth } from "@/hooks/useAuth";

const PaymentSuccessPage = () => {
  useOnboardingGuard("upsell_physical");

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isPhysicalCard, setIsPhysicalCard] = useState<boolean | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isPhysicalPlan, setIsPhysicalPlan] = useState<boolean>(false);
  const [isStandalonePhysical, setIsStandalonePhysical] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const formatPrice = (price: number | null) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price ?? 0);
  };

  useEffect(() => {
    const checkIfPhysicalCard = async (paymentId: string) => {
      try {
        const { data: card } = await supabase
          .from("student_cards")
          .select("is_physical")
          .eq("payment_id", paymentId)
          .maybeSingle();

        if (card?.is_physical) {
          setIsPhysicalCard(true);
          setTimeout(() => {
            navigate("/upload-documentos", { replace: true });
          }, 2000);
        } else {
          setIsPhysicalCard(false);
          setTimeout(() => {
            setShowUpsellModal(true);
          }, 2000);
        }
      } catch (error) {
        console.error("Erro ao verificar carteirinha:", error);
        setIsPhysicalCard(false);
        setTimeout(() => {
          setShowUpsellModal(true);
        }, 2000);
      }
    };

    const handleNavigation = async () => {
      if (!user) return;

      const state = (location.state as {
        paymentId?: string;
        planName?: string;
        amount?: number;
        paymentMethod?: string;
        isPhysicalPlan?: boolean;
        isStandalonePhysical?: boolean;
      }) || {};

      const recentPaymentId = localStorage.getItem("recent_payment_id");

      let step: string | null = null;

      if (user) {
        try {
          const { data } = await supabase
            .from("student_profiles")
            .select("current_onboarding_step")
            .eq("user_id", user.id)
            .maybeSingle();

          step = (data?.current_onboarding_step as string | null) ?? null;
        } catch (err) {
          console.error("Erro ao buscar current_onboarding_step em PaymentSuccessPage:", err);
        }
      }

      console.log("🔍 [PaymentSuccess DEBUG]");
      console.log("Step no banco:", step);
      console.log("State:", state);
      console.log("Recent payment:", recentPaymentId);
      console.log("User:", user?.id);

      if (step === "completed") {
        navigate("/carteirinha", { replace: true });
        return;
      }

      if (step === "review_data") {
        navigate("/gerar-carteirinha", { replace: true });
        return;
      }

      if (step === "pending_validation") {
        navigate("/status-validacao", { replace: true });
        return;
      }

      if (step === "upload_documents") {
        navigate("/upload-documentos", { replace: true });
        return;
      }

      if (state.paymentId) {
        setPaymentId(state.paymentId);
        setPlanName(state.planName ?? null);
        setAmount(state.amount ?? null);
        setPaymentMethod(state.paymentMethod ?? null);
        setIsPhysicalPlan(!!state.isPhysicalPlan);
        setIsStandalonePhysical(!!state.isStandalonePhysical);
        localStorage.setItem("recent_payment_id", state.paymentId);

        if (state.isPhysicalPlan) {
          setIsPhysicalCard(true);
          setShowUpsellModal(false);

          const target = state.isStandalonePhysical ? "/carteirinha" : "/upload-documentos";
          setTimeout(() => {
            navigate(target, { replace: true });
          }, 2000);
        } else {
          checkIfPhysicalCard(state.paymentId);
        }
        return;
      }

      if (recentPaymentId) {
        setPaymentId(recentPaymentId);
        checkIfPhysicalCard(recentPaymentId);
        return;
      }

      if (user) {
        supabase
          .from("student_profiles")
          .select("id, current_onboarding_step")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(async ({ data }) => {
            if (!data?.id) {
              navigate("/complete-profile", { replace: true });
              return;
            }

            const currentStep = (data.current_onboarding_step as string | null) ?? null;

            if (currentStep === "completed") {
              navigate("/carteirinha", { replace: true });
              return;
            }

            if (currentStep === "review_data") {
              navigate("/gerar-carteirinha", { replace: true });
              return;
            }

            if (currentStep === "pending_validation") {
              navigate("/status-validacao", { replace: true });
              return;
            }

            if (currentStep === "upload_documents") {
              navigate("/upload-documentos", { replace: true });
              return;
            }

            const STEPS_BEFORE_UPLOAD = [
              "complete_profile",
              "choose_plan",
              "payment",
              "upsell_physical",
              "payment_upsell",
            ] as const;

            if (!currentStep || STEPS_BEFORE_UPLOAD.includes(currentStep)) {
              await supabase
                .from("student_profiles")
                .update({ current_onboarding_step: "upload_documents" })
                .eq("id", data.id);
              navigate("/upload-documentos", { replace: true });
              return;
            }

            navigate("/upload-documentos", { replace: true });
          })
          .catch(() => {
            navigate("/upload-documentos", { replace: true });
          });
      } else {
        navigate("/upload-documentos", { replace: true });
      }
    };

    handleNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, user?.id]);

  const handleAcceptUpsell = async () => {
    setLoading(true);

    try {
      if (user) {
        const { data: profileRow } = await supabase
          .from("student_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileRow?.id) {
          const { error: stepError } = await supabase
            .from("student_profiles")
            .update({ current_onboarding_step: "payment_upsell" })
            .eq("id", profileRow.id);

          if (stepError) {
            console.warn("Erro ao atualizar current_onboarding_step (não crítico):", stepError);
          }
        }
      }

      if (paymentId) {
        localStorage.setItem(
          "upsell_data",
          JSON.stringify({
            originalPaymentId: paymentId,
            amount: 15,
            isUpsell: true,
            timestamp: Date.now(),
          }),
        );
      }

      navigate("/checkout", {
        state: {
          isUpsell: true,
          originalPaymentId: paymentId,
          upsellAmount: 15.0,
        },
        replace: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineUpsell = async () => {
    setShowUpsellModal(false);
    localStorage.removeItem("recent_payment_id");

    if (user) {
      const { data: profileRow } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileRow?.id) {
        const { error: stepError } = await supabase
          .from("student_profiles")
          .update({ current_onboarding_step: "upload_documents" })
          .eq("id", profileRow.id);

        if (stepError) {
          console.warn("Erro ao atualizar current_onboarding_step (não crítico):", stepError);
        }
      }
    }

    navigate("/upload-documentos", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ure-gradient-start to-ure-gradient-end relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>

      <Header variant="app" />
      
      <main className="relative z-10 container max-w-lg mx-auto px-4 py-8">
        <div className="text-center">
          {/* Ícone de sucesso */}
          <div className="w-24 h-24 bg-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
            <CheckCircle className="w-14 h-14 text-green-400" />
          </div>
          
          {/* Mensagem */}
          <h1 className="text-2xl font-bold mb-3 text-white">
            Pagamento Aprovado!
          </h1>
          <p className="text-white/80 text-sm mb-8">
            {planName ? (
              <>
                {paymentMethod === "pix" ? "PIX aprovado. " : "Pagamento aprovado. "}
                Você adquiriu <span className="font-semibold">{planName}</span>
                {typeof amount === "number" && (
                  <>
                    {" "}
                    por <span className="font-semibold">{formatPrice(amount)}</span>
                  </>
                )}
                . Agora envie seus documentos para validar sua carteirinha.
              </>
            ) : (
              "Agora envie seus documentos para validar sua carteirinha."
            )}
          </p>
          
          {/* Loader de redirecionamento */}
          {!showUpsellModal && (
            <div className="flex items-center justify-center gap-3 text-white/70">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">
                {isPhysicalCard === null 
                  ? 'Processando...' 
                  : 'Redirecionando para envio de documentos...'}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Upsell */}
      <Dialog open={showUpsellModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-white">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center relative">
            <button 
              onClick={handleDeclineUpsell}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <Badge className="bg-white/20 text-white border-0 mb-3 text-xs font-semibold">
              🎉 OFERTA ESPECIAL
            </Badge>
            <h2 className="text-xl font-bold text-white mb-1">
              Adicione a Carteirinha Física!
            </h2>
            <p className="text-white/90 text-sm">
              Oferta válida apenas agora
            </p>
          </div>

          {/* Conteúdo (oferta especial com economia) */}
          <div className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold">🎉 Oferta Especial!</h3>
              <p className="text-lg">
                Adicione a <span className="font-bold">Carteirinha Física</span>, com frete incluso, por apenas
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold text-ure-green">R$ 15,00</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Economize 40% na compra conjunta!
              </p>
              <Alert className="text-left">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  A carteirinha física <strong>não é obrigatória</strong>. Sua carteirinha digital já é 100% válida e aceita em todo Brasil.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleAcceptUpsell}
                disabled={loading}
                className="flex-1 bg-ure-green hover:bg-ure-green/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Sim, quero por R$ 15! 🎁'
                )}
              </Button>
              <Button
                onClick={handleDeclineUpsell}
                variant="outline"
                className="flex-1"
              >
                Não, obrigado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentSuccessPage;
