import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Check,
  CheckCircle,
  CreditCard,
  Loader2,
  Lock,
  QrCode,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { CardForm } from "@/components/payment/CardForm";
import { formatPrice, validateCardForm } from "@/utils/payment-helpers";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import gatewayMpLogo from "@/assets/gateway-mp.png";
import gatewayPagseguroLogo from "@/assets/gateway-pagseguro.png";
import gatewayEfiLogo from "@/assets/pagseguro-logo.png";
import carteirinhaDireitoImg1 from "@/assets/carteirinha-direito-pgto-1.webp";
import carteirinhaDireitoImg2 from "@/assets/carteirinha-direito-pgto-2.webp";
import carteirinhaGeralImg1 from "@/assets/carteirinha-geral-pagto-1.webp";
import carteirinhaGeralImg2 from "@/assets/carteirinha-geral-pagto-2.webp";

type PaymentMethod = "pix" | "card";

interface PhysicalPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_physical: boolean;
  is_direito: boolean;
}

/**
 * FLUXO DO USUÁRIO:
 * 1. Usuário já possui carteirinha digital ativa e acessa /checkout-fisica.
 * 2. Página verifica se há student_card ativo; se não houver, bloqueia com mensagem.
 * 3. Carrega plano de carteira física avulsa (type = 'fisica_avulsa') e gateway ativo.
 * 4. Usuário escolhe forma de pagamento (cartão ou PIX) em um layout idêntico ao Checkout.
 * 5. Ao confirmar, chama edge functions de pagamento com metadata is_physical_avulsa e
 *    original_payment_id do pagamento da digital.
 * 6. Após aprovação, usuário é redirecionado para /carteirinha; triggers cuidam do card físico.
 *
 * ESTADOS DERIVADOS:
 * - noDigitalCard: indica se o usuário tentou acessar sem ter carteirinha digital ativa.
 * - originalPaymentId: payment_id do pagamento original da digital (vincula compra avulsa).
 * - displayAmount: preço do plano físico avulso.
 *
 * GUARDS:
 * - Checagem explícita de user via useAuth; redireciona para /login se não autenticado.
 * - Bloqueio se não existir student_cards com status 'active' para o student_id.
 *
 * DEPENDÊNCIAS BACKEND:
 * - Tabelas student_profiles, student_cards, plans, payment_gateway_config.
 * - Edge functions mercadopago-payment, pagbank-payment-v2, create-payment (PIX).
 * - Triggers que criam/atualizam registros em student_cards para a física avulsa.
 */
