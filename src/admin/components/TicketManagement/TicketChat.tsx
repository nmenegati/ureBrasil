import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TicketChat as BaseTicketChat } from '@/components/TicketChat';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { toast } from 'sonner';

type TicketRow = Tables<'support_tickets'>;
type StudentStatusRow = Tables<'student_full_status'>;

interface AdminTicketChatProps {
  ticketId: string;
}

export function AdminTicketChat({ ticketId }: AdminTicketChatProps) {
  const { user } = useAdminAuth();
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [student, setStudent] = useState<StudentStatusRow | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: ticketRow } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle<TicketRow>();

      if (ticketRow) {
        setTicket(ticketRow);

        const { data: studentRow } = await supabase
          .from('student_full_status')
          .select('*')
          .eq('student_id', ticketRow.student_id)
          .maybeSingle<StudentStatusRow>();

        if (studentRow) {
          setStudent(studentRow);
        }
      }
    };

    load();
  }, [ticketId]);

  const handleAssignToMe = async () => {
    if (!ticket || !user) return;

    const nextStatus =
      ticket.status === 'open' ? 'in_progress' : ticket.status;

    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
        status: nextStatus,
      })
      .eq('id', ticket.id)
      .select('*')
      .maybeSingle<TicketRow>();

    if (error || !data) {
      toast.error('Erro ao atribuir ticket.');
      return;
    }

    setTicket(data);
    toast.success('Ticket atribuído a você.');
  };

  const handleResolve = async () => {
    if (!ticket || !user) return;

    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      } as Tables<'support_tickets'>['Update'])
      .eq('id', ticket.id)
      .select('*')
      .maybeSingle<TicketRow>();

    if (error || !data) {
      toast.error('Erro ao resolver ticket.');
      return;
    }

    setTicket(data);
    toast.success('Ticket marcado como resolvido.');
  };

  const handleEscalate = async () => {
    if (!ticket) return;

    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        priority: 'high',
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
      } as Tables<'support_tickets'>['Update'])
      .eq('id', ticket.id)
      .select('*')
      .maybeSingle<TicketRow>();

    if (error || !data) {
      toast.error('Erro ao escalar ticket.');
      return;
    }

    setTicket(data);
    toast.success('Ticket escalado com prioridade alta.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 h-full">
      <div className="h-full">
        {user && (
          <BaseTicketChat
            ticketId={ticketId}
            currentUserId={user.id}
            isAdmin
          />
        )}
      </div>
      <div className="h-full flex flex-col gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">Dados do estudante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {student ? (
              <>
                <div>
                  <p className="text-xs text-slate-500">Nome</p>
                  <p className="font-medium">{student.full_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">CPF</p>
                    <p>{student.cpf}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Telefone</p>
                    <p>{student.phone}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Instituição</p>
                  <p>{student.institution}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Curso</p>
                  <p>{student.course}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Carteira</p>
                    <p>{student.card_number || 'Sem carteirinha'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <Badge variant="outline" className="text-xs">
                      {student.card_status || 'sem_status'}
                    </Badge>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Carregando dados...</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ticket ? (
              <>
                <div>
                  <p className="text-xs text-slate-500">Assunto</p>
                  <p className="font-medium">{ticket.subject}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <Badge variant="outline" className="text-xs">
                      {ticket.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Prioridade</p>
                    <p>{ticket.priority || 'normal'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleAssignToMe}
                  >
                    Atribuir a mim
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleEscalate}
                  >
                    Escalar
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    onClick={handleResolve}
                    disabled={ticket.status === 'resolved' || ticket.status === 'closed'}
                  >
                    Resolver
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Carregando ticket...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
