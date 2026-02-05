import { useMemo, useState } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { PrintBatchModal } from '@/admin/components/CardProduction/PrintBatchModal';
import { MaskedCPF } from '@/admin/components/shared/MaskedCPF';

type PrintViewRow = Tables<'physical_cards_to_print'>;

interface PrintQueueProps {
  items: PrintViewRow[];
  onBatchProcessed?: () => void;
}

export function PrintQueue({ items, onBatchProcessed }: PrintQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);

  const toggleSelection = (cardId: string | null | undefined) => {
    if (!cardId) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedItems = useMemo(
    () => items.filter(item => item.card_id && selectedIds.has(item.card_id)),
    [items, selectedIds]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-600">
          {selectedItems.length > 0
            ? `${selectedItems.length} carteirinha(s) selecionada(s)`
            : 'Nenhuma carteirinha selecionada'}
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={clearSelection}
            >
              Limpar seleção
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={selectedItems.length === 0}
            onClick={() => setBatchOpen(true)}
          >
            Gerar PDF Lote
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map(item => {
          const cardId = item.card_id ?? '';
          const checked = cardId !== '' && selectedIds.has(cardId);

          const addressParts = [
            item.street,
            item.number,
            item.complement,
            item.neighborhood,
            item.city,
            item.state,
            item.cep,
          ].filter(Boolean);

          return (
            <Card
              key={cardId || `${item.card_number}-${item.cpf}`}
              className="flex flex-col"
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSelection(cardId)}
                  />
                  <div>
                    <CardTitle className="text-sm">
                      {item.full_name || 'Sem nome'}
                    </CardTitle>
                    <div className="text-xs text-slate-500">
                      <MaskedCPF cpf={item.cpf || undefined} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-700 space-y-1 flex-1">
                <p>
                  <span className="font-semibold">Instituição:</span>{' '}
                  {item.institution || 'Não informada'}
                </p>
                <p>
                  <span className="font-semibold">Curso:</span>{' '}
                  {item.course || 'Não informado'}
                </p>
                <p>
                  <span className="font-semibold">Endereço:</span>{' '}
                  {addressParts.join(', ') || 'Não informado'}
                </p>
                <p>
                  <span className="font-semibold">Carteira:</span>{' '}
                  {item.card_number || 'Sem número'}
                </p>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full">
            Nenhuma carteirinha na fila de impressão.
          </p>
        )}
      </div>

      {batchOpen && selectedItems.length > 0 && (
        <PrintBatchModal
          open={batchOpen}
          onOpenChange={open => {
            setBatchOpen(open);
            if (!open) {
              clearSelection();
              onBatchProcessed?.();
            }
          }}
          items={selectedItems}
        />
      )}
    </div>
  );
}
