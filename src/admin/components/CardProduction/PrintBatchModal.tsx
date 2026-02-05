import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

type PrintViewRow = Tables<'physical_cards_to_print'>;
type StudentCardRow = Tables<'student_cards'>;

interface PrintBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PrintViewRow[];
}

export function PrintBatchModal({ open, onOpenChange, items }: PrintBatchModalProps) {
  const { adminUser } = useAdminAuth();
  const [loading, setLoading] = useState(false);

  const handleClose = (value: boolean) => {
    if (!value) {
      setLoading(false);
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
      const nowIso = new Date().toISOString();

      for (const item of items) {
        if (!item.card_id) continue;

        const { data: cardRow } = await supabase
          .from('student_cards')
          .select('usage_code, valid_until')
          .eq('id', item.card_id)
          .maybeSingle<StudentCardRow>();

        const usageCode = cardRow?.usage_code || '';
        const activationUrl = usageCode
          ? `https://console.urebrasil.com.br/ativar?code=${encodeURIComponent(
              usageCode
            )}`
          : 'https://console.urebrasil.com.br/ativar';

        let qrDataUrl: string | null = null;
        try {
          qrDataUrl = await QRCode.toDataURL(activationUrl);
        } catch {
          qrDataUrl = null;
        }

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        doc.setFontSize(16);
        doc.text('Carteirinha URE - Frente', 20, 20);
        doc.setFontSize(12);
        doc.text(`Nome: ${item.full_name || ''}`, 20, 30);
        doc.text(`CPF: ${item.cpf || ''}`, 20, 36);
        doc.text(`Instituição: ${item.institution || ''}`, 20, 42);
        doc.text(`Curso: ${item.course || ''}`, 20, 48);
        doc.text(`Carteira: ${item.card_number || ''}`, 20, 54);

        doc.setFontSize(16);
        doc.text('Verso / Dados de uso', 20, 70);
        doc.setFontSize(12);
        doc.text(
          `Válida até: ${item.valid_until || cardRow?.valid_until || ''}`,
          20,
          78
        );
        doc.text(`Código de ativação: ${usageCode || '-'}`, 20, 84);

        doc.setFontSize(14);
        doc.text('Carta de envio', 20, 105);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(
          [
            'Olá,',
            '',
            'Sua carteirinha física URE está sendo enviada.',
            'Para ativar sua carteirinha digital, acesse o link abaixo ou escaneie o QR Code:',
            '',
            activationUrl,
            '',
            `Código de ativação: ${usageCode || '-'}`,
          ].join('\n'),
          170
        );
        doc.text(lines, 20, 112);

        if (qrDataUrl) {
          doc.addImage(qrDataUrl, 'PNG', 150, 130, 40, 40);
        }

        const pdfBlob = doc.output('blob');

        const fileName = `card-${item.card_id}-${Date.now()}.pdf`;
        const path = `physical-cards/${item.card_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, pdfBlob, { upsert: true });

        if (uploadError) {
          toast.error('Erro ao salvar PDF de impressão.');
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(path);

        const pdfUrl = urlData?.publicUrl ?? null;

        const adminClient = supabase as any;
        await adminClient
          .from('physical_card_prints')
          .insert({
            card_id: item.card_id,
            pdf_url: pdfUrl,
            status: 'printed',
            created_at: nowIso,
            printed_by: adminUser.userId,
          });

        await supabase
          .from('student_cards')
          .update({
            shipping_status: 'printed' as any,
            updated_at: nowIso,
          })
          .eq('id', item.card_id);

        await adminClient
          .from('admin_actions')
          .insert({
            action_type: 'card_batch_printed',
            card_id: item.card_id,
            performed_by: adminUser.userId,
            details: `Lote impresso em ${nowIso}`,
            created_at: nowIso,
          });
      }

      toast.success('Lote de impressão gerado.');
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar PDF de impressão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Será gerado um lote de impressão para{' '}
            <span className="font-semibold">{items.length}</span>{' '}
            carteirinha(s).
          </p>
          <p className="text-xs text-slate-500">
            Os registros serão gravados em histórico e o status de envio das
            carteirinhas será atualizado para <strong>printed</strong>.
          </p>
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
