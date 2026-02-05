import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

interface NovoTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  userId: string | null;
  onTicketCreated?: (ticketId: string) => void;
}

const CATEGORIES = [
  { value: 'Pagamento', label: 'Pagamento' },
  { value: 'Documentos', label: 'Documentos' },
  { value: 'Carteirinha', label: 'Carteirinha' },
  { value: 'Outros', label: 'Outros' },
];

export function NovoTicketModal({
  open,
  onOpenChange,
  studentId,
  userId,
  onTicketCreated,
}: NovoTicketModalProps) {
  const [category, setCategory] = useState('Pagamento');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setCategory('Pagamento');
    setSubject('');
    setMessage('');
    setFiles([]);
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      resetState();
    }
    onOpenChange(value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setFiles(Array.from(event.target.files));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studentId || !userId) {
      toast.error('Perfil não carregado.');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error('Preencha assunto e mensagem.');
      return;
    }

    setLoading(true);

    try {
      const subjectText = `${category} – ${subject.trim()}`;

      const { data: ticketRow, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          student_id: studentId,
          subject: subjectText,
          message: message.trim(),
          status: 'open',
        } as Tables<'support_tickets'>['Insert'])
        .select('id')
        .maybeSingle();

      if (ticketError || !ticketRow?.id) {
        toast.error('Erro ao criar ticket.');
        return;
      }

      const ticketId = ticketRow.id as string;

      const attachments: { name: string; url: string; size: number; type: string }[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `support-tickets/${ticketId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(path, file, { upsert: true });

        if (uploadError) {
          toast.error('Erro ao enviar anexo.');
          continue;
        }

        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        if (data?.publicUrl) {
          attachments.push({
            name: file.name,
            url: data.publicUrl,
            size: file.size,
            type: file.type,
          });
        }
      }

      const { error: messageError } = await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        sender_id: userId,
        message: message.trim(),
        attachments: attachments.length ? attachments : null,
        is_internal: false,
      } as Tables<'support_messages'>['Insert']);

      if (messageError) {
        toast.error('Erro ao salvar mensagem do ticket.');
        return;
      }

      toast.success('Ticket criado com sucesso.');
      onTicketCreated?.(ticketId);
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Ticket de Suporte</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={event => setSubject(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              rows={4}
              value={message}
              onChange={event => setMessage(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attachments">Anexos (opcional)</Label>
            <Input
              id="attachments"
              type="file"
              multiple
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} arquivo(s) selecionado(s)
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Enviando...' : 'Criar Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

