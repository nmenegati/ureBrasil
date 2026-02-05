import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

type RejectionReasonRow = Tables<'rejection_reasons'>;

interface RejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onRejected?: () => void;
}

export function RejectModal({ open, onOpenChange, documentId, onRejected }: RejectModalProps) {
  const { adminUser } = useAdminAuth();
  const [reasons, setReasons] = useState<RejectionReasonRow[]>([]);
  const [reasonId, setReasonId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const loadReasons = async () => {
      const { data, error } = await supabase
        .from('rejection_reasons')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data) {
        setReasons(data as RejectionReasonRow[]);
      }
    };

    loadReasons();
  }, [open]);

  const handleClose = (value: boolean) => {
    if (!value) {
      setReasonId('');
      setNotes('');
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!adminUser) {
      toast.error('Sessão de administrador inválida.');
      return;
    }
    if (!reasonId) {
      toast.error('Selecione um motivo.');
      return;
    }
    if (!notes.trim()) {
      toast.error('Preencha as notas de rejeição.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'rejected',
          rejection_reason_id: reasonId,
          rejection_notes: notes.trim(),
          validated_at: new Date().toISOString(),
          validated_by: adminUser.userId,
        } as Tables<'documents'>['Update'])
        .eq('id', documentId);

      if (updateError) {
        toast.error('Erro ao rejeitar documento.');
        return;
      }

      const adminClient = supabase as any;
      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'document_rejected',
          document_id: documentId,
          performed_by: adminUser.userId,
          rejection_reason_id: reasonId,
          details: notes.trim(),
          created_at: new Date().toISOString(),
        });

      toast.success('Documento rejeitado.');
      onRejected?.();
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeitar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map(reason => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reject-notes">Notas para o aluno</Label>
            <Textarea
              id="reject-notes"
              rows={4}
              value={notes}
              onChange={event => setNotes(event.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar rejeição
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

