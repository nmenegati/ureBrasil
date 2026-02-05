import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface ShippingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
}

export function ShippingModal({ open, onOpenChange, cardId }: ShippingModalProps) {
  const { adminUser } = useAdminAuth();
  const [trackingCode, setTrackingCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = (value: boolean) => {
    if (!value) {
      setTrackingCode('');
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!adminUser) {
      toast.error('Sessão de administrador inválida.');
      return;
    }
    if (!trackingCode.trim()) {
      toast.error('Informe o código de rastreio.');
      return;
    }

    setLoading(true);

    try {
      const nowIso = new Date().toISOString();

      const { error: cardUpdateError } = await supabase
        .from('student_cards')
        .update({
          shipping_code: trackingCode.trim(),
          shipped_at: nowIso,
          shipping_status: 'shipped' as any,
          updated_at: nowIso,
        })
        .eq('id', cardId);

      if (cardUpdateError) {
        toast.error('Erro ao atualizar status de envio.');
        return;
      }

      const adminClient = supabase as any;
      await adminClient
        .from('physical_card_prints')
        .update({
          sent_at: nowIso,
          tracking_code: trackingCode.trim(),
        })
        .eq('card_id', cardId);

      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'card_shipped',
          card_id: cardId,
          performed_by: adminUser.userId,
          details: `Rastreio: ${trackingCode.trim()}`,
          created_at: nowIso,
        });

      toast.success('Envio registrado com sucesso.');
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar envio da carteirinha</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="shipping-tracking">Código de rastreio (Correios)</Label>
            <Input
              id="shipping-tracking"
              value={trackingCode}
              onChange={event => setTrackingCode(event.target.value)}
              placeholder="Ex.: PX123456789BR"
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
              Confirmar envio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

