import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, Info, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const educationLevels = [
  { id: 'fundamental', label: 'Ensino Fundamental' },
  { id: 'medio', label: 'Ensino Médio' },
  { id: 'tecnico', label: 'Curso Técnico' },
  { id: 'graduacao', label: 'Graduação' },
  { id: 'pos', label: 'Mestrado/Doutorado' },
];

const fieldConfiguration = {
  fundamental: {
    showCourseField: false,
    seriesLabel: 'Série *',
    seriesPlaceholder: 'Selecione a série',
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
    seriesPlaceholder: 'Selecione a série',
    seriesOptions: ['1º ano', '2º ano', '3º ano'],
  },
  tecnico: {
    showCourseField: true,
    courseLabel: 'Curso *',
    coursePlaceholder: 'Ex: Técnico em Enfermagem',
    periodLabel: 'Módulo *',
    periodPlaceholder: 'Selecione o módulo',
    periodOptions: ['1º módulo', '2º módulo', '3º módulo', '4º módulo'],
  },
  graduacao: {
    showCourseField: true,
    courseLabel: 'Curso *',
    coursePlaceholder: 'Ex: Odontologia',
    periodLabel: 'Semestre *',
    periodPlaceholder: 'Selecione o semestre',
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
    ],
  },
  pos: {
    showCourseField: true,
    courseLabel: 'Programa *',
    coursePlaceholder: 'Ex: Mestrado em Educação',
    periodLabel: 'Semestre *',
    periodPlaceholder: 'Selecione o semestre',
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

export default function CompleteProfile() {
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
  const [educationLevel, setEducationLevel] = useState<'fundamental' | 'medio' | 'tecnico' | 'graduacao' | 'pos'>('graduacao');
  const [loading, setLoading] = useState(false);
  const [isCepResolved, setIsCepResolved] = useState(false);
  const [courseType, setCourseType] = useState<'direito' | 'outro'>('outro');
  const [customCourseName, setCustomCourseName] = useState('');

  const config = fieldConfiguration[educationLevel];
  const basePeriodOptions =
    (config.showCourseField ? config.periodOptions : config.seriesOptions) || [];
  const canBeLawStudent = educationLevel === 'graduacao' || educationLevel === 'pos';

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
        setNumber(data.number || '');
        setComplement(data.complement || '');
        setNeighborhood(data.neighborhood || '');
        setCity(data.city || '');
        setState(data.state || '');
        setInstitution(data.institution || '');
        setCourse(data.course || '');
        setPeriod(data.period || '');
        setEnrollmentNumber(data.enrollment_number || '');
        if (
          data.education_level === 'fundamental' ||
          data.education_level === 'medio' ||
          data.education_level === 'tecnico' ||
          data.education_level === 'graduacao' ||
          data.education_level === 'pos'
        ) {
          setEducationLevel(data.education_level);
        }

        const isGradOrPost =
          data.education_level === 'graduacao' ||
          data.education_level === 'pos';

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
      (educationLevel === 'graduacao' || educationLevel === 'pos') &&
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
        number,
        complement: complement || null,
        neighborhood,
        city,
        state,
        institution,
        course: config.showCourseField ? course : null,
        period,
        enrollment_number: enrollmentNumber,
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
      <Header variant="app" />
      <main className="py-8 px-4">
        <div className="container mx-auto max-w-4xl mb-4">
          <ProgressBar currentStep="profile" />
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <div className="bg-card rounded-2xl shadow-xl border border-border p-6 md:p-8">
              <div className="space-y-6">
              {/* Título */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Complete seu perfil</h1>
                <p className="text-muted-foreground">Precisamos de mais algumas informações</p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Seção Endereço */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                    Endereço Residencial
                  </h2>

                  {/* CEP com mensagem informativa */}
                  <div className="flex flex-row items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <div className="w-32 sm:w-36">
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
                    <div className="flex-1 flex items-center gap-1.5 pt-6">
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

                  {/* Rua */}
                  <div className="space-y-2">
                    <Label htmlFor="street" className="text-foreground">Rua</Label>
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
                    <span className="text-xs text-muted-foreground block text-right">{street.length}/70</span>
                  </div>

                  {/* Número + Complemento */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 space-y-2">
                      <Label htmlFor="number" className="text-foreground">Número</Label>
                      <Input
                        id="number"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 123, 54, 1002"
                        value={number}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setNumber(digitsOnly);
                        }}
                        maxLength={10}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                      <span className="text-xs text-muted-foreground block text-right">{number.length}/10</span>
                    </div>
                    <div className="col-span-2 space-y-2">
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
                      <span className="text-xs text-muted-foreground block text-right">{complement.length}/50</span>
                    </div>
                  </div>

                  {/* Bairro */}
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood" className="text-foreground">Bairro</Label>
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
                    <span className="text-xs text-muted-foreground block text-right">
                      {neighborhood.length}/70
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2 col-span-3">
                      <Label htmlFor="city" className="text-foreground">Cidade</Label>
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
                    <div className="space-y-2 col-span-1">
                      <Label htmlFor="state" className="text-foreground">Estado</Label>
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

                {/* Seção Acadêmica */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                    Dados Acadêmicos
                  </h2>

                  <div className="space-y-2">
                    <Label className="text-foreground">Nível de ensino</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {educationLevels.map((level) => (
                        <Button
                          key={level.id}
                          type="button"
                          variant={educationLevel === level.id ? 'default' : 'outline'}
                          className="justify-start"
                          onClick={() => {
                            setEducationLevel(level.id as typeof educationLevel);
                            setCourse('');
                            setPeriod('');
                            setCourseType('outro');
                            setCustomCourseName('');
                          }}
                        >
                          {level.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institution" className="text-foreground">Instituição de ensino</Label>
                    <Input
                      id="institution"
                      type="text"
                      placeholder="Ex: Universidade Federal de Juiz de Fora"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      maxLength={70}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                      required
                    />
                    <span className="text-xs text-muted-foreground block text-right">{institution.length}/70</span>
                  </div>

                  {config.showCourseField && (
                    canBeLawStudent ? (
                      <div className="space-y-3">
                        <Label className="text-foreground">Tipo de curso *</Label>
                        <RadioGroup
                          value={courseType}
                          onValueChange={(value: 'direito' | 'outro') => {
                            setCourseType(value);
                            if (value === 'direito') {
                              setCourse('Direito');
                              setCustomCourseName('');
                            } else {
                              setCourse('');
                            }
                          }}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="direito" id="direito" />
                            <Label htmlFor="direito" className="font-normal cursor-pointer">
                              Curso de Direito
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="outro" id="outro" />
                            <Label htmlFor="outro" className="font-normal cursor-pointer">
                              Outro curso
                            </Label>
                          </div>
                        </RadioGroup>
                        {courseType === 'outro' && (
                          <div className="space-y-2">
                            <Label htmlFor="course" className="text-foreground">
                              {config.courseLabel}
                            </Label>
                            <Input
                              id="course"
                              type="text"
                              placeholder={config.coursePlaceholder}
                              value={customCourseName}
                              onChange={(e) => {
                                setCustomCourseName(e.target.value);
                                setCourse(e.target.value);
                              }}
                              maxLength={150}
                              className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                              required
                            />
                            <span className="text-xs text-muted-foreground block text-right">
                              {customCourseName.length}/150
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="course" className="text-foreground">
                          {config.courseLabel}
                        </Label>
                        <Input
                          id="course"
                          type="text"
                          placeholder={config.coursePlaceholder}
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          maxLength={70}
                          className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                          required
                        />
                        <span className="text-xs text-muted-foreground block text-right">
                          {course.length}/70
                        </span>
                      </div>
                    )
                  )}

                  <div className="flex flex-row gap-4">
                    <div className="space-y-2 w-1/2">
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
                    <div className="space-y-2 w-1/2">
                      <Label htmlFor="enrollmentNumber" className="text-foreground">Nº de matrícula</Label>
                      <Input
                        id="enrollmentNumber"
                        type="text"
                        placeholder="Ex: 123456"
                        value={enrollmentNumber}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setEnrollmentNumber(digitsOnly);
                        }}
                        maxLength={10}
                        className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 h-11 text-base"
                        required
                      />
                      <span className="text-xs text-muted-foreground block text-right">{enrollmentNumber.length}/10</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Esses dados aparecerão na sua carteirinha.</p>
                    <p>Exemplo: "Graduação – 3º semestre – Direito – UFJF"</p>
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
      </main>
    </div>
  );
}
