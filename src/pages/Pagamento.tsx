import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  QrCode, 
  CreditCard, 
  FileText, 
  Shield, 
  Lock, 
  Check, 
  Loader2, 
  Zap, 
  Clock,
  Smartphone,
  CreditCard as CardIcon,
  GraduationCap,
  Scale,
  Sparkles,
  Home
} from 'lucide-react';

type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

interface Plan {
  id: string;
  name: string;
  price: number;
  type: string;
  description: string | null;
  is_physical: boolean;
  is_direito: boolean;
}

// Formatação do número do cartão: 1234 5678 9012 3456
const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
};

// Formatação da validade: MM/AA
const formatExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }
  return cleaned;
};

// Formatação do CVV: 3-4 dígitos
const formatCVV = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

// Benefícios por tipo de plano
const getPlanBenefits = (plan: Plan): string[] => {
  const benefits: string[] = [];
  
  if (plan.is_physical) {
    benefits.push('Carteirinha física impressa');
    benefits.push('Envio pelos Correios');
  } else {
    benefits.push('Carteirinha 100% digital');
    benefits.push('Acesso imediato após aprovação');
  }
  
  if (plan.is_direito) {
    benefits.push('Acesso à OAB e Tribunais');
    benefits.push('Desconto em livrarias jurídicas');
  }
  
  benefits.push('Validade nacional');
  benefits.push('Descontos em milhares de estabelecimentos');
  
  return benefits;
};

