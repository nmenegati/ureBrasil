import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useViaCep } from '@/hooks/useViaCep';
import { formatCEP } from '@/lib/validators';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const periods = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º'];

export default function CompleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { fetchAddress, loading: cepLoading } = useViaCep();

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-cyan-500 animate-spin mx-auto" />
          <p className="text-slate-400 mt-4">Carregando...</p>
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
      } else {
        toast.error('CEP não encontrado. Preencha manualmente.');
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

    // Atualizar perfil
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

    toast.success('Perfil completado com sucesso!');
    navigate('/dashboard');
  };

  return (
    <AuthLayout>
      <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
        {/* Título */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Complete seu perfil</h1>
          <p className="text-slate-400">Precisamos de mais algumas informações</p>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 w-2/3"></div>
            </div>
            <span className="text-sm text-slate-400">Etapa 2 de 3</span>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção Endereço */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">
              Endereço Residencial
            </h2>

            {/* CEP */}
            <div className="space-y-2">
              <Label htmlFor="cep" className="text-white">CEP</Label>
              <div className="relative">
                <Input
                  id="cep"
                  type="text"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                  required
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-500 animate-spin" />
                )}
              </div>
            </div>

            {/* Rua */}
            <div className="space-y-2">
              <Label htmlFor="street" className="text-white">Rua</Label>
              <Input
                id="street"
                type="text"
                placeholder="Nome da rua"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                required
              />
            </div>

            {/* Número e Complemento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number" className="text-white">Número</Label>
                <Input
                  id="number"
                  type="text"
                  placeholder="123"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement" className="text-white">Complemento</Label>
                <Input
                  id="complement"
                  type="text"
                  placeholder="Apto, bloco..."
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {/* Bairro */}
            <div className="space-y-2">
              <Label htmlFor="neighborhood" className="text-white">Bairro</Label>
              <Input
                id="neighborhood"
                type="text"
                placeholder="Nome do bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                required
              />
            </div>

            {/* Cidade e Estado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-white">Cidade</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="Nome da cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-white">Estado</Label>
                <Select value={state} onValueChange={setState} required>
                  <SelectTrigger className="bg-slate-700/50 text-white border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {brazilianStates.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seção Acadêmica */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">
              Dados Acadêmicos
            </h2>

            {/* Instituição */}
            <div className="space-y-2">
              <Label htmlFor="institution" className="text-white">Instituição de ensino</Label>
              <Input
                id="institution"
                type="text"
                placeholder="Ex: Universidade Federal..."
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                required
              />
            </div>

            {/* Curso */}
            <div className="space-y-2">
              <Label htmlFor="course" className="text-white">Curso</Label>
              <Input
                id="course"
                type="text"
                placeholder="Ex: Direito"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                required
              />
            </div>

            {/* Período e Matrícula */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period" className="text-white">Período/Semestre</Label>
                <Select value={period} onValueChange={setPeriod} required>
                  <SelectTrigger className="bg-slate-700/50 text-white border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20">
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
                <Label htmlFor="enrollmentNumber" className="text-white">Nº de matrícula</Label>
                <Input
                  id="enrollmentNumber"
                  type="text"
                  placeholder="12345678"
                  value={enrollmentNumber}
                  onChange={(e) => setEnrollmentNumber(e.target.value)}
                  className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
                  required
                />
              </div>
            </div>
          </div>

          {/* Botão Continuar */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
          >
            {loading ? 'Salvando...' : 'Continuar'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
