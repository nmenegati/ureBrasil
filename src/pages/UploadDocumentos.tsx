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
import { ProgressBar } from '@/components/ProgressBar';
import { 
  FileText, 
  GraduationCap, 
  Camera, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  File as FileIcon,
  Smartphone,
  CreditCard,
  User,
  SquareUserRound,
  MessageCircle,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CameraCapture } from '@/components/CameraCapture';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { useFaceValidation } from '@/hooks/useFaceValidation';
import { SupportModal } from '@/components/SupportModal';

type DocumentType = 'rg' | 'matricula' | 'foto' | 'selfie';

interface DocumentConfig {
  type: DocumentType;
  label: string;
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

interface DocumentCardProps {
  config: DocumentConfig;
  doc: DocumentRecord | undefined;
  preview: string | undefined;
  isUploading: boolean;
  progress: number;
  hasCameraSupport: boolean;
  onUpload: (file: File, type: DocumentType) => void;
  onOpenCamera: () => void;
  isRgMissingSide?: boolean;
  onAddSecondSide?: (file: File) => void;
}

function isRejectedForMissingSide(rejectionReason: string | null | undefined): boolean {
  if (!rejectionReason) return false;
  const lower = rejectionReason.toLowerCase();
  return (
    lower.includes('verso') ||
    lower.includes('frente') ||
    lower.includes('um lado') ||
    lower.includes('um único lado') ||
    lower.includes('apenas um') ||
    lower.includes('frente e verso') ||
    lower.includes('outro lado') ||
    lower.includes('ambos os lados')
  );
}

const documentConfigs: DocumentConfig[] = [
  {
    type: 'matricula',
    label: 'Comprovante de Matrícula',
    icon: FileText,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 3
  },
  {
    type: 'rg',
    label: 'Documento de Identidade',
    icon: CreditCard,
    acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 3
  },
  {
    type: 'foto',
    label: 'Foto 3x4',
    icon: SquareUserRound,
    acceptedTypes: ['image/jpeg', 'image/png'],
    maxSizeMB: 5
  },
  {
    type: 'selfie',
    label: 'Selfie do Rosto',
    icon: Camera,
    acceptedTypes: ['image/jpeg', 'image/png'],
    maxSizeMB: 5
  }
];

const DocumentCard = ({
  config,
  doc,
  preview,
  isUploading,
  progress,
  hasCameraSupport,
  onUpload,
  onOpenCamera,
  isRgMissingSide,
  onAddSecondSide,
}: DocumentCardProps) => {
  const IconComponent = config.icon;
  const status = doc?.status;
  const isSelfie = config.type === 'selfie';
  const isRg = config.type === 'rg';
  const canUpload = !doc || status === 'rejected';
  const disableUpload = !canUpload || isUploading;
  const inputId = `file-${config.type}`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAddingSecondSide, setIsAddingSecondSide] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelfie) {
      toast.error('Use a câmera para enviar a selfie');
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) {
      onUpload(file, config.type);
    }
  };

  const handleChooseFileClick = () => {
    if (disableUpload || isSelfie) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isRg && isRgMissingSide && isAddingSecondSide && onAddSecondSide) {
        onAddSecondSide(file);
      } else {
        onUpload(file, config.type);
      }
    }
    setIsAddingSecondSide(false);
    if (e.target) {
      e.target.value = '';
    }
  };

  const getStatusBadge = () => {
    if (!doc) {
      return (
        <Badge variant="secondary" className="bg-slate-300 text-slate-600">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    }
    switch (doc.status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Em análise
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="bg-red-400 text-red-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return null;
    }
  };

  let PrimaryIcon: React.ElementType = IconComponent;
  let SecondaryIcon: React.ElementType | null = null;

  if (config.type === 'matricula') {
    PrimaryIcon = FileText;
    SecondaryIcon = GraduationCap;
  } else if (config.type === 'rg') {
    PrimaryIcon = CreditCard;
    SecondaryIcon = User;
  } else if (config.type === 'foto') {
    PrimaryIcon = SquareUserRound;
    SecondaryIcon = null;
  } else if (config.type === 'selfie') {
    PrimaryIcon = Camera;
    SecondaryIcon = null;
  }

  const baseCardClasses =
    'relative backdrop-blur-sm rounded-xl border-2 p-6 transition-colors shadow-sm';

  let stateClasses = '';
  if (!doc) {
    stateClasses =
      'bg-slate-200 border-slate-400 border-dashed hover:border-sky-500 hover:bg-yellow-100 hover:shadow-md';
  } else if (status === 'approved') {
    stateClasses = 'bg-sky-200 border-sky-400 border-solid';
  } else if (status === 'rejected') {
    stateClasses = 'bg-red-200 border-red-500 border-dashed';
  } else if (status === 'pending') {
    stateClasses = 'bg-slate-50 border-slate-300 border-dashed';
  }

  const interactive = !disableUpload;

  const renderTips = () => {
    if (config.type === 'selfie') {
      return (
        <ul className="mt-1 space-y-1 text-xs text-slate-700">
          <li>💡 Boa iluminação</li>
          <li>👓 Sem óculos escuros</li>
          <li>🧢 Sem boné ou chapéu</li>
        </ul>
      );
    }

    if (config.type === 'foto') {
      return (
        <ul className="mt-1 space-y-1 text-xs text-slate-700">
          <li>☀️ Fundo claro e uniforme</li>
          <li>🚫 Sem acessórios ou filtros</li>
          <li>⚠️ Foto usada na carteira URE</li>
        </ul>
      );
    }

    if (config.type === 'rg') {
      return (
        <ul className="mt-1 space-y-1 text-xs text-slate-700">
          <li>🪪 RG (Frente e Verso)</li>
          <li>🚗 CNH</li>
          <li>🛂 Passaporte</li>
        </ul>
      );
    }

    if (config.type === 'matricula') {
      return (
        <ul className="mt-1 space-y-1 text-xs text-slate-700">
          <li>📄 Comprovante de matrícula atual</li>
          <li>🏫 Declaração da instituição</li>
          <li>💰 Comprovante de pagamento recente</li>
        </ul>
      );
    }

    return null;
  };

  const isEmpty = !doc;

  return (
    <div
      className={cn(baseCardClasses, stateClasses, interactive && 'cursor-pointer')}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => {
        if (!interactive || disableUpload) return;
        if (doc) return;
        if (isSelfie) {
          onOpenCamera?.();
        } else {
          fileInputRef.current?.click();
        }
      }}
    >
      <div className="absolute top-2 right-3">
        {getStatusBadge()}
      </div>

      <div className="flex items-center mb-4">
        {isEmpty ? (
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-shrink-0 flex items-center">
              <div className="w-16 h-16 rounded-full bg-slate-900/90 flex items-center justify-center">
                <PrimaryIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">
                {config.label}
              </h3>
              {renderTips()}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg flex items-center gap-1.5">
              <PrimaryIcon className="w-5 h-5 text-primary" />
              {SecondaryIcon && <SecondaryIcon className="w-4 h-4 text-primary/80" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {config.label}
              </h3>
              {status !== 'approved' && renderTips()}
            </div>
          </div>
        )}
      </div>

      {status === 'approved' && (
        <div className="pointer-events-none absolute inset-0 flex justify-end items-start pr-4 pt-4 opacity-10">
          <CheckCircle className="w-16 h-16 text-sky-700" />
        </div>
      )}

      {isUploading ? (
          <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-slate-600 mt-2 text-center">
            Enviando... {progress}%
          </p>
        </div>
      ) : doc && preview ? (
        <div className="mt-4">
          <img
            src={preview}
            alt="Preview"
            className="object-cover rounded-lg mx-auto w-full h-40"
          />
          <div className={cn("mt-2 flex items-center", status === 'approved' ? "justify-center" : "justify-between")}>
            <p className={cn("text-sm text-slate-600 truncate", status === 'approved' ? "text-center" : "flex-1")}>
              {doc.file_name}
            </p>
            {status === 'rejected' && isSelfie && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCamera();
                }}
                className="text-primary hover:text-primary/80 hover:bg-primary/10"
              >
                Tirar nova selfie
              </Button>
            )}
          </div>
          {/* input único por card, renderizado mais abaixo */}
        </div>
      ) : doc && !preview ? (
        <div className="mt-4">
          <div className="p-4 bg-slate-100 rounded-lg flex items-center gap-3">
            <FileIcon className="w-8 h-8 text-slate-500" />
            <p className="text-sm text-slate-900 truncate flex-1">{doc.file_name}</p>
          </div>
          {/* input único por card, renderizado mais abaixo */}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {isSelfie ? (
            <>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCamera();
                }}
                className="w-full py-3"
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
            {!isSelfie && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={disableUpload}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChooseFileClick();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Escolher arquivo
              </Button>
            )}
              <p className="text-xs text-slate-500 mt-2 text-center">
                {config.acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}
                {' • '}Máx {config.maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
      )}

      {doc?.status === 'rejected' && doc.rejection_reason && (
        <Alert variant="destructive" className="mt-4 bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-600">
            {doc.rejection_reason}
          </AlertDescription>
        </Alert>
      )}

      {doc?.status === 'rejected' && !isSelfie && (
        <>
          {isRg && isRgMissingSide ? (
            <>
              <p className="mt-3 text-xs text-slate-700">
                Agora envie o outro lado do documento.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-600 border border-red-500/30"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (disableUpload) return;
                    setIsAddingSecondSide(true);
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Adicionar outro lado
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAddingSecondSide(false);
                    if (!disableUpload) {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  Enviar documento único
                </Button>
              </div>
            </>
          ) : (
            <>
              {isUploading ? (
                <Button
                  type="button"
                  disabled
                  className="w-full mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-600 border border-red-500/30"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Novo Documento
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-600 border border-red-500/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseFileClick();
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Novo Documento
                </Button>
              )}
            </>
          )}
        </>
      )}

      {!isSelfie && (
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept={config.acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      )}
    </div>
  );
};

