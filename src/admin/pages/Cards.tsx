import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PrintQueue } from '@/admin/components/CardProduction/PrintQueue';
import { ShippingModal } from '@/admin/components/CardProduction/ShippingModal';
import { MaskedCPF } from '@/admin/components/shared/MaskedCPF';

type PhysicalCardViewRow = Tables<'physical_cards_to_print'>;
type ShippingStatus = Enums<'shipping_status'> | 'printed';

export default function AdminCardsPage() {
  const [items, setItems] = useState<PhysicalCardViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'printed' | 'shipped' | 'delivered'>('queue');
  const [shippingCardId, setShippingCardId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('physical_cards_to_print')
      .select('*')
      .order('issued_at', { ascending: true });

    if (data) {
      setItems(data as PhysicalCardViewRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const queueItems = useMemo(
    () =>
      items.filter(
        item =>
          !item.shipping_status ||
          item.shipping_status === ('pending' as ShippingStatus)
      ),
    [items]
  );

  const printedItems = useMemo(
    () =>
      items.filter(
        item => item.shipping_status === ('printed' as ShippingStatus)
      ),
    [items]
  );

  const shippedItems = useMemo(
    () =>
      items.filter(
        item => item.shipping_status === ('shipped' as ShippingStatus)
      ),
    [items]
  );

  const deliveredItems = useMemo(
    () =>
      items.filter(
        item => item.shipping_status === ('delivered' as ShippingStatus)
      ),
    [items]
  );

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Produção de Carteirinhas</h1>
            <p className="text-sm text-slate-500">
              Gerencie impressão e envio de carteirinhas físicas.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={load}
          >
            Recarregar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="queue">Fila de Impressão</TabsTrigger>
            <TabsTrigger value="printed">Impressas</TabsTrigger>
            <TabsTrigger value="shipped">Enviadas</TabsTrigger>
            <TabsTrigger value="delivered">Entregues</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Carteirinhas na fila de impressão</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando fila...</p>
                ) : (
                  <PrintQueue
                    items={queueItems}
                    onBatchProcessed={load}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="printed" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Carteirinhas impressas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando...</p>
                ) : printedItems.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma carteirinha impressa aguardando envio.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {printedItems.map(item => (
                      <Card
                        key={item.card_id || item.card_number}
                        className="flex flex-col"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            {item.full_name || 'Sem nome'}
                          </CardTitle>
                          <div className="text-xs text-slate-500">
                            <MaskedCPF cpf={item.cpf || undefined} />
                          </div>
                        </CardHeader>
                        <CardContent className="text-xs text-slate-700 space-y-1 flex-1">
                          <p>
                            <span className="font-semibold">Carteira:</span>{' '}
                            {item.card_number}
                          </p>
                          <p>
                            <span className="font-semibold">Endereço:</span>{' '}
                            {[item.street, item.number, item.city, item.state]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                          <div className="pt-2">
                            {item.card_id && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setShippingCardId(item.card_id!)}
                              >
                                Registrar envio
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipped" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Carteirinhas enviadas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando...</p>
                ) : shippedItems.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma carteirinha marcada como enviada.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {shippedItems.map(item => (
                      <Card
                        key={item.card_id || item.card_number}
                        className="flex flex-col"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            {item.full_name || 'Sem nome'}
                          </CardTitle>
                          <div className="text-xs text-slate-500">
                            <MaskedCPF cpf={item.cpf || undefined} />
                          </div>
                        </CardHeader>
                        <CardContent className="text-xs text-slate-700 space-y-1 flex-1">
                          <p>
                            <span className="font-semibold">Carteira:</span>{' '}
                            {item.card_number}
                          </p>
                          <p>
                            <span className="font-semibold">Cidade:</span>{' '}
                            {item.city}, {item.state}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivered" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Carteirinhas entregues</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando...</p>
                ) : deliveredItems.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma carteirinha marcada como entregue.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {deliveredItems.map(item => (
                      <Card
                        key={item.card_id || item.card_number}
                        className="flex flex-col"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            {item.full_name || 'Sem nome'}
                          </CardTitle>
                          <div className="text-xs text-slate-500">
                            <MaskedCPF cpf={item.cpf || undefined} />
                          </div>
                        </CardHeader>
                        <CardContent className="text-xs text-slate-700 space-y-1 flex-1">
                          <p>
                            <span className="font-semibold">Carteira:</span>{' '}
                            {item.card_number}
                          </p>
                          <p>
                            <span className="font-semibold">Cidade:</span>{' '}
                            {item.city}, {item.state}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {shippingCardId && (
        <ShippingModal
          open={!!shippingCardId}
          onOpenChange={open => {
            if (!open) {
              setShippingCardId(null);
              load();
            }
          }}
          cardId={shippingCardId}
        />
      )}
    </AdminLayout>
  );
}
