import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { CheckCircle, Loader2, CreditCard, Truck, Shield, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isPhysicalCard, setIsPhysicalCard] = useState<boolean | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = (location.state as { paymentId?: string })?.paymentId;
    if (id) {
      setPaymentId(id);
      localStorage.setItem('recent_payment_id', id);
      checkIfPhysicalCard(id);
    } else {
      // Sem paymentId, redirecionar direto
      navigate('/complete-profile', { replace: true });
    }
  }, [location.state, navigate]);

  const checkIfPhysicalCard = async (paymentId: string) => {
    try {
      // Buscar carteirinha associada ao pagamento
      const { data: card } = await supabase
        .from('student_cards')
        .select('is_physical')
        .eq('payment_id', paymentId)
        .maybeSingle();

      if (card?.is_physical) {
        // Já é física, redirecionar direto
        setIsPhysicalCard(true);
        setTimeout(() => {
          navigate('/complete-profile', { replace: true });
        }, 2000);
      } else {
        // É digital, mostrar upsell após 2 segundos
        setIsPhysicalCard(false);
        setTimeout(() => {
          setShowUpsellModal(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao verificar carteirinha:', error);
      // Em caso de erro, mostrar upsell como fallback
      setIsPhysicalCard(false);
      setTimeout(() => {
        setShowUpsellModal(true);
      }, 2000);
    }
  };

  const handleAcceptUpsell = () => {
    setLoading(true);
    // Navegar para checkout com flag de upsell
    navigate('/checkout', { 
      state: { 
        isUpsell: true,
        originalPaymentId: paymentId,
        upsellAmount: 15.00
      },
      replace: true 
    });
  };

  const handleDeclineUpsell = () => {
    setShowUpsellModal(false);
    localStorage.removeItem('recent_payment_id');
    navigate('/complete-profile', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
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
            Agora complete seu cadastro para emitir a carteirinha...
          </p>
          
          {/* Loader de redirecionamento */}
          {!showUpsellModal && (
            <div className="flex items-center justify-center gap-3 text-white/70">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">
                {isPhysicalCard === null 
                  ? 'Processando...' 
                  : 'Redirecionando para completar perfil...'}
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

          {/* Conteúdo */}
          <div className="p-6 space-y-5">
            {/* Preço */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-gray-500 line-through text-lg">R$ 25,00</span>
                <Badge variant="destructive" className="text-xs">-40%</Badge>
              </div>
              <div className="text-4xl font-bold text-green-600">
                R$ 15,00
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Pagamento único • Sem mensalidade
              </p>
            </div>

            {/* Benefícios */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-gray-700">Entrega em todo Brasil via Correios</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-gray-700">Material premium com QR Code integrado</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-gray-700">Aceita em cinemas, teatros e eventos</span>
              </div>
            </div>

            {/* Botões */}
            <div className="space-y-3 pt-2">
              <Button 
                onClick={handleAcceptUpsell}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-6 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Quero a Carteirinha Física - R$ 15'
                )}
              </Button>
              
              <button
                onClick={handleDeclineUpsell}
                className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors py-2"
              >
                Continuar apenas com a digital
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentSuccessPage;
