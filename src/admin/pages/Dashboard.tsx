import { useEffect, useState, Suspense, lazy } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { Users, FileText as FileTextIcon, CreditCard as CreditCardIcon, LifeBuoy as LifeBuoyIcon, IdCard } from 'lucide-react';

const DashboardCharts = lazy(() => import('@/admin/components/DashboardCharts'));

interface AdminDashboardMetrics {
  total_students: number;
  pending_documents: number;
  pending_payments: number;
  open_tickets: number;
  active_cards: number;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardsSeries, setCardsSeries] = useState<{ date: string; count: number }[]>([]);
  const [docStatus, setDocStatus] = useState<{ name: string; value: number }[]>([]);
  const [paymentsByMethod, setPaymentsByMethod] = useState<{ method: string; value: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 29);
      const fromIso = thirtyDaysAgo.toISOString();

      const dashboardPromise = supabase
        .from('admin_dashboard')
        .select('*')
        .maybeSingle();

      const cardsPromise = supabase
        .from('student_cards')
        .select('id, issued_at')
        .gte('issued_at', fromIso);

      const docsPromise = supabase
        .from('documents')
        .select('id, status');

      const paymentsPromise = supabase
        .from('payments')
        .select('id, payment_method');

      const [dashboardRes, cardsRes, docsRes, paymentsRes] = await Promise.all([
        dashboardPromise,
        cardsPromise,
        docsPromise,
        paymentsPromise,
      ]);

      if (!dashboardRes.error && dashboardRes.data) {
        const data = dashboardRes.data as any;
        setMetrics({
          total_students: data.total_students ?? 0,
          pending_documents: data.pending_documents ?? 0,
          pending_payments: data.pending_payments ?? 0,
          open_tickets: data.open_tickets ?? 0,
          active_cards: data.active_cards ?? 0,
        });
      }

      if (!cardsRes.error && cardsRes.data) {
        const counts: Record<string, number> = {};
        cardsRes.data.forEach((row: any) => {
          if (!row.issued_at) return;
          const d = new Date(row.issued_at);
          const key = d.toISOString().slice(0, 10);
          counts[key] = (counts[key] || 0) + 1;
        });

        const series: { date: string; count: number }[] = [];
        for (let i = 0; i < 30; i++) {
          const d = new Date(thirtyDaysAgo);
          d.setDate(thirtyDaysAgo.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          series.push({
            date: key.slice(5),
            count: counts[key] || 0,
          });
        }
        setCardsSeries(series);
      }

      if (!docsRes.error && docsRes.data) {
        const counts: Record<string, number> = {
          approved: 0,
          pending: 0,
          rejected: 0,
        };
        docsRes.data.forEach((row: any) => {
          if (row.status && counts[row.status] != null) {
            counts[row.status] += 1;
          }
        });
        setDocStatus([
          { name: 'Aprovados', value: counts.approved },
          { name: 'Pendentes', value: counts.pending },
          { name: 'Rejeitados', value: counts.rejected },
        ]);
      }

      if (!paymentsRes.error && paymentsRes.data) {
        const counts: Record<string, number> = {};
        paymentsRes.data.forEach((row: any) => {
          const m = row.payment_method || 'outros';
          counts[m] = (counts[m] || 0) + 1;
        });
        const mapped = Object.entries(counts).map(([method, value]) => ({
          method,
          value,
        }));
        setPaymentsByMethod(mapped);
      }

      setLoading(false);
    };

    load();
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Visão geral dos indicadores operacionais da URE.
          </p>
        </header>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Estudantes"
            value={metrics?.total_students ?? 0}
            loading={loading}
            icon={Users}
          />
          <MetricCard
            title="Docs pendentes"
            value={metrics?.pending_documents ?? 0}
            loading={loading}
            icon={FileTextIcon}
          />
          <MetricCard
            title="Pagamentos pendentes"
            value={metrics?.pending_payments ?? 0}
            loading={loading}
            icon={CreditCardIcon}
          />
          <MetricCard
            title="Tickets abertos"
            value={metrics?.open_tickets ?? 0}
            loading={loading}
            icon={LifeBuoyIcon}
          />
          <MetricCard
            title="Carteiras ativas"
            value={metrics?.active_cards ?? 0}
            loading={loading}
            icon={IdCard}
          />
        </div>

        <Suspense fallback={null}>
          <DashboardCharts
            cardsSeries={cardsSeries}
            docStatus={docStatus}
            paymentsByMethod={paymentsByMethod}
          />
        </Suspense>
      </div>
    </AdminLayout>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  loading: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

function MetricCard({ title, value, loading, icon: Icon }: MetricCardProps) {
  return (
    <Card className="h-full border-slate-200 bg-white/60 backdrop-blur">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-xs font-medium text-slate-500">
          {title}
        </CardTitle>
        {Icon && (
          <div className="h-7 w-7 rounded-full bg-slate-900 text-slate-50 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-slate-900">
          {loading ? '...' : value.toLocaleString('pt-BR')}
        </p>
      </CardContent>
    </Card>
  );
}
