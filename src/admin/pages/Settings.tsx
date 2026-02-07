import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GatewaySelector } from '@/admin/components/Settings/GatewaySelector';

export default function AdminSettingsPage() {
  const { isSuperAdmin, adminUser } = useAdminAuth();

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
                Somente super administradores podem acessar as configurações avançadas do sistema.
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
            <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
            <p className="text-sm text-slate-500">
              Ajuste provedores de pagamento e integrações avançadas.
            </p>
          </div>
        </div>

        <GatewaySelector />
      </div>
    </AdminLayout>
  );
}

