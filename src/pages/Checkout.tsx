import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePagBank } from "@/hooks/usePagBank";
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
import { Separator } from "@/components/ui/separator";
import { QrCode, CreditCard, Loader2, Check, Shield, Lock, CheckCircle } from "lucide-react";
import pagseguroLogo from "@/assets/pagseguro-logo.png";
import carteirinhaDireitoImg1 from "@/assets/carteirinha-direito-pgto-1.jpg";
import carteirinhaDireitoImg2 from "@/assets/carteirinha-direito-pgto-2.jpg";
import carteirinhaGeralImg1 from "@/assets/carteirinha-geral-pagto-1.jpeg";
import carteirinhaGeralImg2 from "@/assets/carteirinha-geral-pagto-2.jpeg";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_physical: boolean;
  is_direito: boolean;
}

interface UpsellState {
  isUpsell?: boolean;
  amount?: number;
  originalPaymentId?: string;
  planType?: string;
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

const getValidityDate = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const validityYear = currentMonth < 3 ? currentYear : currentYear + 1;
  return `31/03/${validityYear}`;
};

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { 
    generateSession, 
    createCardToken, 
    processCardPayment,
    loading: pagbankLoading 
  } = usePagBank();

  // Extrair state de upsell
  const upsellState = location.state as UpsellState | null;
  const isUpsell = upsellState?.isUpsell ?? false;
  const upsellAmount = upsellState?.amount ?? 15;
  const originalPaymentId = upsellState?.originalPaymentId;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">(isUpsell ? "card" : "pix");
  const [cardType, setCardType] = useState<"credit" | "debit">("credit");
  const [installments, setInstallments] = useState("1");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [studentProfile, setStudentProfile] = useState<{
    cpf: string;
    phone: string;
    birth_date: string;
  } | null>(null);

  useEffect(() => {
    const fetchPlanAndProfile = async () => {
      if (!user) return;

      try {
        // Buscar perfil COM dados necessários para PagBank
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("plan_id, cpf, phone, birth_date")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          toast.error("Erro ao carregar perfil");
          navigate("/dashboard");
          return;
        }

        // Guardar dados do perfil para o PagBank
        setStudentProfile({
          cpf: profile.cpf,
          phone: profile.phone,
          birth_date: profile.birth_date,
        });

        // === MODO UPSELL ===
        if (isUpsell && originalPaymentId) {
          // Buscar nome do plano original para mostrar no checkout
          const { data: originalPayment } = await supabase
            .from("payments")
            .select("plan_id, plans(name)")
            .eq("id", originalPaymentId)
            .single();

          const originalPlanName = originalPayment?.plans 
            ? (originalPayment.plans as { name: string }).name 
            : "sua carteirinha";

          setPlan({
            id: 'physical_addon',
            name: 'Carteirinha Física',
            description: `Adicional para ${originalPlanName}`,
            price: upsellAmount,
            is_physical: true,
            is_direito: false,
          });

          setLoading(false);
          return;
        }

        // === MODO NORMAL ===
        if (!profile?.plan_id) {
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
        
        // Gerar sessão PagBank após carregar dados
        await generateSession();
      } catch (error) {
        console.error("Erro ao carregar:", error);
        toast.error("Erro ao carregar informações");
      } finally {
        setLoading(false);
      }
    };

    fetchPlanAndProfile();
  }, [user, navigate, generateSession, isUpsell, originalPaymentId, upsellAmount]);

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
    if (!plan || !studentProfile) return;

    if (!validateCardForm()) return;

    setProcessing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      // === UPSELL: Carteirinha física usando PagBank (pagbank-payment-v2) ===
      if (isUpsell && originalPaymentId) {
        console.log("💳 Processando upsell via PagBank (pagbank-payment-v2)...");

        const [month, year] = cardExpiry.split("/");
        const expYear = year && year.length === 2 ? `20${year}` : year;

        const { data, error } = await supabase.functions.invoke(
          "pagbank-payment-v2",
          {
            body: {
              amount: upsellAmount,
              installments: 1,
              card: {
                number: cardNumber.replace(/\s/g, ""),
                exp_month: month,
                exp_year: expYear,
                security_code: cardCvv,
                holder_name: cardName,
              },
              metadata: {
                is_upsell: true,
                original_payment_id: originalPaymentId,
              },
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );

        if (error) throw error;
        if (!data?.success) {
          throw new Error(
            (data && (data.error as string | undefined)) ||
              "Erro ao processar pagamento do upsell",
          );
        }

        // Atualizar carteirinha original para física
        const { error: updateError } = await supabase
          .from('student_cards')
          .update({ 
            is_physical: true,
            updated_at: new Date().toISOString()
          })
          .eq('payment_id', originalPaymentId);

        if (updateError) {
          console.error('Erro ao atualizar carteirinha:', updateError);
        } else {
          console.log('✅ Carteirinha atualizada para física');
        }

        // Limpar flag para não mostrar modal novamente
        localStorage.removeItem('recent_payment_id');
        
        toast.success('🎉 Carteirinha física adicionada! Você receberá em 7-10 dias úteis.');
        
        // Usar window.location.href para forçar reload completo da página de documentos
        setTimeout(() => {
          window.location.href = '/upload-documentos';
        }, 2000);
        
        return;
      }

      // === FLUXO NORMAL (não-upsell) ===
      if (paymentMethod === "pix") {
        // Manter lógica PIX existente
        const payload = {
          plan_id: plan.id,
          payment_method: "pix",
        };

        const { data, error } = await supabase.functions.invoke("create-payment", {
          body: payload,
        });

        if (error) throw error;

        if (data.pix_data) {
          navigate("/pagamento", {
            state: { pixData: data.pix_data, paymentId: data.payment_id },
          });
        }
      } else {
        // Usar PagBank para cartão com tokenização segura
        const cardToken = await createCardToken({
          cardNumber,
          cardholderName: cardName,
          expirationMonth: cardExpiry.split('/')[0],
          expirationYear: '20' + cardExpiry.split('/')[1],
          cvv: cardCvv,
        });

        const result = await processCardPayment({
          cardToken,
          cardholderName: cardName,
          cardholderCPF: studentProfile.cpf,
          cardholderPhone: studentProfile.phone,
          cardholderBirthDate: studentProfile.birth_date,
          installments: cardType === "credit" ? parseInt(installments) : 1,
          amount: plan.price,
          planId: plan.id,
        });

        if (result.success) {
          // Fluxo normal: salvar payment_id para modal de upsell
          localStorage.setItem('recent_payment_id', result.payment.id);
          navigate('/pagamento/sucesso', { 
            state: { paymentId: result.payment.id } 
          });
        }
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground mb-4">Plano não encontrado</p>
        <Button onClick={() => navigate("/escolher-plano")}>Escolher Plano</Button>
      </div>
    );
  }

  const isDireitoPlan =
    plan.is_direito ||
    plan.name.toLowerCase().includes("direito") ||
    plan.name.toLowerCase().includes("lexpraxis");

  const direitoImages = [carteirinhaDireitoImg1, carteirinhaDireitoImg2];
  const geralImages = [carteirinhaGeralImg1, carteirinhaGeralImg2];
  const images = isDireitoPlan ? direitoImages : geralImages;

  let imagemCarteirinha = images[0];
  if (plan.id) {
    const hash =
      plan.id.charCodeAt(0) + plan.id.charCodeAt(plan.id.length - 1);
    imagemCarteirinha = images[hash % images.length];
  }

  const displayAmount = isUpsell ? upsellAmount : plan.price;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="py-8 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-1.5 mb-1 text-green-600">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wide">
                COMPRA 100% SEGURA
              </span>
            </div>

            <div className="flex items-start gap-4 md:gap-5 mt-3">
              <div className="order-1 md:order-2 flex-1 pl-2 md:pl-4">
                <h2 className="text-xl md:text-2xl font-bold mb-2 text-foreground">
                  {plan.name}
                </h2>
                {plan.description && (
                  <p className="text-sm md:text-base text-muted-foreground mb-4">
                    {plan.description}
                  </p>
                )}

                <div className="mt-4">
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    {formatPrice(displayAmount)}
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground mt-1">
                    {isUpsell
                      ? "Adicional • Entrega em 7-10 dias úteis"
                      : `Pagamento único • Válida até ${getValidityDate()}`}
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0 order-2 md:order-1 flex justify-end md:justify-start">
                <img
                  src={imagemCarteirinha}
                  alt="Carteirinha"
                  className="rounded-lg shadow-lg w-24 md:w-28 h-auto object-cover"
                />
              </div>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="benefits" className="border-none">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  Benefícios inclusos
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Carteirinha digital com QR Code de verificação</span>
                    </li>
                    {plan.is_direito && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Acesso a benefícios exclusivos para estudantes de Direito</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Descontos em estabelecimentos parceiros</span>
                    </li>
                    {!isUpsell && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Validade nacional até {getValidityDate()}</span>
                      </li>
                    )}
                    {isUpsell && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Carteirinha física em PVC inclusa</span>
                      </li>
                    )}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="border-t pt-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-4 text-foreground">
                  Escolha a forma de pagamento
                </h3>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pix")}
                    className={`border-2 rounded-lg p-4 transition w-full text-center ${
                      paymentMethod === "pix"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    <QrCode className="h-8 w-8 mx-auto mb-2" />
                    <div className="font-semibold">PIX</div>
                    <div className="text-xs text-green-600 mb-2">
                      Aprovação instantânea
                    </div>
                    <div className="text-lg font-bold">
                      {formatPrice(displayAmount)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`border-2 rounded-lg p-4 transition w-full text-center ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    <CreditCard className="h-8 w-8 mx-auto mb-2" />
                    <div className="font-semibold">Cartão</div>
                    <div className="text-xs text-blue-600 mb-2">
                      Débito ou Crédito
                    </div>
                    <div className="text-lg font-bold">
                      {formatPrice(displayAmount)}
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Pagamento processado com</span>
                  <img src={pagseguroLogo} alt="PagSeguro" className="h-6 w-auto" />
                </div>
              </div>

              {paymentMethod === "pix" && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <h3 className="font-semibold text-foreground mb-1">
                    Pagamento via PIX
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Ao clicar em "Gerar QR Code PIX", vamos criar um código para
                    você pagar com seu app do banco.
                  </p>
                </div>
              )}

              {paymentMethod === "card" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Tipo de cartão
                    </Label>
                    <RadioGroup
                      value={cardType}
                      onValueChange={(value) =>
                        setCardType(value as "credit" | "debit")
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="credit" id="credit" />
                        <Label htmlFor="credit" className="cursor-pointer">
                          Crédito
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="debit" id="debit" />
                        <Label htmlFor="debit" className="cursor-pointer">
                          Débito
                        </Label>
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
                      onChange={(e) =>
                        setCardNumber(maskCardNumber(e.target.value))
                      }
                      maxLength={19}
                    />
                  </div>

                  <div>
                    <Label htmlFor="cardName">Nome no cartão</Label>
                    <Input
                      id="cardName"
                      placeholder="Como está impresso no cartão"
                      value={cardName}
                      onChange={(e) =>
                        setCardName(e.target.value.toUpperCase())
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cardExpiry">Validade</Label>
                      <Input
                        id="cardExpiry"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) =>
                          setCardExpiry(maskExpiry(e.target.value))
                        }
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardCvv">CVV</Label>
                      <Input
                        id="cardCvv"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) =>
                          setCardCvv(maskCvv(e.target.value))
                        }
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod && (
                <div>
                  <Button
                    className="w-full py-6 text-lg"
                    onClick={handleSubmit}
                    disabled={processing || pagbankLoading || !isFormValid()}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processando...
                      </>
                    ) : paymentMethod === "pix" ? (
                      "Gerar QR Code PIX"
                    ) : isUpsell ? (
                      `Confirmar Adicional ${formatPrice(displayAmount)}`
                    ) : (
                      "Finalizar Pagamento"
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t mt-6 pt-4 space-y-3">
              <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Pagamento seguro
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Dados protegidos
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Sem taxas extras
                </span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Ao continuar você concorda com nossos{" "}
                <Link to="/termos" className="underline hover:text-foreground transition-colors">
                  Termos de Uso
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
