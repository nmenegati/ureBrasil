import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft } from 'lucide-react';

export default function Pagamento() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="bg-cyan-500/10 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <CreditCard className="w-12 h-12 text-cyan-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl text-white font-bold">Pagamento</h1>
        <p className="text-slate-400 mt-3">
          Integração com gateway de pagamento em desenvolvimento. Em breve você poderá finalizar seu pedido.
        </p>
        <Button 
          onClick={() => navigate('/dashboard')} 
          className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
}
