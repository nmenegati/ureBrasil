import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { ProgressBar } from "@/components/ProgressBar";
import { CardForm } from "@/components/payment/CardForm";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
import { QrCode, CreditCard, Loader2, Check, Shield, Lock, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import {
  maskCardNumber,
  maskExpiry,
  maskCvv,
  getValidityDate,
  formatPrice,
  validateCardForm,
} from "@/utils/payment-helpers";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_physical: boolean;
  is_direito: boolean;
}

declare global {
  interface Window {
    EfiJs?: any;
    fbq?: (...args: unknown[]) => void;
  }
}

const EFI_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/gh/efipay/js-payment-token-efi/dist/payment-token-efi.min.js";

const EFI_ACCOUNT_ID = import.meta.env.VITE_EFI_ACCOUNT_ID as string | undefined;
const EFI_ENV = (import.meta.env.VITE_EFI_ENV as string | undefined) || "sandbox";

const loadEfiScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Janela não disponível"));
      return;
    }
    if (window.EfiJs) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = EFI_SCRIPT_SRC;
    script.type = "text/javascript";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Falha ao carregar SDK de pagamento da Efi"));
    document.body.appendChild(script);
  });
};

const detectCardBrand = (cardNumber: string) => {
  const bin = cardNumber.replace(/\D/g, "").slice(0, 1);
  if (bin === "4") return "visa";
  if (bin === "5") return "mastercard";
  return "visa";
};

/**
 * FLUXO DO USUÁRIO:
 * 1. Chega em /pagamento após escolher um plano digital (geral ou direito).
 * 2. Página carrega o plano selecionado e o perfil do estudante.
 * 3. Usuário escolhe forma de pagamento (cartão ou PIX) e gateway disponível.
 * 4. Em caso de cartão, preenche dados via CardForm ou SDK Mercado Pago.
 * 5. Ao confirmar, a edge function de pagamento é chamada e cria/atualiza o registro em payments.
 * 6. Triggers backend criam o student_card digital e avançam o onboarding.
 *
 * ESTADOS DERIVADOS:
 * - paymentMethod: null, 'card' ou 'pix', controlando qual UI exibir.
 * - isFormValid: valida campos de cartão para gateways não-Mercado Pago.
 * - displayAmount: valor final cobrado (pode incluir descontos/ofertas).
 *
 * GUARDS:
 * - useOnboardingGuard(['choose_plan', 'payment']): garante que o usuário
 *   só acesse /pagamento a partir de escolher plano ou do próprio passo payment.
 * - Redireciona para login ou escolher plano se não houver sessão ou plano válido.
 *
 * DEPENDÊNCIAS BACKEND:
 * - Tabela payments (criação de transações e vinculação a plans/student_profiles).
 * - Edge functions mercadopago-payment, pagbank-payment-v2 e efi-payment.
 * - Triggers que criam student_cards e atualizam current_onboarding_step após pagamento.
 */
