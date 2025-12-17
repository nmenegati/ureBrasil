import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    
    const { data, error } = await signIn(email, password);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Confirme seu email antes de fazer login');
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      toast.success('Login realizado com sucesso!');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 1. Verificar se email está confirmado
      if (!data.user.email_confirmed_at) {
        window.location.href = '/verificar-email';
        return;
      }
      
      // 2. Verificar estado do perfil
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('profile_completed')
        .eq('user_id', data.user.id)
        .maybeSingle();
      
      if (!profile || !profile.profile_completed) {
        window.location.href = '/complete-profile';
      } else {
        window.location.href = '/dashboard';
      }
      return;
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    toast.info('Autenticação com Google em breve. Por enquanto, use email e senha.');
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Título */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
          <p className="text-slate-400">Entre na sua conta de estudante</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
              required
            />
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-700/50 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Lembrar de mim e Esqueci senha */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="border-slate-600 data-[state=checked]:bg-cyan-500"
              />
              <Label htmlFor="remember" className="text-sm text-slate-300 cursor-pointer">
                Lembrar de mim
              </Label>
            </div>
            <button
              type="button"
              onClick={() => toast.info('Recuperação de senha em breve')}
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              Esqueci minha senha
            </button>
          </div>

          {/* Botão Entrar */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {/* Separador */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-800/50 text-slate-400">ou</span>
          </div>
        </div>

        {/* Google Login */}
        <Button
          type="button"
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full bg-white/90 hover:bg-white text-slate-900 font-medium border-0"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar com Google
        </Button>

        {/* Link para cadastro */}
        <p className="text-center text-sm text-slate-400">
          Não tem conta?{' '}
          <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium">
            Cadastre-se
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}