import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock } from 'lucide-react';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { adminUser } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adminUser) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [adminUser, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.user) {
        setError('Credenciais inválidas.');
        return;
      }

      const adminClient = supabase as any;
      let adminRow: any | null = null;

      try {
        console.log('[Admin Login] auth.uid:', data.user.id);
        const { data: byId, error: byIdError } = await adminClient
          .from('admin_users')
          .select('*')
          .eq('auth_user_id', data.user.id)
          .maybeSingle();

        console.log('[Admin Login] query result (by auth_user_id):', byId, byIdError);

        if (!byIdError && byId) {
          adminRow = byId;
        }
      } catch {
      }

      if (!adminRow && data.user.email) {
        try {
          const { data: byEmail, error: byEmailError } = await adminClient
            .from('admin_users')
            .select('*')
            .eq('email', data.user.email)
            .maybeSingle();

          console.log('[Admin Login] query result (by email):', byEmail, byEmailError);

          if (!byEmailError && byEmail) {
            adminRow = byEmail;
          }
        } catch {
        }
      }

      if (!adminRow || adminRow.is_active === false) {
        setError('Usuário sem permissão para acessar o painel.');
        await supabase.auth.signOut();
        return;
      }

      navigate('/admin/dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-700" />
            <CardTitle className="text-xl font-semibold">Acesso ao Console URE</CardTitle>
          </div>
          <p className="text-sm text-slate-500">
            Faça login com uma conta autorizada de administrador.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-2"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
