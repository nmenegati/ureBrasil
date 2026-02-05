import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Send, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

type SupportMessageRow = Tables<'support_messages'>;

interface AttachmentInfo {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface TicketChatProps {
  ticketId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

export function TicketChat({ ticketId, currentUserId, isAdmin = false }: TicketChatProps) {
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as SupportMessageRow[]);
      }
      setLoading(false);
    };

    loadMessages();

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        payload => {
          const newMessage = payload.new as SupportMessageRow;
          setMessages(prev => [...prev, newMessage]);
          const isFromOther = newMessage.sender_id !== currentUserId;
          if (isFromOther) {
            toast.info(isAdmin ? 'Novo comentário do estudante.' : 'Atualização do suporte.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, currentUserId, isAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, loading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setFiles(Array.from(event.target.files));
  };

  const handleSend = async () => {
    if (!inputText.trim() && files.length === 0) return;
    setSending(true);

    try {
      const attachments: AttachmentInfo[] = [];

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

      const { error } = await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        sender_id: currentUserId,
        message: inputText.trim() || '(anexo)',
        attachments: attachments.length ? attachments : null,
        is_internal: isAdmin ? false : false,
      } as Tables<'support_messages'>['Insert']);

      if (error) {
        toast.error('Erro ao enviar mensagem.');
        return;
      }

      setInputText('');
      setFiles([]);
    } finally {
      setSending(false);
    }
  };

  const renderAttachments = (attachments: unknown) => {
    const list = Array.isArray(attachments) ? (attachments as AttachmentInfo[]) : [];
    if (!list.length) return null;
    return (
      <div className="mt-1 space-y-1">
        {list.map((att, index) => (
          <a
            key={index}
            href={att.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-100 underline break-all"
          >
            {att.name}
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-slate-900 text-slate-50">
      <div className="flex-1 overflow-y-auto p-3 space-y-2" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-300">
            Carregando conversa...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-300">
            Nenhuma mensagem ainda.
          </div>
        ) : (
          messages.map(message => {
            const isMine = message.sender_id === currentUserId;
            const isAdminMessage = isAdmin ? isMine : !isMine;

            return (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  isMine ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-xs',
                    isMine
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-50'
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold">
                      {isAdminMessage ? 'Suporte' : 'Você'}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      {new Date(message.created_at).toLocaleString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {message.message}
                  </div>
                  {renderAttachments(message.attachments as unknown)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-700 p-2 space-y-2">
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 cursor-pointer">
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <Input
            value={inputText}
            onChange={event => setInputText(event.target.value)}
            placeholder="Digite sua mensagem..."
            className="bg-slate-800 border-slate-700 text-slate-50 placeholder:text-slate-500"
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={sending || (!inputText.trim() && files.length === 0)}
            onClick={handleSend}
            className="bg-sky-600 hover:bg-sky-700"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
            {files.map(file => (
              <span key={file.name} className="px-2 py-0.5 rounded-full bg-slate-800">
                {file.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

