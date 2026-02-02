import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, User, MapPin, GraduationCap, Shield, History, Save, Mail, Lock, Trash2, FileText, CreditCard, CheckCircle2, Clock, XCircle, AlertTriangle, Eye, EyeOff, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { useViaCep } from '@/hooks/useViaCep';
import { supabase } from '@/integrations/supabase/client';
import { formatCPF, formatPhone, formatCEP, formatEnrollmentNumber, validatePassword } from '@/lib/validators';
import { formatBirthDate, formatDate } from '@/lib/dateUtils';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  phone: string;
  avatar_url: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  institution: string | null;
  course: string | null;
  period: string | null;
  enrollment_number: string | null;
  plan_id: string | null;
  is_law_student?: boolean | null;
  education_level?: string | null;
}

interface Document {
  id: string;
  type: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  file_url?: string;
  mime_type?: string;
  validated_at?: string | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  metadata?: any;
}

interface StudentCard {
  id: string;
  card_number: string;
  status: string;
  valid_until: string;
  card_type: string;
  issued_at?: string;
}

interface Plan {
  id: string;
  name: string;
}

// formatCPF and formatPhone imported from @/lib/validators

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatEducationLevel = (level: string | null | undefined) => {
  if (!level) return 'Não informado';
  const map: Record<string, string> = {
    fundamental: 'Fundamental',
    medio: 'Médio',
    tecnico: 'Técnico',
    graduacao: 'Graduação',
    pos_lato: 'Pós-graduação',
    stricto_sensu: 'Pós-graduação',
  };
  return map[level] || level;
};

const getPaymentVariantLabel = (payment: Payment, profile: StudentProfile | null) => {
  const isLaw = !!profile?.is_law_student;
  const meta = payment.metadata || {};
  const isPhysicalUpsell = !!(meta.is_physical_upsell || meta.is_upsell);
  const brand = isLaw ? 'LexPraxis' : 'URE';
  const modality = isPhysicalUpsell ? 'Física' : 'Digital';
  return `${modality} ${brand}`;
};

const documentTypeLabels: Record<string, string> = {
  rg: 'RG / CNH',
  matricula: 'Comprovante de Matrícula',
  foto: 'Foto 3x4',
  selfie: 'Selfie com Documento'
};

const periodOptions = [
  '1º semestre', '1º período', '1º ano',
  '2º semestre', '2º período', '2º ano',
  '3º semestre', '3º período', '3º ano',
  '4º semestre', '4º período', '4º ano',
  '5º semestre', '5º período', '5º ano',
  '6º semestre', '6º período', '6º ano',
  '7º semestre', '7º período', '7º ano',
  '8º semestre', '8º período', '8º ano',
  '9º semestre', '9º período', '9º ano',
  '10º semestre', '10º período',
  'Pós-Graduação', 'Mestrado', 'Doutorado'
];

