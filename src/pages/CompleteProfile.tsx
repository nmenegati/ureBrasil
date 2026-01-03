import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useViaCep } from '@/hooks/useViaCep';
import { formatCEP } from '@/lib/validators';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sun, Moon, Info, AlertTriangle } from 'lucide-react';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

const periods = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º'];

export default function CompleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { fetchAddress, loading: cepLoading, error: cepError } = useViaCep();

  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [period, setPeriod] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setCep(formatted);

    const cleanCep = value.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      const address = await fetchAddress(cleanCep);
      if (address) {
        setStreet(address.street);
        setNeighborhood(address.neighborhood);
        setCity(address.city);
        setState(address.state);
        toast.success('Endereço encontrado!');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Validações
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP inválido');
      return;
    }

    if (!street || !number || !neighborhood || !city || !state) {
      toast.error('Preencha todos os campos de endereço');
      return;
    }

    if (!institution || !course || !period || !enrollmentNumber) {
      toast.error('Preencha todos os campos acadêmicos');
      return;
    }

    setLoading(true);

    // ID do plano Geral Digital para não-Direito
    const PLAN_GERAL_DIGITAL_ID = 'a20e423f-c222-47b0-814f-e532f1bbe0c4';

    // APENAS UPDATE - perfil SEMPRE existe graças à trigger do banco
    const { error } = await supabase
      .from('student_profiles')
      .update({
        cep: cleanCep,
        street,
        number,
        complement: complement || null,
        neighborhood,
        city,
        state,
        institution,
        course,
        period,
        enrollment_number: enrollmentNumber,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao salvar perfil. Tente novamente.');
      setLoading(false);
      return;
    }

    // Buscar perfil atualizado para verificar is_law_student (trigger já atualizou)
    const { data: updatedProfile } = await supabase
      .from('student_profiles')
      .select('is_law_student')
      .eq('user_id', user.id)
      .single();

    toast.success('Perfil completado com sucesso!');
    setLoading(false);

    // Redirecionar baseado em is_law_student
    if (updatedProfile?.is_law_student) {
      // Estudante de Direito → pode escolher plano
      window.location.href = '/escolher-plano';
    } else {
      // Não é Direito → plano Geral Digital automaticamente
      localStorage.setItem('selected_plan_id', PLAN_GERAL_DIGITAL_ID);
      
      // Atualizar plan_id no banco
      await supabase
        .from('student_profiles')
        .update({ plan_id: PLAN_GERAL_DIGITAL_ID })
        .eq('user_id', user.id);
      
      window.location.href = '/pagamento';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <img src={ureBrasilLogo} alt="URE Brasil" className="h-8 sm:h-9 w-auto object-contain" />
          </Link>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-foreground" />
              ) : (
                <Moon className="h-5 w-5 text-foreground" />
              )}
            </button>
            
            <span className="text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Entrar
              </Link>
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div className="bg-card rounded-2xl shadow-xl border border-border p-6 md:p-8">
            <div className="space-y-6">
              {/* Título */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Complete seu perfil</h1>
                <p className="text-muted-foreground">Precisamos de mais algumas informações</p>
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-2/3"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">Etapa 2 de 3</span>
                </div>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Seção Endereço */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                    Endereço Residencial
                  </h2>

                  {/* CEP com mensagem informativa ao lado */}
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                    <div className="w-full sm:w-36">
                      <Label htmlFor="cep" className="text-foreground">CEP</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          type="text"
                          placeholder="00000-000"
                          value={cep}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                          required
                        />
                        {cepLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pb-0 sm:pb-2">
                      <Info className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Insira seu CEP para preencher o endereço automaticamente.
                      </span>
                    </div>
                  </div>

                  {/* Exibir erro do CEP se houver */}
                  {cepError && (
                    <Alert className="border-amber-500/50 bg-amber-500/10 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                        {cepError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Rua (3 cols) + Número (1 col) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-3 space-y-2">
                      <Label htmlFor="street" className="text-foreground">Rua</Label>
                      <Input
                        id="street"
                        type="text"
                        placeholder="Nome da rua"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        maxLength={150}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                      <span className="text-xs text-muted-foreground block text-right">{street.length}/150</span>
                    </div>
                    <div className="sm:col-span-1 space-y-2">
                      <Label htmlFor="number" className="text-foreground">Número</Label>
                      <Input
                        id="number"
                        type="text"
                        placeholder="123"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        maxLength={10}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                      <span className="text-xs text-muted-foreground block text-right">{number.length}/10</span>
                    </div>
                  </div>

                  {/* Bairro + Complemento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood" className="text-foreground">Bairro</Label>
                      <Input
                        id="neighborhood"
                        type="text"
                        placeholder="Nome do bairro"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        maxLength={100}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                      <span className="text-xs text-muted-foreground block text-right">{neighborhood.length}/100</span>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complement" className="text-foreground">Complemento</Label>
                      <Input
                        id="complement"
                        type="text"
                        placeholder="Apto, bloco... (opcional)"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        maxLength={100}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      />
                      <span className="text-xs text-muted-foreground block text-right">{complement.length}/100</span>
                    </div>
                  </div>

                  {/* Cidade e Estado - somente leitura (determinados pelo CEP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-foreground">Cidade</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Preenchido pelo CEP"
                        value={city}
                        disabled
                        className="bg-muted text-muted-foreground border-input h-11 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-foreground">Estado</Label>
                      <Input
                        id="state"
                        type="text"
                        placeholder="UF"
                        value={state}
                        disabled
                        className="bg-muted text-muted-foreground border-input h-11 text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Acadêmica */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                    Dados Acadêmicos
                  </h2>

                  {/* Instituição */}
                  <div className="space-y-2">
                    <Label htmlFor="institution" className="text-foreground">Instituição de ensino</Label>
                    <Input
                      id="institution"
                      type="text"
                      placeholder="Ex: Universidade Federal..."
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      maxLength={150}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      required
                    />
                    <span className="text-xs text-muted-foreground block text-right">{institution.length}/150</span>
                  </div>

                  {/* Curso */}
                  <div className="space-y-2">
                    <Label htmlFor="course" className="text-foreground">Curso</Label>
                    <Input
                      id="course"
                      type="text"
                      placeholder="Ex: Direito"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      maxLength={150}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      required
                    />
                    <span className="text-xs text-muted-foreground block text-right">{course.length}/150</span>
                  </div>

                  {/* Período e Matrícula */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="period" className="text-foreground">Período/Semestre</Label>
                      <Select value={period} onValueChange={setPeriod} required>
                        <SelectTrigger className="bg-background text-foreground border-input focus:border-primary focus:ring-primary/20 h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {periods.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="enrollmentNumber" className="text-foreground">Nº de matrícula</Label>
                      <Input
                        id="enrollmentNumber"
                        type="text"
                        placeholder="12345678"
                        value={enrollmentNumber}
                        onChange={(e) => setEnrollmentNumber(e.target.value)}
                        maxLength={20}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                      <span className="text-xs text-muted-foreground block text-right">{enrollmentNumber.length}/20</span>
                    </div>
                  </div>
                </div>

                {/* Botão Continuar */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-base font-semibold"
                >
                  {loading ? 'Salvando...' : 'Continuar'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
