import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { validateCPF, formatCPF, formatPhone } from '@/lib/validators';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string>('');
  const [isCpfValid, setIsCpfValid] = useState(false);
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Constantes para os dropdowns de data
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1940 + 1 }, (_, i) => currentYear - i);

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setCpf(formatted);
    
    // Validar apenas quando tiver 14 caracteres (formato completo: 000.000.000-00)
    if (formatted.length === 14) {
      const isValid = validateCPF(formatted);
      setIsCpfValid(isValid);
      
      if (!isValid) {
        setCpfError('CPF inválido');
      } else {
        setCpfError('');
      }
    } else {
      setIsCpfValid(false);
      setCpfError('');
    }
  };

  const getBirthDate = (): Date | null => {
    if (!birthDay || !birthMonth || !birthYear) return null;
    
    const day = parseInt(birthDay);
    const month = parseInt(birthMonth) - 1; // JavaScript months são 0-indexed
    const year = parseInt(birthYear);
    
    const date = new Date(year, month, day);
    
    // Validar se a data é válida (ex: 31 de fevereiro não existe)
    if (
      date.getDate() !== day ||
      date.getMonth() !== month ||
      date.getFullYear() !== year
    ) {
      setDateError('Data inválida');
      return null;
    }
    
    setDateError('');
    return date;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!fullName || fullName.length < 3) {
      toast.error('Nome deve ter pelo menos 3 caracteres');
      return;
    }

    if (!validateCPF(cpf)) {
      toast.error('CPF inválido');
      return;
    }

    const birthDate = getBirthDate();
    if (!birthDate) {
      toast.error('Selecione uma data de nascimento válida');
      return;
    }

    // Validar idade (mínimo 16 anos)
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    
    if (actualAge < 16) {
      toast.error('Você deve ter pelo menos 16 anos');
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email inválido');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      toast.error('Telefone inválido');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (!termsAccepted) {
      toast.error('Você deve aceitar os termos de uso');
      return;
    }

    setLoading(true);

    // Criar conta
    const { data, error } = await signUp(email, password, {
      full_name: fullName,
      cpf: cpf.replace(/\D/g, ''),
      phone: cleanPhone,
      birth_date: format(birthDate, 'yyyy-MM-dd'),
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      // Salvar dados iniciais no student_profiles
      const { error: profileError } = await supabase
        .from('student_profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          cpf: cpf.replace(/\D/g, ''),
          phone: cleanPhone,
          birth_date: format(birthDate, 'yyyy-MM-dd'),
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          profile_completed: false,
          // Campos obrigatórios com valores temporários
          rg: '',
          street: '',
          number: '',
          neighborhood: '',
          city: '',
          state: '',
          cep: '',
          institution: '',
          course: '',
          period: '',
          enrollment_number: '',
        });

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        toast.error('Erro ao criar perfil. Tente novamente.');
        setLoading(false);
        return;
      }

      toast.success('Conta criada com sucesso!');
      navigate('/complete-profile');
    }
  };

  const handleGoogleSignup = () => {
    toast.info('Autenticação com Google em breve. Por enquanto, use email e senha.');
  };

  return (
    <AuthLayout>
      <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2">
        {/* Título */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Crie sua conta de estudante</h1>
          <p className="text-slate-400">Comece sua jornada com a URE Brasil</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome completo */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white">Nome completo</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="João Silva Santos"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
              required
            />
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <Label htmlFor="cpf" className="text-white">CPF</Label>
            <Input
              id="cpf"
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => handleCpfChange(e.target.value)}
              maxLength={14}
              className={cn(
                "bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20",
                cpfError && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                isCpfValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
              )}
              required
            />
            {cpfError && (
              <p className="text-red-400 text-sm mt-1">{cpfError}</p>
            )}
            {isCpfValid && !cpfError && (
              <p className="text-green-400 text-sm mt-1">✓ CPF válido</p>
            )}
          </div>

          {/* Data de nascimento */}
          <div className="space-y-2">
            <Label className="text-white">Data de nascimento</Label>
            <div className="grid grid-cols-3 gap-2">
              {/* Dia */}
              <Select value={birthDay} onValueChange={setBirthDay}>
                <SelectTrigger className="bg-slate-700/50 text-white border-slate-600 focus:border-cyan-500">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                  {days.map((day) => (
                    <SelectItem 
                      key={day} 
                      value={day.toString().padStart(2, '0')}
                      className="text-white hover:bg-slate-700 focus:bg-slate-700"
                    >
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Mês */}
              <Select value={birthMonth} onValueChange={setBirthMonth}>
                <SelectTrigger className="bg-slate-700/50 text-white border-slate-600 focus:border-cyan-500">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                  {months.map((month) => (
                    <SelectItem 
                      key={month.value} 
                      value={month.value}
                      className="text-white hover:bg-slate-700 focus:bg-slate-700"
                    >
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Ano */}
              <Select value={birthYear} onValueChange={setBirthYear}>
                <SelectTrigger className="bg-slate-700/50 text-white border-slate-600 focus:border-cyan-500">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                  {years.map((year) => (
                    <SelectItem 
                      key={year} 
                      value={year.toString()}
                      className="text-white hover:bg-slate-700 focus:bg-slate-700"
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dateError && (
              <p className="text-red-400 text-sm mt-1">{dateError}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
              required
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-white">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={15}
              className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
              required
            />
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-white">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Termos */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
              className="mt-1 border-slate-600 data-[state=checked]:bg-cyan-500"
            />
            <Label htmlFor="terms" className="text-sm text-slate-300 leading-relaxed cursor-pointer">
              Li e aceito os Termos de Uso e Política de Privacidade, e declaro estar ciente de que sou responsável pela veracidade dos documentos enviados.
            </Label>
          </div>

          {/* Botão Criar conta */}
          <Button
            type="submit"
            disabled={loading || !isCpfValid || cpf.length < 14}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        {/* Separador */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-800/50 text-slate-400">ou</span>
          </div>
        </div>

        {/* Google Signup */}
        <Button
          type="button"
          onClick={handleGoogleSignup}
          variant="outline"
          className="w-full bg-white/90 hover:bg-white text-slate-900 font-medium border-0"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar com Google
        </Button>

        {/* Link para login */}
        <p className="text-center text-sm text-slate-400">
          Já tem conta?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
