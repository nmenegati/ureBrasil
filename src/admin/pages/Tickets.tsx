import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AdminTicketChat } from '@/admin/components/TicketManagement/TicketChat';
import { MaskedCPF } from '@/admin/components/shared/MaskedCPF';

type TicketSummaryRow = Tables<'admin_tickets_summary'>;

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<TicketSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('admin_tickets_summary')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setTickets(data as TicketSummaryRow[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  const filteredTickets = tickets.filter(ticket => {
    if (!ticket.ticket_id) return false;
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
    if (assignedFilter === 'unassigned' && ticket.assigned_to) return false;
    if (assignedFilter === 'assigned' && !ticket.assigned_to) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
            <p className="text-sm text-slate-500">
              Gerencie tickets abertos pelos estudantes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="waiting_user">Aguardando usuário</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="assigned">Atribuídos</SelectItem>
                <SelectItem value="unassigned">Não atribuídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lista de tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-slate-500 px-4 py-3">Carregando tickets...</p>
            ) : filteredTickets.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3">
                Nenhum ticket encontrado com os filtros atuais.
              </p>
            ) : (
              <div className="divide-y">
                {filteredTickets.map(ticket => (
                  <button
                    key={ticket.ticket_id}
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
                    onClick={() => {
                      if (ticket.ticket_id) {
                        setSelectedTicketId(ticket.ticket_id);
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {ticket.student_name}{' '}
                        {ticket.student_cpf && (
                          <>
                            • <MaskedCPF cpf={ticket.student_cpf || undefined} />
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {ticket.status && (
                        <Badge variant="outline" className="text-xs">
                          {ticket.status}
                        </Badge>
                      )}
                      {ticket.message_count != null && (
                        <span className="text-[11px] text-slate-500">
                          {ticket.message_count} msgs
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!selectedTicketId}
          onOpenChange={open => {
            if (!open) setSelectedTicketId(null);
          }}
        >
          <DialogContent className="max-w-4xl h-[75vh]">
            {selectedTicketId && <AdminTicketChat ticketId={selectedTicketId} />}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
