import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default function Notificacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const client = supabase as any;
      const { data } = await client
        .from('notifications')
        .select('id, title, message, link, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setNotifications(data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const markAsRead = async (id: string) => {
    const client = supabase as any;
    await client.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.read) await markAsRead(notification.id);
    if (notification.link) {
      if (notification.link.startsWith('/')) {
        navigate(notification.link);
      } else {
        window.open(notification.link, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Notificações</h1>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Bell className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhuma notificação ainda.</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <ul className="flex flex-col gap-2">
            {notifications.map(notification => (
              <li
                key={notification.id}
                onClick={() => handleClick(notification)}
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  !notification.read
                    ? 'bg-muted border-primary/20'
                    : 'bg-card border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                    {notification.title}
                  </span>
                  {!notification.read && (
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {notification.message}
                </p>
                <span className="text-xs text-muted-foreground mt-2 block">
                  {formatDate(notification.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
