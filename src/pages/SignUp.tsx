import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { validateCPF, formatCPF, formatPhone } from '@/lib/validators';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

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
    const month = parseInt(birthMonth) - 1;
    const year = parseInt(birthYear);
    
    const date = new Date(year, month, day);
    
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

    if (password.length > 20) {
      toast.error('Senha deve ter no máximo 20 caracteres');
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

    try {
      const metadata = {
        full_name: fullName.trim(),
        cpf: cpf.replace(/\D/g, ''),
        birth_date: format(birthDate, 'yyyy-MM-dd'),
        phone: cleanPhone,
        terms_accepted: true
      };

      const { data, error } = await signUp(email, password, metadata);

      if (error) {
        if (error.message.includes('already registered') || 
            error.message.includes('User already registered')) {
          toast.error('Este email já está cadastrado');
        } else {
          toast.error('Erro ao criar conta: ' + error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = '/verificar-email';
      } else {
        toast.error('Erro inesperado ao criar conta');
        setLoading(false);
      }

    } catch (err: any) {
      toast.error('Erro ao criar conta: ' + err.message);
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    toast.info('Autenticação com Google em breve. Por enquanto, use email e senha.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header com logo */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/">
            <img src={ureBrasilLogo} alt="URE Brasil" className="h-10" />
          </Link>
          <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
            Já tem conta? <span className="font-semibold text-cyan-600">Entrar</span>
          </Link>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Título centralizado */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Crie sua conta de estudante
            </h1>
            <p className="text-gray-600">
              Comece sua jornada com a URE Brasil
            </p>
          </div>

          {/* Formulário em card grande */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Nome completo */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-gray-700 font-medium">Nome completo *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="João Silva Santos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  className="bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500/20 text-base h-11"
                  required
                />
                <span className="text-xs text-gray-400 block text-right">{fullName.length}/100</span>
              </div>

              {/* CPF + Data de nascimento (2 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPF */}
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-gray-700 font-medium">CPF *</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    maxLength={14}
                    className={cn(
                      "bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500/20 text-base h-11",
                      cpfError && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                      isCpfValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
                    )}
                    required
                  />
                  {cpfError && (
                    <p className="text-red-500 text-sm">{cpfError}</p>
                  )}
                  {isCpfValid && !cpfError && (
                    <p className="text-green-600 text-sm">✓ CPF válido</p>
                  )}
                </div>

                {/* Data de nascimento */}
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Data de nascimento *</Label>
                  <div className="flex gap-2">
                    {/* Dia */}
                    <Select value={birthDay} onValueChange={setBirthDay}>
                      <SelectTrigger className="flex-1 bg-white text-gray-900 border-gray-300 focus:border-cyan-500 h-11">
                        <SelectValue placeholder="Dia" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 max-h-60">
                        {days.map((day) => (
                          <SelectItem 
                            key={day} 
                            value={day.toString().padStart(2, '0')}
                            className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100"
                          >
                            {day.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Mês */}
                    <Select value={birthMonth} onValueChange={setBirthMonth}>
                      <SelectTrigger className="flex-1 bg-white text-gray-900 border-gray-300 focus:border-cyan-500 h-11">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 max-h-60">
                        {months.map((month) => (
                          <SelectItem 
                            key={month.value} 
                            value={month.value}
                            className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100"
                          >
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Ano */}
                    <Select value={birthYear} onValueChange={setBirthYear}>
                      <SelectTrigger className="flex-1 bg-white text-gray-900 border-gray-300 focus:border-cyan-500 h-11">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 max-h-60">
                        {years.map((year) => (
                          <SelectItem 
                            key={year} 
                            value={year.toString()}
                            className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100"
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {dateError && (
                    <p className="text-red-500 text-sm">{dateError}</p>
                  )}
                </div>
              </div>

              {/* Email + Telefone (2 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={100}
                    className="bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500/20 text-base h-11"
                    required
                  />
                  <span className="text-xs text-gray-400 block text-right">{email.length}/100</span>
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-700 font-medium">Telefone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    maxLength={15}
                    className="bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500/20 text-base h-11"
                    required
                  />
                  <span className="text-xs text-gray-400 block text-right">{phone.length}/15</span>
                </div>
              </div>

              {/* Senha + Confirmar (2 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      maxLength={20}
                      className="bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500/20 text-base h-11 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Mínimo 6 caracteres</span>
                    <span>{password.length}/20</span>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>

                {/* Confirmar senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">Confirmar senha *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      maxLength={20}
                      className="bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500/20 text-base h-11 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Deve coincidir</span>
                    <span>{confirmPassword.length}/20</span>
                  </div>
                </div>
              </div>

              {/* Termos */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1 border-gray-300 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                />
                <Label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                  Li e aceito os{' '}
                  <a href="/termos" className="text-cyan-600 hover:underline" target="_blank">
                    Termos de Uso
                  </a>
                  {' '}e{' '}
                  <a href="/privacidade" className="text-cyan-600 hover:underline" target="_blank">
                    Política de Privacidade
                  </a>
                  , e declaro estar ciente de que sou o único responsável pela veracidade das informações fornecidas.
                </Label>
              </div>

              {/* Botão Criar conta */}
              <Button
                type="submit"
                disabled={loading || !isCpfValid || cpf.length < 14}
                className="w-full h-12 text-base bg-cyan-500 hover:bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>

              {/* Separador */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400">ou</span>
                </div>
              </div>

              {/* Google Signup */}
              <Button
                type="button"
                onClick={handleGoogleSignup}
                variant="outline"
                className="w-full h-12 text-base bg-white hover:bg-gray-50 text-gray-700 font-medium border-gray-300"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar com Google
              </Button>

              {/* Link para login */}
              <p className="text-center text-sm text-gray-600">
                Já tem uma conta?{' '}
                <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 hover:underline">
                  Fazer login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
