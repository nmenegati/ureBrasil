import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Paperclip } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TicketChat } from "@/components/TicketChat";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type TicketRow = Tables<"support_tickets">;

type SupportView = "list" | "new" | "new-form" | "conversation";

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
  defaultCategory?: string;
  initialTicketId?: string | null;
}

interface DraftData {
  category: string;
  description: string;
  attachmentName?: string | null;
  timestamp: number;
}

const DRAFT_KEY = "support-draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const CATEGORY_OPTIONS = [
  "Documento rejeitado",
  "Problema com pagamento",
  "Dados incorretos na carteirinha",
  "Carteirinha não gerou",
  "Trocar foto da carteirinha",
  "Outro",
];

function getPlaceholderForCategory(category: string): string {
  switch (category) {
    case "Documento rejeitado":
      return "Qual documento foi rejeitado e o que você já tentou?";
    case "Problema com pagamento":
      return "Descreva o problema. Inclua método de pagamento usado.";
    case "Dados incorretos na carteirinha":
      return "Quais dados estão errados na carteirinha?";
    case "Carteirinha não gerou":
      return "Descreva o que acontece ao tentar gerar.";
    case "Trocar foto da carteirinha":
      return "Por que deseja trocar a foto?";
    default:
      return "Descreva sua solicitação com detalhes.";
  }
}

function statusBadge(status: TicketRow["status"]) {
  let label = status;
  let className = "";

  if (status === "open") {
    label = "Aberto";
    className = "bg-amber-100 text-amber-800 border-amber-200";
  } else if (status === "in_progress" || status === "waiting_user") {
    label = "Em andamento";
    className = "bg-sky-100 text-sky-800 border-sky-200";
  } else if (status === "resolved" || status === "closed") {
    label = "Resolvido";
    className = "bg-emerald-100 text-emerald-800 border-emerald-200";
  }

  return (
    <Badge variant="outline" className={`text-[11px] ${className}`}>
      {label}
    </Badge>
  );
}

