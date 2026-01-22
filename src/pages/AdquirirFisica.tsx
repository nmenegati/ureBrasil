import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Header } from "@/components/Header";

const AdquirirFisica = () => {
  const navigate = useNavigate();
  
  const handlePurchase = async () => {
    navigate('/pagamento', {
      state: {
        isPhysicalUpsell: true,
        amount: 24.00,
        selectedPlan: {
          name: 'Carteirinha Física',
          price: 24.00,
          is_physical: true,
          is_standalone: true
        }
      }
    });
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Carteirinha Física</CardTitle>
            <CardDescription>
              Tenha também a versão física da sua carteirinha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Sua carteirinha digital já é 100% válida. A versão física é opcional e para sua conveniência.
              </AlertDescription>
            </Alert>
            
          <div className="bg-muted p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg">Carteirinha Física</span>
              <span className="text-2xl font-bold">R$ 24,00</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✅ Frete grátis para todo Brasil</li>
                <li>✅ Entrega em 7-10 dias úteis</li>
                <li>✅ Material durável de PVC</li>
                <li>✅ Mesmo design da digital</li>
              </ul>
            </div>
            
            <div className="flex gap-4">
              <Button onClick={handlePurchase} className="flex-1">
                Adquirir por R$ 24,00
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/carteirinha')}
                className="flex-1"
              >
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdquirirFisica;
