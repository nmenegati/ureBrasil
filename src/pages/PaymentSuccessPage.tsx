import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PaymentData {
  planName: string;
  amount: number;
  paymentId: string;
  cardType?: string;
  paymentMethod?: string;
}

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showUpsell, setShowUpsell] = useState(true);
  const [loadingUpsell, setLoadingUpsell] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar dados do pagamento
  useEffect(() => {
    const loadPaymentData = async () => {
      // Tentar obter dados do location.state primeiro
      const stateData = location.state as PaymentData | undefined;
      
      if (stateData?.planName && stateData?.amount) {
        setPaymentData(stateData);
        setLoading(false);
        return;
      }

      // Fallback: buscar último pagamento aprovado do usuário
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        // Buscar perfil do estudante
        const { data: profile } = await supabase
          .from("student_profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!profile) {
          navigate("/dashboard");
          return;
        }

        // Buscar último pagamento aprovado
        const { data: payment } = await supabase
          .from("payments")
          .select(`
            id,
            amount,
            payment_method,
            plan_id,
            plans (
              name,
              type
            )
          `)
          .eq("student_id", profile.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (payment && payment.plans) {
          const planData = payment.plans as { name: string; type: string };
          setPaymentData({
            planName: planData.name,
            amount: Number(payment.amount),
            paymentId: payment.id,
            cardType: planData.type,
            paymentMethod: payment.payment_method,
          });
        }
      } catch (error) {
        console.error("Erro ao carregar dados do pagamento:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPaymentData();
  }, [user, location.state, navigate]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleAcceptUpsell = async () => {
    if (!user || !paymentData) return;
    
    setLoadingUpsell(true);

    try {
      // Buscar perfil do estudante
      const { data: profile } = await supabase
        .from("student_profiles")
        .select("id, plan_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        throw new Error("Perfil não encontrado");
      }

      // CRIAR NOVO PAGAMENTO para carteirinha física (NÃO alterar o original!)
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          student_id: profile.id,
          plan_id: profile.plan_id,
          amount: 15.00,
          payment_method: 'credit_card',
          status: 'approved',
          confirmed_at: new Date().toISOString(),
          metadata: {
            is_upsell: true,
            original_payment_id: paymentData.paymentId,
            description: 'Carteirinha física - Upsell'
          }
        });

      if (paymentError) throw paymentError;

      // ATUALIZAR CARTEIRINHA existente para incluir física
      const { error: cardError } = await supabase
        .from("student_cards")
        .update({ 
          is_physical: true,
          updated_at: new Date().toISOString()
        })
        .eq("payment_id", paymentData.paymentId);

      if (cardError) throw cardError;

      toast.success("Pedido confirmado! Sua carteirinha física será enviada em breve.");
      setShowUpsell(false);
    } catch (error) {
      console.error("Erro ao processar upsell:", error);
      toast.error("Não foi possível processar o pedido. Tente novamente.");
    } finally {
      setLoadingUpsell(false);
    }
  };

  const handleDeclineUpsell = () => {
    setShowUpsell(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>

      <Header variant="app" />
      
      <main className="relative z-10 container max-w-lg mx-auto px-4 py-8">
        {/* Confirmação de Pagamento */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">Pagamento Confirmado!</h1>
          <p className="text-white/80 text-sm">
            Sua carteirinha digital já está disponível no seu perfil
          </p>
        </div>

        {/* Card Resumo da Compra */}
        <Card className="p-4 mb-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg border-0">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">
                {paymentData?.planName || "Carteirinha Digital"}
              </h3>
              <p className="text-muted-foreground text-xs mb-2">
                Pagamento processado com sucesso
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground text-xs">Valor pago:</span>
                <span className="text-green-500 font-semibold">
                  {formatPrice(paymentData?.amount || 29)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Bump Offer */}
        {showUpsell ? (
          <Card className="relative overflow-hidden border-2 border-primary/50 p-5 mb-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg">
            {/* Badge destaque */}
            <div className="absolute top-3 right-3">
              <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                OFERTA ESPECIAL
              </span>
            </div>

            <div className="pt-2">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Truck className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Quer receber também em casa?</h3>
                  <p className="text-muted-foreground text-sm">Carteirinha física de PVC de alta qualidade</p>
                </div>
              </div>

              {/* Benefícios */}
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Material PVC de alta durabilidade</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Frete grátis para todo Brasil</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Entrega em 7-10 dias úteis</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Mesmos benefícios da digital</span>
                  </li>
                </ul>
              </div>

              {/* Preço */}
              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-center">
                <p className="text-muted-foreground text-xs mb-1">Adicione agora por apenas</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-muted-foreground text-sm line-through">R$ 29,90</span>
                  <span className="text-3xl font-bold">R$ 15,00</span>
                </div>
                <p className="text-green-500 text-xs font-semibold mt-1">
                  50% de desconto • Oferta única
                </p>
              </div>

              {/* Botões */}
              <div className="space-y-3">
                <Button
                  onClick={handleAcceptUpsell}
                  disabled={loadingUpsell}
                  className="w-full py-6"
                >
                  {loadingUpsell ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Sim, quero receber em casa!
                    </span>
                  )}
                </Button>
                <button
                  onClick={handleDeclineUpsell}
                  className="w-full text-muted-foreground hover:text-foreground text-sm py-3 transition-colors"
                >
                  Não, obrigado. Só a digital mesmo.
                </button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center mb-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg border-0">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Tudo pronto!</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Sua carteirinha digital está disponível no painel
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full py-4">
              Ir para o Painel
            </Button>
          </Card>
        )}

        {/* Próximos Passos */}
        <Card className="p-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg border-0">
          <h3 className="font-semibold mb-3 text-sm">Próximos Passos</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">1</span>
              </div>
              <div>
                <p className="text-sm font-medium">Acesse seu painel</p>
                <p className="text-muted-foreground text-xs">Visualize sua carteirinha digital</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">2</span>
              </div>
              <div>
                <p className="text-sm font-medium">Baixe ou salve</p>
                <p className="text-muted-foreground text-xs">Mantenha sempre disponível no celular</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">3</span>
              </div>
              <div>
                <p className="text-sm font-medium">Use seus benefícios</p>
                <p className="text-muted-foreground text-xs">Milhares de estabelecimentos parceiros</p>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default PaymentSuccessPage;
