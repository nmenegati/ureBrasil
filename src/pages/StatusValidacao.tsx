import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { 
  FileText, GraduationCap, Camera, UserCircle,
  Loader2, CheckCircle, XCircle, RefreshCw, Clock
} from 'lucide-react';
import carteirinhaDireitoImg1 from "@/assets/carteirinha-direito-pgto-1.jpg";
import carteirinhaDireitoImg2 from "@/assets/carteirinha-direito-pgto-2.jpg";
import carteirinhaGeralImg1 from "@/assets/carteirinha-geral-pagto-1.jpeg";
import carteirinhaGeralImg2 from "@/assets/carteirinha-geral-pagto-2.jpeg";

interface DocumentRecord {
  id: string;
  type: string;
  file_name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  rejection_notes?: string | null;
  created_at: string;
}

const documentConfigs = [
  { type: 'matricula', label: 'Comprovante de Matrícula', icon: GraduationCap },
  { type: 'rg', label: 'RG ou CNH', icon: FileText },
  { type: 'foto', label: 'Foto 3x4', icon: Camera },
  { type: 'selfie', label: 'Selfie com Documento', icon: UserCircle },
];

const DocCard = ({ doc, config }: { doc?: DocumentRecord; config: typeof documentConfigs[0] }) => {
  const Icon = config.icon;
  
  const getStatusBadge = () => {
    if (!doc) {
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          Não enviado
        </Badge>
      );
    }
    
    switch (doc.status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Aguardando validação...
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-lg shadow-black/5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white">{config.label}</h3>
          {doc && (
            <p className="text-sm text-slate-600 dark:text-slate-300 truncate mt-1">{doc.file_name}</p>
          )}
          <div className="mt-3">
            {getStatusBadge()}
          </div>
          {doc?.status === 'rejected' && (doc.rejection_reason || doc.rejection_notes) && (
            <Alert variant="destructive" className="mt-3 bg-red-500/10 border-red-500/30">
              <AlertDescription className="text-red-600 dark:text-red-300 text-sm">
                {doc.rejection_reason || doc.rejection_notes}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};

export default function StatusValidacao() {
  const { isChecking } = useOnboardingGuard('pending_validation');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLawStudentView, setIsLawStudentView] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const loadDocuments = useCallback(async (studentId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return;
    }

    setDocuments(data || []);
    setLoadingDocs(false);
    setRefreshing(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    const { data: profileData, error: profileError } = await supabase
      .from('student_profiles')
      .select('id, is_law_student, education_level')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      toast.error('Perfil não encontrado');
      navigate('/complete-profile');
      return;
    }

    setProfileId(profileData.id);

    const isLaw =
      profileData.is_law_student &&
      (profileData.education_level === 'graduacao' ||
        profileData.education_level === 'pos_lato' ||
        profileData.education_level === 'stricto_sensu');
    setIsLawStudentView(!!isLaw);
    setImageIndex(Math.floor(Math.random() * 2));
    await loadDocuments(profileData.id);
  }, [user?.id, navigate, loadDocuments]);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Carregar perfil e documentos
  useEffect(() => {
    if (isChecking) return;
    if (user) {
      loadData();
    }
  }, [user, loadData, isChecking]);

  // Polling a cada 5 segundos
  useEffect(() => {
    if (!profileId) return;
    if (isChecking) return;
    
    const interval = setInterval(() => {
      loadDocuments(profileId);
    }, 5000);

    return () => clearInterval(interval);
  }, [profileId, loadDocuments, isChecking]);

  const handleRefresh = async () => {
    if (!profileId) return;
    setRefreshing(true);
    await loadDocuments(profileId);
    toast.success('Status atualizado!');
  };

  const hasRejected = documents.some(d => d.status === 'rejected');
  const allPending = documents.length > 0 && documents.every(d => d.status === 'pending');

  const direitoImages = [carteirinhaDireitoImg1, carteirinhaDireitoImg2];
  const geralImages = [carteirinhaGeralImg1, carteirinhaGeralImg2];
  const images = isLawStudentView ? direitoImages : geralImages;
  const imagemCarteirinha = images[imageIndex] || images[0];

  if (authLoading || isChecking || loadingDocs) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      
      <main className="container mx-auto px-4 pt-4 pb-8 max-w-2xl">
        <div className="mb-4">
          <ProgressBar currentStep="card" />
        </div>
        <div>
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
              {documents.length === 4 && documents.every(d => d.status === 'approved') ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : allPending ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : hasRejected ? (
                <XCircle className="w-8 h-8 text-red-500" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-500" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 items-center">
            <div className="col-span-3 text-center">
              <h1 className="text-2xl font-bold text-foreground">
                {documents.length === 4 && documents.every(d => d.status === 'approved')
                  ? 'Documentos aprovados! Tudo pronto para gerar sua carteirinha. 🤩'
                  : hasRejected 
                    ? 'Documentos precisam de correção' 
                    : 'Estamos analisando seus documentos'
                }
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {documents.length === 4 && documents.every(d => d.status === 'approved')
                  ? 'Você está a um passo de ter sua carteirinha '
                  : hasRejected 
                    ? 'Veja abaixo quais documentos precisam ser reenviados.'
                    : 'Normalmente esse processo leva apenas alguns minutos.'
                }
              </p>
            </div>
            <div className="col-span-1 lg:justify-self-center">
              <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl border border-white/20 p-1.5 shadow-lg shadow-black/5 flex items-center justify-center w-full lg:w-[180px] mx-auto">
                <img
                  src={imagemCarteirinha}
                  alt="Modelo da carteirinha"
                  className="rounded-lg shadow-md w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {hasRejected && (
          <Alert className="mb-6 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-600 dark:text-red-300">
              Alguns documentos foram rejeitados. Corrija-os e envie novamente.
            </AlertDescription>
          </Alert>
        )}

        {allPending && documents.length > 0 && (
          <Alert className="mb-6 bg-primary/10 border-primary/30">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <AlertDescription className="text-primary">
              Validação em andamento... A página atualiza automaticamente a cada 5 segundos.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          {documentConfigs.map(config => {
            const doc = documents.find(d => d.type === config.type);
            return <DocCard key={config.type} config={config} doc={doc} />;
          })}
        </div>

        {allPending && (
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">
              ⏱️ Tempo estimado: 2 a 5 minutos
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              A página atualiza automaticamente a cada 5 segundos
            </p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar Status
          </Button>
          
          {hasRejected && (
            <Button
              onClick={() => navigate('/upload-documentos')}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Corrigir Documentos
            </Button>
          )}
          
          {documents.length === 4 && documents.every(d => d.status === 'approved') && (
            <Button
              onClick={async () => {
                if (profileId) {
                  const { error } = await supabase
                    .from('student_profiles')
                    .update({ current_onboarding_step: 'review_data' })
                    .eq('id', profileId);
                  if (error) {
                    console.error('Erro ao atualizar current_onboarding_step para review_data:', error);
                  }
                }
                navigate('/gerar-carteirinha');
              }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              Conferir dados e gerar carteirinha →
            </Button>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
