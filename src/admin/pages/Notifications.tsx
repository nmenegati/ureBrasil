import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SendNotificationForm } from '@/admin/components/Notifications/SendNotificationForm';
import { HistoryTable } from '@/admin/components/Notifications/HistoryTable';

export default function NotificationsPage() {
  const { adminUser } = useAdminAuth();

  if (!adminUser) {
    return <AdminLayout />;
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Tabs defaultValue="new">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Central de notificações</h1>
              <p className="text-sm text-slate-500">
                Envie comunicados segmentados para estudantes.
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="new">Nova notificação</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="new" className="mt-4">
            <SendNotificationForm />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notificações enviadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <HistoryTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
