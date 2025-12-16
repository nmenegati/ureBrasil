import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { CreditCard, Home } from 'lucide-react';

export default function Pagamento() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      
      <main className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="text-center max-w-md">
          <div className="bg-primary/10 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <CreditCard className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl text-foreground font-bold">Pagamento</h1>
          <p className="text-muted-foreground mt-3">
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