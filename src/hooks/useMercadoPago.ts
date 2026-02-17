import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Tipos
interface CardFormData {
  token?: string;
  paymentMethodId?: string;
  payment_method_id?: string;
  issuerId?: string;
  issuer_id?: string;
  installments?: string | number;
}

interface PaymentResult {
  success: boolean;
  payment_id?: string;
  status?: string;
  mp_status?: string;
  mp_status_detail?: string;
  pix_qr_code?: string;
  pix_qr_code_base64?: string;
  pix_expires_at?: string;
  error?: string;
}

// Carregar SDK do Mercado Pago
const loadMercadoPagoSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById('mp-sdk')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar SDK Mercado Pago'));
    document.head.appendChild(script);
  });
};

/**
 * Hook de integração com o SDK do Mercado Pago no frontend.
 *
 * @returns {
 *  sdkReady, loading, error,
 *  initCardForm, processCardPayment, processPixPayment
 * } - estados e ações para inicializar o CardForm e disparar pagamentos.
 *
 * Efeitos:
 * - Injeta o script do SDK Mercado Pago (https://sdk.mercadopago.com/js/v2) no DOM.
 * - Inicializa o cardForm (iframes seguros) com IDs fornecidos pelo chamador.
 * - Usa supabase.functions.invoke('mercadopago-payment') para processar pagamentos
 *   de cartão/PIX, repassando metadados (plan_id, amount, is_upsell etc.).
 *
 * Depende de:
 * - Edge function mercadopago-payment configurada no Supabase.
 * - Variável de ambiente VITE_MP_PUBLIC_KEY válida no frontend.
 * - Autenticação do usuário (supabase.auth.getSession) para obter access_token.
 */
