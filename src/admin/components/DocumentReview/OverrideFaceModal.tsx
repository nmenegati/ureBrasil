import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface OverrideFaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  onOverridden?: () => void;
}

export function OverrideFaceModal({
  open,
  onOpenChange,
  studentId,
  onOverridden,
}: OverrideFaceModalProps) {
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
    if (!justification.trim()) {
      toast.error('Justificativa obrigatória para override.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('student_profiles')
        .update({
          face_validated: true,
        })
        .eq('id', studentId);

      if (updateError) {
        toast.error('Erro ao aplicar override de face.');
        return;
      }

      const adminClient = supabase as any;
      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'face_validation_override',
          student_id: studentId,
          performed_by: adminUser.userId,
          details: justification.trim(),
          created_at: new Date().toISOString(),
        });

      toast.success('Override de face aplicado.');
      onOverridden?.();
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override de validação facial</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="face-override-notes">Justificativa</Label>
            <Textarea
              id="face-override-notes"
              rows={4}
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
              Confirmar override
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

