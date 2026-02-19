import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { CheckCircle, Loader2, CreditCard, Truck, Shield, X, Info } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { useAuth } from "@/hooks/useAuth";

/**
 * FLUXO DO USUÁRIO:
 * 1. Chega em /pagamento/sucesso após pagamento aprovado do plano digital.
 * 2. Página lê dados do pagamento de location.state ou de recent_payment_id no localStorage.
 * 3. Exibe confirmação de pagamento e, após um pequeno delay, abre modal de upsell
 *    oferecendo a carteira física com desconto (fisica_upsell).
 * 4. Usuário pode aceitar a oferta (navega para /checkout com dados de upsell) ou recusar
 *    e seguir para o fluxo padrão (ex.: upload de documentos ou carteirinha).
 *
 * ESTADOS DERIVADOS:
 * - isPhysicalPlan / isStandalonePhysical: indicam se o plano original já era físico.
 * - upsellPrice: valor atual do plano fisica_upsell buscado em plans.
 * - showUpsellModal: controla exibição do modal de oferta especial.
 *
 * GUARDS:
 * - useOnboardingGuard('upsell_physical'): garante que a página só é acessada na etapa
 *   correta do funil de pagamento.
 * - Verificações adicionais de usuário autenticado via useAuth.
 *
 * DEPENDÊNCIAS BACKEND:
 * - Tabela payments (identificação do pagamento recém-aprovado).
 * - Tabela plans (leitura do preço atual do plano fisica_upsell).
 * - Fluxo de checkout físico (/checkout) que usa originalPaymentId para adicionar a física.
 */
const PaymentSuccessPage = () => {
  const { isChecking } = useOnboardingGuard("upsell_physical");
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
  const [upsellPrice, setUpsellPrice] = useState<number | null>(null);

  const formatPrice = (price: number | null) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price ?? 0);
  };

  useEffect(() => {
    if (isChecking) return;

    const state = (location.state as {
      paymentId?: string;
      planName?: string;
      amount?: number;
      paymentMethod?: string;
      isPhysicalPlan?: boolean;
      isStandalonePhysical?: boolean;
    }) || {};

    if (state.paymentId) {
      setPaymentId(state.paymentId);
      setPlanName(state.planName ?? null);
      setAmount(state.amount ?? null);
      setPaymentMethod(state.paymentMethod ?? null);
      setIsPhysicalPlan(!!state.isPhysicalPlan);
      setIsStandalonePhysical(!!state.isStandalonePhysical);
      localStorage.setItem("recent_payment_id", state.paymentId);
    } else {
      const recentPaymentId = localStorage.getItem("recent_payment_id");
      if (recentPaymentId) {
        setPaymentId(recentPaymentId);
      }
    }

    const timeout = setTimeout(() => {
      setShowUpsellModal(true);
    }, 2000);

    const loadUpsellPrice = async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("price")
        .eq("type", "fisica_upsell")
        .eq("is_active", true)
        .single();

      if (error) {
        console.error("[PAYMENT_SUCCESS] Erro ao carregar preço de fisica_upsell:", {
          error: error.message,
        });
        return;
      }

      if (data) {
        setUpsellPrice(data.price);
      }
    };

    loadUpsellPrice();

    return () => clearTimeout(timeout);
  }, [isChecking, location.state]);

  const handleAcceptUpsell = async () => {
    if (!upsellPrice) return;

    setLoading(true);

    try {
      const state = (location.state as { paymentId?: string } | undefined) || {};
      const incomingPaymentId =
        state.paymentId || localStorage.getItem("recent_payment_id");

      if (incomingPaymentId) {
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .select("id, status")
          .eq("id", incomingPaymentId)
          .single();

        if (paymentError) {
          console.error("[PAYMENT_SUCCESS] Erro ao buscar pagamento para upsell:", {
            paymentId: incomingPaymentId,
            error: paymentError.message,
          });
          navigate("/pagamento");
          return;
        }

        if (!payment || payment.status !== "approved") {
          console.warn("[PAYMENT_SUCCESS] Pagamento não encontrado ou não aprovado:", incomingPaymentId);
          navigate("/pagamento");
          return;
        }
      }

      if (paymentId) {
        localStorage.setItem(
          "upsell_data",
          JSON.stringify({
            originalPaymentId: paymentId,
            amount: upsellPrice,
            isUpsell: true,
            timestamp: Date.now(),
          }),
        );
      }

      navigate("/checkout", {
        state: {
          isUpsell: true,
          originalPaymentId: paymentId,
          amount: upsellPrice,
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
      const { data: profileRow, error: profileError } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[PAYMENT_SUCCESS] Erro ao buscar profileRow ao recusar upsell:", {
          userId: user.id,
          error: profileError.message,
        });
      }

      if (profileRow?.id) {
        const { error: stepError } = await supabase
          .from("student_profiles")
          .update({ current_onboarding_step: "upload_documents" })
          .eq("id", profileRow.id);

        if (stepError) {
          console.warn("[PAYMENT_SUCCESS] Erro ao atualizar current_onboarding_step (não crítico):", stepError);
        }
      }
    }

    navigate("/upload-documentos", { replace: true });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
                . Agora envie seus documentos para validar sua Carteira URE.
              </>
            ) : (
              "Agora envie seus documentos para validar sua Carteira URE."
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
          <DialogTitle className="sr-only">Oferta de upgrade para carteirinha física</DialogTitle>
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
              Adicione a Carteira Física!
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
                Adicione a <span className="font-bold">Carteira Física</span>, com frete incluso, por apenas
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold text-ure-green">
                  {formatPrice(upsellPrice)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Economize 40% na compra conjunta!
              </p>
              <Alert className="text-left">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  A carteira física <strong>não é obrigatória</strong>. Sua Carteira do Estudante URE digital já é 100% válida e aceita em todo Brasil.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleAcceptUpsell}
                disabled={loading || !upsellPrice}
                className="flex-1 bg-ure-green hover:bg-ure-green/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  `Sim, quero por ${formatPrice(upsellPrice)}! 🎁`
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
