import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { QrCode, CreditCard, Loader2, Check, IdCard } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_physical: boolean;
  is_direito: boolean;
}

// Máscaras de input
const maskCardNumber = (v: string) => {
  return v.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").slice(0, 19);
};

const maskExpiry = (v: string) => {
  return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1/$2").slice(0, 5);
};

const maskCvv = (v: string) => {
  return v.replace(/\D/g, "").slice(0, 4);
};

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [cardType, setCardType] = useState<"credit" | "debit">("credit");
  const [installments, setInstallments] = useState("1");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  useEffect(() => {
    const fetchPlan = async () => {
      if (!user) return;

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
          toast.error("Plano não encontrado");
          navigate("/escolher-plano");
          return;
        }

        setPlan(planData);
      } catch (error) {
        console.error("Erro ao carregar plano:", error);
        toast.error("Erro ao carregar informações");
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [user, navigate]);

  const validateCardForm = () => {
    if (paymentMethod !== "card") return true;

    const cardNumberClean = cardNumber.replace(/\s/g, "");
    if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
      toast.error("Número do cartão inválido");
      return false;
    }
    if (cardName.trim().length < 3) {
      toast.error("Nome no cartão inválido");
      return false;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      toast.error("Data de validade inválida");
      return false;
    }
    if (cardCvv.length < 3) {
      toast.error("CVV inválido");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!plan) return;
    if (!validateCardForm()) return;

    setProcessing(true);

    try {
      const payload: Record<string, unknown> = {
        plan_id: plan.id,
        payment_method:
          paymentMethod === "pix"
            ? "pix"
            : cardType === "credit"
            ? "credit_card"
            : "debit_card",
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

      if (paymentMethod === "pix" && data.pix_data) {
        navigate("/pagamento", {
          state: { pixData: data.pix_data, paymentId: data.payment_id },
        });
      } else if (data.status === "approved") {
        toast.success("Pagamento aprovado!");
        navigate("/dashboard");
      } else {
        toast.error("Pagamento não aprovado");
      }
    } catch (error: unknown) {
      console.error("Erro no pagamento:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento";
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getInstallmentOptions = () => {
    if (!plan) return [];
    const options = [];
    const maxInstallments = plan.price >= 100 ? 12 : plan.price >= 50 ? 6 : 3;
    for (let i = 1; i <= maxInstallments; i++) {
      const value = plan.price / i;
      options.push({
        value: i.toString(),
        label:
          i === 1
            ? `À vista ${formatPrice(plan.price)}`
            : `${i}x de ${formatPrice(value)}`,
      });
    }
    return options;
  };

  const isFormValid = () => {
    if (paymentMethod === "pix") return true;
    const cardNumberClean = cardNumber.replace(/\s/g, "");
    return (
      cardNumberClean.length >= 13 &&
      cardName.trim().length >= 3 &&
      /^\d{2}\/\d{2}$/.test(cardExpiry) &&
      cardCvv.length >= 3
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="app" />
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-muted-foreground">Plano não encontrado</p>
          <Button onClick={() => navigate("/escolher-plano")} className="mt-4">
            Escolher Plano
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />

      <div className="container mx-auto px-4 py-6 max-w-md">
        {/* 1. Mensagem Motivacional */}
        <div className="bg-primary/10 text-primary p-4 rounded-lg text-center mb-6">
          <p className="font-medium">
            🎫 Finalize agora e use sua carteirinha ainda hoje.
          </p>
        </div>

        {/* 2. Barra de Progresso */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">Plano</span>
          </div>
          <div className="w-8 h-px bg-primary" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">2</span>
            </div>
            <span className="text-xs font-medium">Pagamento</span>
          </div>
          <div className="w-8 h-px bg-muted" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm text-muted-foreground">3</span>
            </div>
            <span className="text-xs text-muted-foreground">Pronto</span>
          </div>
        </div>

        {/* 3. Card do Plano com Accordion */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <IdCard className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <Badge
                    variant="secondary"
                    className="bg-green-500/10 text-green-600 text-xs"
                  >
                    Selecionado
                  </Badge>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                )}
              </div>
            </div>

            <Accordion type="single" collapsible className="border-t pt-2">
              <AccordionItem value="benefits" className="border-b-0">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  Ver o que está incluso
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      100% digital
                    </li>
                    {plan.is_direito && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Acesso OAB e Tribunais
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Descontos em estabelecimentos
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Validade nacional
                    </li>
                    {plan.is_physical && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Carteirinha física inclusa
                      </li>
                    )}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="border-t pt-3 mt-2">
              <div className="text-2xl font-bold text-center">
                {formatPrice(plan.price)}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Pagamento único • Validade de 1 ano
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Métodos de Pagamento */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Forma de pagamento</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button
                type="button"
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
                type="button"
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

            {/* 5. Formulário Dinâmico */}
            {paymentMethod === "pix" && (
              <div className="animate-fade-in bg-muted/50 rounded-lg p-4 text-center">
                <QrCode className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Ao clicar em "Gerar QR Code PIX", você receberá um código para
                  pagamento instantâneo.
                </p>
              </div>
            )}

            {paymentMethod === "card" && (
              <div className="animate-fade-in space-y-4">
                <RadioGroup
                  value={cardType}
                  onValueChange={(v) => setCardType(v as "credit" | "debit")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="debit" id="debit" />
                    <Label htmlFor="debit" className="cursor-pointer">
                      Débito
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="credit" id="credit" />
                    <Label htmlFor="credit" className="cursor-pointer">
                      Crédito
                    </Label>
                  </div>
                </RadioGroup>

                {cardType === "credit" && (
                  <div>
                    <Label htmlFor="installments">Parcelamento</Label>
                    <Select value={installments} onValueChange={setInstallments}>
                      <SelectTrigger id="installments" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getInstallmentOptions().map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
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
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cardName">Nome no cartão</Label>
                  <Input
                    id="cardName"
                    placeholder="Como está no cartão"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    className="mt-1"
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
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardCvv">CVV</Label>
                    <Input
                      id="cardCvv"
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(maskCvv(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground text-xs mb-4">
          <span>🔒 Pagamento seguro</span>
          <span className="text-muted">|</span>
          <span>🛡️ Dados protegidos</span>
          <span className="text-muted">|</span>
          <span>✅ Sem taxas extras</span>
        </div>

        {/* 7. Botão Integrado */}
        <Button
          onClick={handleSubmit}
          disabled={processing || !isFormValid()}
          className="w-full py-6 text-base"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : paymentMethod === "pix" ? (
            "Gerar QR Code PIX"
          ) : (
            "Finalizar Pagamento"
          )}
        </Button>

        <p className="text-center text-muted-foreground text-xs mt-4 mb-8">
          Ao continuar você concorda com nossos{" "}
          <a href="#" className="underline">
            Termos de Uso
          </a>
        </p>
      </div>
    </div>
  );
}
