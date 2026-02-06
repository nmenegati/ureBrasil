import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { NotificationPreview } from '@/admin/components/Notifications/NotificationPreview';
import { RecipientCounter, NotificationFilters } from '@/admin/components/Notifications/RecipientCounter';

type SendType = 'all' | 'filtered';

const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
  'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

interface ToggleBadgeProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function ToggleBadge({ label, selected, onClick }: ToggleBadgeProps) {
  return (
    <Badge
      variant={selected ? 'default' : 'outline'}
      className={`cursor-pointer text-[11px] px-2 py-0.5 transition-all ${
        selected ? 'bg-sky-600 text-white hover:bg-sky-700' : 'hover:bg-slate-100'
      }`}
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}

export function SendNotificationForm() {
  const { adminUser } = useAdminAuth();
  const [sendType, setSendType] = useState<SendType>('all');
  const [filters, setFilters] = useState<NotificationFilters>({
    state: '',
    city: '',
    educationLevels: [],
    cardTypes: [],
    isPhysical: null,
    cardStatuses: [],
    isLawStudent: false,
  });

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);
   const [showFilters, setShowFilters] = useState(false);

  const handleToggleArray = (key: keyof NotificationFilters, value: string) => {
    setFilters(prev => {
      const current = (prev as any)[key] as string[];
      const exists = current.includes(value);
      const next = exists ? current.filter(item => item !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !message.trim()) {
      toast.error('Título e mensagem são obrigatórios.');
      return;
    }

    if (title.length > 60) {
      toast.error('Título deve ter no máximo 60 caracteres.');
      return;
    }

    if (message.length > 500) {
      toast.error('Mensagem deve ter no máximo 500 caracteres.');
      return;
    }

    if (!adminUser) {
      toast.error('Sessão de administrador inválida.');
      return;
    }

    setSending(true);

    try {
      const client = supabase as any;
      const nowIso = new Date().toISOString();

      let query = client
        .from('student_profiles')
        .select('user_id, city, state, education_level, is_law_student, id', {
          count: 'exact',
        })
        .not('user_id', 'is', null);

      if (sendType === 'filtered') {
        if (filters.state) {
          query = query.eq('state', filters.state);
        }
        if (filters.city) {
          query = query.ilike('city', `%${filters.city}%`);
        }
        if (filters.educationLevels.length > 0) {
          query = query.in('education_level', filters.educationLevels);
        }
        if (filters.isLawStudent === true) {
          query = query.eq('is_law_student', true);
        }

        const needsCardJoin =
          filters.cardTypes.length > 0 ||
          filters.cardStatuses.length > 0 ||
          filters.isPhysical != null;

        if (needsCardJoin) {
          query = client
            .from('student_profiles')
            .select(
              'user_id, city, state, education_level, is_law_student, id, student_cards!inner(status,card_type,is_physical)',
            )
            .not('user_id', 'is', null);

          if (filters.state) {
            query = query.eq('state', filters.state);
          }
          if (filters.city) {
            query = query.ilike('city', `%${filters.city}%`);
          }
          if (filters.educationLevels.length > 0) {
            query = query.in('education_level', filters.educationLevels);
          }
          if (filters.isLawStudent === true) {
            query = query.eq('is_law_student', true);
          }
          if (filters.cardTypes.length > 0) {
            query = query.in('student_cards.card_type', filters.cardTypes);
          }
          if (filters.cardStatuses.length > 0) {
            query = query.in('student_cards.status', filters.cardStatuses);
          }
          if (filters.isPhysical != null) {
            query = query.eq('student_cards.is_physical', filters.isPhysical);
          }
        }
      }

      const { data, error, count } = await query;

      if (error) {
        toast.error('Erro ao calcular destinatários.');
        return;
      }

      const recipients = (data || []).filter((row: any) => row.user_id);

      if (recipients.length === 0) {
        toast.error('Nenhum destinatário encontrado para os filtros selecionados.');
        return;
      }

      const notificationsPayload = recipients.map((row: any) => ({
        user_id: row.user_id,
        type: 'admin_broadcast',
        title: title.trim(),
        message: message.trim(),
        read: false,
        created_at: nowIso,
      }));

      console.log('[NOTIF] Enviando notificações:', {
        total: notificationsPayload.length,
        sample: notificationsPayload[0],
      });

      const { error: insertError } = await client
        .from('notifications')
        .insert(notificationsPayload);

      console.log('[NOTIF] Resultado insert notifications:', insertError);

      if (insertError) {
        toast.error('Erro ao enviar notificações.');
        return;
      }

      const filtersJson = {
        sendType,
        ...filters,
      };

      await client
        .from('admin_notifications_sent')
        .insert({
          title: title.trim(),
          message: message.trim(),
          link: link.trim() || null,
          filters: filtersJson,
          total_recipients: count ?? recipients.length,
          sent_by: adminUser.userId,
          created_at: nowIso,
        });

      await client
        .from('admin_actions')
        .insert({
          action_type: 'notification_sent',
          performed_by: adminUser.userId,
          details: `Notificação "${title.trim()}" enviada para ${count ?? recipients.length} usuários.`,
          created_at: nowIso,
        });

      toast.success(`${count ?? recipients.length} notificações enviadas com sucesso.`);
      setTitle('');
      setMessage('');
      setLink('');
    } finally {
      setSending(false);
    }
  };

  const locationParts: string[] = [];
  if (filters.state) locationParts.push(filters.state);
  if (filters.city) locationParts.push(filters.city);

  const profileParts: string[] = [];
  if (filters.educationLevels.length > 0) {
    profileParts.push(filters.educationLevels.join(', '));
  }
  if (filters.isLawStudent) {
    profileParts.push('Direito');
  }

  const carteiraParts: string[] = [];
  if (filters.cardStatuses.includes('active')) {
    carteiraParts.push('Ativa');
  }
  if (
    filters.cardStatuses.includes('pending_docs') ||
    filters.cardStatuses.includes('pending_payment')
  ) {
    carteiraParts.push('Pendente');
  }
  if (filters.isPhysical === true) {
    carteiraParts.push('Física');
  }
  if (filters.isPhysical === false) {
    carteiraParts.push('Digital');
  }

  const hasAnyFilter =
    locationParts.length > 0 ||
    profileParts.length > 0 ||
    carteiraParts.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Nova notificação
            </span>
            <span className="text-[11px] text-slate-500">
              Selecione o público e personalize a mensagem.
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">
                Destinatários
              </span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-[11px] flex items-center gap-1 transition-colors ${
                    sendType === 'all'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setSendType('all');
                    setShowFilters(false);
                  }}
                >
                  Todos os usuários
                  <RecipientCounter
                    sendType="all"
                    filters={filters}
                    render={({ loading, count }) => (
                      <Badge
                        variant={sendType === 'all' ? 'secondary' : 'outline'}
                        className="ml-1 text-[10px] px-1.5 py-0"
                      >
                        {loading || count === null ? '...' : count ?? 0}
                      </Badge>
                    )}
                  />
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-[11px] flex items-center gap-1 border-l border-slate-200 transition-colors ${
                    sendType === 'filtered'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setSendType('filtered');
                    setShowFilters(true);
                  }}
                >
                  Usuários filtrados
                  <RecipientCounter
                    sendType="filtered"
                    filters={filters}
                    render={({ loading, count }) => (
                      <Badge
                        variant={sendType === 'filtered' ? 'secondary' : 'outline'}
                        className="ml-1 text-[10px] px-1.5 py-0"
                      >
                        {loading || count === null ? '...' : count ?? 0}
                      </Badge>
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {sendType === 'filtered' && (
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="truncate">
                Filtros:{' '}
                {hasAnyFilter
                  ? [
                      locationParts.length ? `Localização (${locationParts.join(', ')})` : null,
                      profileParts.length ? `Perfil (${profileParts.join(', ')})` : null,
                      carteiraParts.length ? `Carteira (${carteiraParts.join(', ')})` : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')
                  : 'nenhum filtro adicional'}
              </span>
              <button
                type="button"
                className="ml-2 text-[11px] font-medium text-sky-700 hover:text-sky-800"
                onClick={() => setShowFilters(prev => !prev)}
              >
                {showFilters ? 'Fechar filtros' : 'Editar filtros'}
              </button>
            </div>
          )}

          {sendType === 'filtered' && showFilters && (
            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Localização
                  </Label>
                  <select
                    className="h-8 px-2 rounded-md border border-slate-300 bg-white text-xs"
                    value={filters.state || ''}
                    onChange={event =>
                      setFilters(prev => ({ ...prev, state: event.target.value || '' }))
                    }
                  >
                    <option value="">Todos os estados</option>
                    {BRAZIL_STATES.map(uf => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={filters.city || ''}
                    onChange={event =>
                      setFilters(prev => ({ ...prev, city: event.target.value }))
                    }
                    placeholder="Cidade"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Perfil
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {['Médio', 'Superior', 'Pós'].map(level => (
                      <ToggleBadge
                        key={level}
                        label={level}
                        selected={filters.educationLevels.includes(level)}
                        onClick={() => handleToggleArray('educationLevels', level)}
                      />
                    ))}
                    <ToggleBadge
                      label="Direito"
                      selected={!!filters.isLawStudent}
                      onClick={() =>
                        setFilters(prev => ({
                          ...prev,
                          isLawStudent: !prev.isLawStudent,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Carteira
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    <ToggleBadge
                      label="Ativa"
                      selected={filters.cardStatuses.includes('active')}
                      onClick={() => handleToggleArray('cardStatuses', 'active')}
                    />
                    <ToggleBadge
                      label="Pendente"
                      selected={filters.cardStatuses.includes('pending_payment')}
                      onClick={() =>
                        handleToggleArray('cardStatuses', 'pending_payment')
                      }
                    />
                    <ToggleBadge
                      label="Física"
                      selected={filters.isPhysical === true}
                      onClick={() =>
                        setFilters(prev => ({
                          ...prev,
                          isPhysical: prev.isPhysical === true ? null : true,
                        }))
                      }
                    />
                    <ToggleBadge
                      label="Digital"
                      selected={filters.isPhysical === false}
                      onClick={() =>
                        setFilters(prev => ({
                          ...prev,
                          isPhysical: prev.isPhysical === false ? null : false,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  maxLength={60}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-slate-500">
                  {title.length}/60 caracteres
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  maxLength={500}
                  rows={5}
                  className="text-xs"
                />
                <p className="text-[10px] text-slate-500">
                  {message.length}/500 caracteres
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link / CTA (opcional)</Label>
                <Input
                  value={link}
                  onChange={event => setLink(event.target.value)}
                  placeholder="https://"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-700">
                Preview da notificação
              </Label>
              <div className="mt-1">
                <NotificationPreview title={title} message={message} link={link} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={sending || !title.trim() || !message.trim()} className="w-full md:w-auto">
              {sending ? 'Enviando…' : 'Enviar notificação'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