/**
 * FLUXO DO USUÁRIO:
 * 1. Faz login e cai em /upload-documentos (guarded por useOnboardingGuard).
 * 2. Envia 4 documentos: matrícula, documento de identidade (RG/CNH), foto 3x4 e selfie.
 * 3. Cada upload dispara validação automática (validate-document-v2 + IA) e atualiza status.
 * 4. Quando os 4 documentos estão aprovados, o checkbox de termos é exibido.
 * 5. Ao aceitar os termos, inicia polling de face_validated e chama advance_to_review.
 * 6. Quando face_validated e advance_to_review retornam OK, usuário é redirecionado
 *    para /gerar-carteirinha para revisão final dos dados.
 *
 * ESTADOS DERIVADOS:
 * - allDocsUploaded: existem registros para todos os 4 tipos de documento.
 * - allDocsApproved: todos os 4 documentos estão com status 'approved'.
 * - termsOk: termsAccepted || termsAlreadyAccepted.
 * - faceOk: profile.face_validated === true.
 * - canGenerateCard: allDocsApproved && faceOk && termsOk.
 * - canSubmit: allDocsUploaded && termsOk (controle de CTA legado).
 *
 * GUARDS:
 * - useOnboardingGuard('upload_documents'): impede acesso fora da etapa certa
 *   e redireciona conforme current_onboarding_step.
 * - Bloqueio adicional se usuário não estiver autenticado (redirect para /login).
 *
 * DEPENDÊNCIAS BACKEND:
 * - Edge function validate-document-v2: valida cada documento e atualiza documents.
 * - Edge function compare-faces: compara selfie com documentos de rosto e atualiza
 *   face_validated + face_validations.
 * - RPC advance_to_review: checa se docs/face/termos estão ok e muda passo para review_data.
 * - Triggers em documents/payments/student_cards que mantêm o fluxo sincronizado.
 */
