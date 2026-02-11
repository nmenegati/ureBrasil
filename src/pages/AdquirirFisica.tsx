import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Header } from "@/components/Header";
import { PolicyModal } from "@/components/PolicyModal";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/utils/payment-helpers";

const AdquirirFisica = () => {
  const navigate = useNavigate();
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [physicalPlan, setPhysicalPlan] = useState<{
    id: string;
    name: string;
    price: number;
  } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  
  useEffect(() => {
    const loadPlan = async () => {
      const { data } = await supabase
        .from("plans")
        .select("id, name, price")
        .eq("type", "fisica_avulsa")
        .eq("is_active", true)
        .single();

      if (data) {
        setPhysicalPlan({
          id: data.id,
          name: data.name,
          price: data.price,
        });
      }

      setLoadingPlan(false);
    };

    loadPlan();
  }, []);

  const handlePurchase = async () => {
    if (!physicalPlan) return;
    navigate('/checkout-fisica');
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Carteirinha Física do Estudante URE</CardTitle>
            <CardDescription>
              Tenha também a versão física da sua carteirinha do estudante
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
           
            <div className="bg-sky-100 border border-blue-300 p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg">{physicalPlan?.name || "Carteirinha Física"}</span>
                <span className="text-2xl font-bold">
                  {physicalPlan ? formatPrice(physicalPlan.price) : "..."}
                </span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✅ Frete grátis para todo Brasil</li>
                <li>✅ Entrega em 10 a 15 dias úteis</li>
                <li>✅ Material durável de PVC</li>
                <li>✅ Mesmo design da digital</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Ao prosseguir, você concorda com nossa{" "}
                <button
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(true)}
                  className="text-primary hover:underline"
                >
                  Política de Entregas
                </button>
                .
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Sua carteirinha digital já é 100% válida. A versão física é opcional e para sua conveniência.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-4">
              <Button onClick={handlePurchase} className="flex-1" disabled={loadingPlan || !physicalPlan}>
                {physicalPlan ? `Adquirir por ${formatPrice(physicalPlan.price)}` : "Carregando..."}
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
      <PolicyModal
        type="delivery"
        open={isDeliveryModalOpen}
        onOpenChange={setIsDeliveryModalOpen}
      />
    </div>
  );
};

export default AdquirirFisica;
