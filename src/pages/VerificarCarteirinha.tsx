import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

type VerificationStatus = 'loading' | 'valid' | 'invalid' | 'not_found' | 'rate_limited' | 'error';

interface PublicCardRow {
  student_id: string | null;
  usage_code: string | null;
  status: string | null;
  valid_until: string | null;
  issued_year: number | null;
}

interface PublicProfileRow {
  full_name: string;
  institution: string | null;
  course: string | null;
  profile_photo_url: string | null;
}

interface PublicCardData {
  fullName: string;
  institution: string | null;
  course: string | null;
  validUntil: string | null;
  issuedYear: number | null;
  status: string;
  photoUrl: string | null;
}

const LOCAL_LIMIT_KEY = 'ure-card-verify-requests';
const LOCAL_LIMIT_WINDOW_MS = 60_000;
const LOCAL_LIMIT_MAX_REQUESTS = 10;

export default function VerificarCarteirinha() {
  const params = useParams();
  const usageCode = params.usageCode || '';

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [cardData, setCardData] = useState<PublicCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const metaSelector = 'meta[name="robots"]';
    const existing = document.querySelector(metaSelector) as HTMLMetaElement | null;
    const previousContent = existing?.getAttribute('content') ?? null;

    let meta = existing;
    let created = false;

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      created = true;
      document.head.appendChild(meta);
    }

    meta.content = 'noindex,nofollow';

    return () => {
      if (!meta) return;
      if (created) {
        document.head.removeChild(meta);
        return;
      }
      if (previousContent === null) {
        document.head.removeChild(meta);
      } else {
        meta.content = previousContent;
      }
    };
  }, []);

  useEffect(() => {
    const now = Date.now();

    try {
      const raw = window.localStorage.getItem(LOCAL_LIMIT_KEY);
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      const recent = parsed.filter((ts) => now - ts < LOCAL_LIMIT_WINDOW_MS);

      if (recent.length >= LOCAL_LIMIT_MAX_REQUESTS) {
        setStatus('rate_limited');
        setLoading(false);
        return;
      }

      recent.push(now);
      window.localStorage.setItem(LOCAL_LIMIT_KEY, JSON.stringify(recent));
    } catch (error) {
      console.error('Erro ao aplicar limite local de verificações', error);
    }

    const fetchData = async () => {
      if (!usageCode) {
        setStatus('not_found');
        setCardData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setStatus('loading');

      try {
        const { data: card, error: cardError } = await supabase
          .from('student_cards')
          .select('student_id, usage_code, status, valid_until, issued_year')
          .eq('usage_code', usageCode)
          .maybeSingle<PublicCardRow>();

        if (cardError) {
          throw cardError;
        }

        if (!card) {
          setCardData(null);
          setStatus('not_found');
          setLoading(false);
          return;
        }

        const studentId = card.student_id;

        if (!studentId) {
          setCardData(null);
          setStatus('error');
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('student_profiles')
          .select('full_name, institution, course, profile_photo_url')
          .eq('id', studentId)
          .maybeSingle<PublicProfileRow>();

        if (profileError) {
          throw profileError;
        }

        let photoUrl: string | null = null;

        if (profile?.profile_photo_url) {
          const { data: publicData } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(profile.profile_photo_url);

          if (publicData?.publicUrl) {
            photoUrl = publicData.publicUrl;
          } else {
            const { data: signedData, error: signedError } = await supabase.storage
              .from('documents')
              .createSignedUrl(profile.profile_photo_url, 600);

            if (!signedError && signedData?.signedUrl) {
              photoUrl = signedData.signedUrl;
            }
          }
        }

        const publicData: PublicCardData = {
          fullName: profile?.full_name ?? '',
          institution: profile?.institution ?? null,
          course: profile?.course ?? null,
          validUntil: card.valid_until ?? null,
          issuedYear: card.issued_year ?? null,
          status: card.status ?? '',
          photoUrl,
        };

        setCardData(publicData);

        if (card.status === 'active') {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch (error) {
        console.error('Erro ao verificar carteirinha', error);
        setStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [usageCode]);

  const abbreviatedName = useMemo(() => {
    if (!cardData?.fullName) return '';
    const parts = cardData.fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];

    const first = parts[0];
    const last = parts[parts.length - 1] || '';
    if (!last) return first;

    return `${first} ${last[0].toUpperCase()}.`;
  }, [cardData?.fullName]);

  const formattedValidity = useMemo(() => {
    if (!cardData?.validUntil) return null;
    const date = new Date(cardData.validUntil);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR');
  }, [cardData?.validUntil]);

  const issuedYearLabel = useMemo(() => {
    if (!cardData?.issuedYear) return null;
    return String(cardData.issuedYear);
  }, [cardData?.issuedYear]);

  const isValid = status === 'valid';
  const isInvalid = status === 'invalid';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img
            src={ureBrasilLogo}
            alt="URE Brasil"
            className="h-10 w-auto object-contain"
          />
        </div>

        <Card className="bg-card border border-border shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-lg font-semibold text-foreground">
              Verificação de Carteirinha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Verificando carteirinha...
                </p>
              </div>
            )}

            {!loading && status === 'rate_limited' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    Muitas consultas em pouco tempo
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Aguarde alguns instantes e tente novamente.
                  </p>
                </div>
              </div>
            )}

            {!loading && status === 'not_found' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <XCircle className="h-8 w-8 text-red-500" />
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    Código não encontrado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Verifique se o código lido está correto ou entre em contato com a instituição.
                  </p>
                </div>
              </div>
            )}

            {!loading && status === 'error' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    Erro ao verificar carteirinha
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tente novamente em instantes. Se o problema persistir, contate o suporte.
                  </p>
                </div>
              </div>
            )}

            {!loading && (isValid || isInvalid) && cardData && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className={
                      isValid
                        ? 'inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold'
                        : 'inline-flex items-center gap-2 rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold'
                    }
                  >
                    {isValid ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>
                      {isValid ? 'CARTEIRINHA VÁLIDA' : 'CARTEIRINHA INVÁLIDA/EXPIRADA'}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Código de uso: {usageCode}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="w-28 h-36 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    {cardData.photoUrl ? (
                      <img
                        src={cardData.photoUrl}
                        alt="Foto do estudante"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Foto não disponível
                      </span>
                    )}
                  </div>

                  <div className="w-full space-y-2 text-sm text-foreground">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-semibold">{abbreviatedName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Instituição
                      </p>
                      <p>{cardData.institution || 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Curso</p>
                      <p>{cardData.course || 'Não informado'}</p>
                    </div>
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Validade
                        </p>
                        <p>{formattedValidity || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Ano de emissão
                        </p>
                        <p>{issuedYearLabel || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