export default function UploadDocumentos() {
  const { isChecking } = useOnboardingGuard('upload_documents');
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
  const [manualRequested, setManualRequested] = useState(false);
  const [faceValidationPending, setFaceValidationPending] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

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
      console.error('[UPLOAD_DOCUMENTOS] Erro ao carregar documentos:', {
        studentId: profile.id,
        error: error.message,
      });
      toast.error('Erro ao carregar documentos');
      return;
    }
    
    const docsMap: Record<string, DocumentRecord> = {};
    const newPreviews: Record<string, string> = {};
    
    for (const doc of data || []) {
      docsMap[doc.type] = doc as DocumentRecord;
      
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

  useEffect(() => {
    if (isChecking) return;
    if (user) {
      fetchProfile();
    }
  }, [user, isChecking, fetchProfile]);

  useEffect(() => {
    if (isChecking) return;
    if (profile) {
      fetchDocuments();
    }
  }, [profile, isChecking, fetchDocuments]);

  const { result: faceValidation } = useFaceValidation(profile?.id);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasCameraSupport(false);
    }
  }, []);

  useEffect(() => {
    const checkTerms = async () => {
      if (!profile?.id) return;
      
      const { data, error } = await supabase
        .from('student_profiles')
        .select('terms_accepted, terms_accepted_at, terms_version')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('[UPLOAD_DOCUMENTOS] Erro ao carregar termos:', {
          profileId: profile.id,
          error: error.message,
        });
        return;
      }

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
      const { data: card, error } = await supabase
        .from('student_cards')
        .select('status')
        .eq('student_id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('[UPLOAD_DOCUMENTOS] Erro ao verificar bloqueio de documentos:', {
          profileId: profile.id,
          error: error.message,
        });
        return;
      }
      if (card?.status === 'active') {
        toast.error('Documentos não podem ser alterados com carteira ativa. Entre em contato com suporte.');
      }
    };
    checkIfLocked();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const hasPending = Object.values(documents).some(
      (doc) => doc && doc.status === 'pending'
    );

    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [profile?.id, documents, fetchDocuments]);

