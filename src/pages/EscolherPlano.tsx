import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Check, FileText, Scale, CreditCard, Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Configuração visual dos planos (ordem e benefícios)
const planConfig: Record<string, { 
  icon: typeof FileText; 
  benefits: string[]; 
  popular?: boolean;
  order: number;
}> = {
  'geral_digital': {
    icon: FileText,
    order: 1,
    benefits: [
      'Carteirinha digital PDF',
      'QR Code de validação',
      'Validade 1 ano',
      'Entrega instantânea por email'
    ]
  },
  'direito_digital': {
    icon: Scale,
    order: 2,
    benefits: [
      'Carteirinha digital PDF',
      'QR Code + Selo OAB Estudante',
      'Validade 1 ano',
      'Reconhecimento profissional',
      'Descontos advocacia'
    ]
  },
  'geral_fisica': {
    icon: CreditCard,
    order: 3,
    popular: true,
    benefits: [
      'Tudo do plano digital',
      'Carteirinha física impressa (PVC)',
      'Frete grátis para todo Brasil',
      'Entrega em 7-15 dias úteis',
      'Digital liberada imediatamente'
    ]
  },
  'direito_fisica': {
    icon: Award,
    order: 4,
    benefits: [
      'Tudo do plano digital OAB',
      'Carteirinha física impressa (PVC)',
      'Selo OAB impresso',
      'Frete grátis para todo Brasil',
      'Entrega em 7-15 dias úteis',
      'Digital liberada imediatamente'
    ]
  }
};

interface Plan {
  id: string;
  name: string;
  price: number;
  type: string;
  is_active: boolean;
}

export default function EscolherPlano() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Carregar perfil e planos
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      // Buscar perfil
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profile) setProfileId(profile.id);

      // Buscar planos ativos
      const { data: plansData } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansData) {
        // Ordenar conforme config
        const sortedPlans = plansData.sort((a, b) => {
          const orderA = planConfig[a.type]?.order || 99;
          const orderB = planConfig[b.type]?.order || 99;
          return orderA - orderB;
        });
        setPlans(sortedPlans);
      }

      setLoading(false);
    };

    loadData();
  }, [user]);

  const handleSelectPlan = async (planId: string, planName: string) => {
    if (!profileId) {
      toast.error('Perfil não encontrado');
      return;
    }

    setSelecting(planId);

    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({ plan_id: planId })
        .eq('id', profileId);

      if (error) throw error;

      toast.success(`Plano "${planName}" selecionado!`);
      navigate('/pagamento');
    } catch (error: unknown) {
      toast.error('Erro ao selecionar plano');
      console.error(error);
    } finally {
      setSelecting(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      
      <main className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Escolha seu Plano
            </h1>
            <p className="text-lg text-muted-foreground">
              Todas as opções incluem validade de 1 ano
            </p>
          </div>

        {/* Grid de Planos */}
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map(plan => {
            const config = planConfig[plan.type] || { icon: FileText, benefits: [], order: 99 };
            const Icon = config.icon;
            const isPopular = config.popular;

            return (
              <Card 
                key={plan.id}
                className={`relative p-6 bg-card/80 border-border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all ${
                  isPopular ? 'border-2 border-primary shadow-lg shadow-primary/20' : ''
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                      ⭐ MAIS POPULAR
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className={`p-2 rounded-lg ${isPopular ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Icon className={`w-6 h-6 ${isPopular ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    {plan.name}
                  </h3>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">
                    R$ {Number(plan.price).toFixed(0)}
                  </span>
                  <span className="text-muted-foreground ml-2">/ ano</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {config.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan.id, plan.name)}
                  disabled={selecting !== null}
                  className={`w-full ${
                    isPopular 
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  {selecting === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Escolher Plano
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-sm text-muted-foreground">
          <p>🔒 Pagamento 100% seguro</p>
          <p className="mt-2">Dúvidas? contato@urebrasil.com.br</p>
        </div>
        </div>
      </main>
    </div>
  );
}