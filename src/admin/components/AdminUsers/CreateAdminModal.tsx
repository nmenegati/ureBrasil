import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface CreateAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAdminModal({ open, onOpenChange }: CreateAdminModalProps) {
  const { adminUser } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('admin');
  const [loading, setLoading] = useState(false);

  const handleClose = (value: boolean) => {
    if (!value) {
      setEmail('');
      setName('');
      setRole('admin');
    }
    onOpenChange(value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast.error('Preencha email e nome.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.admin.listUsers();

      if (error) {
        toast.error('Erro ao buscar usuário por email.');
        return;
      }

      const user = data.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

      if (!user) {
        toast.error('Usuário não encontrado no Auth com este email.');
        return;
      }

      const adminClient = supabase as any;
      const nowIso = new Date().toISOString();

      const { error: insertError } = await adminClient
        .from('admin_users')
        .insert({
          user_id: user.id,
          email: user.email,
          full_name: name.trim(),
          role,
          is_active: true,
          created_at: nowIso,
        });

      if (insertError) {
        toast.error('Erro ao criar admin.');
        return;
      }

      await adminClient
        .from('admin_actions')
        .insert({
          action_type: 'admin_created',
          performed_by: adminUser?.userId ?? null,
          target_user_id: user.id,
          details: `Novo admin ${name.trim()} (${role})`,
          created_at: nowIso,
        });

      toast.success('Administrador criado com sucesso.');
      handleClose(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo administrador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-name">Nome</Label>
            <Input
              id="admin-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="attendant">Atendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