const handleUpload = async (file: File, type: DocumentType) => {
    if (uploading[type]) return;

    if (!profile?.id || !user?.id) {
      toast.error('Perfil não carregado. Recarregue a página.');
      return;
    }
    if (type === 'foto') {
      const { data: card } = await supabase
        .from('student_cards')
        .select('status')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (card?.status === 'active') {
        toast.error('Foto não pode ser alterada após emissão da Carteira. Entre em contato com suporte.');
        return;
      }
    }
    
    const config = documentConfigs.find(d => d.type === type);
    if (!config) {
      toast.error('Tipo de documento inválido');
      return;
    }

    if (type === 'selfie' || type === 'foto') {
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são aceitas para este documento');
        return;
      }
    }

    if (type === 'rg' || type === 'matricula') {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';

      if (!isImage && !isPDF) {
        const label =
          type === 'rg'
            ? 'Documento de Identidade'
            : 'Comprovante de Matrícula';
        toast.error(`Apenas imagens ou PDFs são aceitos para ${label}`);
        return;
      }

      const maxSizeMB = 3;
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`Arquivo deve ter no máximo ${maxSizeMB}MB`);
        return;
      }
    }
    
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
      
      const fileIsImage = fileToUpload.type.startsWith('image/');
      const fileIsPDF = fileToUpload.type === 'application/pdf';

      let maxSizeMB = config.maxSizeMB;

      if (fileToUpload.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`Arquivo maior que ${maxSizeMB}MB`);
      }
      if (!config.acceptedTypes.includes(fileToUpload.type)) {
        throw new Error('Tipo de arquivo não aceito');
      }
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [type]: Math.min((prev[type] || 0) + 20, 90)
        }));
      }, 200);
      
      const ext = fileToUpload.name.split('.').pop();
      const filePath = `${user.id}/${type}/${Date.now()}.${ext}`;
      
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, fileToUpload, { upsert: true });
        
      if (storageError) throw storageError;
      
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
            rejection_reason: null,
            rejection_notes: null,
            rejection_reason_id: null,
            validated_at: null,
            validated_by: null
          })
          .eq('id', existingDoc.id);
          
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            student_id: profile.id,
            type: type,
            file_url: filePath,
            file_name: fileToUpload.name,
            file_size: fileToUpload.size,
            mime_type: fileToUpload.type,
            status: 'pending'
          });
          
        if (dbError) throw dbError;
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

  const allDocsUploaded = documentConfigs.every((config) => !!documents[config.type]);
  const allDocsApproved = documentConfigs.every((config) => {
    const doc = documents[config.type];
    return doc && doc.status === "approved";
  });

  const termsOk = termsAccepted || termsAlreadyAccepted;
  const faceOk = !!profile?.face_validated;
  const canGenerateCard = allDocsApproved && faceOk && termsOk;
  const canSubmit = allDocsUploaded && termsOk;

  const handleAddRgSecondSide = async (secondFile: File) => {
    if (!profile?.id || !user?.id) {
      toast.error('Perfil não carregado. Recarregue a página.');
      return;
    }

    const rgDoc = documents['rg'];
    if (!rgDoc) {
      toast.error('Documento RG não encontrado. Envie novamente.');
      return;
    }

    const config = documentConfigs.find(d => d.type === 'rg');
    if (!config) return;

    if (!secondFile.type.startsWith('image/') && secondFile.type !== 'application/pdf') {
      toast.error('Apenas imagens ou PDFs são aceitos');
      return;
    }
    if (secondFile.size > 3 * 1024 * 1024) {
      toast.error('Arquivo deve ter no máximo 3MB');
      return;
    }

    const toastId = 'upload-rg-back';
    toast.loading('Enviando outro lado do documento...', { id: toastId });

    try {
      setUploading(prev => ({ ...prev, rg: true }));
      setUploadProgress(prev => ({ ...prev, rg: 0 }));

      let fileToUpload = secondFile;
      if (secondFile.type.startsWith('image/') && secondFile.size > 1024 * 1024) {
        fileToUpload = await compressImage(secondFile, 2400, 2400, 0.9);
      }

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          rg: Math.min((prev['rg'] || 0) + 20, 90)
        }));
      }, 200);

      const ext = fileToUpload.name.split('.').pop();
      const filePath = `${user.id}/rg-back/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, fileToUpload, { upsert: true });

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('documents')
        .update({
          file_url_back: filePath,
          status: 'pending',
          rejection_reason: null,
          rejection_notes: null,
          rejection_reason_id: null,
          validated_at: null,
          validated_by: null
        })
        .eq('id', rgDoc.id);

      if (dbError) throw dbError;

      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, rg: 100 }));

      toast.success('Documento enviado! Validando...', { id: toastId });
      await fetchDocuments();

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar documento';
      toast.error(message, { id: toastId });
    } finally {
      setUploading(prev => ({ ...prev, rg: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, rg: 0 }));
      }, 1000);
    }
  };

  const handleSubmit = async () => {
    if (!termsAccepted && !termsAlreadyAccepted) {
      toast.error('Você precisa aceitar a declaração de veracidade');
      return;
    }

    if (termsAlreadyAccepted) {
        toast.success('Documentos enviados! Aguardando validação...');
        setTimeout(() => {
            window.location.reload();
        }, 5000);
        return;
    }

    try {
      let ip = 'unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ip = ipData.ip;
      } catch (e) {}

      const { data, error } = await supabase
        .from('student_profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_ip_address: ip,
          terms_version: '1.0'
        })
        .select('id, user_id, terms_accepted, current_onboarding_step')
        .eq('id', profile!.id);

      if (error) {
        console.error('Erro ao salvar termos:', error);
        toast.error('Erro ao salvar aceitação do termo');
        return;
      }

      toast.success('Documentos enviados! Validação em andamento...');
      setTimeout(() => {
        window.location.reload();
      }, 5000);
     
    } catch (error) {
      console.error('[TERMOS] Erro inesperado ao salvar aceitação do termo:', error);
      toast.error('Erro ao salvar aceitação do termo. Tente novamente.');
    }
  };
  
  const handleGoToReview = async () => {
    if (!profile?.id) {
      toast.error('Perfil não carregado.');
      return;
    }
    const { data, error } = await supabase.rpc('advance_to_review', {
      p_student_id: profile.id,
    });

    if (error) {
      console.error('[UPLOAD_DOCUMENTOS] RPC advance_to_review erro:', error);
      toast.error('Erro interno ao avançar para revisão. Tente novamente.');
      return;
    }

    if (data === true) {
      window.location.href = '/gerar-carteirinha';
    } else {
      toast.error('Ainda há pendências. Verifique documentos, termos e validação facial.');
    }
  };

  const handleManualValidation = async () => {
    if (!profile?.id || !user?.id) {
      toast.error('Perfil não carregado. Recarregue a página.');
      return;
    }

    if (manualRequested || profile.manual_review_requested) {
      toast.success('Sua solicitação de validação manual já foi registrada.');
      return;
    }

    setManualRequested(true);

    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({ manual_review_requested: true })
        .eq('id', profile.id);

      if (error) {
        console.error('Erro ao registrar solicitação manual:', error);
        toast.error('Erro ao enviar solicitação. Tente novamente.');
        setManualRequested(false);
        return;
      }

      setProfile(prev => prev ? { ...prev, manual_review_requested: true } : prev);
      toast.success('Solicitação enviada! Nossa equipe analisará seus documentos em até 2 dias úteis.');
      navigate('/aguardando-aprovacao');
    } catch (error) {
      console.error('Erro inesperado ao solicitar validação manual:', error);
      toast.error('Erro ao enviar solicitação. Tente novamente.');
      setManualRequested(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!faceValidationPending) return;
    if (!faceValidation) return;

    if (faceValidation.passed === true) {
      setFaceValidationPending(false);
      toast.success('Identidade validada com sucesso!');
      navigate('/gerar-carteirinha');
    } else if (faceValidation.passed === false) {
      setFaceValidationPending(false);
      toast.error('Não foi possível validar. Verifique selfie e tente novamente.');
    }
  }, [faceValidation, faceValidationPending, navigate]);

  useEffect(() => {
    if (!faceValidationPending) return;
    const timer = setTimeout(() => {
      setFaceValidationPending(false);
      toast.info('Validação em processamento. Aguarde um momento e atualize a página.');
    }, 30000);
    return () => clearTimeout(timer);
  }, [faceValidationPending]);

  if (authLoading || isChecking || loadingProfile) {
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
      <main className="relative z-10 px-4 pt-6 pb-20 sm:px-6 lg:px-8">  
        <div className="max-w-4xl mx-auto space-y-6">  
          <ProgressBar currentStep="documents" />  
          
          <div className="text-center">  
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">  
              Vamos Preparar Sua Carteira do Estudante URE  
            </h1>  
            <p className="text-sm md:text-base text-muted-foreground">  
              Envie seus documentos para aprovação. O processo é rápido e seguro.  
              <br />  
              <span className="text-xs md:text-sm font-medium text-emerald-700 flex items-center justify-center gap-1 mt-2">  
                <CheckCircle className="w-4 h-4" /> Seus dados estão protegidos pela LGPD  
              </span>  
            </p>  
          </div>  
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">  
          {documentConfigs.map(config => {
            const doc = documents[config.type];
            const isRgMissingSide =
              config.type === 'rg' &&
              doc &&
              doc.status === 'rejected' &&
              isRejectedForMissingSide((doc as any).rejection_reason);

            return (
              <DocumentCard
                key={config.type}
                config={config}
                doc={doc}
                preview={previews[config.type]}
                isUploading={uploading[config.type] || false}
                progress={uploadProgress[config.type] || 0}
                hasCameraSupport={hasCameraSupport}
                onUpload={handleUpload}
                onOpenCamera={() => setShowCamera(true)}
                isRgMissingSide={isRgMissingSide}
                onAddSecondSide={
                  config.type === 'rg' ? handleAddRgSecondSide : undefined
                }
              />
            );
          })}  
        </div>  
  
        <Alert className="bg-green-300 border-green-500 py-2">  
          <AlertDescription className="text-sm text-gray-700 flex items-center justify-center gap-2 text-center">  
            <span>🔍</span>  
            <span>Validação facial após aprovação da documentação.</span>  
          </AlertDescription>  
        </Alert>

        {allDocsApproved && !termsAlreadyAccepted && (
          <div className="mb-6 max-w-2xl mx-auto">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={async (checked) => {
                  const isChecked = checked === true;
                  setTermsAccepted(isChecked);

                  if (!isChecked || !profile?.id || !user?.id) {
                    return;
                  }

                  if (faceValidationPending) {
                    return;
                  }

                  try {
                    let ip = 'unknown';
                    try {
                      const ipResponse = await fetch('https://api.ipify.org?format=json');
                      const ipData = await ipResponse.json();
                      ip = ipData.ip;
                    } catch (e) {}

                    const { data, error } = await supabase
                      .from('student_profiles')
                      .update({
                        terms_accepted: true,
                        terms_accepted_at: new Date().toISOString(),
                        terms_ip_address: ip,
                        terms_version: '1.0',
                      })
                      .select('id, user_id, terms_accepted, terms_accepted_at, terms_ip_address')
                      .eq('id', profile.id);

                    if (error) {
                      console.error('[TERMOS] Erro ao salvar aceite imediato:', error);
                      toast.error('Erro ao salvar aceitação do termo');
                      setTermsAccepted(false);
                      return;
                    }

                    setTermsAlreadyAccepted(true);
                    setTermsAccepted(true);
                    setTermsAcceptedDate(new Date().toISOString());
                    setTermsVersion('1.0');

                    // Se já estiver validado (ex.: usuário voltou a esta tela), avançar direto
                    if (profile.face_validated) {
                      const { data: advanced, error: advanceError } = await supabase.rpc(
                        'advance_to_review',
                        { p_student_id: profile.id }
                      );

                      if (!advanceError && advanced === true) {
                        window.location.href = '/gerar-carteirinha';
                      } else {
                        toast.error('Erro ao avançar. Recarregue a página.');
                      }
                      return;
                    }

                    setShowManualFallback(false);
                    setFaceValidationPending(true);

                    setTimeout(() => {
                      let attempts = 0;

                      if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                      }

                      pollRef.current = setInterval(async () => {
                        attempts++;

                        const { data: faceRow, error: faceError } = await supabase
                          .from('student_profiles')
                          .select('face_validated')
                          .eq('id', profile.id)
                          .maybeSingle();

                        if (faceError) {
                          console.error('[TERMOS] Erro ao verificar face_validated:', faceError);
                        }

                        if (faceRow?.face_validated) {
                          if (pollRef.current) {
                            clearInterval(pollRef.current);
                            pollRef.current = null;
                          }

                          const { data: advanced, error: advanceError } = await supabase.rpc(
                            'advance_to_review',
                            { p_student_id: profile.id }
                          );

                          if (!advanceError && advanced === true) {
                            window.location.href = '/gerar-carteirinha';
                          } else {
                            setFaceValidationPending(false);
                            toast.error('Erro ao avançar. Recarregue a página.');
                          }
                        } else if (attempts >= 15) {
                          if (pollRef.current) {
                            clearInterval(pollRef.current);
                            pollRef.current = null;
                          }
                          setFaceValidationPending(false);
                          toast.info('Validação demorando. Solicite validação manual.');
                          setShowManualFallback(true);
                        }
                      }, 3000);
                    }, 2000);
                  } catch (err) {
                    console.error('[TERMOS] Erro inesperado ao salvar aceite imediato:', err);
                    toast.error('Erro ao salvar aceitação do termo');
                    setTermsAccepted(false);
                  }
                }}
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
                 e que os documentos fornecidos são verdadeiros e de minha responsabilidade.
              </label>
            </div>

            <Dialog open={showFullTerms} onOpenChange={setShowFullTerms}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogTitle className="sr-only">
                Termo de Responsabilidade por Veracidade dos Documentos
              </DialogTitle>
                <div className="space-y-3 text-sm text-slate-600">
                  <h2 className="text-lg font-semibold text-foreground">
                    Termo de Responsabilidade por Veracidade dos Documentos
                  </h2>
                  <p>
                    Eu, <strong className="text-slate-900">{profile?.full_name}</strong>, portador(a) do CPF nº
                    <strong className="text-slate-900"> {profile?.cpf}</strong>, DECLARO sob as penas da lei que:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>
                      Os documentos enviados (RG/CNH, comprovante de matrícula e 
                      fotografias) são <strong className="text-slate-900">VERDADEIROS, AUTÊNTICOS</strong> e 
                      de minha <strong className="text-slate-900">TITULARIDADE</strong>.
                    </li>
                    <li>
                      Sou o <strong className="text-slate-900">ÚNICO RESPONSÁVEL</strong> pela veracidade das 
                      informações fornecidas, <strong className="text-slate-900">ISENTANDO a URE BRASIL</strong> de 
                      qualquer responsabilidade civil ou criminal decorrente de 
                      falsificação ou adulteração.
                    </li>
                    <li>
                      Estou <strong className="text-slate-900">CIENTE</strong> de que a falsificação de documentos 
                      constitui <strong className="text-slate-900">CRIME</strong> previsto nos Artigos 297, 298 e 
                      299 do Código Penal Brasileiro (reclusão de 1 a 5 anos e multa).
                    </li>
                    <li>
                      Em caso de <strong className="text-slate-900">FALSIDADE</strong> comprovada, meu cadastro será
                      <strong className="text-slate-900"> CANCELADO</strong> imediatamente, sem direito a reembolso, 
                      e o caso será comunicado às autoridades competentes.
                    </li>
                  </ol>
                  <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                    <p>Data: {new Date().toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {allDocsUploaded && termsAlreadyAccepted && !canGenerateCard && (
          <div className="mb-6 max-w-2xl mx-auto bg-green-500/20 border border-green-500/50 rounded-xl px-4 py-3 shadow-md">
            <p className="text-sm text-green-900">
              ✅ Você aceitou o Termo de Responsabilidade
              <br />
              <span className="text-xs text-green-800/80">
                Data: {termsAcceptedDate ? new Date(termsAcceptedDate).toLocaleString('pt-BR') : 'N/A'} • Versão: {termsVersion || '1.0'}
              </span>
            </p>
          </div>
        )}

        {canGenerateCard && (
          <>
            <Alert className="mb-4 max-w-2xl mx-auto bg-green-500/20 border-green-500/50">
              <AlertDescription className="text-sm text-slate-800">
                Documentos, validação facial e Termo de Responsabilidade aprovados.
                Você já aceitou o Termo em{' '}
                {termsAcceptedDate
                  ? new Date(termsAcceptedDate).toLocaleString('pt-BR')
                  : 'data não disponível'}
                {` • Versão: ${termsVersion || '1.0'}.`}
              </AlertDescription>
            </Alert>
            <Button
              className="w-full max-w-2xl mx-auto block"
              onClick={handleGoToReview}
              disabled={faceValidationPending}
            >
              Ir para revisão e geração da carteirinha
            </Button>
          </>
        )}

        {!canGenerateCard && showManualFallback && (
          <Button
            variant="outline"
            disabled={manualRequested}
            onClick={handleManualValidation}
            className="w-full mt-3"
          >
            Solicitar validação manual
          </Button>
        )}
  
        {showCamera && (
          <CameraCapture
            onCapture={(file) => {
              handleUpload(file, 'selfie');
              setShowCamera(false);
            }}
            onCancel={() => setShowCamera(false)}
          />
        )}

        {faceValidationPending && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 text-center max-w-sm mx-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Validando sua identidade...</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Isso pode levar alguns segundos
              </p>
            </div>
          </div>
        )}
      </div>
      {profile && (
        <>
          <div className="mt-8 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setSupportOpen(true)}
            >
              <MessageCircle className="w-4 h-4" />
              Não conseguiu resolver? Abra uma solicitação
            </Button>
          </div>
          <SupportModal
            open={supportOpen}
            onClose={() => setSupportOpen(false)}
            defaultCategory={
              Object.values(documents).some((doc) => doc.status === 'rejected')
                ? 'Documento rejeitado'
                : undefined
            }
          />
        </>
      )}
    </main>
  </div>
);
}
