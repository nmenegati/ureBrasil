import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogsTable, NormalizedLogItem } from '@/admin/components/Logs/LogsTable.tsx';
import { supabase } from '@/integrations/supabase/client';

type TabKey = 'admin' | 'activity' | 'audit';

export default function LogsPage() {
  const { isSuperAdmin, adminUser } = useAdminAuth();
  const [tab, setTab] = useState<TabKey>('admin');
  const [adminActions, setAdminActions] = useState<NormalizedLogItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<NormalizedLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<NormalizedLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const adminClient = supabase as any;

      const [adminRes, activityRes, auditRes] = await Promise.all([
        adminClient.from('admin_actions').select('*').order('created_at', { ascending: false }),
        adminClient.from('activity_log').select('*').order('created_at', { ascending: false }),
        adminClient.from('audit_logs').select('*').order('created_at', { ascending: false }),
      ]);

      const now = new Date();

      if (!adminRes.error && adminRes.data) {
        const mapped: NormalizedLogItem[] = adminRes.data.map((row: any) => {
          const target =
            row.document_id ||
            row.payment_id ||
            row.card_id ||
            row.student_id ||
            row.target_user_id ||
            row.target_id ||
            null;

          return {
            id: row.id || `${row.action_type}-${row.created_at}-${Math.random()}`,
            timestamp: row.created_at || now.toISOString(),
            adminName: row.admin_name || null,
            adminId: row.performed_by || null,
            actionType: row.action_type || null,
            target,
            justification: row.details || null,
            ip: row.ip_address || null,
            metadata: row.metadata || null,
          };
        });
        setAdminActions(mapped);
      }

      if (!activityRes.error && activityRes.data) {
        const mapped: NormalizedLogItem[] = activityRes.data.map((row: any) => ({
          id: row.id,
          timestamp: row.created_at,
          adminName: row.user_id || null,
          adminId: row.user_id || null,
          actionType: row.action || null,
          target: row.entity_type ? `${row.entity_type}:${row.entity_id}` : row.entity_id,
          justification: null,
          ip: row.ip_address || null,
          metadata: row.details || null,
        }));
        setActivityLogs(mapped);
      }

      if (!auditRes.error && auditRes.data) {
        const mapped: NormalizedLogItem[] = auditRes.data.map((row: any) => ({
          id: row.id,
          timestamp: row.created_at,
          adminName: row.actor_id || null,
          adminId: row.actor_id || null,
          actionType: row.action || null,
          target: row.table_name ? `${row.table_name}:${row.record_id}` : row.record_id,
          justification: null,
          ip: row.ip_address || null,
          metadata: row.details || row.metadata || { old: row.old_values, new: row.new_values },
        }));
        setAuditLogs(mapped);
      }

      setLoading(false);
    };

    load();
  }, []);

  const filteredItems = useMemo(() => {
    const map = {
      admin: adminActions,
      activity: activityLogs,
      audit: auditLogs,
    } as const;

    const source = map[tab];
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    return source.filter(item => {
      const ts = new Date(item.timestamp);
      if (fromDate && ts < fromDate) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (ts > end) return false;
      }
      if (actionFilter && !(item.actionType || '').toLowerCase().includes(actionFilter.toLowerCase())) {
        return false;
      }
      if (adminFilter && !(item.adminId || item.adminName || '').toLowerCase().includes(adminFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [tab, adminActions, activityLogs, auditLogs, dateFrom, dateTo, actionFilter, adminFilter]);

  const handleExportCsv = () => {
    const headers = ['id', 'timestamp', 'admin', 'admin_id', 'action', 'target', 'justification', 'ip', 'metadata'];
    const rows = filteredItems.map(item => [
      item.id,
      item.timestamp,
      item.adminName ?? '',
      item.adminId ?? '',
      item.actionType ?? '',
      item.target ?? '',
      item.justification ?? '',
      item.ip ?? '',
      JSON.stringify(item.metadata ?? {}),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${tab}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!adminUser || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto mt-16">
          <Card>
            <CardHeader>
              <CardTitle>Acesso restrito</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Somente super administradores podem visualizar os logs do sistema.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Logs do Sistema</h1>
            <p className="text-sm text-slate-500">
              Acompanhe ações administrativas, atividades e auditoria.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={value => setTab(value as TabKey)}>
          <TabsList>
            <TabsTrigger value="admin">Ações Admin</TabsTrigger>
            <TabsTrigger value="activity">Atividades</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">Data inicial</label>
              <Input
                type="date"
                className="h-8 text-xs w-40"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">Data final</label>
              <Input
                type="date"
                className="h-8 text-xs w-40"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">Ação</label>
              <Input
                placeholder="Filtro por ação"
                className="h-8 text-xs w-44"
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600">Admin</label>
              <Input
                placeholder="ID ou nome"
                className="h-8 text-xs w-44"
                value={adminFilter}
                onChange={e => setAdminFilter(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs ml-auto"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
            >
              Exportar CSV
            </Button>
          </div>

          <TabsContent value="admin" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ações administrativas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando logs...</p>
                ) : (
                  <LogsTable items={filteredItems} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Atividades</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando logs...</p>
                ) : (
                  <LogsTable items={filteredItems} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando logs...</p>
                ) : (
                  <LogsTable items={filteredItems} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
