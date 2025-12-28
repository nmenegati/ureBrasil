import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { CheckCircle, Loader2 } from "lucide-react";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Salvar paymentId no localStorage para o modal de upsell no Dashboard
    const paymentId = (location.state as { paymentId?: string })?.paymentId;
    if (paymentId) {
      localStorage.setItem('recent_payment_id', paymentId);
    }
    
    // Redirecionar para o Dashboard após 2 segundos
    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, location.state]);

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
            Sua carteirinha digital está sendo ativada...
          </p>
          
          {/* Loader de redirecionamento */}
          <div className="flex items-center justify-center gap-3 text-white/70">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Redirecionando para o painel...</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccessPage;
