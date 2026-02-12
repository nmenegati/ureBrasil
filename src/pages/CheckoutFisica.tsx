import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, CreditCard, Loader2, Lock, QrCode, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { CardForm } from "@/components/payment/CardForm";
import { formatPrice, validateCardForm } from "@/utils/payment-helpers";
import { toast } from "sonner";

type PaymentMethod = "pix" | "card";

interface PhysicalPlan {
  id: string;
  name: string;
  price: number;
}

export default function CheckoutFisica() {
  const { user } = useAuth();
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
    if (!user?.id) {
      return;
    }

    const loadInitialData = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("id, cpf, phone, birth_date")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError || !profile) {
          toast.error("Erro ao carregar perfil do estudante.");
          navigate("/dashboard", { replace: true });
          return;
        }

        setStudentProfile({
          cpf: profile.cpf,
          phone: profile.phone,
          birth_date: profile.birth_date,
        });

        const { data: physicalPlan, error: planError } = await supabase
          .from("plans")
          .select("id, name, price")
          .eq("type", "fisica_avulsa")
          .eq("is_active", true)
          .single();

        if (planError || !physicalPlan) {
          toast.error("Plano de carteirinha física não encontrado.");
          navigate("/dashboard", { replace: true });
          return;
        }

        setPlan({
          id: physicalPlan.id,
          name: physicalPlan.name,
          price: physicalPlan.price,
        });

        const { data: gatewayConfig } = await supabase
          .from("payment_gateway_config")
          .select("gateway_name")
          .eq("is_active", true)
          .single();

        if (gatewayConfig?.gateway_name) {
          setActiveGateway(gatewayConfig.gateway_name);
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        toast.error("Erro ao carregar informações para pagamento.");
        navigate("/dashboard", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user?.id, navigate]);

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

  const isCardFormValid = () => {
    if (paymentMethod !== "card") return true;
    if (activeGateway === "mercadopago") return true;

    const validation = validateCardForm({
      cardNumber,
      cardName,
      cardExpiry,
      cardCvv,
    });

    return validation.valid;
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

      if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const metadata: Record<string, unknown> = {
        is_physical: true,
        is_physical_avulsa: true,
      };

      if (paymentMethod === "pix") {
        const payload: Record<string, unknown> = {
          plan_id: plan.id,
          payment_method: "pix",
          amount: plan.price,
          metadata,
        };

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
            body: payload,
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }));
        }

        if (error) throw error;

        if (data?.pix_code) {
          navigate("/pagamento/pix", { state: { paymentData: data } });
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

        if (!result.success) {
          throw new Error(result.error || "Erro no pagamento");
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

      toast.success("Pagamento aprovado! Sua carteirinha física será enviada em breve.");
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

  const displayAmount = plan.price;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container max-w-3xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Finalizar Compra da Carteirinha Física
          </h1>
          <p className="text-sm text-muted-foreground">
            A carteira física é opcional e pode ser adquirida a qualquer momento.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">Forma de Pagamento</h2>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <label className="border rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary transition">
                    <RadioGroupItem value="card" className="sr-only" />
                    <CreditCard className="h-6 w-6" />
                    <span className="font-medium">Cartão</span>
                    <span className="text-xs text-muted-foreground">
                      Débito ou Crédito
                    </span>
                    <span className="text-sm font-semibold">
                      {formatPrice(displayAmount)}
                    </span>
                  </label>

                  <label className="border rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary transition">
                    <RadioGroupItem value="pix" className="sr-only" />
                    <QrCode className="h-6 w-6" />
                    <span className="font-medium">PIX</span>
                    <span className="text-xs text-muted-foreground">
                      Aprovação rápida
                    </span>
                    <span className="text-sm font-semibold">
                      {formatPrice(displayAmount)}
                    </span>
                  </label>
                </RadioGroup>
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">
                        Pagamento seguro, dados criptografados
                      </span>
                    </div>
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

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground border-t pt-4">
                <Lock className="h-3 w-3" />
                <span>Pagamento 100% seguro. Não altera seu fluxo de carteirinha digital.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Resumo da Carteirinha Física</h2>
                <p className="text-xs text-muted-foreground">
                  Compra avulsa, independente do fluxo de onboarding.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{plan.name}</span>
                <span className="text-lg font-bold">
                  {formatPrice(plan.price)}
                </span>
              </div>
              <div className="border-t pt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Envio para todo Brasil após confirmação do pagamento.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3 text-blue-500" />
                  <span>Não altera seu status de documentos ou onboarding.</span>
                </div>
              </div>

              <Button
                className="w-full mt-2"
                disabled={processing || mpLoading || !plan}
                onClick={handleSubmit}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando pagamento...
                  </>
                ) : paymentMethod === "pix" ? (
                  "Gerar QR Code PIX"
                ) : (
                  `Pagar ${formatPrice(displayAmount)}`
                )}
              </Button>

              {mpError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Ocorreu um erro ao inicializar o Mercado Pago. Tente novamente ou escolha outro método.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
