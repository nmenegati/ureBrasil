import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/admin/components/Layout/AdminLayout';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { CreateAdminModal } from '@/admin/components/AdminUsers/CreateAdminModal';
import { ToggleActiveModal } from '@/admin/components/AdminUsers/ToggleActiveModal';

interface AdminUserRow {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const { isSuperAdmin, adminUser } = useAdminAuth();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<AdminUserRow | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);

  const load = async () => {
    setLoading(true);
    const adminClient = supabase as any;
    const { data, error } = await adminClient
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(
        data.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          email: row.email ?? null,
          full_name: row.full_name ?? null,
          role: row.role ?? null,
          is_active: row.is_active !== false,
          created_at: row.created_at,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(
    () =>
      items.slice().sort((a, b) => {
        if (a.role === 'super') return -1;
        if (b.role === 'super') return 1;
        return a.created_at.localeCompare(b.created_at);
      }),
    [items]
  );

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
                Apenas super administradores podem gerenciar usuários administradores.
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
            <h1 className="text-2xl font-bold text-slate-900">Administradores</h1>
            <p className="text-sm text-slate-500">
              Gerencie contas de administradores e atendentes.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            Novo Admin
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lista de administradores</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum administrador cadastrado.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Nome
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-24">
                        Role
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-24">
                        Status
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-40">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(row => (
                      <tr key={row.id} className="border-t hover:bg-slate-50">
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-900">
                              {row.full_name || '-'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {row.user_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-700">
                          {row.email || '-'}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-700">
                          {row.role || '-'}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-700">
                          {row.is_active ? 'Ativo' : 'Inativo'}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setDetailUser(row)}
                            >
                              Ver
                            </Button>
                            {row.role !== 'super' && (
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => setToggleTarget(row)}
                              >
                                {row.is_active ? 'Desativar' : 'Ativar'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateAdminModal
        open={createOpen}
        onOpenChange={open => {
          setCreateOpen(open);
          if (!open) load();
        }}
      />

      {toggleTarget && (
        <ToggleActiveModal
          open={!!toggleTarget}
          onOpenChange={open => {
            if (!open) {
              setToggleTarget(null);
              load();
            }
          }}
          adminUser={toggleTarget}
        />
      )}

      <Dialog
        open={!!detailUser}
        onOpenChange={open => {
          if (!open) setDetailUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do admin</DialogTitle>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-2 text-xs text-slate-700">
              <p>
                <span className="font-semibold">Nome:</span>{' '}
                {detailUser.full_name || '-'}
              </p>
              <p>
                <span className="font-semibold">Email:</span>{' '}
                {detailUser.email || '-'}
              </p>
              <p>
                <span className="font-semibold">Role:</span>{' '}
                {detailUser.role || '-'}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                {detailUser.is_active ? 'Ativo' : 'Inativo'}
              </p>
              <p>
                <span className="font-semibold">User ID:</span>{' '}
                {detailUser.user_id}
              </p>
              <p>
                <span className="font-semibold">Criado em:</span>{' '}
                {new Date(detailUser.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

