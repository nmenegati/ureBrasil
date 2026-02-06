import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface HistoryRow {
  id: string;
  created_at: string;
  title: string | null;
  message: string | null;
  link: string | null;
  filters: any | null;
  total_recipients: number | null;
  sent_by: string | null;
}

export function HistoryTable() {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryRow | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const client = supabase as any;
      const { data, error } = await client
        .from('admin_notifications_sent')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setItems(
          data.map((row: any) => ({
            id: row.id,
            created_at: row.created_at,
            title: row.title ?? null,
            message: row.message ?? null,
            link: row.link ?? null,
            filters: row.filters ?? null,
            total_recipients: row.total_recipients ?? null,
            sent_by: row.sent_by ?? null,
          }))
        );
      }
      setLoading(false);
    };

    load();
  }, []);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-md border bg-white">
            {loading ? (
              <p className="text-sm text-slate-500 px-4 py-3">
                Carregando histórico de notificações...
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3">
                Nenhuma notificação enviada ainda.
              </p>
            ) : (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-40">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">
                      Título
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-40">
                      Destinatários
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-40">
                      Enviado por
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-800">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold truncate">
                            {item.title || 'Sem título'}
                          </span>
                          {item.filters && (
                            <div className="flex flex-wrap gap-1">
                              {item.filters.state && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700">
                                  UF: {item.filters.state}
                                </span>
                              )}
                              {item.filters.city && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700">
                                  {item.filters.city}
                                </span>
                              )}
                              {item.filters.cardTypes &&
                                item.filters.cardTypes.length > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700">
                                    Tipos: {item.filters.cardTypes.join(', ')}
                                  </span>
                                )}
                              {item.filters.cardStatuses &&
                                item.filters.cardStatuses.length > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700">
                                    Status: {item.filters.cardStatuses.join(', ')}
                                  </span>
                                )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                        {item.total_recipients ?? '-'}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                        {item.sent_by || '-'}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setSelected(item)}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={open => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da notificação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-xs text-slate-700">
              <p>
                <span className="font-semibold">Título:</span>{' '}
                {selected.title || '-'}
              </p>
              <p>
                <span className="font-semibold">Mensagem:</span>{' '}
                {selected.message || '-'}
              </p>
              <p>
                <span className="font-semibold">Link:</span>{' '}
                {selected.link || '-'}
              </p>
              <p>
                <span className="font-semibold">Destinatários:</span>{' '}
                {selected.total_recipients ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Enviado por:</span>{' '}
                {selected.sent_by || '-'}
              </p>
              {selected.filters && (
                <div className="mt-2">
                  <p className="font-semibold mb-1">Filtros utilizados</p>
                  <pre className="whitespace-pre-wrap break-words max-h-64 overflow-auto bg-slate-50 border rounded p-2">
                    {JSON.stringify(selected.filters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

