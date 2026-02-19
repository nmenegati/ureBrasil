import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { ProgressBar } from "@/components/ProgressBar";
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
import gatewayMpLogo from "@/assets/gateway-mp.png";
import gatewayPagseguroLogo from "@/assets/gateway-pagseguro.png";
import gatewayEfiLogo from "@/assets/pagseguro-logo.png";
import carteirinhaDireitoImg1 from "@/assets/carteirinha-direito-pgto-1.jpg";
import carteirinhaDireitoImg2 from "@/assets/carteirinha-direito-pgto-2.jpg";
import carteirinhaGeralImg1 from "@/assets/carteirinha-geral-pagto-1.jpeg";
import carteirinhaGeralImg2 from "@/assets/carteirinha-geral-pagto-2.jpeg";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOnboardingGuard, STEP_ROUTES } from "@/hooks/useOnboardingGuard";
import { useMercadoPago } from "@/hooks/useMercadoPago";
import { CardForm } from "@/components/payment/CardForm";
import { validateCardForm } from "@/utils/payment-helpers";

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

interface ResolvedUpsell {
  isUpsell: boolean;
  amount: number;
  originalPaymentId: string;
}

const CHECKOUT_RESOLVE_RETRY_KEY = "checkout_resolve_attempts";

const getValidityDate = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const validityYear = currentMonth < 3 ? currentYear : currentYear + 1;
  return `31/03/${validityYear}`;
};

