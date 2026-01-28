import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompression';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ProgressBar';
import { 
  FileText, 
  GraduationCap, 
  Camera, 
  UserCircle, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  File,
  ChevronDown,
  Shield,
  Smartphone,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CameraCapture } from '@/components/CameraCapture';

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
  cpf: string;
  profile_completed: boolean;
  is_law_student?: boolean;
  education_level?: string;
  face_validated?: boolean;
  face_validation_attempts?: number;
  manual_review_requested?: boolean;
  institution?: string | null;
  course?: string | null;
  period?: string | null;
  enrollment_number?: string | null;
  birth_date?: string | null;
}

const documentConfigs: DocumentConfig[] = [
  {
    type: 'matricula',
    label: 'Comprovante de Matrícula',
    description: 'Envie Declaração, Comprovante de Matrícula ou Boleto recente.',
    icon: GraduationCap,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 5
  },
  {
    type: 'rg',
    label: 'Documento de Identidade',
    description: 'Envie RG/CIN, CNH ou Passaporte. Fotos nítidas da frente e do verso.',
    icon: FileText,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 5
  },
  {
    type: 'foto',
    label: 'Foto 3x4',
    description: 'Envie foto 3x4 com fundo neutro, sem óculos e com boa iluminação.',
    icon: Camera,
    acceptedTypes: ['image/jpeg', 'image/png'],
    maxSizeMB: 5
  },
  {
    type: 'selfie',
    label: 'Selfie do Rosto',
    description: 'Tire uma selfie com boa iluminação, olhando para a câmera para validar sua identidade.',
    icon: UserCircle,
    acceptedTypes: ['image/jpeg', 'image/png'],
    maxSizeMB: 5
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
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAlreadyAccepted, setTermsAlreadyAccepted] = useState(false);
  const [termsAcceptedDate, setTermsAcceptedDate] = useState<string | null>(null);
  const [termsVersion, setTermsVersion] = useState<string>('');
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(true);

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

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasCameraSupport(false);
    }
  }, []);

  // Verificar se já aceitou os termos
  useEffect(() => {
    const checkTerms = async () => {
      if (!profile?.id) return;
      
      const { data } = await supabase
        .from('student_profiles')
        .select('terms_accepted, terms_accepted_at, terms_version')
        .eq('id', profile.id)
        .maybeSingle();
      
      if (data?.terms_accepted) {
        setTermsAccepted(true);
        setTermsAlreadyAccepted(true);
        setTermsAcceptedDate(data.terms_accepted_at);
        setTermsVersion(data.terms_version || '1.0');
      }
    };
    
    checkTerms();
  }, [profile]);

  useEffect(() => {
    const checkIfLocked = async () => {
      if (!profile?.id) return;
      const { data: card } = await supabase
        .from('student_cards')
        .select('status')
        .eq('student_id', profile.id)
        .maybeSingle();
      if (card?.status === 'active') {
        toast.error('Documentos não podem ser alterados com carteirinha ativa. Entre em contato com suporte.');
      }
    };
    checkIfLocked();
  }, [profile?.id, navigate]);

  const fetchProfile = useCallback(async () => {
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
  }, [user]);

  const fetchDocuments = useCallback(async () => {
    if (!profile) return;
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', profile.id);
      
    if (error) {
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
  }, [profile]);

  const handleUpload = async (file: File, type: DocumentType) => {
    if (!profile?.id || !user?.id) {
      toast.error('Perfil não carregado. Recarregue a página.');
      return;
    }
    
    let documentIdForValidation: string | null = null;
    
    // BLOQUEIO: Foto 3x4 não pode ser alterada se carteirinha ativa
    if (type === 'foto') {
      const { data: card } = await supabase
        .from('student_cards')
        .select('status')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (card?.status === 'active') {
        toast.error('Foto não pode ser alterada após emissão da carteirinha. Entre em contato com suporte.');
        return;
      }
    }
    
    const config = documentConfigs.find(d => d.type === type);
    if (!config) {
      toast.error('Tipo de documento inválido');
      return;
    }
    
    // Toast de loading
    const toastId = `upload-${type}`;
    toast.loading(`Enviando ${config.label}...`, { id: toastId });
    
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));

      let fileToUpload = file;
      if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
        toast.info('Otimizando imagem...');
        const isDocument = type === 'rg' || type === 'matricula';
        const maxSize = isDocument ? 2400 : 1920;
        const quality = isDocument ? 0.9 : 0.8;
        fileToUpload = await compressImage(file, maxSize, maxSize, quality);
      }
      
      // Validações
      if (fileToUpload.size > config.maxSizeMB * 1024 * 1024) {
        throw new Error(`Arquivo maior que ${config.maxSizeMB}MB`);
      }
      if (!config.acceptedTypes.includes(fileToUpload.type)) {
        throw new Error('Tipo de arquivo não aceito');
      }
      
      // Simular progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [type]: Math.min((prev[type] || 0) + 20, 90)
        }));
      }, 200);
      
      // Path usando USER.ID para satisfazer RLS policy do storage
      // A policy verifica: (storage.foldername(name))[1] = (auth.uid())::text
      const ext = fileToUpload.name.split('.').pop();
      const filePath = `${user.id}/${type}/${Date.now()}.${ext}`;
      
      // Upload para Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, fileToUpload, { upsert: true });
        
      if (storageError) {
        throw storageError;
      }
      
      // Verificar se já existe documento deste tipo para este estudante
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('student_id', profile.id)
        .eq('type', type)
        .maybeSingle();
      
      if (existingDoc) {
        const { error: dbError } = await supabase
          .from('documents')
          .update({
            file_url: filePath,
            file_name: fileToUpload.name,
            file_size: fileToUpload.size,
            mime_type: fileToUpload.type,
            status: 'pending',
            // Limpar campos de rejeição ao reenviar
            rejection_reason: null,
            rejection_notes: null,
            rejection_reason_id: null,
            validated_at: null,
            validated_by: null
          })
          .eq('id', existingDoc.id);
          
        if (dbError) {
          throw dbError;
        }
        
        documentIdForValidation = existingDoc.id;
      } else {
        const { data: newDoc, error: dbError } = await supabase
          .from('documents')
          .insert({
            student_id: profile.id,
            type: type,
            file_url: filePath,
            file_name: fileToUpload.name,
            file_size: fileToUpload.size,
            mime_type: fileToUpload.type,
            status: 'pending'
          })
          .select('id')
          .single();
          
        if (dbError) {
          throw dbError;
        }
        
        documentIdForValidation = newDoc.id;
      }
      
      // Chamar validação automática
      if (documentIdForValidation) {
        try {
          console.log('🔄 Iniciando validação:', {
            documentId: documentIdForValidation,
            studentId: profile.id,
            type,
            filePath
          });

          const { data, error } = await supabase.functions.invoke('validate-document-v2', {
            body: {
              document_id: documentIdForValidation,
              student_id: profile.id,
              type,
              file_url: filePath
            }
          });

          console.log('📦 Resposta validação:', { data, error });

          if (error) {
            console.error('❌ Erro na validação:', error);
          } else {
            console.log('✅ Validação iniciada com sucesso');
          }
        } catch (validationError) {
          console.error('💥 Exception validação:', validationError);
        }
      }
      
      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [type]: 100 }));
      
      toast.success(`${config.label} enviado com sucesso!`, { id: toastId });
      await fetchDocuments();
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar documento';
      toast.error(message, { id: toastId });
    } finally {
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
    const status = doc?.status;
    const isSelfie = config.type === 'selfie';
    
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file, config.type);
      }
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file, config.type);
      }
      // Reset input para permitir reenvio do mesmo arquivo
      e.target.value = '';
    };
    
    const getStatusBadge = () => {
      if (!doc) {
        return (
          <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      }
      switch (doc.status) {
        case 'pending':
          return (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
              <Clock className="w-3 h-3 mr-1" />
              Em análise
            </Badge>
          );
        case 'approved':
          return (
            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400">
              <CheckCircle className="w-3 h-3 mr-1" />
              Aprovado
            </Badge>
          );
        case 'rejected':
          return (
            <Badge variant="destructive" className="bg-red-500/20 text-red-600 dark:text-red-400">
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
          "bg-sky-900/15 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl border-2 border-dashed p-6 transition-colors shadow-lg shadow-black/5",
          doc
            ? "border-solid border-slate-200 dark:border-slate-600"
            : "border-slate-300 dark:border-slate-600 hover:border-primary/50"
        )}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Header do card */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <IconComponent className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {config.label}
                {status === 'approved' && (
                  <span className="ml-2 text-xs font-semibold text-green-600 dark:text-green-400">
                    ✓ Aprovado
                  </span>
                )}
              </h3>
              {status !== 'approved' && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {config.description}
                </p>
              )}
            </div>
          </div>
          {getStatusBadge()}
        </div>
        
        {/* Área de upload ou preview */}
        {isUploading ? (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 text-center">
              Enviando... {progress}%
            </p>
          </div>
        ) : doc && preview ? (
          <div className="mt-4">
            <img 
              src={preview} 
              alt="Preview" 
              className={cn(
                "object-cover rounded-lg mx-auto",
                status === 'approved' ? "w-28 h-20" : "w-full h-40"
              )}
            />
            <div
              className={cn(
                "mt-2 flex items-center",
                status === 'approved' ? "justify-center" : "justify-between"
              )}
            >
              <p
                className={cn(
                  "text-sm text-slate-600 dark:text-slate-300 truncate",
                  status === 'approved' ? "text-center" : "flex-1"
                )}
              >
                {doc.file_name}
              </p>
              {status !== 'approved' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  className="text-primary hover:text-primary/80 hover:bg-primary/10"
                >
                  Trocar
                </Button>
              )}
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
            <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg flex items-center gap-3">
              <File className="w-8 h-8 text-slate-500 dark:text-slate-400" />
              <p className="text-sm text-slate-900 dark:text-white truncate flex-1">{doc.file_name}</p>
            </div>
            {status !== 'approved' && (
              <div className="flex justify-end mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  className="text-primary hover:text-primary/80 hover:bg-primary/10"
                >
                  Trocar
                </Button>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={config.acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {isSelfie ? (
              <>
                <Button
                  onClick={() => setShowCamera(true)}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Tirar Selfie Agora
                </Button>
                {!hasCameraSupport && !doc && !preview && (
                  <Alert className="mt-3 bg-blue-50 border-blue-200">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm">
                      <p className="font-semibold mb-2">
                        Câmera não disponível neste dispositivo
                      </p>
                      <p className="mb-3">
                        Para sua segurança, a selfie deve ser tirada ao vivo pela câmera.
                      </p>
                      <p className="text-xs text-gray-600">
                        📱 Acesse esta página pelo smartphone para continuar.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div>
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
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Escolher arquivo
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                  {config.acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} 
                  {' • '}Máx {config.maxSizeMB}MB
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Motivo de rejeição */}
        {doc?.status === 'rejected' && doc.rejection_reason && (
          <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-600 dark:text-red-300">
              {doc.rejection_reason}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Botão destacado para reenviar documento rejeitado */}
        {doc?.status === 'rejected' && (
          <Button 
            onClick={() => inputRef.current?.click()}
            className="w-full mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-500/30"
          >
            <Upload className="w-4 h-4 mr-2" />
            Enviar Novo Documento
          </Button>
        )}
      </div>
    );
  };

  const uploadedCount = Object.keys(documents).length;
  const allDocsUploaded = uploadedCount >= 4;
  const allDocsApproved = documentConfigs.every((config) => {
    const doc = documents[config.type];
    return doc && doc.status === "approved";
  });

  const termsOk = termsAccepted || termsAlreadyAccepted;
  const faceOk = !!profile?.face_validated;
  const canGenerateCard = allDocsApproved && faceOk && termsOk;

  const canSubmit =
    allDocsUploaded &&
    allDocsApproved &&
    termsOk;

  const handleSubmit = async () => {
    if (!termsAccepted && !termsAlreadyAccepted) {
      toast.error('Você precisa aceitar a declaração de veracidade');
      return;
    }

    // Se já aceitou antes, só redireciona
    if (termsAlreadyAccepted) {
      navigate('/status-validacao');
      return;
    }

    try {
      // Pegar IP do usuário
      let ip = 'unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ip = ipData.ip;
      } catch (e) {
        // Silently ignore IP fetch error
      }

      // Salvar aceitação dos termos no banco
      const { error } = await supabase
        .from('student_profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_ip_address: ip,
          terms_version: '1.0'
        })
        .eq('id', profile!.id);

      if (error) {
        toast.error('Erro ao salvar aceitação do termo');
        return;
      }

      toast.success('Termo aceito com sucesso!');
      navigate('/status-validacao');
      
    } catch (error) {
      toast.error('Erro ao processar. Tente novamente.');
    }
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl text-foreground font-bold">Perfil não encontrado</h1>
          <p className="text-muted-foreground mt-2">Complete seu perfil antes de enviar documentos.</p>
          <Button 
            onClick={() => navigate('/complete-profile')} 
            className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Completar Perfil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="relative z-10 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ProgressBar currentStep="documents" />
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Vamos Preparar Sua Carteirinha URE
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Envie seus documentos para aprovação. O processo é rápido e seguro.
              <br />
              <span className="text-xs md:text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1 mt-2">
                <CheckCircle className="w-4 h-4" /> Seus dados estão protegidos pela LGPD
              </span>
            </p>
          </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 max-w-md sm:max-w-none mx-auto">
          {documentConfigs.map(config => (
            <DocumentCard key={config.type} config={config} />
          ))}
        </div>

        <Alert className="bg-blue-50 border-blue-200 py-2 mb-6">
          <AlertDescription className="text-sm text-gray-700 flex items-center gap-2">
            <span>🔍</span>
            <span>Validação facial após aprovação da documentação. Acompanhe o status na página de validação.</span>
          </AlertDescription>
        </Alert>

        {allDocsUploaded && !termsAlreadyAccepted && (
          <div className="mb-6 max-w-2xl mx-auto">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
                Declaro que li e concordo com o{' '}
                <button
                  type="button"
                  onClick={() => setShowFullTerms(true)}
                  className="text-blue-600 hover:underline"
                >
                  Termo de Responsabilidade
                </button>
                . Os documentos fornecidos são verdadeiros e de minha responsabilidade.
              </label>
            </div>

            <Dialog open={showFullTerms} onOpenChange={setShowFullTerms}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <h2 className="text-lg font-semibold text-foreground">
                    Termo de Responsabilidade por Veracidade dos Documentos
                  </h2>
                  <p>
                    Eu, <strong className="text-slate-900 dark:text-white">{profile?.full_name}</strong>, portador(a) do CPF nº
                    <strong className="text-slate-900 dark:text-white"> {profile?.cpf}</strong>, DECLARO sob as penas da lei que:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>
                      Os documentos enviados (RG/CNH, comprovante de matrícula e 
                      fotografias) são <strong className="text-slate-900 dark:text-white">VERDADEIROS, AUTÊNTICOS</strong> e 
                      de minha <strong className="text-slate-900 dark:text-white">TITULARIDADE</strong>.
                    </li>
                    <li>
                      Sou o <strong className="text-slate-900 dark:text-white">ÚNICO RESPONSÁVEL</strong> pela veracidade das 
                      informações fornecidas, <strong className="text-slate-900 dark:text-white">ISENTANDO a URE BRASIL</strong> de 
                      qualquer responsabilidade civil ou criminal decorrente de 
                      falsificação ou adulteração.
                    </li>
                    <li>
                      Estou <strong className="text-slate-900 dark:text-white">CIENTE</strong> de que a falsificação de documentos 
                      constitui <strong className="text-slate-900 dark:text-white">CRIME</strong> previsto nos Artigos 297, 298 e 
                      299 do Código Penal Brasileiro (reclusão de 1 a 5 anos e multa).
                    </li>
                    <li>
                      Em caso de <strong className="text-slate-900 dark:text-white">FALSIDADE</strong> comprovada, meu cadastro será
                      <strong className="text-slate-900 dark:text-white"> CANCELADO</strong> imediatamente, sem direito a reembolso, 
                      e o caso será comunicado às autoridades competentes.
                    </li>
                  </ol>
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400">
                    <p>Data: {new Date().toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {allDocsUploaded && termsAlreadyAccepted && !canGenerateCard && (
          <div className="mb-6 max-w-2xl mx-auto bg-green-500/20 dark:bg-green-500/15 border border-green-500/50 rounded-xl px-4 py-3 shadow-md">
            <p className="text-sm text-green-900 dark:text-green-200">
              ✅ Você já aceitou o Termo de Responsabilidade
              <br />
              <span className="text-xs text-green-800/80 dark:text-green-300/80">
                Data: {termsAcceptedDate ? new Date(termsAcceptedDate).toLocaleString('pt-BR') : 'N/A'} • Versão: {termsVersion || '1.0'}
              </span>
            </p>
          </div>
        )}

        {canGenerateCard && (
          <>
            <Alert className="mb-4 max-w-2xl mx-auto bg-green-500/20 border-green-500/50">
              <AlertDescription className="text-sm text-slate-800">
                Documentos, validação facial e Termo de Tesponsabilidade aprovados.
                Você já aceitou o Termo em{' '}
                {termsAcceptedDate
                  ? new Date(termsAcceptedDate).toLocaleString('pt-BR')
                  : 'data não disponível'}
                {` • Versão: ${termsVersion || '1.0'}.`}
              </AlertDescription>
            </Alert>
            <Button
              className="w-full max-w-2xl mx-auto block"
              onClick={() => navigate('/gerar-carteirinha')}
            >
              Ir para revisão e geração da carteirinha
            </Button>
          </>
        )}

        {!canGenerateCard && (
          <Button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed py-6 text-lg"
          >
            {termsAlreadyAccepted ? 'Ver status da validação' : 'Aceitar termo e enviar para validação'}
          </Button>
        )}
        {showCamera && (
          <CameraCapture
            onCapture={(file) => {
              handleUpload(file, 'selfie');
              setShowCamera(false);
            }}
            onCancel={() => {
              setShowCamera(false);
            }}
          />
        )}
        </div>
      </main>
    </div>
  );
}
