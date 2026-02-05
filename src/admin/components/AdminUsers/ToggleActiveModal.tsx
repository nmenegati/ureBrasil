import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface ToggleActiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminUser: {
    id: string;
    user_id: string;
    full_name: string | null;
    is_active: boolean;
  };
}

export function ToggleActiveModal({ open, onOpenChange, adminUser: target }: ToggleActiveModalProps) {
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
    if (!justification.trim()) {
      toast.error('Justificativa obrigatória.');
      return;
    }

    setLoading(true);

    try {
      const adminClient = supabase as any;
      const nowIso = new Date().toISOString();
      const nextActive = !target.is_active;

      const { error: updateError } = await adminClient
        .from('admin_users')
        .update({
          is_active: nextActive,
          updated_at: nowIso,
        })
        .eq('id', target.id);

      if (updateError) {
        toast.error('Erro ao atualizar status do admin.');
        return;
      }

      await adminClient
        .from('admin_actions')
        .insert({
          action_type: nextActive ? 'admin_activated' : 'admin_deactivated',
          performed_by: adminUser?.userId ?? null,
          target_user_id: target.user_id,
          details: justification.trim(),
          created_at: nowIso,
        });

      toast.success('Status atualizado com sucesso.');
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target.is_active ? 'Desativar administrador' : 'Ativar administrador'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Admin:{' '}
            <span className="font-semibold">
              {target.full_name || target.user_id}
            </span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="toggle-justify">Justificativa</Label>
            <Textarea
              id="toggle-justify"
              rows={4}
              value={justification}
              onChange={e => setJustification(e.target.value)}
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

