import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { toast } from 'sonner';
import { formatCPF } from '@/lib/validators';

interface MaskedCPFProps {
  cpf: string | null | undefined;
}

export function MaskedCPF({ cpf }: MaskedCPFProps) {
  const { adminUser } = useAdminAuth();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [justification, setJustification] = useState('');

  const numericCpf = useMemo(
    () => (cpf ? cpf.replace(/\D/g, '') : ''),
    [cpf]
  );

  const masked = useMemo(() => {
    if (!numericCpf || numericCpf.length < 5) {
      return '***.***.***-**';
    }
    const last5 = numericCpf.slice(-5); // XXX-XX
    return `***.***.${last5.slice(0, 3)}-${last5.slice(3)}`;
  }, [numericCpf]);

  const formattedFull = useMemo(() => {
    if (!numericCpf) return '';
    return formatCPF(numericCpf);
  }, [numericCpf]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setVisible(false);
    }, 10_000);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleRevealClick = () => {
    if (!numericCpf) return;
    setModalOpen(true);
  };

  const handleConfirmReveal = async () => {
    if (!numericCpf) {
      setModalOpen(false);
      return;
    }
    if (!justification.trim()) {
      toast.error('Justificativa obrigatória para revelar CPF.');
      return;
    }

    try {
      const adminClient = supabase as any;
      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'cpf_revealed',
          performed_by: adminUser?.userId ?? null,
          details: justification.trim(),
          cpf: numericCpf,
          created_at: new Date().toISOString(),
        });
    } catch {
    }

    setModalOpen(false);
    setJustification('');
    setVisible(true);
  };

  if (!numericCpf) {
    return <span className="text-xs text-slate-500">CPF indisponível</span>;
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <span className="font-mono text-xs text-slate-800">
          {visible ? formattedFull : masked}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-slate-500 hover:text-slate-800"
          onClick={visible ? () => setVisible(false) : handleRevealClick}
        >
          {visible ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revelar CPF completo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              O CPF será exibido por até{' '}
              <span className="font-semibold">10 segundos</span>.
              Informe a justificativa para auditoria.
            </p>
            <div className="space-y-2">
              <Label htmlFor="cpf-justify">Justificativa</Label>
              <Textarea
                id="cpf-justify"
                rows={4}
                value={justification}
                onChange={event => setJustification(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirmReveal}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

