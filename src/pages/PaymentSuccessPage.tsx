import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [showUpsell, setShowUpsell] = useState(true);
  const [loadingUpsell, setLoadingUpsell] = useState(false);

  const handleAcceptUpsell = async () => {
    setLoadingUpsell(true);
    // Simular processamento de 1.5s
    await new Promise(resolve => setTimeout(resolve, 1500));
    // TODO: Integrar com API de pagamento para R$ 15
    toast.success("Carteirinha física adicionada! Será enviada em breve.");
    setLoadingUpsell(false);
    setShowUpsell(false);
  };

  const handleDeclineUpsell = () => {
    setShowUpsell(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      
      <main className="container max-w-lg mx-auto px-4 py-8">
        {/* Confirmação de Pagamento */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Pagamento Confirmado!</h1>
          <p className="text-muted-foreground text-sm">
            Sua carteirinha digital já está disponível no seu perfil
          </p>
        </div>

        {/* Card Resumo da Compra */}
        <Card className="p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Carteirinha Digital Geral</h3>
              <p className="text-muted-foreground text-xs mb-2">Pagamento processado com sucesso</p>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground text-xs">Valor pago:</span>
                <span className="text-green-500 font-semibold">R$ 29,00</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Bump Offer */}
        {showUpsell ? (
          <Card className="relative overflow-hidden border-2 border-primary/50 p-5 mb-6">
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
          <Card className="p-6 text-center mb-6">
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
        <Card className="p-4">
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
