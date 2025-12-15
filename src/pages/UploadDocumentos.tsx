import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft, 
  FileText, 
  GraduationCap, 
  Camera, 
  UserCircle, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  File
} from 'lucide-react';

type DocumentType = 'rg' | 'matricula' | 'foto' | 'selfie';

interface DocumentConfig {
  type: DocumentType;
  label: string;
  description: string;
  icon: React.ElementType;
  acceptedTypes: string[];
  maxSizeMB: number;
}

interface DocumentRecord {
  id: string;
  type: string;
  file_url: string;
  file_name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  mime_type: string;
}

interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  profile_completed: boolean;
}

const documentConfigs: DocumentConfig[] = [
  {
    type: 'rg',
    label: 'RG ou CNH',
    description: 'Frente e verso do documento',
    icon: FileText,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 5
  },
  {
    type: 'matricula',
    label: 'Comprovante de Matrícula',
    description: 'Documento oficial da instituição',
    icon: GraduationCap,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 5
  },
  {
    type: 'foto',
    label: 'Foto 3x4',
    description: 'Fundo branco ou azul, sem óculos',
    icon: Camera,
    acceptedTypes: ['image/jpeg', 'image/png'],
    maxSizeMB: 2
  },
  {
    type: 'selfie',
    label: 'Selfie com Documento',
    description: 'Segure seu RG/CNH ao lado do rosto',
    icon: UserCircle,
    acceptedTypes: ['image/jpeg', 'image/png'],
    maxSizeMB: 2
  }
];