export default function CheckoutFisica() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PhysicalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [cardType, setCardType] = useState<"credit" | "debit">("credit");
  const [installments, setInstallments] = useState("1");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [activeGateway, setActiveGateway] = useState<string>("pagbank");
  const [studentProfile, setStudentProfile] = useState<{
    cpf: string;
    phone: string;
    birth_date: string;
  } | null>(null);
  const [originalPaymentId, setOriginalPaymentId] = useState<string | null>(null);
  const [noDigitalCard, setNoDigitalCard] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const mpFormInitializedRef = useRef(false);
  const {
    sdkReady,
    initCardForm,
    processCardPayment,
    processPixPayment,
    loading: mpLoading,
    error: mpError,
  } = useMercadoPago();

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      navigate("/login");
      return;
    }

    const loadInitialData = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("id, cpf, phone, birth_date, is_law_student, education_level, plan_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError || !profile) {
          toast.error("Erro ao carregar perfil do estudante.");
          navigate("/carteirinha", { replace: true });
          return;
        }

        setStudentProfile({
          cpf: profile.cpf,
          phone: profile.phone,
          birth_date: profile.birth_date,
        });

        const { data: studentCard, error: cardError } = await supabase
          .from("student_cards")
          .select("id, payment_id, status")
          .eq("student_id", profile.id)
          .eq("status", "active")
          .maybeSingle();

        if (cardError) {
          console.error("[CHECKOUT_FISICA] Erro ao buscar carteirinha digital ativa:", {
            studentId: profile.id,
            error: cardError.message,
          });
          toast.error("Erro ao verificar sua carteirinha digital.");
          navigate("/carteirinha", { replace: true });
          return;
        }

        if (!studentCard) {
          setNoDigitalCard(true);
          return;
        }

        setOriginalPaymentId(studentCard.payment_id || null);

        const { data: physicalPlan, error: planError } = await supabase
          .from("plans")
          .select("id, name, description, price, is_physical, is_direito")
          .eq("type", "fisica_avulsa")
          .eq("is_active", true)
          .single();

        if (planError || !physicalPlan) {
          if (planError) {
            console.error("[CHECKOUT_FISICA] Erro ao buscar plano fisica_avulsa:", {
              error: planError.message,
            });
          }
          toast.error("Plano de carteirinha física não encontrado.");
          return;
        }

        setPlan({
          id: physicalPlan.id,
          name: physicalPlan.name,
          description: physicalPlan.description,
          price: physicalPlan.price,
          is_physical: physicalPlan.is_physical,
          is_direito: physicalPlan.is_direito,
        });

        const { data: gatewayConfig, error: gatewayError } = await supabase
          .from("payment_gateway_config")
          .select("gateway_name")
          .eq("is_active", true)
          .single();

        if (gatewayError) {
          console.error("[CHECKOUT_FISICA] Erro ao carregar gateway ativo:", {
            error: gatewayError.message,
          });
        }

        if (gatewayConfig?.gateway_name) {
          setActiveGateway(gatewayConfig.gateway_name);
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        toast.error("Erro ao carregar informações para pagamento.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user?.id, authLoading, navigate]);

  useEffect(() => {
    if (activeGateway !== "mercadopago") return;
    if (!sdkReady) return;
    if (!plan?.price) return;
    if (paymentMethod !== "card") return;
    if (!studentProfile?.cpf) return;
    if (mpFormInitializedRef.current) return;

    const timer = setTimeout(() => {
      const formElement = document.getElementById("form-checkout");
      if (!formElement) {
        console.error("[CheckoutFisica] form-checkout NÃO encontrado no DOM");
        return;
      }

      initCardForm({
        amount: String(plan.price),
        cardNumberId: "mp-card-number",
        expirationDateId: "mp-expiration-date",
        securityCodeId: "mp-security-code",
        cardholderNameId: "mp-cardholder-name",
        installmentsId: "mp-installments",
        identificationTypeId: "mp-identification-type",
        identificationNumberId: "mp-identification-number",
        onReady: () => {},
        onError: () => {},
      });

      mpFormInitializedRef.current = true;
    }, 500);

    return () => clearTimeout(timer);
  }, [activeGateway, sdkReady, plan?.price, paymentMethod, initCardForm, studentProfile?.cpf]);

  const getMaxInstallments = () => {
    if (!plan) return 1;
    if (plan.price >= 100) return 12;
    if (plan.price >= 50) return 6;
    return 3;
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

  const currentGatewayLogo = () => {
    if (activeGateway === "mercadopago") return gatewayMpLogo;
    if (activeGateway === "efi") return gatewayEfiLogo;
    return gatewayPagseguroLogo;
  };

  const currentGatewayName = () => {
    if (activeGateway === "mercadopago") return "Mercado Pago";
    if (activeGateway === "efi") return "Efí";
    return "PagSeguro";
  };

  const handleSubmit = async () => {
    if (!plan || !studentProfile || !user) return;

    if (paymentMethod === "card" && activeGateway !== "mercadopago") {
      const validation = validateCardForm({
        cardNumber,
        cardName,
        cardExpiry,
        cardCvv,
      });

      if (!validation.valid) {
        toast.error(validation.message || "Dados do cartão inválidos.");
        return;
      }
    }

    setProcessing(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!user || !session || !plan) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const metadata: Record<string, unknown> = {
        is_physical: true,
        is_physical_avulsa: true,
      };

      if (originalPaymentId) {
        metadata.original_payment_id = originalPaymentId;
      }

      if (paymentMethod === "pix") {
        let data: any;
        let error: any;

        if (activeGateway === "mercadopago") {
          const result = await processPixPayment({
            plan_id: plan.id,
            amount: plan.price,
            payer_email: user.email!,
            is_upsell: false,
            metadata,
          });
          if (!result.success) throw new Error(result.error || "Erro PIX");
          data = result;
          error = null;
        } else {
          ({ data, error } = await supabase.functions.invoke("create-payment", {
            body: {
              plan_id: plan.id,
              payment_method: "pix",
              amount: plan.price,
              metadata,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }));
        }

        if (error) throw error;

        if (data?.pix_code) {
          navigate("/pagamento/pix", {
            state: {
              paymentData: {
                ...data,
                amount: plan.price,
              },
              returnTo: "/carteirinha",
              successMessage:
                "Carteirinha física adquirida! Envio em 7-10 dias úteis.",
            },
          });
          return;
        }

        toast.success("Pagamento processado com sucesso!");
        navigate("/carteirinha", { replace: true });
        return;
      }

      const [month, year] = cardExpiry.split("/");
      const expYear = year && year.length === 2 ? `20${year}` : year;

      let data: any;
      let error: any;

      if (activeGateway === "mercadopago") {
        const result = await processCardPayment({
          plan_id: plan.id,
          amount: plan.price,
          payer_email: user.email!,
          is_upsell: false,
          metadata,
          cardType,
        });

        if (!result.success || result.status !== 'approved') {
          throw new Error(result.error || "Pagamento não autorizado. Tente novamente ou use outro cartão.");
        }

        data = result;
        error = null;
      } else if (activeGateway === "efi") {
        const cleanNumber = cardNumber.replace(/\s/g, "");
        const bin = cleanNumber.slice(0, 1);
        const brand = bin === "4" ? "visa" : bin === "5" ? "mastercard" : "visa";

        const tokenResponse = await (window as any).EfiJs.CreditCard
          .setAccount((window as any).EFI_ACCOUNT_ID)
          .setEnvironment((window as any).EFI_ENV)
          .setCreditCardData({
            brand,
            number: cleanNumber,
            cvv: cardCvv,
            expirationMonth: month,
            expirationYear: expYear,
            reuse: false,
          })
          .getPaymentToken();

        const paymentToken = tokenResponse?.payment_token;
        if (!paymentToken) {
          throw new Error("Falha ao gerar token de cartão Efi.");
        }

        ({ data, error } = await supabase.functions.invoke("efi-payment", {
          body: {
            amount: plan.price,
            installments: parseInt(installments, 10),
            card: {
              payment_token: paymentToken,
              holder_name: cardName,
            },
            metadata,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }));
      } else {
        ({ data, error } = await supabase.functions.invoke("pagbank-payment-v2", {
          body: {
            amount: plan.price,
            installments: parseInt(installments, 10),
            card: {
              number: cardNumber.replace(/\s/g, ""),
              holder_name: cardName,
              exp_month: month,
              exp_year: expYear,
              cvv: cardCvv,
              type: cardType,
            },
            metadata,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }));
      }

      if (error) {
        throw error;
      }

      toast.success("Carteirinha física adquirida! Envio em 7-10 dias úteis.");
      navigate("/carteirinha", { replace: true });
    } catch (error: any) {
      console.error("[CheckoutFisica] Erro no pagamento:", error);
      const message =
        error?.message || "Erro ao processar pagamento. Tente novamente.";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="app" />
        <div className="container max-w-3xl py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (noDigitalCard) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="app" />
        <div className="container max-w-3xl py-12">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  Você precisa ter uma carteirinha digital ativa para adquirir a física.
                </AlertDescription>
              </Alert>
              <Button
                className="mt-4"
                onClick={() => navigate("/carteirinha")}
              >
                Voltar para minha carteirinha
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="app" />
        <div className="container max-w-3xl py-12">
          <Alert variant="destructive">
            <AlertDescription>
              Não foi possível carregar o plano de carteirinha física.
            </AlertDescription>
          </Alert>
        </div>
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

  const displayAmount = plan.price;

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
                    Envio em até 7-10 dias úteis
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
                      <span>Carteirinha física impressa</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Frete grátis para todo Brasil</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Mesma validade da carteirinha digital</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="border-t pt-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-4 text-foreground">
                  Escolha a forma de pagamento
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
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
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Pagamento processado com</span>
                  <img
                    src={currentGatewayLogo()}
                    alt={currentGatewayName()}
                    className="h-6 w-auto"
                  />
                </div>
              </div>

              {paymentMethod === "pix" && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <h3 className="font-semibold text-foreground mb-1">
                    Pagamento via PIX
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Ao clicar em &quot;Gerar QR Code PIX&quot;, vamos criar um código
                    para você pagar com seu app do banco.
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

                  {activeGateway === "mercadopago" ? (
                    <form
                      id="form-checkout"
                      className="space-y-3"
                      onSubmit={(e) => e.preventDefault()}
                    >
                      <div>
                        <Label>Número do cartão</Label>
                        <div
                          id="mp-card-number"
                          className="h-10 border rounded px-3 py-2 bg-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mp-cardholder-name">Nome no cartão</Label>
                        <input
                          id="mp-cardholder-name"
                          className="h-10 border rounded px-3 w-full"
                          placeholder="Nome como no cartão"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Validade</Label>
                          <div
                            id="mp-expiration-date"
                            className="h-10 border rounded px-3 py-2 bg-white"
                          />
                        </div>
                        <div>
                          <Label>CVV</Label>
                          <div
                            id="mp-security-code"
                            className="h-10 border rounded px-3 py-2 bg-white"
                          />
                        </div>
                      </div>
                      <div style={cardType === "debit" ? { display: "none" } : undefined}>
                        <Label htmlFor="mp-installments">Parcelamento</Label>
                        <select
                          id="mp-installments"
                          className="h-10 border rounded px-3 w-full"
                        />
                      </div>
                      <div style={{ display: "none" }}>
                        <select id="mp-identification-type" defaultValue="CPF">
                          <option value="CPF">CPF</option>
                        </select>
                        <input
                          id="mp-identification-number"
                          defaultValue={
                            studentProfile?.cpf?.replace(/\D/g, "") || ""
                          }
                        />
                        <select id="mp-issuer" />
                      </div>
                    </form>
                  ) : (
                    <CardForm
                      cardNumber={cardNumber}
                      setCardNumber={setCardNumber}
                      cardName={cardName}
                      setCardName={setCardName}
                      cardExpiry={cardExpiry}
                      setCardExpiry={setCardExpiry}
                      cardCvv={cardCvv}
                      setCardCvv={setCardCvv}
                      installments={installments}
                      setInstallments={setInstallments}
                      maxInstallments={getMaxInstallments()}
                      planPrice={displayAmount}
                      cardType={cardType}
                      activeGateway={activeGateway}
                    />
                  )}
                </div>
              )}

              {paymentMethod && (
                <div>
                  <Button
                    className="w-full py-6 text-lg"
                    onClick={handleSubmit}
                    disabled={
                      processing ||
                      mpLoading ||
                      !plan ||
                      (paymentMethod === "card" &&
                        activeGateway !== "mercadopago" &&
                        !isFormValid())
                    }
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

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Pagamento processado com</span>
                <img
                  src={currentGatewayLogo()}
                  alt={currentGatewayName()}
                  className="h-6 w-auto"
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Ao continuar você concorda com nossos{" "}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Termos de Uso
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isTermsModalOpen} onOpenChange={setIsTermsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Termos de Uso – URE Brasil</DialogTitle>
              <DialogDescription>
                Condições gerais para uso da plataforma e emissão de carteirinhas estudantis.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-2 text-sm text-muted-foreground space-y-4">
              <p>
                Ao acessar ou utilizar a página da URE Brasil e solicitar a emissão de carteirinhas de estudante,
                você aceita estes Termos de Uso integralmente. Estes termos regem o serviço de emissão de carteiras
                estudantis padronizadas (DNE/CIE), conforme Lei 12.933/2013.
              </p>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Elegibilidade e responsabilidades</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>O serviço destina-se a estudantes regularmente matriculados em instituições de ensino reconhecidas.</li>
                  <li>Você é responsável pela veracidade das informações e documentos enviados.</li>
                  <li>O uso indevido da carteirinha pode acarretar sanções civis e penais.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Processo de emissão</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>A carteirinha digital é emitida após validação dos documentos enviados.</li>
                  <li>A carteirinha possui elementos de segurança para uso em pedidos de meia-entrada.</li>
                  <li>O prazo padrão para emissão é de até 48 horas úteis após aprovação dos documentos.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Limitação de responsabilidade</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>A URE Brasil não se responsabiliza por recusa de meia-entrada por parte de terceiros.</li>
                  <li>Não há responsabilidade por danos indiretos, lucros cessantes ou prejuízos decorrentes do uso da carteirinha.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Alterações e contato</h3>
                <p>
                  Estes termos podem ser atualizados periodicamente, e a versão vigente estará sempre disponível no
                  site oficial da URE Brasil.
                </p>
                <p>
                  Em caso de dúvidas, solicitações ou pedidos de cancelamento, entre em contato pelo e-mail{" "}
                  <span className="font-medium text-foreground">contato@ure.com.br</span>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Última atualização: janeiro de 2026.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
