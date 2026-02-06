import { useMemo, useState } from 'react';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MarkPaidModal } from '@/admin/components/PaymentManagement/MarkPaidModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { MaskedCPF } from '@/admin/components/shared/MaskedCPF';

type PaymentRow = Tables<'payments'> & {
  student_profiles?: {
    id: string;
    full_name: string | null;
    cpf: string | null;
  } | null;
};

type PaymentStatus = Enums<'payment_status'>;
type PaymentMethod = Enums<'payment_method'>;

interface PaymentTableProps {
  payments: PaymentRow[];
  onReload: () => void;
}

export function PaymentTable({ payments, onReload }: PaymentTableProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  const formatted = useMemo(
    () =>
      payments.map((payment) => ({
        ...payment,
        studentName: payment.student_profiles?.full_name ?? 'Sem nome',
        studentCpf: payment.student_profiles?.cpf ?? '',
      })),
    [payments]
  );

  const handleRefund = async (payment: PaymentRow) => {
    const justification = window.prompt('Justificativa para estorno:');
    if (!justification) return;

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
      } as Tables<'payments'>['Update'])
      .eq('id', payment.id);

    if (updateError) {
      toast.error('Erro ao estornar pagamento.');
      return;
    }

    const { data: adminUser } = await supabase.auth.getUser();
    const adminClient = supabase as any;
    await adminClient
      .from('admin_actions')
      .insert({
        action_type: 'payment_refunded',
        payment_id: payment.id,
        performed_by: adminUser.user?.id ?? null,
        details: justification,
        created_at: new Date().toISOString(),
      });

    toast.success('Pagamento estornado.');
    onReload();
  };

  const statusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
      case 'processing':
        return 'bg-amber-100 text-amber-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'refunded':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const methodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'pix':
        return 'PIX';
      case 'credit_card':
        return 'Crédito';
      case 'debit_card':
        return 'Débito';
      default:
        return method;
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">ID</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Aluno</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Valor</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Método</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Data</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {formatted.map((payment) => (
              <tr key={payment.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 align-top">
                  <span className="font-mono text-[11px] text-slate-600">
                    {payment.id.slice(0, 8)}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">
                      {payment.studentName}
                    </span>
                    {payment.studentCpf && (
                      <span className="text-[11px] text-slate-500">
                        <MaskedCPF cpf={payment.studentCpf} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-slate-900 font-semibold">
                    {payment.amount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-[11px] text-slate-700">
                    {methodLabel(payment.payment_method)}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <Badge
                    className={`text-[11px] ${statusColor(payment.status)}`}
                  >
                    {payment.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-700">
                      {new Date(payment.created_at).toLocaleString('pt-BR')}
                    </span>
                    {payment.confirmed_at && (
                      <span className="text-[11px] text-emerald-700">
                        Conf.:{' '}
                        {new Date(payment.confirmed_at).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setSelectedPayment(payment)}
                    >
                      Ver
                    </Button>
                    {payment.status !== 'approved' && payment.status !== 'refunded' && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setMarkPaidOpen(true);
                        }}
                      >
                        Marcar pago
                      </Button>
                    )}
                    {payment.status === 'approved' && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => handleRefund(payment)}
                      >
                        Estornar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {formatted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-sm text-slate-500"
                >
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!selectedPayment && !markPaidOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedPayment(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do pagamento</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-2 text-xs text-slate-700">
              <p>
                <span className="font-semibold">ID:</span> {selectedPayment.id}
              </p>
              <p>
                <span className="font-semibold">Aluno:</span>{' '}
                {selectedPayment.studentName}
              </p>
              <p>
                <span className="font-semibold">Valor:</span>{' '}
                {selectedPayment.amount.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
              <p>
                <span className="font-semibold">Método:</span>{' '}
                {methodLabel(selectedPayment.payment_method)}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                {selectedPayment.status}
              </p>
              {selectedPayment.metadata && (
                <Card className="mt-2">
                  <CardContent className="p-2">
                    <p className="font-semibold mb-1 text-[11px]">
                      Metadados / tentativas
                    </p>
                    <pre className="text-[10px] whitespace-pre-wrap break-words max-h-40 overflow-auto">
                      {JSON.stringify(selectedPayment.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedPayment && markPaidOpen && (
        <MarkPaidModal
          open={markPaidOpen}
          onOpenChange={(open) => {
            setMarkPaidOpen(open);
            if (!open) {
              setSelectedPayment(null);
              onReload();
            }
          }}
          paymentId={selectedPayment.id}
          onMarked={onReload}
        />
      )}
    </>
  );
}