export default function Perfil() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { refreshProfile } = useProfile();
  const { fetchAddress, loading: cepLoading, error: cepError } = useViaCep();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [card, setCard] = useState<StudentCard | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePhotoSignedUrl, setProfilePhotoSignedUrl] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<{ url: string; title: string } | null>(null);
  const [docThumbnails, setDocThumbnails] = useState<Record<string, string>>({});
  
  // Form states
  const [personalForm, setPersonalForm] = useState({ full_name: '', phone: '' });
  const [addressForm, setAddressForm] = useState({ cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' });
  const [academicForm, setAcademicForm] = useState({ institution: '', course: '', period: '', enrollment_number: '' });
  const [securityForm, setSecurityForm] = useState({ currentPasswordForEmail: '', newEmail: '', currentPasswordForPassword: '', newPassword: '', confirmPassword: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  
  // Loading states
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Password visibility toggles
  const [showCurrentPasswordEmail, setShowCurrentPasswordEmail] = useState(false);
  const [showCurrentPasswordChange, setShowCurrentPasswordChange] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  useEffect(() => {
    const genSigned = async () => {
      if (profile?.profile_photo_url) {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(profile.profile_photo_url, 300);
        if (!error && data?.signedUrl) {
          setProfilePhotoSignedUrl(data.signedUrl);
        } else {
          setProfilePhotoSignedUrl(null);
        }
      } else {
        setProfilePhotoSignedUrl(null);
      }
    };
    genSigned();
  }, [profile?.profile_photo_url]);

  const loadAllData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setPersonalForm({ full_name: profileData.full_name || '', phone: profileData.phone || '' });
        setAddressForm({
          cep: profileData.cep || '',
          street: profileData.street || '',
          number: profileData.number || '',
          complement: profileData.complement || '',
          neighborhood: profileData.neighborhood || '',
          city: profileData.city || '',
          state: profileData.state || ''
        });
        setAcademicForm({
          institution: profileData.institution || '',
          course: profileData.course || '',
          period: profileData.period || '',
          enrollment_number: profileData.enrollment_number
            ? formatEnrollmentNumber(String(profileData.enrollment_number))
            : ''
        });

        // Load documents
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('student_id', profileData.id)
          .order('created_at', { ascending: false });
        
        if (docsData) {
          setDocuments(docsData);
          const thumbs: Record<string, string> = {};
          for (const d of docsData) {
            if (d.mime_type?.startsWith('image/') && d.file_url) {
              const { data: signed, error: signedError } = await supabase.storage
                .from('documents')
                .createSignedUrl(d.file_url, 600);
              if (!signedError && signed?.signedUrl) {
                thumbs[d.id] = signed.signedUrl;
              }
            }
          }
          setDocThumbnails(thumbs);
        }

        // Load payments
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('student_id', profileData.id)
          .order('created_at', { ascending: false });
        
        if (paymentsData) setPayments(paymentsData);

        // Load card
        const { data: cardData } = await supabase
          .from('student_cards')
          .select('*')
          .eq('student_id', profileData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (cardData) setCard(cardData);

        // Load plan
        if (profileData.plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('*')
            .eq('id', profileData.plan_id)
            .single();
          
          if (planData) setPlan(planData);
        }
      }
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleCepChange = async (cep: string) => {
    const formattedCep = formatCEP(cep);
    setAddressForm(prev => ({ ...prev, cep: formattedCep }));
    
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length === 8) {
      const address = await fetchAddress(cleanCep);
      if (address) {
        setAddressForm(prev => ({
          ...prev,
          street: address.street,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state
        }));
      }
    }
  };

  const openDocumentPreview = async (doc: Document) => {
    if (!doc.file_url) return;
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_url, 600);
      if (error || !data?.signedUrl) {
        toast.error('Erro ao carregar documento');
        return;
      }
      const title = documentTypeLabels[doc.type] || doc.type;
      setDocPreview({ url: data.signedUrl, title });
    } catch {
      toast.error('Erro ao carregar documento');
    }
  };

  const savePersonalInfo = async () => {
    if (!profile) return;
    setSavingPersonal(true);
    
    try {
      const cleanPhone = personalForm.phone.replace(/\D/g, '');
      
      // Verificar se telefone já existe em outro usuário (usando RPC que ignora RLS)
      const { data: phoneExists, error: phoneError } = await supabase.rpc('check_phone_exists', { 
        p_phone: cleanPhone 
      });
      
      if (phoneError) {
        console.error('Erro ao verificar telefone:', phoneError);
      }
      
      // Se existe E não é o telefone atual do usuário
      if (phoneExists && profile.phone !== cleanPhone) {
        toast.error('Este telefone já está em uso por outro usuário!');
        setSavingPersonal(false);
        return;
      }
      
      const { error } = await supabase
        .from('student_profiles')
        .update({
          full_name: personalForm.full_name,
          phone: cleanPhone
        })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, ...personalForm, phone: cleanPhone });
      await refreshProfile();
      toast.success('Informações salvas!');
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setSavingPersonal(false);
    }
  };

  const saveAddress = async () => {
    if (!profile) return;
    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({
          cep: addressForm.cep.replace(/\D/g, ''),
          street: addressForm.street,
          number: addressForm.number,
          complement: addressForm.complement,
          neighborhood: addressForm.neighborhood,
          city: addressForm.city,
          state: addressForm.state
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Endereço salvo!');
    } catch (error) {
      toast.error('Erro ao salvar endereço');
    } finally {
      setSavingAddress(false);
    }
  };

  const saveAcademicInfo = async () => {
    if (!profile) return;
    setSavingAcademic(true);
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({
          institution: academicForm.institution,
          course: academicForm.course,
          period: academicForm.period,
          enrollment_number: academicForm.enrollment_number.replace(/\D/g, '')
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Dados acadêmicos salvos!');
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setSavingAcademic(false);
    }
  };

  const changeEmail = async () => {
    const { currentPasswordForEmail, newEmail } = securityForm;
    
    if (!currentPasswordForEmail || !newEmail) {
      toast.error('Preencha todos os campos');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Email inválido');
      return;
    }

    if (newEmail === user?.email) {
      toast.error('O novo email deve ser diferente do atual');
      return;
    }

    setChangingEmail(true);

    try {
      // Validar senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPasswordForEmail
      });

      if (signInError) {
        toast.error('Senha atual incorreta');
        return;
      }

      // Senha correta - trocar email
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (updateError) {
        if (updateError.message.includes('already registered')) {
          toast.error('Este email já está em uso');
        } else {
          toast.error(updateError.message);
        }
        return;
      }

      toast.success('Email de confirmação enviado! Verifique sua caixa de entrada.', { duration: 6000 });
      setSecurityForm(prev => ({ ...prev, currentPasswordForEmail: '', newEmail: '' }));
    } catch (error: unknown) {
      toast.error('Erro ao trocar email');
      console.error(error);
    } finally {
      setChangingEmail(false);
    }
  };

  const changePassword = async () => {
    const { currentPasswordForPassword, newPassword, confirmPassword } = securityForm;

    if (!currentPasswordForPassword) {
      toast.error('Digite sua senha atual');
      return;
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.isValid) {
      toast.error(`Ajuste a nova senha: ${passwordCheck.feedback.join(' • ')}`);
      return;
    }

    if (newPassword.length > 20) {
      toast.error('Senha deve ter no máximo 20 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Senhas não coincidem');
      return;
    }

    setChangingPassword(true);

    try {
      // Validar senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPasswordForPassword
      });

      if (signInError) {
        toast.error('Senha atual incorreta');
        return;
      }

      // Senha correta - alterar senha
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setSecurityForm(prev => ({ ...prev, currentPasswordForPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Digite DELETE para confirmar');
      return;
    }
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('DEBUG deleteAccount - sessão:', {
        exists: !!session,
        token: session?.access_token ? session.access_token.substring(0, 20) + '...' : null,
        expires: session?.expires_at,
      });

      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const { data, error } = await supabase.functions.invoke('delete-user-data', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('DEBUG deleteAccount - resposta função:', { data, error });

      if (error) {
        throw error;
      }

      if (data && typeof (data as { error?: string }).error === 'string') {
        throw new Error((data as { error: string }).error);
      }

      toast.success('Dados apagados com sucesso');
      await supabase.auth.signOut();
      navigate('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao apagar dados';
      toast.error(`Erro ao apagar dados: ${message}`);
    } finally {
      setDeletingAccount(false);
    }
  };

  const isCardActive = card?.status === 'active';
  const academicLocked = isCardActive;
  const effectivePeriodOptions =
    academicForm.period && !periodOptions.includes(academicForm.period)
      ? [academicForm.period, ...periodOptions]
      : periodOptions;
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  if (authLoading || loading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Avatar Section */}
        <Card className="mb-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20">
          <CardContent className="pt-6">
            <div className="flex flex-row items-center gap-6">
              <div className="relative flex-shrink-0">
                <Avatar className={`h-32 w-32 border-4 ${profile?.profile_photo_url ? 'border-primary' : 'border-muted'}`}>
                  <AvatarImage src={profilePhotoSignedUrl || undefined} />
                  <AvatarFallback className="text-3xl bg-primary/20 text-primary">{initials}</AvatarFallback>
                </Avatar>
                {profile?.profile_photo_url && (
                  <Badge className="absolute -bottom-2 -right-2 text-[10px] px-2 py-0.5">
                    Aprovada
                  </Badge>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <h2 className="text-xl md:text-2xl font-bold text-foreground break-words">
                  {profile?.full_name}
                </h2>
                <p className="text-sm text-muted-foreground break-all">{user?.email}</p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Foto atualizada conforme Foto 3x4.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-auto p-1 bg-muted/50">
              <TabsTrigger value="personal" className="flex flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Pessoal</span>
              </TabsTrigger>
              <TabsTrigger value="address" className="flex flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Endereço</span>
              </TabsTrigger>
              <TabsTrigger value="academic" className="flex flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Acadêmico</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Segurança</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col sm:flex-row gap-1 py-2 text-xs sm:text-sm">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
            </TabsList>

            {/* Personal Info Tab */}
            <TabsContent value="personal" className="p-6">
              <div className="space-y-4">
                {/* Nome + Telefone (grid-cols-4: 3/4 + 1/4) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-3">
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input
                      id="full_name"
                      value={personalForm.full_name}
                      onChange={(e) => setPersonalForm(prev => ({ ...prev, full_name: e.target.value }))}
                      disabled
                      className="bg-muted"
                      maxLength={60}
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Conforme CPF. Contate suporte para alterações.
                      </p>
                      <span className="text-xs text-muted-foreground">{personalForm.full_name.length}/60</span>
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formatPhone(personalForm.phone)}
                      onChange={(e) => setPersonalForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                    <span className="text-xs text-muted-foreground block text-right mt-1">{personalForm.phone.length}/15</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>CPF</Label>
                    <Input value={formatCPF(profile?.cpf || '')} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground mt-1">Não pode ser alterado</p>
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input value={profile?.birth_date ? formatBirthDate(profile.birth_date) : ''} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Conforme CPF. Contate suporte para alterações.
                    </p>
                  </div>
                </div>

                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">Para trocar email, acesse a aba "Segurança"</p>
                </div>

                <Button onClick={savePersonalInfo} disabled={savingPersonal} className="w-full sm:w-auto">
                  {savingPersonal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="p-6">
              <div className="space-y-4">
                {/* CEP com texto informativo ao lado do input */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                  <div className="w-full sm:w-32">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="relative">
                      <Input
                        id="cep"
                        value={formatCEP(addressForm.cep)}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {cepLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pb-0 sm:pb-2">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      Altere o CEP para atualizar o endereço.
                    </span>
                  </div>
                </div>
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
                  <div className="sm:col-span-3">
                    <Label htmlFor="street">Rua</Label>
                    <Input
                      id="street"
                      value={addressForm.street}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                      maxLength={150}
                    />
                    <span className="text-xs text-muted-foreground block text-right mt-1">{addressForm.street.length}/150</span>
                  </div>
                  <div className="sm:col-span-1">
                    <Label htmlFor="number">Número</Label>
                    <Input
                      id="number"
                      value={addressForm.number}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                      maxLength={10}
                    />
                    <span className="text-xs text-muted-foreground block text-right mt-1">{addressForm.number.length}/10</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      value={addressForm.neighborhood}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                      maxLength={100}
                    />
                    <span className="text-xs text-muted-foreground block text-right mt-1">{addressForm.neighborhood.length}/100</span>
                  </div>
                  <div>
                    <Label htmlFor="complement">Complemento</Label>
                    <Input
                      id="complement"
                      value={addressForm.complement}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                      placeholder="Apto, bloco... (opcional)"
                      maxLength={100}
                    />
                    <span className="text-xs text-muted-foreground block text-right mt-1">{addressForm.complement.length}/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Cidade</Label>
                    <Input value={addressForm.city} disabled className="bg-muted" />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input value={addressForm.state} disabled className="bg-muted" />
                  </div>
                </div>

                <Button onClick={saveAddress} disabled={savingAddress} className="w-full sm:w-auto">
                  {savingAddress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Endereço
                </Button>
              </div>
            </TabsContent>

            {/* Academic Tab */}
            <TabsContent value="academic" className="p-6">
              <div className="space-y-4">
                <div>
                  <Label>Nível</Label>
                  <Input
                    value={formatEducationLevel((profile as StudentProfile | null)?.education_level)}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="institution">Instituição de Ensino</Label>
                  <Input
                    id="institution"
                    value={academicForm.institution}
                    onChange={(e) => setAcademicForm(prev => ({ ...prev, institution: e.target.value }))}
                    disabled={academicLocked}
                    maxLength={150}
                  />
                  <span className="text-xs text-muted-foreground block text-right mt-1">{academicForm.institution.length}/150</span>
                </div>

                <div>
                  <Label htmlFor="course">Curso</Label>
                  <Input
                    id="course"
                    value={academicForm.course}
                    onChange={(e) => setAcademicForm(prev => ({ ...prev, course: e.target.value }))}
                    disabled={academicLocked}
                    maxLength={150}
                  />
                  <span className="text-xs text-muted-foreground block text-right mt-1">{academicForm.course.length}/150</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="period">Período</Label>
                    <Select
                      value={academicForm.period}
                      onValueChange={(value) => setAcademicForm(prev => ({ ...prev, period: value }))}
                      disabled={academicLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {effectivePeriodOptions.map(period => (
                          <SelectItem key={period} value={period}>{period}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="enrollment_number">Número de Matrícula</Label>
                    <Input
                      id="enrollment_number"
                      value={academicForm.enrollment_number}
                      onChange={(e) =>
                        setAcademicForm(prev => ({
                          ...prev,
                          enrollment_number: formatEnrollmentNumber(e.target.value)
                        }))
                      }
                      disabled={academicLocked}
                      maxLength={14}
                    />
                    <span className="text-xs text-muted-foreground block text-right mt-1">
                      {academicForm.enrollment_number.length}/14
                    </span>
                  </div>
                </div>

                <Button onClick={saveAcademicInfo} disabled={savingAcademic || academicLocked} className="w-full sm:w-auto">
                  {savingAcademic ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Dados Acadêmicos
                </Button>
                {academicLocked && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dados acadêmicos não podem ser alterados após emissão da carteirinha. Contate o suporte para ajustes.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="p-6 space-y-8">
              {/* Change Email */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Trocar Email
                </h3>
                <div>
                  <Label>Email Atual</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                </div>
                <div>
                  <Label htmlFor="newEmail">Novo Email *</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={securityForm.newEmail}
                    onChange={(e) => setSecurityForm(prev => ({ ...prev, newEmail: e.target.value }))}
                    placeholder="novo@email.com"
                    maxLength={100}
                  />
                  <span className="text-xs text-muted-foreground block text-right mt-1">{securityForm.newEmail.length}/100</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <Label htmlFor="currentPasswordForEmail">Senha Atual *</Label>
                    <div className="relative">
                      <Input
                        id="currentPasswordForEmail"
                        type={showCurrentPasswordEmail ? 'text' : 'password'}
                        value={securityForm.currentPasswordForEmail}
                        onChange={(e) => setSecurityForm(prev => ({ ...prev, currentPasswordForEmail: e.target.value }))}
                        placeholder="Digite sua senha"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPasswordEmail(!showCurrentPasswordEmail)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPasswordEmail ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Para sua segurança, confirme sua senha
                    </p>
                  </div>
                  <div>
                    <Button 
                      onClick={changeEmail} 
                      disabled={changingEmail || !securityForm.currentPasswordForEmail || !securityForm.newEmail} 
                      variant="outline"
                      className="w-full h-10"
                    >
                      {changingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Solicitar Troca de Email
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Clique para solicitar a troca
                    </p>
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 p-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Esta alteração só será realizada após você clicar no link do email de confirmação.</span>
                </div>
              </div>

              <hr className="border-border" />

              {/* Change Password */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Trocar Senha
                </h3>
                <div>
                  <Label htmlFor="currentPasswordForPassword">Senha Atual *</Label>
                  <div className="relative">
                    <Input
                      id="currentPasswordForPassword"
                      type={showCurrentPasswordChange ? 'text' : 'password'}
                      value={securityForm.currentPasswordForPassword}
                      onChange={(e) => setSecurityForm(prev => ({ ...prev, currentPasswordForPassword: e.target.value }))}
                      placeholder="Digite sua senha atual"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPasswordChange(!showCurrentPasswordChange)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrentPasswordChange ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para sua segurança, confirme sua senha antes de alterá-la
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newPassword">Nova Senha *</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        maxLength={20}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Mínimo 6 caracteres</span>
                      <span>{securityForm.newPassword.length}/20</span>
                    </div>
                    <PasswordStrengthIndicator password={securityForm.newPassword} />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={securityForm.confirmPassword}
                        onChange={(e) => setSecurityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Repita a nova senha"
                        minLength={6}
                        maxLength={20}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Deve coincidir</span>
                      <span>{securityForm.confirmPassword.length}/20</span>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={changePassword} 
                  disabled={changingPassword || !securityForm.currentPasswordForPassword || !securityForm.newPassword || !securityForm.confirmPassword} 
                  variant="outline"
                >
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Alterar Senha
                </Button>
              </div>

              <hr className="border-border" />

              {/* Delete Account */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Excluir Conta
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Minha Conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">Tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          <p>Esta ação não pode ser desfeita. Isso irá excluir permanentemente:</p>
                          <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                            <li>Seu perfil e dados pessoais</li>
                            <li>Documentos enviados</li>
                            <li>Histórico de pagamentos</li>
                            <li>Sua carteirinha (se houver)</li>
                          </ul>
                          <p className="mt-4 font-semibold">Digite DELETE para confirmar:</p>
                          <Input
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="DELETE"
                            className="mt-2"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={deleteAccount}
                        disabled={deletingAccount || deleteConfirmation !== 'DELETE'}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirmar Exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="p-6 space-y-6">
              {/* Card Status */}
              <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Status da Carteirinha
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {card ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={card.status === 'active' ? 'default' : 'secondary'}
                          className={card.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}
                        >
                          {card.status === 'active' ? 'Ativa' : 'Pendente'}
                        </Badge>
                        {card.status === 'active' && card.issued_at && (
                          <span className="text-xs text-muted-foreground">
                            ativada em {formatDate(card.issued_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Número:</strong> {card.card_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Validade:</strong> {formatDate(card.valid_until)}
                      </p>
                      {plan && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Plano:</strong> {plan.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma carteirinha emitida</p>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos Enviados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {documents.length > 0 ? (
                    <div className="space-y-3">
                      {documents.map(doc => {
                        const label = documentTypeLabels[doc.type] || doc.type;
                        const approvedDate = doc.validated_at || doc.created_at;
                        const isImage = doc.mime_type?.startsWith('image/');
                        const thumbUrl = docThumbnails[doc.id];
                        return (
                          <div
                            key={doc.id}
                            className="grid grid-cols-[1fr,auto] items-center gap-3 py-2 border-b border-border last:border-0"
                          >
                            <div>
                              <p className="text-sm font-medium">{label}</p>
                              {doc.status === 'approved' ? (
                                <Badge className="mt-1 bg-blue-500 text-white text-[11px] font-medium px-2 py-0.5">
                                  Aprovado em {formatDate(approvedDate)}
                                </Badge>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {doc.status === 'pending'
                                    ? `Em análise desde ${formatDate(doc.created_at)}`
                                    : `Rejeitado em ${formatDate(doc.created_at)}`}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center">
                              {isImage && thumbUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openDocumentPreview(doc)}
                                  className="border border-border rounded-md overflow-hidden w-16 h-16 flex items-center justify-center bg-muted/40 hover:bg-muted transition-colors"
                                >
                                  <img
                                    src={thumbUrl}
                                    alt={label}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ) : (
                                <div className="w-16 h-16 flex items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                                  <FileText className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum documento enviado</p>
                  )}
                </CardContent>
              </Card>

              {/* Payments */}
              <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 shadow-lg shadow-black/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length > 0 ? (
                    <div className="space-y-3">
                      {payments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="text-sm font-medium">
                              {formatCurrency(payment.amount)}{" "}
                              <span className="text-xs text-muted-foreground">
                                •{" "}
                                {getPaymentVariantLabel(payment, profile)}{" "}
                                •{" "}
                                {payment.payment_method === 'pix'
                                  ? 'PIX'
                                  : payment.payment_method === 'credit_card'
                                  ? 'Cartão de crédito'
                                  : 'Cartão de débito'}
                              </span>
                            </p>
                            {payment.status === 'approved' ? (
                              <Badge className="mt-1 bg-blue-500 text-white text-[11px] font-medium px-2 py-0.5">
                                Aprovado em {formatDate(payment.created_at)}
                              </Badge>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                {payment.status === 'pending'
                                  ? `Pendente desde ${formatDate(payment.created_at)}`
                                  : `Rejeitado em ${formatDate(payment.created_at)}`}
                              </p>
                            )}
                          </div>
                          <div className="hidden sm:block">
                            <Badge variant={payment.status === 'approved' ? 'default' : payment.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {payment.status === 'approved' ? 'Aprovado' : payment.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento realizado</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>

        {docPreview && (
          <Dialog open={!!docPreview} onOpenChange={(open) => !open && setDocPreview(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">{docPreview.title}</h2>
                <img
                  src={docPreview.url}
                  alt={docPreview.title}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
}
