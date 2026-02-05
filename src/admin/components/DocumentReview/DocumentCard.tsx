import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ApprovalModal } from '@/admin/components/DocumentReview/ApprovalModal';
import { RejectModal } from '@/admin/components/DocumentReview/RejectModal';
import { OverrideFaceModal } from '@/admin/components/DocumentReview/OverrideFaceModal';
import { toast } from 'sonner';
import { MaskedCPF } from '@/admin/components/shared/MaskedCPF';

type PendingDocRow = Tables<'pending_documents_queue'>;
type DocumentRow = Tables<'documents'>;

interface DocumentCardProps {
  item: PendingDocRow;
  onUpdated?: () => void;
}

export function DocumentCard({ item, onUpdated }: DocumentCardProps) {
  const [documentRow, setDocumentRow] = useState<DocumentRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [largeOpen, setLargeOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [canOverrideFace, setCanOverrideFace] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      if (!item.document_id) return;

      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', item.document_id)
        .maybeSingle<DocumentRow>();

      if (doc) {
        setDocumentRow(doc);
      }

      if (item.file_url) {
        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(item.file_url);
        if (data?.publicUrl) {
          setPreviewUrl(data.publicUrl);
        }
      }

      if (item.student_id) {
        const { data: profileRow } = await supabase
          .from('student_profiles')
          .select('id, face_validated')
          .eq('id', item.student_id)
          .maybeSingle<{ id: string; face_validated: boolean }>();

        if (profileRow && profileRow.face_validated === false) {
          setCanOverrideFace(true);
        }
      }
    };

    loadDetails();
  }, [item.document_id, item.file_url, item.student_id]);

  const sizeLabel =
    documentRow?.file_size != null
      ? `${(documentRow.file_size / 1024).toFixed(1)} KB`
      : 'Tamanho desconhecido';

  const typeLabel = item.document_type || 'desconhecido';

  const dateLabel = item.submitted_at
    ? new Date(item.submitted_at).toLocaleString('pt-BR')
    : 'Data desconhecida';

  const handleUpdated = () => {
    onUpdated?.();
  };

  const handleMissingPreview = () => {
    toast.error('Pré-visualização indisponível para este arquivo.');
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm">
            {item.student_name || 'Aluno sem nome'}
          </CardTitle>
          <div className="text-xs text-slate-500">
            <MaskedCPF cpf={item.cpf || undefined} />
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {typeLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="w-full h-32 bg-slate-100 border rounded-md flex items-center justify-center overflow-hidden cursor-pointer"
          onClick={previewUrl ? () => setLargeOpen(true) : handleMissingPreview}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Documento"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs text-slate-500">
              Sem pré-visualização
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 space-y-1">
          <p>Instituição: {item.institution || 'Não informada'}</p>
          <p>Curso: {item.course || 'Não informado'}</p>
          <p>Enviado em: {dateLabel}</p>
          <p>Tamanho: {sizeLabel}</p>
          {item.hours_waiting != null && (
            <p>Fila: {item.hours_waiting} horas</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setApproveOpen(true)}
          >
            Aprovar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRejectOpen(true)}
          >
            Rejeitar
          </Button>
          {canOverrideFace && item.student_id && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOverrideOpen(true)}
            >
              Override Face
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={largeOpen} onOpenChange={setLargeOpen}>
        <DialogContent className="max-w-3xl">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Documento"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          ) : (
            <p className="text-sm text-slate-600">Imagem não disponível.</p>
          )}
        </DialogContent>
      </Dialog>

      {item.document_id && (
        <ApprovalModal
          open={approveOpen}
          onOpenChange={setApproveOpen}
          documentId={item.document_id}
          onApproved={handleUpdated}
        />
      )}

      {item.document_id && (
        <RejectModal
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          documentId={item.document_id}
          onRejected={handleUpdated}
        />
      )}

      {item.student_id && (
        <OverrideFaceModal
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          studentId={item.student_id}
          onOverridden={handleUpdated}
        />
      )}
    </Card>
  );
}
