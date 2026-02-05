import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface MarkPaidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  onMarked?: () => void;
}

export function MarkPaidModal({ open, onOpenChange, paymentId, onMarked }: MarkPaidModalProps) {
  const { adminUser } = useAdminAuth();
  const [justification, setJustification] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = (value: boolean) => {
    if (!value) {
      setJustification('');
      setFile(null);
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!adminUser) {
      toast.error('Sessão de administrador inválida.');
      return;
    }
    if (!justification.trim()) {
      toast.error('Justificativa obrigatória.');
      return;
    }

    setLoading(true);

    try {
      let receiptUrl: string | null = null;

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `payment-receipts/${paymentId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, file, { upsert: true });

        if (uploadError) {
          toast.error('Erro ao enviar comprovante.');
        } else {
          const { data } = supabase.storage.from('documents').getPublicUrl(path);
          receiptUrl = data?.publicUrl ?? null;
        }
      }

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'approved',
          confirmed_at: new Date().toISOString(),
        } as Tables<'payments'>['Update'])
        .eq('id', paymentId);

      if (updateError) {
        toast.error('Erro ao marcar pagamento como aprovado.');
        return;
      }

      const adminClient = supabase as any;
      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'payment_marked_paid',
          payment_id: paymentId,
          performed_by: adminUser.userId,
          details: justification.trim(),
          receipt_url: receiptUrl,
          created_at: new Date().toISOString(),
        });

      toast.success('Pagamento marcado como aprovado.');
      onMarked?.();
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar pagamento como pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="paid-justification">Justificativa</Label>
            <Textarea
              id="paid-justification"
              rows={4}
              value={justification}
              onChange={event => setJustification(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paid-receipt">Comprovante (opcional)</Label>
            <Input
              id="paid-receipt"
              type="file"
              onChange={event => {
                const f = event.target.files?.[0] ?? null;
                setFile(f);
              }}
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
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

