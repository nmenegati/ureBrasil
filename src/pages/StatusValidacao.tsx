import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import { 
  FileText, GraduationCap, Camera, UserCircle,
  Loader2, CheckCircle, XCircle, RefreshCw, Clock
} from 'lucide-react';

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
  { type: 'rg', label: 'RG ou CNH', icon: FileText },
  { type: 'matricula', label: 'Comprovante de Matrícula', icon: GraduationCap },
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

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
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      toast.error('Perfil não encontrado');
      navigate('/complete-profile');
      return;
    }

    setProfileId(profileData.id);
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
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Polling a cada 5 segundos
  useEffect(() => {
    if (!profileId) return;
    
    const interval = setInterval(() => {
      loadDocuments(profileId);
    }, 5000);

    return () => clearInterval(interval);
  }, [profileId, loadDocuments]);

  // Verificar se todos foram processados
  useEffect(() => {
    if (documents.length < 4) return;
    
    const allProcessed = documents.every(d => 
      d.status === 'approved' || d.status === 'rejected'
    );
    
    if (allProcessed) {
      const allApproved = documents.every(d => d.status === 'approved');
      
      if (allApproved) {
        toast.success('Todos os documentos foram aprovados! 🎉');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else if (documents.some(d => d.status === 'rejected')) {
        toast.error('Alguns documentos precisam ser corrigidos');
      }
    }
  }, [documents, navigate]);

  const handleRefresh = async () => {
    if (!profileId) return;
    setRefreshing(true);
    await loadDocuments(profileId);
    toast.success('Status atualizado!');
  };

  const hasRejected = documents.some(d => d.status === 'rejected');
  const allPending = documents.length > 0 && documents.every(d => d.status === 'pending');

  if (authLoading || loadingDocs) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <Header variant="app" />
      
      <main className="relative z-10 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">

        {/* Título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            {allPending ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : hasRejected ? (
              <XCircle className="w-8 h-8 text-red-300" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-300" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {hasRejected ? 'Documentos Precisam de Correção' : 'Validando seus Documentos'}
          </h1>
          <p className="text-white/80 mt-2">
            {hasRejected 
              ? 'Alguns documentos foram rejeitados. Veja os motivos abaixo.'
              : 'Aguarde enquanto analisamos seus documentos'
            }
          </p>
        </div>

        {/* Status Alerts */}
        {documents.length === 4 && documents.every(d => d.status === 'approved') && (
          <Alert className="mb-6 bg-green-500/10 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-600 dark:text-green-300">
              Todos os documentos foram aprovados! Redirecionando para o painel...
            </AlertDescription>
          </Alert>
        )}

        {hasRejected && (
          <Alert className="mb-6 bg-red-500/10 border-red-500/30">
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

        {/* Cards de Documentos */}
        <div className="space-y-4 mb-8">
          {documentConfigs.map(config => {
            const doc = documents.find(d => d.type === config.type);
            return <DocCard key={config.type} config={config} doc={doc} />;
          })}
        </div>

        {/* Info de tempo */}
        {allPending && (
          <div className="text-center mb-6">
            <p className="text-white/80 text-sm">
              ⏱️ Tempo estimado: 2 a 5 minutos
            </p>
            <p className="text-white/60 text-xs mt-1">
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
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              Ir para o Painel →
            </Button>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}