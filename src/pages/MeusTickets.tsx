import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TicketChat } from '@/components/TicketChat';
import { NovoTicketModal } from '@/components/NovoTicketModal';
import type { Tables } from '@/integrations/supabase/types';
import { formatDate } from '@/lib/dateUtils';

type TicketRow = Tables<'support_tickets'>;

export default function MeusTickets() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) {
        setTickets(data as TicketRow[]);
      }
      setLoading(false);
    };

    load();
  }, [profile?.id]);

  const handleTicketCreated = (ticketId: string) => {
    const reload = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });
      if (data) {
        setTickets(data as TicketRow[]);
      }
      setSelectedTicketId(ticketId);
    };
    reload();
  };

  const openTickets = tickets.filter(ticket =>
    ticket.status === 'open' ||
    ticket.status === 'in_progress' ||
    ticket.status === 'waiting_user'
  );

  const resolvedTickets = tickets.filter(ticket =>
    ticket.status === 'resolved' || ticket.status === 'closed'
  );

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meus Tickets</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe seus chamados com o suporte URE.
            </p>
          </div>
          <Button onClick={() => setNewTicketOpen(true)}>
            + Novo Ticket
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando tickets...</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Abertos
              </h2>
              {openTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum ticket em aberto.
                </p>
              ) : (
                <div className="space-y-2">
                  {openTickets.map(ticket => (
                    <Card
                      key={ticket.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <CardContent className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Aberto em {formatDate(ticket.created_at)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {ticket.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Resolvidos
              </h2>
              {resolvedTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum ticket resolvido ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {resolvedTickets.map(ticket => (
                    <Card
                      key={ticket.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <CardContent className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criado em {formatDate(ticket.created_at)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {ticket.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <NovoTicketModal
          open={newTicketOpen}
          onOpenChange={setNewTicketOpen}
          studentId={profile?.id ?? null}
          userId={user?.id ?? null}
          onTicketCreated={handleTicketCreated}
        />

        <Dialog
          open={!!selectedTicketId}
          onOpenChange={open => {
            if (!open) setSelectedTicketId(null);
          }}
        >
          <DialogContent className="max-w-2xl h-[70vh]">
            {selectedTicketId && user && (
              <TicketChat
                ticketId={selectedTicketId}
                currentUserId={user.id}
                isAdmin={false}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

