import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useViaCep } from '@/hooks/useViaCep';
import { formatCEP, formatEnrollmentNumber } from '@/lib/validators';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  Info,
  AlertTriangle,
  Scale,
  NotebookPen,
  BookOpen,
  Book,
  Briefcase,
  GraduationCap,
  ScrollText,
  MapPin,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';

const educationLevels = [
  { id: 'fundamental', label: 'Fundamental', icon: BookOpen },
  { id: 'medio', label: 'Médio', icon: Book },
  { id: 'tecnico', label: 'Técnico', icon: Briefcase },
  { id: 'graduacao', label: 'Graduação', icon: GraduationCap },
  { id: 'pos_lato', label: 'Pós-graduação', icon: ScrollText },
] as const;

const fieldConfiguration = {
  fundamental: {
    showCourseField: false,
    seriesLabel: 'Série *',
    seriesPlaceholder: 'Selecione',
    seriesOptions: [
      '1º ano',
      '2º ano',
      '3º ano',
      '4º ano',
      '5º ano',
      '6º ano',
      '7º ano',
      '8º ano',
      '9º ano',
    ],
  },
  medio: {
    showCourseField: false,
    seriesLabel: 'Série *',
    seriesPlaceholder: 'Selecione',
    seriesOptions: ['1º ano', '2º ano', '3º ano'],
  },
  tecnico: {
    showCourseField: true,
    courseLabel: 'Curso *',
    coursePlaceholder: 'Ex: Técnico em Eletrotécnica',
    periodLabel: 'Módulo *',
    periodPlaceholder: 'Selecione',
    periodOptions: ['1º módulo', '2º módulo', '3º módulo', '4º módulo'],
  },
  graduacao: {
    showCourseField: true,
    courseLabel: 'Curso *',
    coursePlaceholder: 'Ex: Odontologia',
    periodLabel: 'Semestre *',
    periodPlaceholder: 'Selecione',
    periodOptions: [
      '1º semestre',
      '2º semestre',
      '3º semestre',
      '4º semestre',
      '5º semestre',
      '6º semestre',
      '7º semestre',
      '8º semestre',
      '9º semestre',
      '10º semestre',
      '11º semestre',
      '12º semestre',
    ],
  },
  pos_lato: {
    showCourseField: true,
    courseLabel: 'Curso, Programa de Pós-graduação ou Especialização *',
    coursePlaceholder: 'Ex: MBA em Gestão, Mestrado em Educação',
    periodLabel: 'Semestre *',
    periodPlaceholder: 'Selecione',
    periodOptions: [
      '1º semestre',
      '2º semestre',
      '3º semestre',
      '4º semestre',
      '5º semestre',
      '6º semestre',
      '7º semestre',
      '8º semestre',
    ],
  },
} as const;

const toTitleCase = (str: string) =>
  str
    .toLowerCase()
    .replace(/(^|\s)\w/g, (m) => m.toUpperCase())
    .replace(/(^|\s)(da|de|do|das|dos|em|e)\s/gi, (m) => m.toLowerCase())
    .trim();

