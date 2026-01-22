import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { validateCPF, formatCPF, formatPhone, formatBirthDateBR, parseBirthDateBR, isDisposableEmailDomain } from '@/lib/validators';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Info, CheckCircle } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function PrivacyPolicyContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>
        A URE Brasil valoriza a privacidade dos usuários e se compromete a proteger os dados pessoais
        coletados no processo de emissão de carteirinhas de estudante, em conformidade com a Lei Geral
        de Proteção de Dados (LGPD – Lei nº 13.709/2018).
      </p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Dados coletados</h3>
        <p>Coletamos apenas as informações essenciais para validar a matrícula e emitir a carteirinha estudantil:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>nome completo</li>
          <li>data de nascimento</li>
          <li>CPF</li>
          <li>endereço</li>
          <li>instituição de ensino</li>
          <li>curso ou série</li>
          <li>foto</li>
          <li>declaração de matrícula</li>
        </ul>
        <p>Esses dados são fornecidos voluntariamente pelo usuário ou responsável legal, quando aplicável.</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Uso dos dados</h3>
        <p>Os dados pessoais são utilizados exclusivamente para:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>emitir e validar a carteirinha estudantil;</li>
          <li>verificar a autenticidade da carteirinha via QR Code ou validador online;</li>
          <li>enviar a carteirinha digital por e-mail e outros canais informados.</li>
        </ul>
        <p>
          Não compartilhamos dados pessoais com terceiros sem consentimento, exceto em casos de obrigação legal
          ou solicitação de autoridades competentes.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Armazenamento e segurança</h3>
        <p>
          Os dados são armazenados em servidores seguros localizados no Brasil, com criptografia e acesso restrito
          a pessoas autorizadas.
        </p>
        <p>
          As informações são mantidas apenas pelo período necessário à validade da carteirinha (geralmente 1 ano),
          sendo excluídas ou anonimizadas após esse prazo, salvo obrigações legais.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Direitos do titular</h3>
        <p>Você (ou seu responsável legal) pode, a qualquer momento:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>acessar os dados pessoais cadastrados;</li>
          <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>solicitar a exclusão ou anonimização dos dados, quando cabível;</li>
          <li>revogar o consentimento para o tratamento de dados;</li>
          <li>solicitar a portabilidade dos dados para outro fornecedor de serviço, quando aplicável.</li>
        </ul>
        <p>
          Para exercer esses direitos, entre em contato pelo e-mail{' '}
          <span className="font-medium text-foreground">contato@urebrasil.com.br</span>.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Cookies</h3>
        <p>
          Nosso site utiliza cookies apenas para melhorar a navegação, reforçar a segurança e manter funcionalidades
          essenciais do sistema, sem rastreamento para fins comerciais.
        </p>
        <p>Você pode gerenciar ou desativar cookies nas configurações do navegador.</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Atualizações da política</h3>
        <p>
          Esta política pode ser atualizada periodicamente para refletir melhorias nos serviços ou mudanças legais.
          Mudanças relevantes serão comunicadas pelo site ou por e-mail, quando apropriado.
        </p>
        <p className="text-xs text-muted-foreground">
          Última atualização: janeiro de 2026. Em caso de dúvidas, entre em contato pelo e-mail
          contato@urebrasil.com.br.
        </p>
      </div>
    </div>
  );
}

function TermsOfUseContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>
        Ao acessar ou utilizar a página da URE Brasil e solicitar a emissão de carteirinhas de estudante,
        você aceita estes Termos de Uso integralmente. Estes termos regem o serviço de emissão de carteiras
        estudantis padronizadas (DNE/CIE), conforme Lei 12.933/2013.
      </p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Elegibilidade e responsabilidades</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>
            o serviço destina-se a estudantes regularmente matriculados em instituições de ensino reconhecidas
            (educação infantil ao superior);
          </li>
          <li>
            para menores de 18 anos, o responsável legal deve confirmar os dados no formulário ou anexar
            declaração de autorização, conforme modelo disponibilizado no site;
          </li>
          <li>
            você garante a veracidade das informações fornecidas (nome, CPF, matrícula, foto e demais dados).
            A falsidade dessas informações pode sujeitar o responsável a sanções civis e penais.
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Processo de emissão</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>
            após o envio dos dados e do comprovante de matrícula, a carteirinha digital é emitida, em regra,
            em até 48 horas úteis;
          </li>
          <li>
            a carteirinha possui elementos de segurança (como QR Code, trama anti-scanner e microletras) para
            uso em pedidos de meia-entrada em eventos;
          </li>
          <li>
            pagamentos são processados por plataformas seguras; reembolsos serão analisados e concedidos apenas
            em casos de erro comprovado pela URE Brasil.
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Uso permitido</h3>
        <p>
          A carteirinha pode ser utilizada exclusivamente para obtenção de meia-entrada em eventos culturais,
          esportivos e de lazer previstos em lei. É proibido:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>falsificar, adulterar ou revender carteirinhas;</li>
          <li>emprestar ou compartilhar o documento com terceiros;</li>
          <li>divulgar cópias digitais de forma pública ou sem autorização;</li>
          <li>utilizar a carteirinha para fins não previstos na legislação aplicável.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Limitações e isenção de responsabilidade</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>
            a URE Brasil não garante a aceitação universal da carteirinha, pois a conferência do direito à
            meia-entrada também depende da política de cada organizador de evento;
          </li>
          <li>
            a URE Brasil não se responsabiliza por danos indiretos, lucros cessantes, prejuízos financeiros ou
            recusa de meia-entrada por parte de terceiros;
          </li>
          <li>
            o serviço poderá ser suspenso temporariamente para manutenção, ajustes técnicos ou em casos de
            violação destes Termos de Uso.
          </li>
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
  );
}

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string>('');
  const [isCpfValid, setIsCpfValid] = useState(false);
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [birthDateText, setBirthDateText] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmEmailError, setConfirmEmailError] = useState<string>('');
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
  const [step, setStep] = useState<'cpf' | 'form'>('cpf');
  const [cpfData, setCpfData] = useState<{ cpf: string; fullName?: string; birthDate?: string } | null>(null);
  const [cpfConsent, setCpfConsent] = useState(false);
  const [allowManualData, setAllowManualData] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
 

  // Constantes para os dropdowns de data
  const currentYear = new Date().getFullYear();

  const validateConfirmEmailMatch = (emailValue: string, confirmValue: string) => {
    if (!confirmValue) {
      setConfirmEmailError('');
      return;
    }

    if (emailValue && confirmValue && emailValue !== confirmValue) {
      setConfirmEmailError('Os emails não coincidem');
    } else {
      setConfirmEmailError('');
    }
  };

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
    const date = parseBirthDateBR(birthDateText);
    if (!date) {
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
    // Bloquear domínios temporários
    if (value && isDisposableEmailDomain(value)) {
      setEmailError('Email temporário não permitido');
    }

    if (confirmEmail) {
      validateConfirmEmailMatch(value, confirmEmail);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("ure_signup_cpf_data");
      if (!raw) return;
      const cached = JSON.parse(raw) as {
        fullName?: string;
        birthDateText?: string;
        timestamp?: number;
      };
      if (!cached.timestamp) {
        window.sessionStorage.removeItem("ure_signup_cpf_data");
        return;
      }
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - cached.timestamp > thirtyMinutes) {
        window.sessionStorage.removeItem("ure_signup_cpf_data");
        return;
      }
      if (cached.fullName) setFullName(cached.fullName);
      if (cached.birthDateText) setBirthDateText(cached.birthDateText);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!fullName && !birthDateText) {
      window.sessionStorage.removeItem("ure_signup_cpf_data");
      return;
    }
    const payload = {
      fullName,
      birthDateText,
      timestamp: Date.now(),
    };
    try {
      window.sessionStorage.setItem("ure_signup_cpf_data", JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }
  }, [fullName, birthDateText]);

  const handleCPFValidation = async () => {
    if (!cpfConsent) {
      toast.error('Você precisa autorizar a consulta dos seus dados');
      return;
    }

    if (!cpf || !validateCPF(cpf)) {
      toast.error('Informe um CPF válido');
      return;
    }

    setLoading(true);

    try {
      const exists = await checkCpfExists(cpf);
      if (exists) {
        setIsCpfValid(false);
        setCpfError('CPF já cadastrado');
        toast.error('Este CPF já está cadastrado. Faça login para continuar.');
        return;
      }

      const cleanCpf = cpf.replace(/\D/g, '');

      const { data, error } = await supabase.functions.invoke('validate-cpf', {
        body: { cpf: cleanCpf }
      });

      if (error) {
        throw error;
      }

      if (data?.valid) {
        const apiName = data.nome as string | undefined;
        const apiBirth = data.dataNascimento as string | undefined;

        let birthText = apiBirth || '';

        if (apiBirth && /^\d{4}-\d{2}-\d{2}$/.test(apiBirth)) {
          const parsed = new Date(apiBirth);
          if (!isNaN(parsed.getTime())) {
            birthText = format(parsed, 'dd/MM/yyyy');
          }
        }

        setCpfData({
          cpf,
          fullName: apiName,
          birthDate: birthText
        });

        if (apiName) {
          setFullName(apiName);
        }

        if (birthText) {
          setBirthDateText(birthText);
        }

        try {
          if (typeof window !== "undefined") {
            const payload = {
              fullName: apiName || "",
              birthDateText: birthText,
              timestamp: Date.now(),
            };
            window.sessionStorage.setItem("ure_signup_cpf_data", JSON.stringify(payload));
          }
        } catch (err) {
          console.error(err);
        }

        setAllowManualData(false);
        setStep('form');
        toast.success('CPF validado! Complete seu cadastro');
      } else {
        setCpfData(null);
        setAllowManualData(true);
        setStep('form');
        toast.error('CPF não encontrado na base. Você pode preencher os dados manualmente.');
      }
    } catch {
      toast.error('Erro ao validar CPF');
    } finally {
      setLoading(false);
    }
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
    
    if (actualAge < 6) {
      toast.error('Você deve ter pelo menos 6 anos');
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email inválido');
      return;
    }
    if (isDisposableEmailDomain(email)) {
      toast.error('Emails temporários não são permitidos');
      setEmailError('Email temporário não permitido');
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

    if (email !== confirmEmail) {
      toast.error('Os emails não coincidem');
      return;
    }

    setLoading(true);
    setEmailError('');

    try {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        await supabase.auth.signOut();
      }

      const cpfExists = await checkCpfExists(cpf);
      if (cpfExists) {
        setCpfError('CPF já cadastrado');
        setIsCpfValid(false);
        toast.error('Este CPF já está cadastrado no sistema');
        setLoading(false);
        return;
      }

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

      if (data?.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0) {
        setEmailError('Este email já está cadastrado');
        toast.error('Este email já está cadastrado. Deseja fazer login?');
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('ure_signup_draft');
        window.localStorage.setItem('pending_email', email);
      }

      navigate(`/verificar-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Signup error:', msg);
      setEmailError(msg);
      toast.error('Erro ao criar conta: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Crie sua conta URE
            </h1>
            <p className="text-muted-foreground">
              Cinema, shows, teatro e eventos culturais com meia-entrada. Um benefício simples que gera economia ao longo do ano.
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-xl p-6 md:p-8 border border-border">
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 'cpf' && (
                <div className="space-y-4">
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
                      <p className="text-green-600 dark:text-green-400 text-sm">CPF válido</p>
                    )}
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cpfConsent}
                          onCheckedChange={(checked) => setCpfConsent(checked as boolean)}
                          className="mt-1 border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="text-sm">
                          Autorizo a URE Brasil a consultar meus dados cadastrais na Receita Federal exclusivamente para validação.
                          <button
                            type="button"
                            onClick={() => setIsPrivacyModalOpen(true)}
                            className="underline ml-1 text-primary hover:text-primary/80"
                          >
                            Política de Privacidade
                          </button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="button"
                    onClick={handleCPFValidation}
                    disabled={!cpf || !cpfConsent || loading}
                    className="w-full h-11"
                  >
                    {loading ? 'Validando...' : 'Validar CPF'}
                  </Button>
                </div>
              )}

              {step === 'form' && (
                <>
                  {cpfData && !allowManualData ? (
                    <>
                      <Alert className="bg-green-50 border-green-300 text-green-900 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-700" />
                            <AlertDescription>
                              CPF validado: {cpfData.cpf}
                            </AlertDescription>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-white text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => {
                              setStep('cpf');
                              setCpf('');
                              setCpfData(null);
                              setIsCpfValid(false);
                              setCpfError('');
                              setCpfConsent(false);
                              setAllowManualData(false);
                              setFullName('');
                              setBirthDateText('');
                              try {
                                if (typeof window !== "undefined") {
                                  window.sessionStorage.removeItem("ure_signup_cpf_data");
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          >
                            Usar outro CPF
                          </Button>
                        </div>
                      </Alert>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
                        <div className="space-y-2 md:col-span-3">
                          <Label htmlFor="fullName" className="text-foreground font-medium">Nome completo *</Label>
                          <Input
                            id="fullName"
                            type="text"
                            value={fullName}
                            readOnly
                            className="bg-muted text-foreground border-input text-base h-11"
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="birthdate" className="text-foreground font-medium">Data de nascimento *</Label>
                          <Input
                            id="birthdate"
                            type="text"
                            value={birthDateText}
                            readOnly
                            className="bg-muted text-foreground border-input text-base h-11"
                            required
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {!cpfData && allowManualData && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            Não foi possível validar seu CPF automaticamente. Preencha seus dados manualmente.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-foreground font-medium">Nome completo *</Label>
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="Seu nome completo"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          maxLength={100}
                          className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11"
                          required
                        />
                        <span className="text-xs text-muted-foreground block text-right">{fullName.length}/100</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <p className="text-green-600 dark:text-green-400 text-sm">✓ CPF válido</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="birthdate" className="text-foreground font-medium">Data de nascimento *</Label>
                          <Input
                            id="birthdate"
                            type="text"
                            inputMode="numeric"
                            pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{4}"
                            placeholder="Dia/Mês/Ano"
                            value={birthDateText}
                            onChange={(e) => setBirthDateText(formatBirthDateBR(e.target.value))}
                            maxLength={10}
                            autoComplete="bday"
                            title="Use o formato DD/MM/AAAA (ex.: 08/09/1970)"
                            className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11"
                            required
                          />
                          {dateError && (
                            <p className="text-destructive text-sm">{dateError}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

              <div className="space-y-6">
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
                    autoComplete="email"
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

                <div className="space-y-2">
                  <Label htmlFor="confirmEmail" className="text-foreground font-medium">Confirme seu Email</Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    placeholder="Digite o email novamente"
                    value={confirmEmail}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfirmEmail(value);
                      validateConfirmEmailMatch(email, value);
                    }}
                    maxLength={100}
                    autoComplete="off"
                    className={cn(
                      "bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11",
                      confirmEmailError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                    )}
                    required
                  />
                  <span className="text-xs text-muted-foreground block text-right">{confirmEmail.length}/100</span>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar senha *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
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

              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1 border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  Li e aceito os{' '}
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="text-primary hover:underline"
                  >
                    Termos de Uso
                  </button>
                  {' '}e{' '}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="text-primary hover:underline"
                  >
                    Política de Privacidade
                  </button>
                  , e declaro estar ciente de que sou o único responsável pela veracidade das informações fornecidas.
                </Label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Ao continuar, você concorda com nossos{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="underline hover:text-foreground"
                >
                  Termos de Uso
                </button>{' '}
                e{' '}
                <button
                  type="button"
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="underline hover:text-foreground"
                >
                  Política de Privacidade
                </button>
                .
              </p>

              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <Link to="/login" className="font-semibold text-primary hover:text-primary/80 hover:underline">
                  Fazer login
                </Link>
              </p>
                </>
              )}
            </form>

            <Dialog open={isTermsModalOpen} onOpenChange={setIsTermsModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Termos de Uso – URE Brasil</DialogTitle>
                  <DialogDescription>
                    Condições gerais para uso da plataforma e emissão de carteirinhas estudantis.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                  <TermsOfUseContent />
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isPrivacyModalOpen} onOpenChange={setIsPrivacyModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Política de Privacidade – URE Brasil</DialogTitle>
                  <DialogDescription>
                    Entenda como seus dados são coletados, utilizados e protegidos pela URE Brasil.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                  <PrivacyPolicyContent />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