export default function UploadDocumentos() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [documents, setDocuments] = useState<Record<string, DocumentRecord>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Buscar perfil
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Buscar documentos quando tiver perfil
  useEffect(() => {
    if (profile) {
      fetchDocuments();
    }
  }, [profile]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (error) {
      toast.error('Erro ao carregar perfil');
      setLoadingProfile(false);
      return;
    }
    
    setProfile(data);
    setLoadingProfile(false);
  };

  const fetchDocuments = async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', profile.id);
      
    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return;
    }
    
    // Organizar por tipo e gerar previews
    const docsMap: Record<string, DocumentRecord> = {};
    const newPreviews: Record<string, string> = {};
    
    for (const doc of data || []) {
      docsMap[doc.type] = doc as DocumentRecord;
      
      // Gerar signed URL para preview de imagens
      if (doc.mime_type?.startsWith('image/')) {
        const { data: signedData } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.file_url, 3600);
          
        if (signedData) {
          newPreviews[doc.type] = signedData.signedUrl;
        }
      }
    }
    
    setDocuments(docsMap);
    setPreviews(newPreviews);
  };

  const handleUpload = async (file: File, type: DocumentType) => {
    console.log('═══════════════════════════════════');
    console.log('🚀 INICIANDO UPLOAD');
    console.log('═══════════════════════════════════');
    console.log('📁 Arquivo:', file.name, '| Tamanho:', file.size);
    console.log('📋 Tipo:', type);
    console.log('👤 User ID (auth.uid):', user?.id);
    console.log('📝 Profile ID (student_profiles.id):', profile?.id);
    console.log('═══════════════════════════════════');
    
    if (!profile?.id || !user?.id) {
      console.error('❌ ERRO: profile.id ou user.id não existe!');
      toast.error('Perfil não carregado. Recarregue a página.');
      return;
    }
    
    const config = documentConfigs.find(d => d.type === type);
    if (!config) {
      console.log('❌ Config não encontrada para tipo:', type);
      toast.error('Tipo de documento inválido');
      return;
    }
    
    // Toast de loading
    const toastId = `upload-${type}`;
    toast.loading(`Enviando ${config.label}...`, { id: toastId });
    
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));
      
      // Validações
      console.log('📝 Validando arquivo...');
      if (file.size > config.maxSizeMB * 1024 * 1024) {
        throw new Error(`Arquivo maior que ${config.maxSizeMB}MB`);
      }
      if (!config.acceptedTypes.includes(file.type)) {
        throw new Error('Tipo de arquivo não aceito');
      }
      console.log('✅ Validação OK');
      
      // Simular progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [type]: Math.min((prev[type] || 0) + 20, 90)
        }));
      }, 200);
      
      // Path usando USER.ID para satisfazer RLS policy do storage
      // A policy verifica: (storage.foldername(name))[1] = (auth.uid())::text
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${type}/${Date.now()}.${ext}`;
      console.log('📤 Storage path:', filePath);
      console.log('   └─ Primeiro folder (user.id):', user.id);
      
      // Upload para Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });
        
      if (storageError) {
        console.error('❌ Erro storage:', storageError);
        throw storageError;
      }
      console.log('✅ Storage OK');
      
      // Verificar se já existe documento deste tipo para este estudante
      console.log('💾 Verificando documento existente...');
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('student_id', profile.id)
        .eq('type', type as any)
        .maybeSingle();
      
      if (existingDoc) {
        console.log('📝 Atualizando documento existente:', existingDoc.id);
        const { error: dbError } = await supabase
          .from('documents')
          .update({
            file_url: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            status: 'pending'
          })
          .eq('id', existingDoc.id);
          
        if (dbError) {
          console.error('❌ Erro banco (update):', dbError);
          throw dbError;
        }
      } else {
        console.log('📝 Inserindo novo documento');
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            student_id: profile.id,
            type: type as any,
            file_url: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            status: 'pending'
          });
          
        if (dbError) {
          console.error('❌ Erro banco (insert):', dbError);
          throw dbError;
        }
      }
      console.log('✅ Banco OK');
      
      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [type]: 100 }));
      
      toast.success(`${config.label} enviado com sucesso!`, { id: toastId });
      console.log('🎉 Upload completo!');
      await fetchDocuments();
      
    } catch (error: any) {
      console.error('❌ ERRO GERAL:', error);
      toast.error(error.message || 'Erro ao enviar documento', { id: toastId });
    } finally {
      console.log('🏁 Finalizando upload');
      setUploading(prev => ({ ...prev, [type]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [type]: 0 }));
      }, 1000);
    }
  };

  // Componente interno do Card de Documento
  const DocumentCard = ({ config }: { config: DocumentConfig }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    
    const doc = documents[config.type];
    const preview = previews[config.type];
    const isUploading = uploading[config.type];
    const progress = uploadProgress[config.type] || 0;
    const IconComponent = config.icon;
    
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📁 Drop detectado');
      const file = e.dataTransfer.files[0];
      if (file) {
        console.log('📁 Arquivo via drop:', file.name);
        handleUpload(file, config.type);
      }
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log('📁 Arquivo selecionado via input:', e.target.files);
      const file = e.target.files?.[0];
      if (file) {
        console.log('📁 Chamando handleUpload para:', file.name);
        handleUpload(file, config.type);
      }
      // Reset input para permitir reenvio do mesmo arquivo
      e.target.value = '';
    };
    
    const getStatusBadge = () => {
      if (!doc) {
        return (
          <Badge variant="secondary" className="bg-slate-700 text-slate-300">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      }
      switch (doc.status) {
        case 'pending':
          return (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
              <Clock className="w-3 h-3 mr-1" />
              Em análise
            </Badge>
          );
        case 'approved':
          return (
            <Badge className="bg-green-500/20 text-green-400">
              <CheckCircle className="w-3 h-3 mr-1" />
              Aprovado
            </Badge>
          );
        case 'rejected':
          return (
            <Badge variant="destructive" className="bg-red-500/20 text-red-400">
              <AlertCircle className="w-3 h-3 mr-1" />
              Rejeitado
            </Badge>
          );
        default:
          return null;
      }
    };
    
    return (
      <div 
        className={cn(
          "bg-slate-800/50 backdrop-blur-sm rounded-xl border-2 border-dashed p-6 transition-colors",
          doc ? "border-solid border-slate-700" : "border-slate-600 hover:border-cyan-500/50"
        )}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Header do card */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <IconComponent className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{config.label}</h3>
              <p className="text-sm text-slate-400">{config.description}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
        
        {/* Área de upload ou preview */}
        {isUploading ? (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-400 mt-2 text-center">
              Enviando... {progress}%
            </p>
          </div>
        ) : doc && preview ? (
          <div className="mt-4">
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full h-40 object-cover rounded-lg"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-slate-400 truncate flex-1">{doc.file_name}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                Trocar
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={config.acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : doc && !preview ? (
          <div className="mt-4">
            <div className="p-4 bg-slate-700/50 rounded-lg flex items-center gap-3">
              <File className="w-8 h-8 text-slate-400" />
              <p className="text-sm text-slate-300 truncate flex-1">{doc.file_name}</p>
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10"
              >
                Trocar
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={config.acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="mt-4">
            <input
              ref={inputRef}
              type="file"
              accept={config.acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button 
              onClick={() => inputRef.current?.click()}
              variant="outline"
              className="w-full border-dashed border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Escolher arquivo
            </Button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              {config.acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} 
              {' • '}Máx {config.maxSizeMB}MB
            </p>
          </div>
        )}
        
        {/* Motivo de rejeição */}
        {doc?.status === 'rejected' && doc.rejection_reason && (
          <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-300">
              {doc.rejection_reason}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const uploadedCount = Object.keys(documents).length;
  const allDocsUploaded = uploadedCount >= 4;

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="text-slate-400 mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl text-white font-bold">Perfil não encontrado</h1>
          <p className="text-slate-400 mt-2">Complete seu perfil antes de enviar documentos.</p>
          <Button 
            onClick={() => navigate('/complete-profile')} 
            className="mt-6 bg-cyan-500 hover:bg-cyan-600"
          >
            Completar Perfil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar ao Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Envie seus Documentos
          </h1>
          <p className="text-slate-400 mt-2">
            Passo 2 de 4 - Validação de documentos
          </p>
        </div>
        
        {/* Grid de cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {documentConfigs.map(config => (
            <DocumentCard key={config.type} config={config} />
          ))}
        </div>
        
        {/* Contador de progresso */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 mb-6 flex items-center justify-between">
          <span className="text-slate-300">
            Documentos enviados: <span className="text-cyan-500 font-semibold">{uploadedCount}</span> de 4
          </span>
          <Progress 
            value={(uploadedCount / 4) * 100} 
            className="w-32 h-2"
          />
        </div>
        
        {/* Botão continuar */}
        <Button
          disabled={!allDocsUploaded}
          onClick={() => navigate('/escolher-plano')}
          className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed py-6 text-lg"
        >
          {allDocsUploaded 
            ? 'Continuar para Escolha de Plano' 
            : `Envie todos os ${4 - uploadedCount} documentos restantes`
          }
        </Button>
      </div>
    </div>
  );
}
