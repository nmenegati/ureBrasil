import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, QrCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GatewayRow {
  id: string;
  gateway_name: string;
  is_active: boolean;
  sandbox_mode: boolean | null;
  supports_card?: boolean | null;
  supports_pix?: boolean | null;
}

export function GatewaySelector() {
  const [rows, setRows] = useState<GatewayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [target, setTarget] = useState<GatewayRow | null>(null);

  const load = async () => {
    setLoading(true);
    const adminClient = supabase as any;
    const { data, error } = await adminClient
      .from('payment_gateway_config')
      .select('*')
      .order('gateway_name', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar configuração de gateways.');
      setRows([]);
    } else {
      setRows(
        (data || []).map((row: any) => ({
          id: row.id,
          gateway_name: row.gateway_name,
          is_active: row.is_active === true,
          sandbox_mode: row.sandbox_mode ?? false,
          supports_card: row.supports_card ?? true,
          supports_pix: row.supports_pix ?? true,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const labelForGateway = (name: string) => {
    if (name === 'pagbank') return 'PagBank';
    if (name === 'efi') return 'Efí Pay';
    return name;
  };

  const handleConfirmSwitch = async () => {
    if (!target) return;
    setSwitching(true);
    const adminClient = supabase as any;

    try {
      const { error } = await adminClient.rpc('switch_active_gateway', {
        gateway_name: target.gateway_name,
      });

      if (error) {
        toast.error('Erro ao trocar gateway ativo.');
        return;
      }

      toast.success(`Gateway ativo alterado para ${labelForGateway(target.gateway_name)}.`);
      setTarget(null);
      await load();
    } finally {
      setSwitching(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gateway de pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Carregando gateways...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gateway de pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-slate-500">
              Nenhuma configuração de gateway encontrada.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map(row => {
              const active = row.is_active;
              const sandbox = row.sandbox_mode === true;

              return (
                <div
                  key={row.id}
                  className={`rounded-lg border p-3 flex flex-col gap-2 ${
                    active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        {labelForGateway(row.gateway_name)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        className={`text-[10px] ${
                          sandbox
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {sandbox ? 'Sandbox' : 'Produção'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    {row.supports_card && (
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        Cartão
                      </span>
                    )}
                    {row.supports_pix && (
                      <span className="inline-flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        PIX
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end">
                    {!active && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setTarget(row)}
                      >
                        Ativar
                      </Button>
                    )}
                    {active && (
                      <Badge className="text-[10px] bg-emerald-600 text-white">
                        Atual
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!target}
        onOpenChange={open => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar gateway ativo</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Deseja trocar o gateway ativo para{' '}
                <span className="font-semibold">
                  {labelForGateway(target.gateway_name)}
                </span>
                ?
              </p>
              <p className="text-xs text-slate-500">
                Todos os novos pagamentos passarão a ser processados por este provedor.
                Pagamentos antigos permanecem registrados com o gateway original.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTarget(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSwitch}
                  disabled={switching}
                >
                  {switching && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