export function useMercadoPago() {
  const [mp, setMp] = useState<any>(null);
  const [cardForm, setCardForm] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const paymentResolverRef = useRef<{
    resolve: (data: any) => void;
    reject: (err: any) => void;
    params: {
      plan_id: string;
      amount: number;
      payer_email: string;
      is_upsell?: boolean;
      original_payment_id?: string;
      metadata?: Record<string, unknown>;
      cardType?: "credit" | "debit";
    };
  } | null>(null);
  const cardFormInitializedRef = useRef(false);

  // Inicializar SDK
  useEffect(() => {
    const init = async () => {
      try {
        await loadMercadoPagoSDK();
        // PUBLIC_KEY - trocar pela env var do seu projeto
        const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY || 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        const mpInstance = new (window as any).MercadoPago(publicKey, {
          locale: 'pt-BR',
        });
        setMp(mpInstance);
        setSdkReady(true);
      } catch (err: any) {
        setError(err.message);
      }
    };
    init();
  }, []);

  // Inicializar CardForm (formulário de cartão com iframe seguro)
  const initCardForm = useCallback((formConfig: {
    amount: string;
    cardNumberId: string;
    expirationDateId: string;
    securityCodeId: string;
    cardholderNameId: string;
    installmentsId: string;
    identificationTypeId: string;
    identificationNumberId: string;
    onReady?: () => void;
    onError?: (error: any) => void;
  }) => {
    if (!mp) return null;

    if (cardFormInitializedRef.current) {
      console.log('[MP] CardForm já inicializado, ignorando');
      return cardForm;
    }

    try {
      const form = mp.cardForm({
        amount: formConfig.amount,
        iframe: true,
        form: {
          id: 'form-checkout',
          cardNumber: { id: formConfig.cardNumberId, placeholder: 'Número do cartão' },
          expirationDate: { id: formConfig.expirationDateId, placeholder: 'MM/AA' },
          securityCode: { id: formConfig.securityCodeId, placeholder: 'CVV' },
          cardholderName: { id: formConfig.cardholderNameId, placeholder: 'Nome como no cartão' },
          installments: { id: formConfig.installmentsId },
          identificationType: { id: formConfig.identificationTypeId },
          identificationNumber: { id: formConfig.identificationNumberId, placeholder: 'CPF' },
          issuer: { id: 'mp-issuer' },
        },
        callbacks: {
          onFormMounted: (error: any) => {
            if (error) {
              console.warn('CardForm mount error:', error);
              formConfig.onError?.(error);
            } else {
              console.log('CardForm montado com sucesso');
              formConfig.onReady?.();
            }
          },
          onSubmit: async (event: Event) => {
            event.preventDefault();

            const cardFormData: CardFormData = form.getCardFormData();
            console.log('[MP onSubmit] token:', cardFormData.token);
            console.log('[MP onSubmit] data:', JSON.stringify(cardFormData));

            if (!paymentResolverRef.current) return;

            const { resolve, reject, params } = paymentResolverRef.current;

            try {
              if (!cardFormData.token) {
                toast.error('Preencha corretamente os dados do cartão');
                reject(new Error('Cartão inválido ou incompleto'));
                return;
              }

              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Sessão expirada');

              const finalInstallments =
                paymentResolverRef.current?.params.cardType === 'debit'
                  ? 1
                  : Number(cardFormData.installments) || 1;

              const { data, error: fnError } = await supabase.functions.invoke('mercadopago-payment', {
                body: {
                  payment_method: 'credit_card',
                  amount: params.amount,
                  plan_id: params.plan_id,
                  card_token: cardFormData.token,
                  payment_method_id: (cardFormData as any).paymentMethodId,
                  issuer_id: (cardFormData as any).issuerId,
                  installments: finalInstallments,
                  payer_email: params.payer_email,
                  is_upsell: params.is_upsell || false,
                  original_payment_id: params.original_payment_id || null,
                  metadata: params.metadata || {},
                },
              });

              if (fnError) throw new Error(fnError.message);
              if (!data.success) throw new Error(data.error);

              resolve(data);
            } catch (err: any) {
              reject(err);
            }
          },
          onFetching: (resource: string) => {
            console.log('[MP] Fetching:', resource);
          },
        },
      });

      setCardForm(form);
      cardFormInitializedRef.current = true;
      return form;
    } catch (error: any) {
      console.error('[MercadoPago] Erro ao inicializar cardForm:', error);
      setError(error?.message || 'Erro ao inicializar formulário de cartão');
      formConfig.onError?.(error);
      return null;
    }
  }, [mp, cardForm]);

  // Processar pagamento com CARTÃO
  const processCardPayment = useCallback(async (params: {
    plan_id: string;
    amount: number;
    payer_email: string;
    is_upsell?: boolean;
    original_payment_id?: string;
    metadata?: Record<string, unknown>;
    cardType?: "credit" | "debit";
  }): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await new Promise<PaymentResult>((resolve, reject) => {
        paymentResolverRef.current = { resolve, reject, params };

        const formEl = document.getElementById('form-checkout') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
          // Timeout: se MP não chamar onSubmit em 8s, campos estão inválidos
          setTimeout(() => {
            if (paymentResolverRef.current) {
              paymentResolverRef.current = null;
              toast.error('Verifique os dados do cartão e tente novamente');
              reject(new Error('Tempo esgotado - verifique os dados do cartão'));
            }
          }, 8000);
        } else {
          reject(new Error('Formulário não encontrado'));
        }
      });

      return result;
    } catch (err: any) {
      const msg = err.message || 'Erro desconhecido';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
      paymentResolverRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cardFormInitializedRef.current = false;
      if (cardForm) {
        try {
          cardForm.unmount();
        } catch {
        }
      }
    };
  }, [cardForm]);

  // Processar pagamento com PIX
  const processPixPayment = useCallback(async (params: {
    plan_id: string;
    amount: number;
    payer_email: string;
    is_upsell?: boolean;
    original_payment_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error: fnError } = await supabase.functions.invoke('mercadopago-payment', {
        body: {
          payment_method: 'pix',
          amount: params.amount,
          plan_id: params.plan_id,
          payer_email: params.payer_email,
          is_upsell: params.is_upsell || false,
          original_payment_id: params.original_payment_id || null,
          metadata: params.metadata || {},
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || 'Erro ao gerar PIX');

      return data as PaymentResult;
    } catch (err: any) {
      const msg = err.message || 'Erro desconhecido';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    mp,
    sdkReady,
    loading,
    error,
    initCardForm,
    processCardPayment,
    processPixPayment,
  };
}