export default function Pagamento() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados do cartão de crédito
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  
  // Estado para PIX gerado
  const [pixData, setPixData] = useState<{
    qr_code: string;
    qr_code_base64: string;
    expires_at: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      loadPlan();
    }
  }, [user, authLoading]);

  const loadPlan = async () => {
    try {
      // Buscar o plano selecionado do perfil do estudante
      const { data: profile, error: profileError } = await supabase
        .from('student_profiles')
        .select('plan_id')
        .eq('user_id', user!.id)
        .single();

      if (profileError) throw profileError;

      if (!profile?.plan_id) {
        toast.error('Nenhum plano selecionado');
        navigate('/escolher-plano');
        return;
      }

      // Buscar detalhes do plano
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', profile.plan_id)
        .single();

      if (planError) throw planError;

      setPlan(planData);
    } catch (error) {
      console.error('Erro ao carregar plano:', error);
      toast.error('Erro ao carregar informações do plano');
    } finally {
      setLoading(false);
    }
  };

  const isCardValid = (): boolean => {
    if (paymentMethod !== 'credit_card') return true;
    
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    const cleanedExpiry = cardExpiry.replace('/', '');
    
    return (
      cleanedNumber.length === 16 &&
      cardName.trim().length > 0 &&
      cleanedExpiry.length === 4 &&
      cardCVV.length >= 3
    );
  };

  const handlePayment = async () => {
    if (paymentMethod === 'credit_card' && !isCardValid()) {
      toast.error('Preencha todos os campos do cartão corretamente');
      return;
    }

    setProcessing(true);
    setPixData(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        navigate('/login');
        return;
      }

      // Mapear boleto para debit_card (conforme enum do banco)
      const methodToSend = paymentMethod === 'boleto' ? 'debit_card' : paymentMethod;

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          plan_id: plan?.id,
          payment_method: methodToSend,
          card_data: paymentMethod === 'credit_card' ? {
            number: cardNumber.replace(/\s/g, ''),
            holder: cardName,
            exp_month: cardExpiry.split('/')[0],
            exp_year: cardExpiry.split('/')[1],
            cvv: cardCVV
          } : null
        }
      });

      if (error) throw error;

      // Sucesso conforme método
      if (paymentMethod === 'pix') {
        setPixData({
          qr_code: data.pix_qr_code,
          qr_code_base64: data.pix_qr_code_base64,
          expires_at: data.pix_expires_at
        });
        toast.success('QR Code PIX gerado! (MOCK)');
      } else if (paymentMethod === 'credit_card') {
        toast.success('Pagamento aprovado! (MOCK)');
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else if (paymentMethod === 'boleto') {
        if (data.boleto_url) {
          window.open(data.boleto_url, '_blank');
        }
        toast.success('Boleto gerado! (MOCK)');
      }
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  const getButtonText = (): string => {
    if (processing) return 'Processando...';
    
    switch (paymentMethod) {
      case 'pix':
        return 'Gerar QR Code PIX';
      case 'credit_card':
        return `Pagar R$ ${plan?.price.toFixed(2).replace('.', ',')}`;
      case 'boleto':
        return 'Gerar Boleto';
    }
  };

  const getButtonIcon = () => {
    if (processing) return <Loader2 className="w-5 h-5 animate-spin" />;
    
    switch (paymentMethod) {
      case 'pix':
        return <QrCode className="w-5 h-5" />;
      case 'credit_card':
        return <CreditCard className="w-5 h-5" />;
      case 'boleto':
        return <FileText className="w-5 h-5" />;
    }
  };

  const getPlanIcon = () => {
    if (!plan) return <Sparkles className="w-8 h-8" />;
    
    if (plan.is_direito) {
      return <Scale className="w-8 h-8" />;
    }
    return plan.is_physical ? <CardIcon className="w-8 h-8" /> : <Smartphone className="w-8 h-8" />;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859]">
        <Header variant="app" />
        <main className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <p className="text-white/80">Carregando...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859]">
        <Header variant="app" />
        <main className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <Card className="max-w-md p-8 text-center">
            <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Nenhum plano selecionado</h2>
            <p className="text-muted-foreground mb-6">
              Você precisa escolher um plano antes de realizar o pagamento.
            </p>
            <Button onClick={() => navigate('/escolher-plano')} className="w-full">
              Escolher Plano
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      
      <Header variant="app" />
      
      <main className="relative z-10 p-4 pb-8 max-w-5xl mx-auto">
        {/* Título */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Finalizar Pagamento</h1>
          <p className="text-white/80">Complete seu pedido de forma segura</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda: Resumo do Plano */}
          <Card className="p-6 h-fit">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                {getPlanIcon()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    Selecionado
                  </span>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
              </div>
            </div>

            {/* Preço */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Total a pagar</p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="text-4xl font-bold text-primary">
                  {plan.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pagamento único • Validade de 1 ano</p>
            </div>

            {/* Benefícios */}
            <div>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                Incluído no plano
              </h3>
              <ul className="space-y-2">
                {getPlanBenefits(plan).map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Botão trocar plano */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-6 text-muted-foreground"
              onClick={() => navigate('/escolher-plano')}
            >
              Trocar plano
            </Button>
          </Card>

          {/* Coluna Direita: Pagamento */}
          <div className="space-y-4">
            {/* Seletor de Forma de Pagamento */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Forma de Pagamento</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* PIX */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                    ${paymentMethod === 'pix' 
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30' 
                      : 'border-border hover:border-green-300 bg-background'
                    }
                  `}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <QrCode className={`w-8 h-8 ${paymentMethod === 'pix' ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <span className={`font-medium text-sm ${paymentMethod === 'pix' ? 'text-green-700 dark:text-green-400' : ''}`}>
                      PIX
                    </span>
                  </div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-500 text-white rounded-full whitespace-nowrap">
                      <Zap className="w-3 h-3" />
                      Instantâneo
                    </span>
                  </div>
                </button>

                {/* Cartão de Crédito */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-200 text-left
                    ${paymentMethod === 'credit_card' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 bg-background'
                    }
                  `}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <CreditCard className={`w-8 h-8 ${paymentMethod === 'credit_card' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium text-sm ${paymentMethod === 'credit_card' ? 'text-primary' : ''}`}>
                      Cartão
                    </span>
                  </div>
                </button>

                {/* Boleto */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('boleto')}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                    ${paymentMethod === 'boleto' 
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' 
                      : 'border-border hover:border-yellow-300 bg-background'
                    }
                  `}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <FileText className={`w-8 h-8 ${paymentMethod === 'boleto' ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                    <span className={`font-medium text-sm ${paymentMethod === 'boleto' ? 'text-yellow-700 dark:text-yellow-400' : ''}`}>
                      Boleto
                    </span>
                  </div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-yellow-500 text-white rounded-full whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      2 dias úteis
                    </span>
                  </div>
                </button>
              </div>
            </Card>

            {/* Área do Formulário Dinâmico */}
            <Card className="p-6">
              {paymentMethod === 'pix' && !pixData && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <QrCode className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Pagamento via PIX</h3>
                  <p className="text-muted-foreground mb-1">
                    Clique no botão abaixo para gerar seu QR Code PIX
                  </p>
                  <p className="text-sm text-green-600 font-medium">
                    ⚡ O pagamento é processado instantaneamente
                  </p>
                </div>
              )}

              {paymentMethod === 'pix' && pixData && (
                <div className="text-center py-4">
                  <div className="mb-4">
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                      ⚠️ MOCK - Pagamento simulado para testes
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-4">Escaneie o QR Code PIX</h3>
                  
                  <div className="w-48 h-48 mx-auto mb-4 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">QR Code Mock</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    Ou copie o código PIX:
                  </p>
                  
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono break-all max-h-20 overflow-y-auto mb-4">
                    {pixData.qr_code}
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pixData.qr_code);
                      toast.success('Código PIX copiado!');
                    }}
                    className="mb-4"
                  >
                    Copiar Código PIX
                  </Button>
                  
                  <p className="text-xs text-muted-foreground">
                    Expira em: {new Date(pixData.expires_at).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              )}

              {paymentMethod === 'credit_card' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Dados do Cartão</h3>
                  
                  {/* Número do Cartão */}
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      className="font-mono text-lg"
                    />
                  </div>

                  {/* Nome no Cartão */}
                  <div className="space-y-2">
                    <Label htmlFor="cardName">Nome no Cartão</Label>
                    <Input
                      id="cardName"
                      type="text"
                      placeholder="NOME COMO ESTÁ NO CARTÃO"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>

                  {/* Validade e CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">Validade</Label>
                      <Input
                        id="cardExpiry"
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCVV">CVV</Label>
                      <Input
                        id="cardCVV"
                        type="text"
                        placeholder="000"
                        value={cardCVV}
                        onChange={(e) => setCardCVV(formatCVV(e.target.value))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'boleto' && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-yellow-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Pagamento via Boleto</h3>
                  <p className="text-muted-foreground mb-1">
                    Clique no botão abaixo para gerar seu boleto
                  </p>
                  <p className="text-sm text-yellow-600 font-medium">
                    ⏰ A aprovação pode levar até 2 dias úteis após o pagamento
                  </p>
                </div>
              )}

              {/* Botão de Ação */}
              <Button
                onClick={handlePayment}
                disabled={processing || (paymentMethod === 'credit_card' && !isCardValid())}
                className={`
                  w-full mt-6 h-12 text-base font-semibold transition-all
                  ${paymentMethod === 'pix' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : paymentMethod === 'boleto'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-primary hover:bg-primary/90'
                  }
                `}
              >
                {getButtonIcon()}
                <span className="ml-2">{getButtonText()}</span>
              </Button>
            </Card>

            {/* Footer de Segurança */}
            <div className="text-center space-y-3 pt-4">
              <div className="flex items-center justify-center gap-2 text-white">
                <Shield className="w-5 h-5" />
                <span className="font-medium">Pagamento 100% seguro</span>
              </div>
              <div className="flex justify-center items-center gap-4">
                <Lock className="w-5 h-5 text-white/60" />
                <div className="h-4 w-px bg-white/30" />
                <span className="text-xs text-white/60">Dados criptografados</span>
                <div className="h-4 w-px bg-white/30" />
                <span className="text-xs text-white/60">Ambiente protegido</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botão Voltar */}
        <div className="text-center mt-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <Home className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}