export function SupportModal({
  open,
  onClose,
  defaultCategory,
  initialTicketId,
}: SupportModalProps) {
  const { user, profile } = useAuth();
  const [view, setView] = useState<SupportView>("list");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);

  const [category, setCategory] = useState(defaultCategory || "");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const hasTickets = tickets.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadTickets = async () => {
      if (!profile?.id) return;
      setLoadingTickets(true);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTickets(data as TicketRow[]);
      }
      setLoadingTickets(false);
    };

    loadTickets();

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DraftData;
          const age = Date.now() - parsed.timestamp;
          if (age < DRAFT_TTL_MS) {
            setCategory(parsed.category);
            setDescription(parsed.description);
            setView("new-form");
          } else {
            window.localStorage.removeItem(DRAFT_KEY);
          }
        } catch {
          window.localStorage.removeItem(DRAFT_KEY);
        }
      }
    }
  }, [open, profile?.id]);

  useEffect(() => {
    if (!open) return;
    if (!initialTicketId) {
      setView(hasTickets ? "list" : "new");
      return;
    }
    const ticket = tickets.find((t) => t.id === initialTicketId);
    if (ticket) {
      setSelectedTicket(ticket);
      setView("conversation");
    } else {
      setView(hasTickets ? "list" : "new");
    }
  }, [open, initialTicketId, tickets, hasTickets]);

  useEffect(() => {
    if (!open) return;
    if (defaultCategory && !category) {
      setCategory(defaultCategory);
    }
  }, [open, defaultCategory, category]);

  useEffect(() => {
    if (!open) return;
    if (!view || view !== "new-form") return;

    if (typeof window === "undefined") return;
    const payload: DraftData = {
      category,
      description,
      attachmentName: attachment?.name ?? null,
      timestamp: Date.now(),
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
    }
  }, [open, view, category, description, attachment?.name]);

  const handleClose = () => {
    setView("list");
    setSelectedTicket(null);
    onClose();
  };

  const openTickets = useMemo(
    () =>
      tickets.filter(
        (t) =>
          t.status === "open" ||
          t.status === "in_progress" ||
          t.status === "waiting_user",
      ),
    [tickets],
  );

  const resolvedTickets = useMemo(
    () =>
      tickets.filter(
        (t) => t.status === "resolved" || t.status === "closed",
      ),
    [tickets],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens (JPEG, PNG) são permitidas.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Tamanho máximo do anexo é 5MB.");
      return;
    }
    setAttachment(file);
  };

  const handleCreateTicket = async () => {
    if (!user || !profile?.id) {
      toast.error("Perfil não carregado.");
      return;
    }
    if (!category) {
      toast.error("Selecione uma categoria.");
      return;
    }
    if (!description || description.trim().length < 20) {
      toast.error("A descrição deve ter pelo menos 20 caracteres.");
      return;
    }

    setSending(true);

    try {
      let attachmentUrl: string | null = null;

      if (attachment) {
        const ext = attachment.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("support-attachments")
          .upload(path, attachment, { upsert: true });

        if (uploadError) {
          toast.error("Erro ao enviar anexo.");
        } else {
          const { data } = supabase.storage
            .from("support-attachments")
            .getPublicUrl(path);
          attachmentUrl = data?.publicUrl ?? null;
        }
      }

      const subjectText = category;

      const { data: ticketRow, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          student_id: profile.id,
          subject: subjectText,
          message: description.trim(),
          status: "open",
          priority: "medium",
          category,
          is_automatic: false,
        } as any)
        .select("*")
        .maybeSingle<TicketRow>();

      if (ticketError || !ticketRow) {
        toast.error("Erro ao criar solicitação.");
        return;
      }

      const ticketId = ticketRow.id;

      const attachments =
        attachment && attachmentUrl
          ? [
              {
                name: attachment.name,
                url: attachmentUrl,
                size: attachment.size,
                type: attachment.type,
              },
            ]
          : [];

      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          message: description.trim(),
          attachments: attachments.length ? attachments : null,
          is_internal: false,
        } as Tables<"support_messages">["Insert"]);

      if (messageError) {
        toast.error("Erro ao salvar mensagem da solicitação.");
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_KEY);
      }

      toast.success(
        "Solicitação enviada! Prazo de resposta: até 24h úteis.",
      );

      setCategory(defaultCategory || "");
      setDescription("");
      setAttachment(null);

      setTickets((prev) => [ticketRow, ...prev]);
      setSelectedTicket(ticketRow);
      setView("conversation");
    } finally {
      setSending(false);
    }
  };

  const handleOpenAutoChat = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ure-open-chat"));
    }
    handleClose();
  };

  const renderNewFormView = () => {
    const placeholder = getPlaceholderForCategory(
      category || defaultCategory || "Outro",
    );

    return (
      <div className="flex flex-col h-full">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Suporte URE
            </p>
            <h2 className="text-lg font-bold text-foreground">
              Nova solicitação
            </h2>
          </div>
          {hasTickets && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
            >
              Minhas solicitações
            </Button>
          )}
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Categoria
            </label>
            <Select
              value={category || defaultCategory || ""}
              onValueChange={setCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Descrição
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder={placeholder}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {description.length}/1000
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Anexo (opcional)
            </label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer hover:bg-muted">
                <Paperclip className="w-4 h-4" />
                <span>Anexar imagem</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {attachment && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate max-w-[180px]">
                    {attachment.name}
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setAttachment(null)}
                  >
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-3 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
          >
            Fechar
          </Button>
          <Button
            size="sm"
            disabled={
              sending ||
              !category ||
              !description ||
              description.trim().length < 20
            }
            onClick={handleCreateTicket}
          >
            {sending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {sending ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Suporte URE Brasil
            </p>
            <h2 className="text-lg font-bold text-foreground">
              Suas solicitações
            </h2>
          </div>
          <Button size="sm" onClick={() => setView("new")}>
            <MessageCircle className="w-4 h-4 mr-1" />
            Nova solicitação
          </Button>
        </div>

        {loadingTickets ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Carregando solicitações...
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-muted-foreground space-y-3">
            <p>Você ainda não abriu nenhuma solicitação.</p>
            <Button size="sm" onClick={() => setView("new")}>
              Abrir primeira solicitação
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                Em andamento
              </h3>
              {openTickets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma solicitação em aberto.
                </p>
              ) : (
                <div className="space-y-2">
                  {openTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md border hover:bg-muted text-left"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setView("conversation");
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Aberto em{" "}
                          {new Date(ticket.created_at).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>
                      </div>
                      {statusBadge(ticket.status)}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                Encerrados
              </h3>
              {resolvedTickets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma solicitação encerrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {resolvedTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md border hover:bg-muted text-left"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setView("conversation");
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Criado em{" "}
                          {new Date(ticket.created_at).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>
                      </div>
                      {statusBadge(ticket.status)}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <div className="pt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
  };

  const renderConversationView = () => {
    if (!selectedTicket || !user) {
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              Conversa
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setView("list")}>
              Voltar
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Selecione uma solicitação para visualizar.
          </div>
        </div>
      );
    }

    const isResolved =
      selectedTicket.status === "resolved" ||
      selectedTicket.status === "closed";

    return (
      <div className="flex flex-col h-full">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">
              Suporte URE
            </p>
            <h2 className="text-sm font-bold text-foreground">
              {selectedTicket.subject}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(selectedTicket.status)}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedTicket(null);
                setView("list");
              }}
            >
              Voltar
            </Button>
          </div>
        </div>

        {isResolved && (
          <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 flex items-center justify-between gap-2">
            <span>Esta solicitação foi encerrada.</span>
            <Button
              size="xs"
              onClick={() => {
                setSelectedTicket(null);
                setView("new");
              }}
            >
              Abrir nova
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <TicketChat
            ticketId={selectedTicket.id}
            currentUserId={user.id}
            isAdmin={false}
          />
        </div>
      </div>
    );
  };

  const renderView = () => {
    if (view === "new") return (
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Suporte URE
          </p>
          <h2 className="text-lg font-bold text-foreground">
            Precisa de ajuda?
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-4">
          <p className="text-sm text-muted-foreground max-w-sm">
            Muitas dúvidas podem ser resolvidas rapidamente pelo nosso atendimento automático.
          </p>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleOpenAutoChat}
          >
            Falar com atendimento automático
          </Button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground w-full max-w-xs">
            <span className="flex-1 border-t" />
            <span>ou</span>
            <span className="flex-1 border-t" />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setView("new-form")}
          >
            Abrir solicitação com atendente
          </Button>
        </div>
        <div className="pt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
    if (view === "new-form") return renderNewFormView();
    if (view === "conversation") return renderConversationView();
    return renderListView();
  };

  return (
    <Dialog open={open} onOpenChange={(openValue) => !openValue && handleClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4" />
            Suporte
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fale com nossa equipe, acompanhe tickets e abra novas solicitações.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex-1 min-h-0">{renderView()}</div>
      </DialogContent>
    </Dialog>
  );
}
