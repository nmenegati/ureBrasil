import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { CreditCard, Home } from 'lucide-react';

export default function Pagamento() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <Header variant="app" />
      
      <main className="relative z-10 flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="text-center max-w-md bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 border border-white/20">
          <div className="bg-primary/10 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <CreditCard className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl text-slate-900 dark:text-white font-bold">Pagamento</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-3">
            Integração com gateway de pagamento em desenvolvimento. Em breve você poderá finalizar seu pedido.
          </p>
          <Button 
            onClick={() => navigate('/dashboard')} 
            className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Home className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}