export default function Checkout() {
  /**
   * FLUXO DO USUÁRIO:
   * 1. Chega em /checkout como parte do fluxo de upsell físico após pagamento digital.
   * 2. Página resolve o estado de upsell (valor, originalPaymentId) a partir de location.state
   *    ou de dados persistidos (localStorage).
   * 3. Carrega plano e perfil do estudante para preencher resumo e dados do pagador.
   * 4. Usuário escolhe forma de pagamento (cartão ou PIX) e gateway disponível.
   * 5. Em caso de cartão, preenche dados via CardForm ou SDK do Mercado Pago.
   * 6. Ao confirmar, processa o pagamento do upsell e atualiza student_cards / step de onboarding.
   *
   * ESTADOS DERIVADOS:
   * - isUpsell: indica se está em modo de oferta adicional ou fluxo normal.
   * - resolvedUpsell: contém amount e originalPaymentId resolvidos (ou fluxo padrão).
   * - displayAmount: valor efetivo cobrado (pode ser diferente do plano base).
   * - isFormValid: valida campos de cartão quando gateway não é Mercado Pago.
   *
   * GUARDS:
   * - useOnboardingGuard(['upsell_physical', 'payment_upsell']): garante que o aluno
   *   está em um dos passos de upsell antes de acessar /checkout.
   * - Redirects adicionais dependendo de current_onboarding_step e presence de upsell data.
   *
   * DEPENDÊNCIAS BACKEND:
   * - Tabela payments (para buscar pagamento original e registrar novos).
   * - Funções de pagamento (pagbank-payment-v2, mercadopago-payment, efi-payment).
   * - Triggers que criam/atualizam student_cards e current_onboarding_step após pagamento.
   */
  const { isChecking } = useOnboardingGuard(["upsell_physical", "payment_upsell"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Extrair state de upsell
  const upsellState = location.state as UpsellState | null;
  const isUpsell = upsellState?.isUpsell ?? false;
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
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isValidLawStudent, setIsValidLawStudent] = useState(false);
  const [resolvedUpsell, setResolvedUpsell] = useState<ResolvedUpsell | null>(null);
  const [resolvingUpsell, setResolvingUpsell] = useState(true);
  const [upsellResolved, setUpsellResolved] = useState(false);
  const [activeGateway, setActiveGateway] = useState<string>("pagbank");
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
    const fetchGateway = async () => {
      const { data } = await supabase
        .from("payment_gateway_config")
        .select("gateway_name")
        .eq("is_active", true)
        .single();

      if (data?.gateway_name) {
        setActiveGateway(data.gateway_name);
      }
    };

    fetchGateway();
  }, []);

  useEffect(() => {
    if (activeGateway !== "mercadopago") return;
    if (!sdkReady) return;
    if (!resolvedUpsell?.amount) return;
    if (paymentMethod !== "card") return;
    if (!studentProfile?.cpf) return;
    if (mpFormInitializedRef.current) {
      console.info("[Checkout] CardForm MP já inicializado, ignorando");
      return;
    }

    const timer = setTimeout(() => {
      const formElement = document.getElementById("form-checkout");
      if (!formElement) {
        console.error("[Checkout] form-checkout NÃO encontrado no DOM");
        return;
      }

      initCardForm({
        amount: String(resolvedUpsell.amount),
        cardNumberId: "mp-card-number",
        expirationDateId: "mp-expiration-date",
        securityCodeId: "mp-security-code",
        cardholderNameId: "mp-cardholder-name",
        installmentsId: "mp-installments",
        identificationTypeId: "mp-identification-type",
        identificationNumberId: "mp-identification-number",
        onReady: () => console.info("[Checkout] CardForm MP pronto!"),
        onError: (err) => console.error("[Checkout] CardForm MP erro:", err),
      });

      mpFormInitializedRef.current = true;
    }, 500);

    return () => clearTimeout(timer);
  }, [
    activeGateway,
    sdkReady,
    resolvedUpsell?.amount,
    paymentMethod,
    initCardForm,
    studentProfile?.cpf,
  ]);

  useEffect(() => {
    if (isChecking) return;
    if (upsellResolved) return;

    const resolveUpsell = async () => {
      console.info("[CHECKOUT] resolveUpsell:", {
        isUpsell: !!upsellState?.isUpsell,
      });

      const fetchUpsellPrice = async () => {
        const { data } = await supabase
          .from("plans")
          .select("price")
          .eq("type", "fisica_upsell")
          .eq("is_active", true)
          .single();

        return data?.price ?? null;
      };

      if (upsellState?.isUpsell && upsellState.originalPaymentId) {
        let resolvedAmount = upsellState.amount;
        if (typeof resolvedAmount !== "number") {
          resolvedAmount = await fetchUpsellPrice();
        }

        if (typeof resolvedAmount !== "number") {
          setResolvingUpsell(false);
          setUpsellResolved(true);
          navigate("/dashboard", { replace: true });
          return;
        }

        setResolvedUpsell({
          isUpsell: true,
          amount: resolvedAmount,
          originalPaymentId: upsellState.originalPaymentId,
        });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(CHECKOUT_RESOLVE_RETRY_KEY);
        }
        setPaymentMethod("card");
        setResolvingUpsell(false);
        return;
      }

      const savedUpsell = localStorage.getItem("upsell_data");
      if (savedUpsell) {
        try {
          const data = JSON.parse(savedUpsell) as {
            originalPaymentId?: string;
            amount?: number;
            isUpsell?: boolean;
            timestamp?: number;
          };

          const timestamp = typeof data.timestamp === "number" ? data.timestamp : 0;
          const expired = Date.now() - timestamp > 30 * 60 * 1000;

          if (data.isUpsell && data.originalPaymentId && !expired) {
            let resolvedAmount = data.amount;
            if (typeof resolvedAmount !== "number") {
              resolvedAmount = await fetchUpsellPrice();
            }

            if (typeof resolvedAmount !== "number") {
              setResolvingUpsell(false);
              setUpsellResolved(true);
              navigate("/dashboard", { replace: true });
              return;
            }

            setResolvedUpsell({
              isUpsell: true,
              amount: resolvedAmount,
              originalPaymentId: data.originalPaymentId,
            });
              if (typeof window !== "undefined") {
                sessionStorage.removeItem(CHECKOUT_RESOLVE_RETRY_KEY);
              }
            setPaymentMethod("card");
            setResolvingUpsell(false);
            return;
          }
        } catch {
        }
      }

      if (typeof window !== "undefined") {
        const attempts = parseInt(
          sessionStorage.getItem(CHECKOUT_RESOLVE_RETRY_KEY) || "0",
        );

        if (attempts >= 3) {
          sessionStorage.removeItem(CHECKOUT_RESOLVE_RETRY_KEY);

          if (!user) {
            navigate("/complete-profile", { replace: true });
            setResolvingUpsell(false);
            setUpsellResolved(true);
            return;
          }

          const { data: profileRow } = await supabase
            .from("student_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profileRow?.id) {
            await supabase
              .from("student_profiles")
              .update({ current_onboarding_step: "documents" })
              .eq("id", profileRow.id);
          }

          setResolvingUpsell(false);
          setUpsellResolved(true);
          navigate("/upload-documentos", { replace: true });
          return;
        }

        sessionStorage.setItem(
          CHECKOUT_RESOLVE_RETRY_KEY,
          String(attempts + 1),
        );
      }

      setResolvingUpsell(false);
      console.info("[Checkout] resolveUpsell fallback, step redirect para fluxo principal");
      if (!user) {
        navigate("/complete-profile", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("student_profiles")
        .select("current_onboarding_step")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[CHECKOUT] Erro ao buscar current_onboarding_step:", {
          userId: user.id,
          error: error.message,
        });
        navigate("/complete-profile", { replace: true });
        return;
      }

      const step = (data?.current_onboarding_step as string | null) ?? "complete_profile";
      const redirectTo = STEP_ROUTES[step] || STEP_ROUTES["complete_profile"];
      navigate(redirectTo, { replace: true });

      setUpsellResolved(true);
    };

    resolveUpsell();
  }, [isChecking, upsellResolved, user]);

  useEffect(() => {
    if (isChecking) return;
    if (!user?.id) return;
    if (!resolvedUpsell || !resolvedUpsell.isUpsell || !resolvedUpsell.originalPaymentId) return;

    const fetchPlanAndProfile = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("plan_id, cpf, phone, birth_date, is_law_student, education_level")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          toast.error("Erro ao carregar perfil");
          navigate("/dashboard");
          return;
        }

        setStudentProfile({
          cpf: profile.cpf,
          phone: profile.phone,
          birth_date: profile.birth_date,
        });

        const validLaw =
          profile.is_law_student === true &&
          (profile.education_level === "graduacao" ||
            profile.education_level === "pos_lato" ||
            profile.education_level === "stricto_sensu");
        setIsValidLawStudent(validLaw);

        const { data: originalPayment, error: originalPaymentError } = await supabase
          .from("payments")
          .select("plan_id, plans(name)")
          .eq("id", resolvedUpsell.originalPaymentId)
          .single();

        if (originalPaymentError) {
          console.error("[CHECKOUT] Erro ao carregar pagamento original:", {
            error: originalPaymentError.message,
          });
        }

        const originalPlanName = originalPayment?.plans
          ? (originalPayment.plans as { name: string }).name
          : "sua carteirinha";

        setPlan({
          id: originalPayment?.plan_id || "physical_addon",
          name: "Carteirinha Física",
          description: `Adicional para ${originalPlanName}`,
          price: resolvedUpsell.amount,
          is_physical: true,
          is_direito: false,
        });
      } catch (error) {
        console.error("[CHECKOUT] Erro ao carregar dados de upsell:", error);
        toast.error("Erro ao carregar informações de pagamento");
      } finally {
        setLoading(false);
      }
    };

    fetchPlanAndProfile();
  }, [isChecking, user?.id, resolvedUpsell?.originalPaymentId, navigate, resolvedUpsell]);

  const handleSubmit = async () => {
    if (!plan || !studentProfile) return;

    if (!resolvedUpsell || !resolvedUpsell.isUpsell || !resolvedUpsell.originalPaymentId) {
      if (!user) {
        navigate("/complete-profile", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("student_profiles")
        .select("current_onboarding_step")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[CHECKOUT] Erro ao buscar current_onboarding_step (handleSubmit):", {
          userId: user.id,
          error: error.message,
        });
        navigate("/complete-profile", { replace: true });
        return;
      }

      const step = (data?.current_onboarding_step as string | null) ?? "complete_profile";
      const redirectTo = STEP_ROUTES[step] || STEP_ROUTES["complete_profile"];
      navigate(redirectTo, { replace: true });
      return;
    }

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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      if (paymentMethod === "pix" && resolvedUpsell.isUpsell && resolvedUpsell.originalPaymentId) {
        let data: any;
        let error: any;

        if (activeGateway === "mercadopago") {
          const result = await processPixPayment({
            plan_id: plan.id,
            amount: resolvedUpsell.amount,
            payer_email: user!.email!,
            is_upsell: true,
            original_payment_id: resolvedUpsell.originalPaymentId,
            metadata: {
              is_upsell: true,
              is_physical_upsell: true,
              original_payment_id: resolvedUpsell.originalPaymentId,
            },
          });
          if (!result.success) {
            throw new Error(result.error || "Erro PIX");
          }
          data = result;
          error = null;
        } else {
          ({ data, error } = await supabase.functions.invoke("create-payment", {
            body: {
              plan_id: plan.id,
              payment_method: "pix",
              amount: resolvedUpsell.amount,
              metadata: {
                is_upsell: true,
                is_physical_upsell: true,
                original_payment_id: resolvedUpsell.originalPaymentId,
              },
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
                amount: resolvedUpsell.amount,  // ← garantir que amount vai ser o mesmo
              },
              returnTo: "/upload-documentos",
              successMessage:
                "Carteirinha física adicionada! Envio em 7-10 dias úteis.",
            },
          });
          return;
        }

        const { error: updateError } = await supabase
          .from("student_cards")
          .update({
            is_physical: true,
            updated_at: new Date().toISOString(),
          })
          .eq("payment_id", resolvedUpsell.originalPaymentId);

        if (updateError) {
          console.error("[CHECKOUT] Erro update card:", updateError);
        }

        localStorage.removeItem("recent_payment_id");
        localStorage.removeItem("upsell_data");
        toast.success("Carteirinha física adicionada!");
        navigate("/upload-documentos", { replace: true });
        return;
      }

      if (resolvedUpsell.isUpsell && resolvedUpsell.originalPaymentId) {
        console.info("[CHECKOUT] Processando upsell via gateway:", {
          gateway: activeGateway,
        });

        const [month, year] = cardExpiry.split("/");
        const expYear = year && year.length === 2 ? `20${year}` : year;

        let data: any;
        let error: any;

        if (activeGateway === "mercadopago") {
          const result = await processCardPayment({
            plan_id: plan.id,
            amount: resolvedUpsell.amount,
            payer_email: user!.email!,
            is_upsell: true,
            original_payment_id: resolvedUpsell.originalPaymentId,
            cardType,
          });
          if (!result.success) {
            throw new Error(
              result.error || "Erro ao processar pagamento do upsell",
            );
          }
          data = result;
          error = null;
        } else {
          ({ data, error } = await supabase.functions.invoke(
            "pagbank-payment-v2",
            {
              body: {
                amount: resolvedUpsell.amount,
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
                  original_payment_id: resolvedUpsell.originalPaymentId,
                },
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            },
          ));
        }

        if (error) throw error;
        if (!data?.success) {
          throw new Error(
            (data && (data.error as string | undefined)) ||
              "Erro ao processar pagamento do upsell",
          );
        }

        // Atualizar carteirinha original para física
        const { error: updateError } = await supabase
          .from("student_cards")
          .update({
            is_physical: true,
            updated_at: new Date().toISOString(),
          })
          .eq("payment_id", resolvedUpsell.originalPaymentId);

        if (updateError) {
          console.error("[CHECKOUT] Erro ao atualizar carteirinha física:", updateError);
        }

        // Atualizar step de onboarding para upload de documentos
        if (user) {
          const { data: profileRow } = await supabase
            .from("student_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profileRow?.id) {
            const { error: stepError } = await supabase
              .from("student_profiles")
              .update({ current_onboarding_step: "upload_documents" })
              .eq("id", profileRow.id);

            if (stepError) {
              console.warn(
                "Erro ao atualizar current_onboarding_step (não crítico):",
                stepError,
              );
            }
          }
        }

        localStorage.removeItem("recent_payment_id");
        localStorage.removeItem("upsell_data");

        toast.success(
          "🎉 Carteirinha física adicionada! Você receberá em 7-10 dias úteis.",
        );

        navigate("/upload-documentos", { replace: true });
        return;
      }

    } catch (error: unknown) {
      console.error("[CHECKOUT] Erro no pagamento de upsell:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao processar pagamento do upsell";
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

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loading || resolvingUpsell) {
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

  const displayAmount = resolvedUpsell ? resolvedUpsell.amount : plan.price;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <ProgressBar currentStep="payment" />
        </div>
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
                      ? "Envio em até 7 dias úteis"
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
                      <span>Carteirinha física com QR Code de verificação</span>
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
                        <span>Frete Grátis para todo Brasil</span>
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
                  <span className="font-medium text-foreground">suporte@urebrasil.com.br</span>.
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