export default function Pagamento() {
  const { isChecking } = useOnboardingGuard(["choose_plan", "payment"]);
  const navigate = useNavigate();
  const location = useLocation();
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
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{
    cpf: string;
    phone: string;
    birth_date: string;
  } | null>(null);
  const [activeGateway, setActiveGateway] = useState<string>("pagbank");
  const {
    sdkReady,
    initCardForm,
    processCardPayment,
    processPixPayment,
    loading: mpLoading,
    error: mpError,
  } = useMercadoPago();

  const locationState = (location.state as {
    isPhysicalUpsell?: boolean;
    amount?: number;
    selectedPlan?: {
      name: string;
      price: number;
      is_physical: boolean;
      is_standalone?: boolean;
    };
  }) || null;

  const standaloneSelectedPlan = locationState?.selectedPlan;
  const isStandalonePhysical = !!standaloneSelectedPlan?.is_standalone;
  const cardAmountForGateway = standaloneSelectedPlan?.price ?? plan?.price ?? 0;
  const mpFormInitializedRef = useRef(false);

  useEffect(() => {
    if (authLoading || isChecking) return;
    
    const loadPlan = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("plan_id, cpf, phone, birth_date, is_law_student")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          toast.error("Erro ao carregar perfil");
          navigate("/login");
          return;
        }

        setStudentProfile({
          cpf: profile.cpf,
          phone: profile.phone,
          birth_date: profile.birth_date,
        });

        let planQuery = supabase.from("plans").select("*");

        if (profile.plan_id) {
          planQuery = planQuery.eq("id", profile.plan_id);
        } else {
          const planType = profile.is_law_student ? "direito_digital" : "geral_digital";
          planQuery = planQuery.eq("type", planType).eq("is_active", true);
        }

        const { data: planData, error: planError } = await planQuery.single();

        if (planError || !planData) {
          toast.error("Erro ao carregar plano");
          navigate("/escolher-plano");
          return;
        }

        // Auto-assign plan_id se ainda não tinha (apenas para planos digitais)
        if (!profile.plan_id && !isStandalonePhysical) {
          await supabase
            .from("student_profiles")
            .update({ plan_id: planData.id })
            .eq("user_id", user.id);
        }

        if (standaloneSelectedPlan?.is_standalone) {
          setPlan({
            ...planData,
            name: standaloneSelectedPlan.name,
            price: standaloneSelectedPlan.price,
            is_physical: standaloneSelectedPlan.is_physical,
          });
        } else {
          setPlan(planData);
        }
      } catch (error) {
        console.error("Erro ao carregar plano:", error);
        toast.error("Erro ao carregar dados");
        navigate("/escolher-plano");
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [user, authLoading, isChecking, navigate, standaloneSelectedPlan]);

  useEffect(() => {
    const fetchGateway = async () => {
      const { data, error } = await supabase
        .from("payment_gateway_config")
        .select("gateway_name")
        .eq("is_active", true)
        .single();

      if (error) {
        console.error("[PAGAMENTO] Erro ao carregar gateway ativo:", {
          error: error.message,
        });
        return;
      }

      if (data?.gateway_name) {
        setActiveGateway(data.gateway_name);
      }
    };

    fetchGateway();
  }, []);

  useEffect(() => {
    if (activeGateway !== "mercadopago") return;
    if (!sdkReady) return;
    if (!cardAmountForGateway) return;
    if (paymentMethod !== "card") return;
    if (mpFormInitializedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const formElement = document.getElementById("form-checkout");

      if (!formElement) {
        console.error(
          "[Pagamento] form-checkout NÃO encontrado no DOM"
        );
        return;
      }

      initCardForm({
        amount: String(cardAmountForGateway),
        cardNumberId: "mp-card-number",
        expirationDateId: "mp-expiration-date",
        securityCodeId: "mp-security-code",
        cardholderNameId: "mp-cardholder-name",
        installmentsId: "mp-installments",
        identificationTypeId: "mp-identification-type",
        identificationNumberId: "mp-identification-number",
        onError: (err) => console.error("CardForm MP erro:", err),
      });

      mpFormInitializedRef.current = true;
    }, 500);

    return () => clearTimeout(timer);
  }, [
    activeGateway,
    sdkReady,
    cardAmountForGateway,
    paymentMethod,
    initCardForm,
  ]);

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

  const isFormValid = () => {
    if (!paymentMethod) return false;
    if (paymentMethod === "pix") return true;
    return isCardFormValid();
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
    if (!plan || !paymentMethod) return;

    if (paymentMethod === "card" && activeGateway !== "mercadopago") {
      const validation = validateCardForm({
        cardNumber,
        cardName,
        cardExpiry,
        cardCvv,
      });

      if (!validation.valid) {
        toast({
          title: "Erro",
          description: validation.message,
        });
        return;
      }
    }

    setProcessing(true);

    try {
      const { isPhysicalUpsell, amount, selectedPlan } =
        (location.state as {
          isPhysicalUpsell?: boolean;
          amount?: number;
          selectedPlan?: { is_standalone?: boolean };
        } | null) || {};

      const isStandalone = !!selectedPlan?.is_standalone || isStandalonePhysical;
      const isUpsell = !!(isPhysicalUpsell || isStandalone);

      const paymentAmount =
        isUpsell && typeof amount === "number" ? amount : plan.price;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const metadata: Record<string, unknown> = {
        is_upsell: isUpsell,
        is_physical_upsell: isUpsell,
      };

      if (isStandalone) {
        metadata.is_standalone_physical = true;
      }

      if (paymentMethod === "pix") {
        const payload: Record<string, unknown> = {
          plan_id: plan.id,
          payment_method: "pix",
          amount: paymentAmount,
          metadata,
        };

        let data: any;
        let error: any;

        if (activeGateway === "mercadopago") {
          const result = await processPixPayment({
            plan_id: plan.id,
            amount: paymentAmount,
            payer_email: user!.email!,
            is_upsell: isUpsell,
          });
          if (!result.success) throw new Error(result.error || "Erro PIX");
          data = result;
          error = null;
        } else {
          ({ data, error } = await supabase.functions.invoke(
            "create-payment",
            {
              body: payload,
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          ));
        }

        if (error) {
          console.error("[PAGAMENTO] Erro na função create-payment (PIX):", error);
          throw error;
        }

        if (data?.pix_code) {
          navigate("/pagamento/pix", {
            state: {
              paymentData: {
                ...data,
                amount: paymentAmount,
              },
              returnTo: plan.is_physical ? "/upload-documentos" : "/pagamento/sucesso",
              successMessage: "Pagamento confirmado!",
            },
          });
        } else {
          toast.success("Pagamento processado com sucesso!");
          const nextStep = plan.is_physical ? "upload_documents" : "upsell_physical";

          const { data: profileRow, error: profileError } = await supabase
            .from("student_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profileRow?.id) {
            await supabase
              .from("student_profiles")
              .update({ current_onboarding_step: nextStep })
              .eq("id", profileRow.id);
          }

          const nextRoute = nextStep === "upload_documents" ? "/upload-documentos" : "/pagamento/sucesso";

          const paymentId =
            (data && (data.payment_id || data.orderId || data.id)) || undefined;

          navigate(nextRoute, {
            state: {
              planName: plan.name,
              amount: paymentAmount,
              paymentId,
              cardType: plan.is_direito ? "direito" : "geral",
              paymentMethod: "pix",
              isPhysicalPlan: plan.is_physical,
              isStandalonePhysical: isStandalone,
            },
          });
        }
      } else {
        if (!studentProfile) {
          toast.error("Erro ao carregar dados do perfil");
          return;
        }

        const [month, year] = cardExpiry.split("/");
        const expYear =
          year && year.length === 2 ? `20${year}` : year;

        const installmentsCount =
          cardType === "credit" ? parseInt(installments) : 1;

        let data: any;
        let error: any;

        if (activeGateway === "efi") {
          if (!EFI_ACCOUNT_ID) {
            throw new Error(
              "Configuração da conta Efi não encontrada (VITE_EFI_ACCOUNT_ID)."
            );
          }

          await loadEfiScript();

          const cleanNumber = cardNumber.replace(/\s/g, "");
          const brand = detectCardBrand(cleanNumber);
          const efiEnv = EFI_ENV;

          const tokenResponse = await window.EfiJs.CreditCard
            .setAccount(EFI_ACCOUNT_ID)
            .setEnvironment(efiEnv)
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
              amount: paymentAmount,
              installments: installmentsCount,
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
        } else if (activeGateway === "mercadopago") {
          const result = await processCardPayment({
            plan_id: plan.id,
            amount: paymentAmount,
            payer_email: user!.email!,
            is_upsell: isUpsell,
            cardType,
          });
          if (!result.success || result.status !== 'approved') throw new Error(result.error || "Pagamento não autorizado. Tente novamente ou use outro cartão.");
          data = result;
          error = null;
        } else {
          ({ data, error } = await supabase.functions.invoke(
            "pagbank-payment-v2",
            {
              body: {
                amount: paymentAmount,
                installments: installmentsCount,
                card: {
                  number: cardNumber.replace(/\s/g, ""),
                  exp_month: month,
                  exp_year: expYear,
                  security_code: cardCvv,
                  holder_name: cardName,
                },
                metadata,
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          ));
        }

        if (error) {
          console.error("[PAGAMENTO] Erro em função de pagamento (cartão):", error);
          throw error;
        }

        if (!data?.success) {
          const msg =
            (data && (data.error as string | undefined)) ||
            "Pagamento não autorizado";
          throw new Error(msg);
        }

        toast.success("Pagamento processado com sucesso!");
        const nextStep = plan.is_physical ? "upload_documents" : "upsell_physical";

        const { data: profileRow, error: profileError } = await supabase
          .from("student_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileRow?.id) {
          await supabase
            .from("student_profiles")
            .update({ current_onboarding_step: nextStep })
            .eq("id", profileRow.id);
        }

        const nextRoute = nextStep === "upload_documents" ? "/upload-documentos" : "/pagamento/sucesso";

        const paymentId =
          (data && (data.payment_id || data.orderId || data.id)) || undefined;

        // Meta Pixel — conversão de compra (cartão digital)
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'Purchase', {
            value: paymentAmount,
            currency: 'BRL',
            content_ids: [paymentId],
            content_type: 'product',
            content_name: plan.name,
          });
        }

        navigate("/pagamento/sucesso", {
          state: {
            planName: plan.name,
            amount: paymentAmount,
            paymentId,
            cardType: plan.is_direito ? "direito" : "geral",
            paymentMethod: cardType,
            isPhysicalPlan: plan.is_physical,
            isStandalonePhysical: isStandalone,
          },
        });
      }
    } catch (err: any) {
      console.error("Erro no pagamento:", err);

      const context = err?.context;

      if (context?.status === 401) {
        toast.error("Sua sessão expirou. Faça login novamente.");
      } else {
        toast.error("Erro ao processar pagamento. Tente novamente.");
      }
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

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {!isStandalonePhysical && (
            <ProgressBar currentStep="payment" />
          )}
        <Card>  
          <CardContent className="p-6 space-y-5">  
            <div className="flex items-center gap-1.5 mb-1 text-green-600">  
              <Shield className="h-4 w-4" />  
              <span className="text-xs font-medium tracking-wide">COMPRA 100% SEGURA</span>  
            </div>

            {/* Bloco do produto: imagem + texto lado a lado */}
            <div className="flex items-start gap-4 md:gap-5 mt-3">
              {/* Texto: primeiro no mobile, à direita no desktop */}
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
                    {formatPrice(plan.price)}
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground mt-1">
                    Pagamento único • Válida até {getValidityDate()}
                  </p>
                </div>
              </div>

              {/* Imagem: à direita no mobile, à esquerda no desktop */}
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
                      <span>Carteira digital com QR Code de verificação</span>
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
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Validade nacional até {getValidityDate()}</span>
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
                      {formatPrice(plan.price)}
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
                      {formatPrice(plan.price)}
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
                      planPrice={plan.price}
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
                      (paymentMethod === "card" &&
                        activeGateway === "mercadopago"
                        ? false
                        : !isFormValid())
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
                      "Finalizar Pedido com Segurança"
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
                Condições gerais para uso da plataforma e emissão de carteiras estudantis.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-2 text-sm text-muted-foreground space-y-4">
              <p>
                Ao acessar ou utilizar a página da URE Brasil e solicitar a emissão de carteiras de estudante,
                você aceita estes Termos de Uso integralmente. Estes termos regem o serviço de emissão de carteiras
                estudantis padronizadas (DNE/CIE), conforme Lei 12.933/2013.
              </p>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Elegibilidade e responsabilidades</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    o serviço destina-se a estudantes regularmente matriculados em instituições de ensino reconhecidas
                    (educação infantil ao superior);
                  </li>
                  <li>
                    para menores de 18 anos, o responsável legal deve confirmar os dados no formulário ou anexar
                    declaração de autorização, conforme modelo disponibilizado no site;
                  </li>
                  <li>
                    você garante a veracidade das informações fornecidas (nome, CPF, matrícula, foto e demais dados).
                    A falsidade dessas informações pode sujeitar o responsável a sanções civis e penais.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Processo de emissão</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    após o envio dos dados e do comprovante de matrícula, a carteira digital é emitida, em regra,
                    em até 48 horas úteis;
                  </li>
                  <li>
                    a carteira possui elementos de segurança (como QR Code, trama anti-scanner e microletras) para
                    uso em pedidos de meia-entrada em eventos;
                  </li>
                  <li>
                    pagamentos são processados por plataformas seguras; reembolsos serão analisados e concedidos apenas
                    em casos de erro comprovado pela URE Brasil.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Uso permitido</h3>
                <p>
                  A carteira do estudante URE pode ser utilizada exclusivamente para obtenção de meia-entrada em eventos culturais,
                  esportivos e de lazer previstos em lei. É proibido:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>falsificar, adulterar ou revender carteiras;</li>
                  <li>emprestar ou compartilhar o documento com terceiros;</li>
                  <li>divulgar cópias digitais de forma pública ou sem autorização;</li>
                  <li>utilizar a carteira para fins não previstos na legislação aplicável.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Limitações e isenção de responsabilidade</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    a URE Brasil não garante a aceitação universal da carteira, pois a conferência do direito à
                    meia-entrada também depende da política de cada organizador de evento;
                  </li>
                  <li>
                    a URE Brasil não se responsabiliza por danos indiretos, lucros cessantes, prejuízos financeiros ou
                    recusa de meia-entrada por parte de terceiros;
                  </li>
                  <li>
                    o serviço poderá ser suspenso temporariamente para manutenção, ajustes técnicos ou em casos de
                    violação destes Termos de Uso.
                  </li>
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
        </div>
      </main>
    </div>
  );
}
