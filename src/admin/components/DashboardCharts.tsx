import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardChartsProps {
  cardsSeries: { date: string; count: number }[];
  docStatus: { name: string; value: number }[];
  paymentsByMethod: { method: string; value: number }[];
}

export default function DashboardCharts({ cardsSeries, docStatus, paymentsByMethod }: DashboardChartsProps) {
  return (
    <>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Carteirinhas emitidas (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {cardsSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Nenhum dado de emissão nos últimos 30 dias.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cardsSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status dos documentos</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {docStatus.every(item => item.value === 0) ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Nenhum documento processado ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={docStatus}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {docStatus.map((entry, index) => {
                      const colors = ['#22c55e', '#eab308', '#ef4444'];
                      return (
                        <Cell
                          key={entry.name}
                          fill={colors[index % colors.length]}
                        />
                      );
                    })}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pagamentos por método</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {paymentsByMethod.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              Nenhum pagamento registrado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentsByMethod}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="method" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}