const institutionSuggestions = [
  "Universidade de Brasília (UnB)",
  "Universidade de São Paulo (USP)",
  "Universidade Estadual de Campinas (UNICAMP)",
  "Universidade Federal da Bahia (UFBA)",
  "Universidade Federal da Paraíba (UFPB)",
  "Universidade Federal de Alagoas (UFAL)",
  "Universidade Federal de Goiás (UFG)",
  "Universidade Federal de Juiz de Fora (UFJF)",
  "Universidade Federal de Mato Grosso (UFMT)",
  "Universidade Federal de Mato Grosso do Sul (UFMS)",
  "Universidade Federal de Minas Gerais (UFMG)",
  "Universidade Federal de Ouro Preto (UFOP)",
  "Universidade Federal de Pernambuco (UFPE)",
  "Universidade Federal de Santa Catarina (UFSC)",
  "Universidade Federal de Santa Maria (UFSM)",
  "Universidade Federal de São Carlos (UFSCar)",
  "Universidade Federal de São João del-Rei (UFSJ)",
  "Universidade Federal de Sergipe (UFS)",
  "Universidade Federal de Uberlândia (UFU)",
  "Universidade Federal de Viçosa (UFV)",
  "Universidade Federal do ABC (UFABC)",
  "Universidade Federal do Amazonas (UFAM)",
  "Universidade Federal do Ceará (UFC)",
  "Universidade Federal do Espírito Santo (UFES)",
  "Universidade Federal do Maranhão (UFMA)",
  "Universidade Federal do Pará (UFPA)",
  "Universidade Federal do Paraná (UFPR)",
  "Universidade Federal do Piauí (UFPI)",
  "Universidade Federal do Recôncavo da Bahia (UFRB)",
  "Universidade Federal do Rio de Janeiro (UFRJ)",
  "Universidade Federal do Rio Grande (FURG)",
  "Universidade Federal do Rio Grande do Norte (UFRN)",
  "Universidade Federal do Rio Grande do Sul (UFRGS)",
  "Universidade Federal do Tocantins (UFT)",
  "Universidade Federal dos Vales do Jequitinhonha e Mucuri (UFVJM)",
  "Universidade Estadual de Londrina (UEL)",
  "Universidade Estadual de Maringá (UEM)",
  "Universidade Estadual de Montes Claros (UNIMONTES)",
  "Universidade Estadual de Ponta Grossa (UEPG)",
  "Universidade Estadual do Ceará (UECE)",
  "Universidade Estadual do Norte Fluminense (UENF)",
  "Universidade Estadual Paulista (UNESP)",
  "Universidade do Estado do Rio de Janeiro (UERJ)",
  "Centro Universitário Estácio de Sá (Estácio)",
  "Centro Universitário UNA",
  "Centro Universitário UNIFACS",
  "Centro Universitário Unisinos",
  "Centro Universitário UniBH",
  "Centro Universitário Uninove",
  "Centro Universitário Unisociesc",
  "Faculdade Anhanguera",
  "Faculdade IBMEC",
  "Faculdade Pitágoras",
  "Fundação Getulio Vargas (FGV)",
  "Pontifícia Universidade Católica de Goiás (PUC Goiás)",
  "Pontifícia Universidade Católica de Minas Gerais (PUC Minas)",
  "Pontifícia Universidade Católica do Paraná (PUCPR)",
  "Pontifícia Universidade Católica do Rio de Janeiro (PUC-Rio)",
  "Pontifícia Universidade Católica do Rio Grande do Sul (PUCRS)",
  "Universidade Anhembi Morumbi",
  "Universidade Cruzeiro do Sul",
  "Universidade Estácio de Sá",
  "Universidade Nove de Julho (UNINOVE)",
  "Universidade Paulista (UNIP)",
  "Universidade Presbiteriana Mackenzie",
  "Universidade Salvador (UNIFACS)",
  "IFBA - Instituto Federal da Bahia",
  "IFCE - Instituto Federal do Ceará",
  "IFMG - Instituto Federal de Minas Gerais",
  "IFRJ - Instituto Federal do Rio de Janeiro",
  "IFRS - Instituto Federal do Rio Grande do Sul",
  "IFSC - Instituto Federal de Santa Catarina",
  "IFSP - Instituto Federal de São Paulo",
  "IF Sul de Minas",
  "SENAI",
  "SENAC",
];

