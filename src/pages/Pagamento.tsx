import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { QrCode, CreditCard, Loader2, Check } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_physical: boolean;
  is_direito: boolean;
}

const maskCardNumber = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  return numbers.replace(/(\d{4})(?=\d)/g, "$1 ").slice(0, 19);
};

const maskExpiry = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length >= 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  }
  return numbers;
};

const maskCvv = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 4);
};

export default function Pagamento() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | null>(null);
  const [cardType, setCardType] = useState<"credit" | "debit">("credit");
  const [installments, setInstallments] = useState("1");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  useEffect(() => {
    if (authLoading) return;
    
    const loadPlan = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("plan_id")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile?.plan_id) {
          toast.error("Nenhum plano selecionado");
          navigate("/escolher-plano");
          return;
        }

        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("*")
          .eq("id", profile.plan_id)
          .single();

        if (planError || !planData) {
          toast.error("Erro ao carregar plano");
          navigate("/escolher-plano");
          return;
        }

        setPlan(planData);
      } catch (error) {
        console.error("Erro ao carregar plano:", error);
        toast.error("Erro ao carregar dados");
        navigate("/escolher-plano");
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [user, authLoading, navigate]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getInstallmentOptions = () => {
    if (!plan) return [];
    const maxInstallments = plan.price >= 100 ? 12 : plan.price >= 50 ? 6 : 3;
    return Array.from({ length: maxInstallments }, (_, i) => {
      const num = i + 1;
      const value = plan.price / num;
      return {
        value: num.toString(),
        label: num === 1 ? `${formatPrice(plan.price)} à vista` : `${num}x de ${formatPrice(value)}`,
      };
    });
  };

  const isCardFormValid = () => {
    if (paymentMethod !== "card") return true;
    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    return (
      cleanCardNumber.length >= 13 &&
      cardName.trim().length >= 3 &&
      cardExpiry.length === 5 &&
      cardCvv.length >= 3
    );
  };

  const isFormValid = () => {
    if (!paymentMethod) return false;
    if (paymentMethod === "pix") return true;
    return isCardFormValid();
  };

  const handleSubmit = async () => {
    if (!plan || !paymentMethod) return;

    setProcessing(true);

    try {
      const payload: Record<string, unknown> = {
        plan_id: plan.id,
        payment_method: paymentMethod === "card" ? cardType === "credit" ? "credit_card" : "debit_card" : "pix",
      };

      if (paymentMethod === "card") {
        payload.card_data = {
          number: cardNumber.replace(/\s/g, ""),
          name: cardName,
          expiry: cardExpiry,
          cvv: cardCvv,
          installments: cardType === "credit" ? parseInt(installments) : 1,
        };
      }

      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: payload,
      });

      if (error) throw error;

      if (paymentMethod === "pix" && data?.pix_code) {
        navigate("/pagamento/pix", { state: { paymentData: data } });
      } else {
        toast.success("Pagamento processado com sucesso!");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Erro no pagamento:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground mb-4">Plano não encontrado</p>
        <Button onClick={() => navigate("/escolher-plano")}>Escolher Plano</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Mensagem Motivacional */}
        <div className="bg-primary/10 text-primary p-4 rounded-lg text-center">
          <p className="font-medium">🎫 Finalize agora e use sua carteirinha ainda hoje.</p>
        </div>

        {/* Barra de Progresso */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-primary">Plano</span>
          </div>
          <div className="w-8 h-0.5 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">2</span>
            </div>
            <span className="text-sm font-medium text-primary">Pagamento</span>
          </div>
          <div className="w-8 h-0.5 bg-muted" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-bold text-muted-foreground">3</span>
            </div>
            <span className="text-sm text-muted-foreground">Pronto</span>
          </div>
        </div>

        {/* Card do Plano com Accordion */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-lg">{plan.name}</h2>
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
            </div>
            <span className="bg-green-500/20 text-green-600 text-xs font-medium px-2 py-1 rounded">
              Selecionado
            </span>
          </div>

          <Accordion type="single" collapsible className="mb-4">
            <AccordionItem value="benefits" className="border-none">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                Ver o que está incluso
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>100% digital</span>
                  </li>
                  {plan.is_direito && (
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Acesso OAB e Tribunais</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Descontos em estabelecimentos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Validade nacional</span>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="border-t pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-primary">{formatPrice(plan.price)}</span>
              <span className="text-sm text-muted-foreground">Pagamento único • Validade de 1 ano</span>
            </div>
          </div>
        </Card>

        {/* Métodos de Pagamento */}
        <div className="space-y-3">
          <h3 className="font-medium">Escolha a forma de pagamento</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={paymentMethod === "pix" ? "default" : "outline"}
              className="h-auto flex flex-col items-center gap-2 p-4"
              onClick={() => setPaymentMethod("pix")}
            >
              <QrCode className="w-8 h-8" />
              <span className="font-medium">PIX</span>
              <span className="text-xs opacity-80">⚡ Aprovação instantânea</span>
              <span className="font-bold">{formatPrice(plan.price)}</span>
            </Button>

            <Button
              variant={paymentMethod === "card" ? "default" : "outline"}
              className="h-auto flex flex-col items-center gap-2 p-4"
              onClick={() => setPaymentMethod("card")}
            >
              <CreditCard className="w-8 h-8" />
              <span className="font-medium">Cartão</span>
              <span className="text-xs opacity-80">💳 Débito ou Crédito</span>
              <span className="font-bold">{formatPrice(plan.price)}</span>
            </Button>
          </div>
        </div>

        {/* Formulário Dinâmico */}
        {paymentMethod === "pix" && (
          <Card className="p-6 animate-fade-in">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Pagamento via PIX</h3>
                <p className="text-sm text-muted-foreground">
                  Ao clicar no botão abaixo, vamos gerar um QR Code para você realizar o pagamento instantaneamente.
                </p>
              </div>
            </div>
          </Card>
        )}

        {paymentMethod === "card" && (
          <Card className="p-4 space-y-4 animate-fade-in">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de cartão</Label>
              <RadioGroup
                value={cardType}
                onValueChange={(value) => setCardType(value as "credit" | "debit")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="credit" id="credit" />
                  <Label htmlFor="credit" className="cursor-pointer">Crédito</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="debit" id="debit" />
                  <Label htmlFor="debit" className="cursor-pointer">Débito</Label>
                </div>
              </RadioGroup>
            </div>

            {cardType === "credit" && (
              <div>
                <Label htmlFor="installments">Parcelamento</Label>
                <Select value={installments} onValueChange={setInstallments}>
                  <SelectTrigger id="installments">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getInstallmentOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="cardNumber">Número do cartão</Label>
              <Input
                id="cardNumber"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                maxLength={19}
              />
            </div>

            <div>
              <Label htmlFor="cardName">Nome no cartão</Label>
              <Input
                id="cardName"
                placeholder="Como está impresso no cartão"
                value={cardName}
                onChange={(e) => setCardName(e.target.value.toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cardExpiry">Validade</Label>
                <Input
                  id="cardExpiry"
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                  maxLength={5}
                />
              </div>
              <div>
                <Label htmlFor="cardCvv">CVV</Label>
                <Input
                  id="cardCvv"
                  placeholder="123"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(maskCvv(e.target.value))}
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Trust Badges */}
        {paymentMethod && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground text-xs animate-fade-in">
            <span>🔒 Pagamento seguro</span>
            <span className="text-muted-foreground/50">|</span>
            <span>🛡️ Dados protegidos</span>
            <span className="text-muted-foreground/50">|</span>
            <span>✅ Sem taxas extras</span>
          </div>
        )}

        {/* Botão de Ação */}
        {paymentMethod && (
          <div className="space-y-3 animate-fade-in">
            <Button
              className="w-full py-6 text-lg"
              onClick={handleSubmit}
              disabled={processing || !isFormValid()}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : paymentMethod === "pix" ? (
                "Gerar QR Code PIX"
              ) : (
                "Finalizar Pagamento"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao continuar você concorda com nossos{" "}
              <a href="/termos" className="underline hover:text-foreground">
                Termos de Uso
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
