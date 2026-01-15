import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, X, Send, Loader2, LifeBuoy, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  shouldEscalate?: boolean;
}

interface ChatWidgetProps {
  rejectedDocs?: { type: string; reason: string }[];
}

export function ChatWidget({ rejectedDocs = [] }: ChatWidgetProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessage: Message = {
        role: 'assistant',
        content: 'Olá! 👋 Sou o assistente virtual da URE. Como posso ajudar com sua carteirinha hoje?'
      };
      
      if (rejectedDocs.length > 0) {
        initialMessage.content += '\n\nVi que você teve alguns documentos rejeitados. Posso te ajudar a corrigir isso!';
      }
      
      setMessages([initialMessage]);
      setHasUnread(true);
    }
  }, [rejectedDocs, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setHasUnread(false);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    
    // Add user message
    const newMessages = [
      ...messages,
      { role: 'user', content: userMessage } as Message
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-support', {
        body: {
          message: userMessage,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          context: {
            student_id: user?.id,
            student_name: user?.user_metadata?.full_name,
            rejected_docs: rejectedDocs
          }
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        shouldEscalate: data.shouldEscalate
      };

      setMessages([...newMessages, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Não foi possível enviar a mensagem. Tente novamente.');
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Desculpe, tive um problema técnico. Por favor, tente novamente em alguns instantes.' } as Message
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-[350px] sm:w-[380px] max-w-[calc(100vw-32px)] bg-background border border-border rounded-xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col h-[500px] max-h-[calc(100vh-120px)]"
          >
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Suporte URE</h3>
                  <p className="text-xs text-primary-foreground/80 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Online agora
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary-foreground hover:bg-white/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50"
            >
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <Avatar className="w-8 h-8 mt-1 border">
                    {msg.role === 'user' ? (
                      <>
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                      </>
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <div className="flex flex-col gap-2">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2 text-sm shadow-sm",
                        msg.role === 'user' 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-white dark:bg-slate-800 border border-border rounded-tl-none"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Escalation Button */}
                    {msg.shouldEscalate && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-2 mt-1"
                      >
                        <Button 
                          size="sm" 
                          className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                          onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
                        >
                          <LifeBuoy className="w-4 h-4" />
                          Falar com Atendente
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center">
                          Disponível seg-sex 9h às 18h
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <Avatar className="w-8 h-8 mt-1 border">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-background border-t border-border">
              <div className="relative flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Digite sua dúvida..."
                  className="pr-10 bg-slate-50 dark:bg-slate-900"
                  disabled={isLoading}
                />
                <Button 
                  size="icon" 
                  className={cn(
                    "absolute right-1 w-8 h-8 transition-all",
                    inputText.trim() ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
                  )}
                  onClick={handleSendMessage}
                  disabled={isLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto bg-primary text-primary-foreground w-14 h-14 rounded-full shadow-lg shadow-primary/25 flex items-center justify-center relative hover:bg-primary/90 transition-colors"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle className="w-7 h-7" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread Badge */}
        {!isOpen && hasUnread && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-background animate-pulse" />
        )}
      </motion.button>
    </div>
  );
}