const courseSuggestions = [
  "Administração",
  "Agronomia",
  "Arquitetura e Urbanismo",
  "Biomedicina",
  "Ciência da Computação",
  "Ciências Biológicas",
  "Ciências Contábeis",
  "Contabilidade",
  "Design",
  "Design Gráfico",
  "Direito",
  "Economia",
  "Educação Física",
  "Enfermagem",
  "Engenharia Ambiental",
  "Engenharia Civil",
  "Engenharia de Produção",
  "Engenharia Elétrica",
  "Engenharia Mecânica",
  "Engenharia Química",
  "Farmácia",
  "Filosofia",
  "Fisioterapia",
  "Fonoaudiologia",
  "Geografia",
  "Gestão de RH",
  "História",
  "Jornalismo",
  "Letras",
  "Logística",
  "Marketing",
  "Matemática",
  "Medicina",
  "Medicina Veterinária",
  "Nutrição",
  "Odontologia",
  "Pedagogia",
  "Psicologia",
  "Publicidade e Propaganda",
  "Química",
  "Relações Internacionais",
  "Serviço Social",
  "Sistemas de Informação",
  "Técnico em Eletrônica",
  "Técnico em Enfermagem",
  "Técnico em Informática",
  "Técnico em Mecânica",
  "Técnico em Segurança do Trabalho",
  "Terapia Ocupacional",
  "Turismo",
];

const normalizeWithSuggestions = (value: string, suggestions: string[]) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const match = suggestions.find(
    (name) => name.toLowerCase() === trimmed.toLowerCase()
  );

  if (match) return match;
  return toTitleCase(trimmed);
};

