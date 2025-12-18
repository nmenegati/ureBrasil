import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { QrCode, CreditCard, Shield, Lock, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_direito: boolean;
  is_physical: boolean;
}

const maskCardNumber = (v: string) => 
  v.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").substr(0, 19);

const maskExpiry = (v: string) => 
  v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1/$2").substr(0, 5);

const maskCvv = (v: string) => 
  v.replace(/\D/g, "").substr(0, 4);

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [cardType, setCardType] = useState<'debit' | 'credit'>('debit');
  const [installments, setInstallments] = useState('1');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  useEffect(() => {
    const fetchPlan = async () => {
      if (!user) return;

      try {
        // Buscar perfil do estudante com plano
        const { data: profile, error: profileError } = await supabase
          .from('student_profiles')
          .select('plan_id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile?.plan_id) {
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

        if (planError || !planData) {
          toast.error('Plano não encontrado');
          navigate('/escolher-plano');
          return;
        }

        setPlan(planData);
      } catch (error) {
        console.error('Erro ao carregar plano:', error);
        toast.error('Erro ao carregar informações');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [user, navigate]);

  const validateCardForm = () => {
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      toast.error('Número do cartão inválido');
      return false;
    }
    if (!cardName || cardName.length < 3) {
      toast.error('Nome no cartão inválido');
      return false;
    }
    if (!cardExpiry || cardExpiry.length < 5) {
      toast.error('Validade inválida');
      return false;
    }
    if (!cardCvv || cardCvv.length < 3) {
      toast.error('CVV inválido');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!plan) return;

    if (paymentMethod === 'card' && !validateCardForm()) {
      return;
    }

    setProcessing(true);

    try {
      const payload: any = {
        plan_id: plan.id,
        payment_method: paymentMethod === 'pix' ? 'pix' : (cardType === 'credit' ? 'credit_card' : 'debit_card'),
      };

      if (paymentMethod === 'card') {
        payload.card_data = {
          number: cardNumber.replace(/\s/g, ''),
          name: cardName,
          expiry: cardExpiry,
          cvv: cardCvv,
          installments: cardType === 'credit' ? parseInt(installments) : 1,
        };
      }

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: payload,
      });

      if (error) throw error;

      if (paymentMethod === 'pix' && data.pix_data) {
        // Navegar para página de PIX com dados
        navigate('/pagamento', { state: { pixData: data.pix_data, paymentId: data.payment_id } });
      } else if (data.status === 'approved') {
        toast.success('Pagamento aprovado!');
        navigate('/dashboard');
      } else {
        toast.error('Pagamento não aprovado');
      }
    } catch (error: any) {
      console.error('Erro no pagamento:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getInstallmentOptions = () => {
    if (!plan) return [];
    const price = plan.price;
    return [
      { value: '1', label: `1x de ${formatPrice(price)} sem juros` },
      { value: '2', label: `2x de ${formatPrice(price / 2)} sem juros` },
      { value: '3', label: `3x de ${formatPrice(price / 3)} sem juros` },
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-md">
        {/* Título */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Finalizar Pagamento</h1>
          <p className="text-muted-foreground text-sm">Complete seu pedido de forma segura</p>
        </div>

        {/* Card Resumo do Plano */}
        <Card className="p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">{plan?.name}</h3>
              <p className="text-muted-foreground text-xs">{plan?.description}</p>
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground text-xs">Total a pagar</span>
                  <span className="text-2xl font-bold">{formatPrice(plan?.price || 0)}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">Pagamento único • Validade de 1 ano</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Selos de Segurança */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-muted-foreground text-xs">Compra Segura</span>
          </div>
          <div className="w-px h-4 bg-border"></div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-green-500" />
            <span className="text-muted-foreground text-xs">Dados Protegidos</span>
          </div>
        </div>

        {/* Card Métodos de Pagamento */}
        <Card className="p-4 mb-6">
          <h3 className="font-semibold mb-4 text-sm">Forma de Pagamento</h3>

          {/* Grid 2 botões */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant={paymentMethod === "pix" ? "default" : "outline"}
              onClick={() => setPaymentMethod("pix")}
              className="h-auto flex flex-col items-center gap-2 p-4"
            >
              <QrCode className="w-8 h-8" />
              <div className="text-center">
                <p className="text-sm font-medium">PIX</p>
                <p className={`text-xs ${paymentMethod === "pix" ? "text-primary-foreground/80" : "text-green-500"}`}>
                  Instantâneo
                </p>
              </div>
            </Button>

            <Button
              variant={paymentMethod === "card" ? "default" : "outline"}
              onClick={() => setPaymentMethod("card")}
              className="h-auto flex flex-col items-center gap-2 p-4"
            >
              <CreditCard className="w-8 h-8" />
              <div className="text-center">
                <p className="text-sm font-medium">Cartão</p>
                <p className={`text-xs ${paymentMethod === "card" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  Débito/Crédito
                </p>
              </div>
            </Button>
          </div>

          {/* Formulário PIX */}
          {paymentMethod === "pix" && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm mb-2">
                Ao clicar em "Gerar PIX", você receberá o QR Code para pagamento
              </p>
              <p className="text-muted-foreground text-xs">
                O pagamento é processado instantaneamente
              </p>
            </div>
          )}

          {/* Formulário Cartão */}
          {paymentMethod === "card" && (
            <div className="space-y-4">
              {/* Radio: Débito/Crédito */}
              <div>
                <Label className="text-sm mb-2 block">Tipo de Cartão</Label>
                <RadioGroup value={cardType} onValueChange={(v) => setCardType(v as 'debit' | 'credit')}>
                  <div className="flex gap-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="debit" id="debit" />
                      <Label htmlFor="debit" className="cursor-pointer">Débito</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="credit" id="credit" />
                      <Label htmlFor="credit" className="cursor-pointer">Crédito</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Select Parcelamento (só em crédito) */}
              {cardType === "credit" && (
                <div>
                  <Label className="text-sm mb-2 block">Parcelamento</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger>
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

              {/* Número do Cartão */}
              <div>
                <Label htmlFor="cardNumber" className="text-sm mb-2 block">
                  Número do Cartão
                </Label>
                <Input
                  id="cardNumber"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                  maxLength={19}
                />
              </div>

              {/* Nome */}
              <div>
                <Label htmlFor="cardName" className="text-sm mb-2 block">
                  Nome impresso no Cartão
                </Label>
                <Input
                  id="cardName"
                  placeholder="NOME COMPLETO"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                />
              </div>

              {/* Validade e CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cardExpiry" className="text-sm mb-2 block">Validade</Label>
                  <Input
                    id="cardExpiry"
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label htmlFor="cardCvv" className="text-sm mb-2 block">CVV</Label>
                  <Input
                    id="cardCvv"
                    placeholder="123"
                    type="password"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(maskCvv(e.target.value))}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Botão Fixo na Base */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={processing}
            className="w-full py-6"
            size="lg"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              paymentMethod === "pix" ? "Gerar QR Code PIX" : "Finalizar Pagamento"
            )}
          </Button>
          <p className="text-center text-muted-foreground text-xs mt-3">
            Ao continuar você concorda com nossos Termos de Uso
          </p>
        </div>
      </div>
    </div>
  );
}
