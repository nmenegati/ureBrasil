import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { validateCPF, formatCPF, formatPhone } from '@/lib/validators';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';
import { supabase } from '@/integrations/supabase/client';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string>('');
  const [isCpfValid, setIsCpfValid] = useState(false);
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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

  // Verificar se CPF já existe no banco (usando RPC que ignora RLS)
  const checkCpfExists = async (cpfValue: string): Promise<boolean> => {
    const cleanCpf = cpfValue.replace(/\D/g, '');
    const { data, error } = await supabase.rpc('check_cpf_exists', { p_cpf: cleanCpf });
    if (error) {
      console.error('Erro ao verificar CPF:', error);
      return false;
    }
    return data === true;
  };

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setCpf(formatted);
    setEmailError(''); // Limpa erro de email ao mudar CPF
    setCpfError(''); // Limpa erro ao digitar
    
    // Validação local de formato (dígitos verificadores)
    if (formatted.length === 14) {
      const isValid = validateCPF(formatted);
      if (!isValid) {
        setIsCpfValid(false);
        setCpfError('CPF inválido');
      }
    } else {
      setIsCpfValid(false);
    }
  };

  // Debounce para verificar CPF duplicado no banco
  useEffect(() => {
    // Só verifica quando CPF está completo e válido localmente
    if (cpf.length !== 14 || !validateCPF(cpf)) {
      return;
    }
    
    setCheckingCpf(true);
    
    const timer = setTimeout(async () => {
      try {
        const exists = await checkCpfExists(cpf);
        if (exists) {
          setIsCpfValid(false);
          setCpfError('CPF já cadastrado');
        } else {
          setIsCpfValid(true);
          setCpfError('');
        }
      } catch (err) {
        console.error('Erro ao verificar CPF:', err);
        // Em caso de erro na verificação, permitir continuar
        setIsCpfValid(true);
        setCpfError('');
      } finally {
        setCheckingCpf(false);
      }
    }, 500); // 500ms de debounce
    
    return () => clearTimeout(timer);
  }, [cpf]);

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

  // Validação de email em tempo real (formato apenas)
  // Nota: Supabase não permite verificar se email existe sem efeitos colaterais (enviar OTP)
  // A verificação de duplicado é feita no submit via erro do signUp
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError('');
    
    // Validar formato do email
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Formato de email inválido');
    }
  };

  // Verificar se telefone já existe no banco (usando RPC que ignora RLS)
  const checkPhoneExists = async (phoneValue: string): Promise<boolean> => {
    const cleanPhone = phoneValue.replace(/\D/g, '');
    if (cleanPhone.length !== 11) return false;
    
    const { data, error } = await supabase.rpc('check_phone_exists', { p_phone: cleanPhone });
    if (error) {
      console.error('Erro ao verificar telefone:', error);
      return false;
    }
    return data === true;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setPhone(formatted);
    setPhoneError(''); // Limpa erro ao digitar
  };

  // Debounce para verificar telefone duplicado
  useEffect(() => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Só verifica quando telefone está completo (11 dígitos)
    if (cleanPhone.length !== 11) {
      setPhoneError('');
      setCheckingPhone(false);
      return;
    }
    
    setCheckingPhone(true);
    
    const timer = setTimeout(async () => {
      try {
        const exists = await checkPhoneExists(phone);
        if (exists) {
          setPhoneError('Telefone já cadastrado');
        } else {
          setPhoneError('');
        }
      } catch (err) {
        console.error('Erro ao verificar telefone:', err);
      } finally {
        setCheckingPhone(false);
      }
    }, 500); // 500ms de debounce
    
    return () => clearTimeout(timer);
  }, [phone]);

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
    setEmailError('');

    try {
      // Se usuário já está logado, fazer logout antes de signup
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        await supabase.auth.signOut();
      }

      // Verificação final de CPF duplicado antes de criar conta
      const cpfExists = await checkCpfExists(cpf);
      if (cpfExists) {
        setCpfError('CPF já cadastrado');
        setIsCpfValid(false);
        toast.error('Este CPF já está cadastrado no sistema');
        setLoading(false);
        return;
      }

      // Verificação final de telefone duplicado antes de criar conta
      const phoneExists = await checkPhoneExists(phone);
      if (phoneExists) {
        setPhoneError('Telefone já cadastrado');
        toast.error('Este telefone já está cadastrado no sistema');
        setLoading(false);
        return;
      }

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
          setEmailError('Este email já está cadastrado');
          toast.error('Este email já está cadastrado. Deseja fazer login?');
        } else {
          toast.error('Erro ao criar conta: ' + error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // Detectar email duplicado via identities vazio (Supabase retorna user mas sem identities)
        if (!data.user.identities || data.user.identities.length === 0) {
          setEmailError('Este email já está cadastrado');
          toast.error('Este email já está cadastrado!', {
            description: 'Tente fazer login ou recuperar sua senha.'
          });
          setLoading(false);
          return;
        }

        // Signup criou novo usuário com sucesso
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
    <div className="min-h-screen bg-background">
      {/* Header com logo */}
      <div className="bg-card shadow-sm sticky top-0 z-10 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/">
            <img src={ureBrasilLogo} alt="URE Brasil" className="h-10" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleDarkMode}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Já tem conta? <span className="font-semibold text-primary">Entrar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Título centralizado */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Crie sua conta de estudante
            </h1>
            <p className="text-muted-foreground">
              Comece sua jornada com a URE Brasil
            </p>
          </div>

          {/* Formulário em card grande */}
          <div className="bg-card rounded-2xl shadow-xl p-6 md:p-8 border border-border">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Nome completo */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground font-medium">Nome completo *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="João Silva Santos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11"
                  required
                />
                <span className="text-xs text-muted-foreground block text-right">{fullName.length}/100</span>
              </div>

              {/* CPF + Data de nascimento (2 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPF */}
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-foreground font-medium">CPF *</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    maxLength={14}
                    className={cn(
                      "bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11",
                      cpfError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                      isCpfValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
                    )}
                    required
                  />
                  {checkingCpf && (
                    <p className="text-muted-foreground text-sm">Verificando CPF...</p>
                  )}
                  {cpfError && !checkingCpf && (
                    <p className="text-destructive text-sm">
                      {cpfError}
                      {cpfError.includes('já cadastrado') && (
                        <Link to="/login" className="ml-2 text-primary underline hover:text-primary/80">
                          Fazer login
                        </Link>
                      )}
                    </p>
                  )}
                  {isCpfValid && !cpfError && !checkingCpf && (
                    <p className="text-green-600 text-sm">✓ CPF válido</p>
                  )}
                </div>

                {/* Data de nascimento */}
                <div className="space-y-2">
                  <Label className="text-foreground font-medium">Data de nascimento *</Label>
                  <div className="flex gap-2">
                    {/* Dia */}
                    <Select value={birthDay} onValueChange={setBirthDay}>
                      <SelectTrigger className="flex-1 bg-background text-foreground border-input focus:border-primary h-11">
                        <SelectValue placeholder="Dia" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-60">
                        {days.map((day) => (
                          <SelectItem 
                            key={day} 
                            value={day.toString().padStart(2, '0')}
                            className="text-popover-foreground hover:bg-accent focus:bg-accent"
                          >
                            {day.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Mês */}
                    <Select value={birthMonth} onValueChange={setBirthMonth}>
                      <SelectTrigger className="flex-1 bg-background text-foreground border-input focus:border-primary h-11">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-60">
                        {months.map((month) => (
                          <SelectItem 
                            key={month.value} 
                            value={month.value}
                            className="text-popover-foreground hover:bg-accent focus:bg-accent"
                          >
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Ano */}
                    <Select value={birthYear} onValueChange={setBirthYear}>
                      <SelectTrigger className="flex-1 bg-background text-foreground border-input focus:border-primary h-11">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-60">
                        {years.map((year) => (
                          <SelectItem 
                            key={year} 
                            value={year.toString()}
                            className="text-popover-foreground hover:bg-accent focus:bg-accent"
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {dateError && (
                    <p className="text-destructive text-sm">{dateError}</p>
                  )}
                </div>
              </div>

              {/* Email + Telefone (2 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    maxLength={100}
                    className={cn(
                      "bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11",
                      emailError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                    )}
                    required
                  />
                  {emailError ? (
                    <p className="text-destructive text-sm">
                      {emailError}
                      {emailError.includes('já cadastrado') && (
                        <Link to="/login" className="ml-2 text-primary underline hover:text-primary/80">
                          Fazer login
                        </Link>
                      )}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground block text-right">{email.length}/100</span>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-foreground font-medium">Telefone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    maxLength={15}
                    className={cn(
                      "bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11",
                      phoneError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                    )}
                    required
                  />
                  {checkingPhone && (
                    <p className="text-muted-foreground text-sm">Verificando telefone...</p>
                  )}
                  {phoneError && !checkingPhone && (
                    <p className="text-destructive text-sm">
                      {phoneError}
                      <Link to="/login" className="ml-2 text-primary underline hover:text-primary/80">
                        Fazer login
                      </Link>
                    </p>
                  )}
                  {!phoneError && !checkingPhone && (
                    <span className="text-xs text-muted-foreground block text-right">{phone.length}/15</span>
                  )}
                </div>
              </div>

              {/* Senha + Confirmar (2 colunas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground font-medium">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      maxLength={20}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Mínimo 6 caracteres</span>
                    <span>{password.length}/20</span>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>

                {/* Confirmar senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar senha *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      maxLength={20}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
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
                  className="mt-1 border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  Li e aceito os{' '}
                  <a href="/termos" className="text-primary hover:underline" target="_blank">
                    Termos de Uso
                  </a>
                  {' '}e{' '}
                  <a href="/privacidade" className="text-primary hover:underline" target="_blank">
                    Política de Privacidade
                  </a>
                  , e declaro estar ciente de que sou o único responsável pela veracidade das informações fornecidas.
                </Label>
              </div>

              {/* Botão Criar conta */}
              <Button
                type="submit"
                disabled={loading || !isCpfValid || cpf.length < 14 || checkingCpf || checkingPhone || !!phoneError}
                className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>

              {/* Separador */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-card text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Google Signup */}
              <Button
                type="button"
                onClick={handleGoogleSignup}
                variant="outline"
                className="w-full h-12 text-base bg-background hover:bg-accent text-foreground font-medium border-input"
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
              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <Link to="/login" className="font-semibold text-primary hover:text-primary/80 hover:underline">
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