export default function CompleteProfile() {
  const { isChecking } = useOnboardingGuard('complete_profile');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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
  const [educationLevel, setEducationLevel] = useState<
    'fundamental' | 'medio' | 'tecnico' | 'graduacao' | 'pos_lato'
  >('graduacao');
  const [loading, setLoading] = useState(false);
  const [isCepResolved, setIsCepResolved] = useState(false);
  const [openInstitution, setOpenInstitution] = useState(false);
  const [openCourse, setOpenCourse] = useState(false);
  const [courseType, setCourseType] = useState<'direito' | 'outro'>('outro');
  const [customCourseName, setCustomCourseName] = useState('');

  const config = fieldConfiguration[educationLevel];
  const basePeriodOptions =
    (config.showCourseField ? config.periodOptions : config.seriesOptions) || [];
  const canBeLawStudent =
    educationLevel === 'graduacao' ||
    educationLevel === 'pos_lato';
  const institutionPlaceholder =
    educationLevel === 'tecnico'
      ? 'Ex: CEFET-MG'
      : educationLevel === 'fundamental' || educationLevel === 'medio'
      ? 'Instituto de Educação de Minas Gerais'
      : 'Ex: Universidade Federal de Juiz de Fora';
  const coursePlaceholder = !config.showCourseField
    ? ''
    : !canBeLawStudent
    ? config.coursePlaceholder
    : courseType === 'direito'
    ? 'Curso de Direito'
    : educationLevel === 'graduacao'
    ? 'Ex: Odontologia, Medicina, Engenharia Civil...'
    : 'Ex: MBA em Gestão, Especialização em Educação...';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const prefill = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('student_profiles')
        .select(
          'cep, street, number, complement, neighborhood, city, state, institution, course, period, enrollment_number, education_level, is_law_student'
        )
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setCep(data.cep ? formatCEP(data.cep) : '');
        setStreet(data.street || '');
        setNumber(
          data.number ? formatEnrollmentNumber(String(data.number)) : ''
        );
        setComplement(data.complement || '');
        setNeighborhood(data.neighborhood || '');
        setCity(data.city || '');
        setState(data.state || '');
        setInstitution(data.institution || '');
        setCourse(data.course || '');
        setPeriod(data.period || '');
        setEnrollmentNumber(
          data.enrollment_number
            ? formatEnrollmentNumber(String(data.enrollment_number))
            : ''
        );
        if (
          data.education_level === 'fundamental' ||
          data.education_level === 'medio' ||
          data.education_level === 'tecnico' ||
          data.education_level === 'graduacao' ||
          data.education_level === 'pos_lato'
        ) {
          setEducationLevel(data.education_level);
        } else if (data.education_level === 'stricto_sensu') {
          setEducationLevel('pos_lato');
        }

        const isGradOrPost =
          data.education_level === 'graduacao' ||
          data.education_level === 'pos_lato' ||
          data.education_level === 'stricto_sensu';

        if (isGradOrPost && data.course === 'Direito') {
          setCourseType('direito');
          setCustomCourseName('');
        } else if (isGradOrPost) {
          setCourseType('outro');
          setCustomCourseName(data.course || '');
        } else {
          setCourseType('outro');
          setCustomCourseName('');
        }
      }
    };
    prefill();
  }, [user]);

  // Mostrar loading enquanto verifica autenticação
  if (authLoading || isChecking) {
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
      try {
        const address = await fetchAddress(cleanCep);
        if (address) {
          setStreet(address.street);
          setNeighborhood(address.neighborhood);
          setCity(address.city);
          setState(address.state);
          toast.success('Endereço encontrado!');
          setIsCepResolved(true);
        } else {
          setStreet('');
          setNeighborhood('');
          setCity('');
          setState('');
          setIsCepResolved(false);
        }
      } catch {
        setStreet('');
        setNeighborhood('');
        setCity('');
        setState('');
        setIsCepResolved(false);
      }
    } else {
      setStreet('');
      setNeighborhood('');
      setCity('');
      setState('');
      setIsCepResolved(false);
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

    if (!institution || !period || !enrollmentNumber || (config.showCourseField && !course)) {
      toast.error('Preencha todos os campos acadêmicos');
      return;
    }

    setLoading(true);

    const isLawStudent =
      (educationLevel === 'graduacao' ||
        educationLevel === 'pos_lato' ||
        educationLevel === 'stricto_sensu') &&
      courseType === 'direito';

    // ID do plano Geral Digital para não-Direito
    const PLAN_GERAL_DIGITAL_ID = 'a20e423f-c222-47b0-814f-e532f1bbe0c4';

    // APENAS UPDATE - perfil SEMPRE existe graças à trigger do banco
    console.log('Salvando período:', period);

    const { error } = await supabase
      .from('student_profiles')
      .update({
        cep: cleanCep,
        street,
        number: number.replace(/\D/g, ''),
        complement: complement || null,
        neighborhood,
        city,
        state,
        institution,
        course: config.showCourseField ? course : null,
        period,
        enrollment_number: enrollmentNumber.replace(/\D/g, ''),
        education_level: educationLevel,
        is_law_student: isLawStudent,
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
    setLoading(false);

    // Redirecionar baseado em is_law_student
    if (isLawStudent) {
      // Atualizar step de onboarding para escolha de plano
      await supabase
        .from('student_profiles')
        .update({ current_onboarding_step: 'choose_plan' })
        .eq('user_id', user.id);

      navigate('/escolher-plano');
    } else {
      // Não é Direito → plano Geral Digital automaticamente
      localStorage.setItem('selected_plan_id', PLAN_GERAL_DIGITAL_ID);
      
      // Atualizar plan_id e onboarding_step no banco
      await supabase
        .from('student_profiles')
        .update({
          plan_id: PLAN_GERAL_DIGITAL_ID,
          current_onboarding_step: 'payment',
        })
        .eq('user_id', user.id);
      
      window.location.href = '/pagamento';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="py-8 px-4">
        <div className="flex items-center justify-center mb-4">
          <div className="w-full max-w-2xl">
            <ProgressBar currentStep="profile" />
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <div className="space-y-6">
              {/* Título */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Complete seu perfil</h1>
                <p className="text-muted-foreground">Sua carteira URE está a poucos passos</p>
                <p className="text-xs text-muted-foreground italic -mt-1 mb-4">
                   Preencha as informações marcadas com *
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Bloco Endereço */}
                <div className="bg-blue-100 p-4 sm:p-6 rounded-lg border border-blue/300 space-y-4">
                  <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    <span>Endereço Residencial</span>
                  </h3>

                  {/* CEP com mensagem informativa */}
                  <div className="flex flex-col sm:flex-row items-start gap-3 rounded-lg border border-sky-400 bg-slate-50 px-3 py-2">
                    <div className="w-full sm:w-32 sm:w-36">
                      <Label htmlFor="cep" className="text-foreground">CEP *</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          type="text"
                          placeholder="00000-000"
                          value={cep}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          className="bg-background text-foreground placeholder:text-muted-foreground border-sky-400 focus:border-primary focus:ring-primary/20 h-11 text-base"
                          required
                        />
                        {cepLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 sm:pt-6">
                      <Info className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Insira seu CEP para preenchimento automatico.
                      </span>
                    </div>
                  </div>

                  {/* Exibir erro do CEP se houver */}
                  {cepError && (
                    <Alert className="border-amber-500/50 bg-amber-500/10 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-700">
                        {cepError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Rua */}
                  <div className="space-y-2">
                    <Label htmlFor="street" className="text-foreground">Rua *</Label>
                    <Input
                      id="street"
                      type="text"
                      placeholder="Nome da rua"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      maxLength={70}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      required
                    />
                  </div>

                  {/* Número + Complemento */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="col-span-1 space-y-2">
                      <Label htmlFor="number" className="text-foreground">Número *</Label>
                      <Input
                        id="number"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 345, 89"
                        value={number}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '').slice(0, 5);
                          setNumber(formatEnrollmentNumber(cleaned));
                        }}
                        maxLength={6}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />

                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label htmlFor="complement" className="text-foreground">Complemento</Label>
                      <Input
                        id="complement"
                        type="text"
                        placeholder="Apto, bloco... (opcional)"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        maxLength={50}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      />
                    </div>
                  </div>

                  {/* Bairro */}
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood" className="text-foreground">Bairro *</Label>
                    <Input
                      id="neighborhood"
                      type="text"
                      placeholder="Nome do bairro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      maxLength={70}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-2 sm:col-span-3">
                      <Label htmlFor="city" className="text-foreground">Cidade *</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Preenchido pelo CEP"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={isCepResolved}
                        className={isCepResolved ? "border-input h-11 text-base bg-muted text-foreground" : "border-input h-11 text-base bg-background text-foreground"}
                      />
                      <span className="text-xs text-muted-foreground">
                        {isCepResolved ? 'Preenchido pelo CEP.' : 'Preencha manualmente.'}
                      </span>
                    </div>
                    <div className="space-y-2 sm:col-span-1">
                      <Label htmlFor="state" className="text-foreground">Estado *</Label>
                      <Select
                        value={state}
                        onValueChange={(value) => setState(value)}
                        disabled={isCepResolved}
                      >
                        <SelectTrigger className={isCepResolved ? "border-input h-11 text-base bg-muted text-foreground" : "border-input h-11 text-base bg-background text-foreground"}>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AC">AC</SelectItem>
                          <SelectItem value="AL">AL</SelectItem>
                          <SelectItem value="AP">AP</SelectItem>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="BA">BA</SelectItem>
                          <SelectItem value="CE">CE</SelectItem>
                          <SelectItem value="DF">DF</SelectItem>
                          <SelectItem value="ES">ES</SelectItem>
                          <SelectItem value="GO">GO</SelectItem>
                          <SelectItem value="MA">MA</SelectItem>
                          <SelectItem value="MT">MT</SelectItem>
                          <SelectItem value="MS">MS</SelectItem>
                          <SelectItem value="MG">MG</SelectItem>
                          <SelectItem value="PA">PA</SelectItem>
                          <SelectItem value="PB">PB</SelectItem>
                          <SelectItem value="PR">PR</SelectItem>
                          <SelectItem value="PE">PE</SelectItem>
                          <SelectItem value="PI">PI</SelectItem>
                          <SelectItem value="RJ">RJ</SelectItem>
                          <SelectItem value="RN">RN</SelectItem>
                          <SelectItem value="RS">RS</SelectItem>
                          <SelectItem value="RO">RO</SelectItem>
                          <SelectItem value="RR">RR</SelectItem>
                          <SelectItem value="SC">SC</SelectItem>
                          <SelectItem value="SP">SP</SelectItem>
                          <SelectItem value="SE">SE</SelectItem>
                          <SelectItem value="TO">TO</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        {isCepResolved
                          ? 'Preenchido pelo CEP.'
                          : 'Selecione a UF.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bloco Acadêmico */}
                <div className="bg-blue-100 p-4 sm:p-6 rounded-lg border border-blue/300 space-y-4">
                  <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    <span>Dados Acadêmicos</span>
                  </h3>

                  <div className="space-y-2">
                    <Label className="text-foreground">Nível de ensino *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {educationLevels.map((level) => (
                        <Button
                          key={level.id}
                          type="button"
                          variant={educationLevel === level.id ? 'default' : 'outline'}
                          className={
                            'justify-start flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm ' +
                            (educationLevel === level.id ? '' : 'bg-sky-200 border-sky-500 hover:bg-sky-300')
                          }
                          onClick={() => {
                            setEducationLevel(level.id as typeof educationLevel);
                            setCourse('');
                            setPeriod('');
                            setCourseType('outro');
                            setCustomCourseName('');
                          }}
                          >
                          <level.icon className="h-5 w-5" />
                          <span className="truncate">{level.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institution" className="text-foreground">
                      Instituição de ensino *
                    </Label>
                    <Popover open={openInstitution} onOpenChange={setOpenInstitution}>
                      <PopoverTrigger asChild>
                        <Input
                          id="institution"
                          type="text"
                          spellCheck={true}
                          lang="pt-BR"
                          placeholder={institutionPlaceholder}
                          value={institution}
                          onChange={(e) => {
                            setInstitution(e.target.value);
                            setOpenInstitution(true);
                          }}
                          maxLength={70}
                          className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                          required
                        />
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-full max-w-2xl" align="start">
                        <Command>
                          <CommandInput
                            value={institution}
                            onValueChange={(value) => setInstitution(value)}
                            placeholder="Digite para buscar..."
                          />
                          <CommandList className="max-h-48 overflow-y-auto">
                            <CommandEmpty>
                              {institution.trim().length < 2
                                ? "Digite o nome da instituição de ensino."
                                : "Nenhuma sugestão. Continue digitando."}
                            </CommandEmpty>
                            <CommandGroup>
                              {institutionSuggestions
                                .filter((name) => {
                                  const query = institution.trim().toLowerCase();
                                  if (query.length < 2) return false;
                                  return name.toLowerCase().includes(query);
                                })
                                .slice(0, 8)
                                .map((name) => (
                                  <CommandItem
                                    key={name}
                                    value={name}
                                    className="text-sm"
                                    onSelect={() => {
                                      setInstitution(name);
                                      setOpenInstitution(false);
                                    }}
                                  >
                                    {name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {config.showCourseField && (
                    canBeLawStudent ? (
                      <div className="space-y-3">
                        <Label className="text-foreground">Tipo de curso *</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={courseType === 'outro' ? 'default' : 'outline'}
                            className={
                              'justify-start flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm ' +
                              (courseType === 'outro' ? '' : 'bg-sky-200 border-sky-500 hover:bg-sky-300')
                            }
                            onClick={() => {
                              setCourseType('outro');
                              setCourse(customCourseName);
                            }}
                          >
                            <NotebookPen className="h-4 w-4" />
                            <span>Outros cursos</span>
                          </Button>
                          <Button
                            type="button"
                            variant={courseType === 'direito' ? 'default' : 'outline'}
                            className={
                              'justify-start flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm ' +
                              (courseType === 'direito' ? '' : 'bg-sky-200 border-sky-500 hover:bg-sky-300')
                            }
                            onClick={() => {
                              setCourseType('direito');
                              setCourse('Direito');
                              setCustomCourseName('');
                            }}
                          >
                            <Scale className="h-4 w-4" />
                            <span>Curso de Direito</span>
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="course" className="text-foreground">
                            {config.courseLabel}
                          </Label>
                          {courseType === 'direito' ? (
                            <Input
                              id="course"
                              type="text"
                              value="Direito"
                              readOnly
                              tabIndex={-1}
                              className="border-input focus:border-primary focus:ring-primary/20 h-11 text-base bg-sky-200 border border-sky-400 text-foreground cursor-default pointer-events-none"
                              required
                            />
                          ) : (
                            <Popover open={openCourse} onOpenChange={setOpenCourse}>
                              <PopoverTrigger asChild>
                                <Input
                                  id="course"
                                  type="text"
                                  spellCheck={true}
                                  lang="pt-BR"
                                  placeholder={coursePlaceholder}
                                  value={customCourseName}
                                  onChange={(e) => {
                                    setCustomCourseName(e.target.value);
                                    setCourse(e.target.value);
                                    setOpenCourse(true);
                                  }}
                                  maxLength={100}
                                  className="border-input focus:border-primary focus:ring-primary/20 h-11 text-base bg-background text-foreground placeholder:text-muted-foreground"
                                  required
                                />
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-full max-w-2xl" align="start">
                                <Command>
                                  <CommandInput
                                    value={customCourseName}
                                    onValueChange={(value) => {
                                      setCustomCourseName(value);
                                      setCourse(value);
                                    }}
                                    placeholder="Digite para buscar..."
                                  />
                                  <CommandList className="max-h-48 overflow-y-auto">
                                    <CommandEmpty>
                                      {customCourseName.trim().length < 2
                                        ? "Digite o nome do seu curso."
                                        : "Nenhuma sugestão. Continue digitando."}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {courseSuggestions
                                        .filter((name) => {
                                          const query = customCourseName.trim().toLowerCase();
                                          if (query.length < 2) return false;
                                          return name.toLowerCase().includes(query);
                                        })
                                        .slice(0, 8)
                                        .map((name) => (
                                          <CommandItem
                                            key={name}
                                            value={name}
                                            className="text-sm"
                                            onSelect={() => {
                                              setCustomCourseName(name);
                                              setCourse(name);
                                              setOpenCourse(false);
                                            }}
                                          >
                                            {name}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="course" className="text-foreground">
                          {config.courseLabel}
                        </Label>
                        <Popover open={openCourse} onOpenChange={setOpenCourse}>
                          <PopoverTrigger asChild>
                            <Input
                              id="course"
                              type="text"
                              spellCheck={true}
                              lang="pt-BR"
                              placeholder={coursePlaceholder}
                              value={course}
                              onChange={(e) => {
                                setCourse(e.target.value);
                                setOpenCourse(true);
                              }}
                              maxLength={70}
                              className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                              required
                            />
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-full max-w-2xl" align="start">
                            <Command>
                              <CommandInput
                                value={course}
                                onValueChange={(value) => setCourse(value)}
                                placeholder="Digite para buscar..."
                              />
                              <CommandList className="max-h-48 overflow-y-auto">
                                <CommandEmpty>
                                  {course.trim().length < 2
                                    ? "Digite o nome da instituição de ensino."
                                    : "Nenhuma sugestão. Continue digitando."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {courseSuggestions
                                    .filter((name) => {
                                      const query = course.trim().toLowerCase();
                                      if (query.length < 2) return false;
                                      return name.toLowerCase().includes(query);
                                    })
                                    .slice(0, 8)
                                    .map((name) => (
                                      <CommandItem
                                        key={name}
                                        value={name}
                                        className="text-sm"
                                        onSelect={() => {
                                          setCourse(name);
                                          setOpenCourse(false);
                                        }}
                                      >
                                        {name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="period" className="text-foreground">
                        {config.showCourseField ? config.periodLabel : config.seriesLabel}
                      </Label>
                      <Select
                        value={period}
                        onValueChange={(value) => setPeriod(value)}
                      >
                        <SelectTrigger className="border-input h-11 text-base bg-background text-foreground">
                          <SelectValue
                            placeholder={
                              config.showCourseField
                                ? config.periodPlaceholder
                                : config.seriesPlaceholder
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {basePeriodOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="enrollmentNumber" className="text-foreground">Nº de matrícula *</Label>
                      <Input
                        id="enrollmentNumber"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 345.678"
                        value={enrollmentNumber}
                        onChange={(e) => {
                          setEnrollmentNumber(formatEnrollmentNumber(e.target.value));
                        }}
                        maxLength={11}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Esses dados aparecerão na sua carteirinha.</p>
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
      </main>
    </div>
  );
}
