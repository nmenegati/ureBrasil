import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PaymentTable } from '@/admin/components/PaymentManagement/PaymentTable';

type PaymentRow = Tables<'payments'> & {
  student_profiles?: {
    id: string;
    full_name: string | null;
    cpf: string | null;
  } | null;
};

type PaymentStatus = Enums<'payment_status'>;
type PaymentMethod = Enums<'payment_method'>;

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'last24h' | 'last7d'>('all');

  const load = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, student_profiles(id, full_name, cpf)')
      .order('created_at', { ascending: false });

    if (data) {
      setPayments(data as PaymentRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return payments.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (dateFilter !== 'all') {
        const created = new Date(p.created_at);
        const diff = now.getTime() - created.getTime();
        if (dateFilter === 'last24h' && diff > 24 * 60 * 60 * 1000) return false;
        if (dateFilter === 'last7d' && diff > 7 * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [payments, statusFilter, methodFilter, dateFilter]);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pagamentos</h1>
            <p className="text-sm text-slate-500">
              Acompanhe e gerencie pagamentos dos estudantes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={statusFilter}
              onValueChange={value => setStatusFilter(value as typeof statusFilter)}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
                <SelectItem value="refunded">Estornados</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={methodFilter}
              onValueChange={value => setMethodFilter(value as typeof methodFilter)}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="credit_card">Crédito</SelectItem>
                <SelectItem value="debit_card">Débito</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dateFilter}
              onValueChange={value => setDateFilter(value as typeof dateFilter)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as datas</SelectItem>
                <SelectItem value="last24h">Últimas 24h</SelectItem>
                <SelectItem value="last7d">Últimos 7 dias</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={load}
              className="h-8 text-xs"
            >
              Recarregar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Carregando pagamentos...</p>
            ) : (
              <PaymentTable payments={filtered} onReload={load} />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

