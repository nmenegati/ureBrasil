import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface ApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onApproved?: () => void;
}

export function ApprovalModal({ open, onOpenChange, documentId, onApproved }: ApprovalModalProps) {
  const { adminUser } = useAdminAuth();
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = (value: boolean) => {
    if (!value) {
      setJustification('');
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!adminUser) {
      toast.error('Sessão de administrador inválida.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'approved',
          rejection_reason: null,
          rejection_notes: null,
          validated_at: new Date().toISOString(),
          validated_by: adminUser.userId,
        } as Tables<'documents'>['Update'])
        .eq('id', documentId);

      if (updateError) {
        toast.error('Erro ao aprovar documento.');
        return;
      }

      const adminClient = supabase as any;
      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'document_approved',
          document_id: documentId,
          performed_by: adminUser.userId,
          details: justification || null,
          created_at: new Date().toISOString(),
        });

      toast.success('Documento aprovado.');
      onApproved?.();
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar aprovação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="approval-justification">Justificativa (opcional)</Label>
            <Textarea
              id="approval-justification"
              rows={3}
              value={justification}
              onChange={event => setJustification(event.target.value)}
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
              Confirmar aprovação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

