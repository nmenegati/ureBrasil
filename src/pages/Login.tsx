import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

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
      
      // ID do plano Geral Digital para não-Direito
      const PLAN_GERAL_DIGITAL_ID = 'a20e423f-c222-47b0-814f-e532f1bbe0c4';
      
      // 1. Verificar se email está confirmado
      if (!data.user.email_confirmed_at) {
        window.location.href = `/verificar-email?email=${encodeURIComponent(data.user.email || '')}`;
        return;
      }
      
      // 2. Buscar perfil com is_law_student
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id, profile_completed, is_law_student')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!profile) {
        // Perfil básico não existe - ir para completar perfil
        window.location.href = '/complete-profile';
        return;
      }

      // 3. Verificar perfil completo (ANTES do pagamento no novo fluxo)
      if (!profile.profile_completed) {
        window.location.href = '/complete-profile';
        return;
      }

      // 4. Verificar pagamento aprovado
      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('student_id', profile.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (!payment) {
        // Sem pagamento aprovado - rota depende de is_law_student
        if (profile.is_law_student) {
          // Estudante de Direito pode escolher plano
          window.location.href = '/escolher-plano';
        } else {
          // Não-Direito vai direto para pagamento com plano Geral
          localStorage.setItem('selected_plan_id', PLAN_GERAL_DIGITAL_ID);
          window.location.href = '/pagamento';
        }
        return;
      }

      // 5. Verificar documentos aprovados
      const { count: docsApproved } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', profile.id)
        .eq('status', 'approved');

      if ((docsApproved || 0) < 4) {
        window.location.href = '/upload-documentos';
        return;
      }

      // 6. Tudo OK - ir para dashboard
      window.location.href = '/dashboard';
      return;
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header com logo + tema + cadastro */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-14 sm:h-[72px]">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <img src={ureBrasilLogo} alt="URE Brasil" className="h-9 sm:h-11 w-auto object-contain" />
            <div className="hidden md:flex flex-col items-start justify-center -space-y-0.5 ml-2 bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
              <span className="text-[10px] font-medium tracking-wide uppercase">
                UNIÃO REPRESENTATIVA
              </span>
              <span className="text-[10px] font-bold tracking-wide uppercase">
                DOS ESTUDANTES DO BRASIL
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-3">
            {/* Link cadastro */}
            <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground">
              Não tem conta? <span className="font-semibold text-primary">Cadastre-se</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-md mx-auto">
          
          {/* Título */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-muted-foreground">
              Entre na sua conta de estudante
            </p>
          </div>

          {/* Card do formulário */}
          <div className="bg-card rounded-2xl shadow-xl p-6 md:p-8 border border-border">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11"
                  required
                />
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 pr-10 text-base h-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                    className="border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Lembrar de mim
                  </Label>
                </div>
                <Link
                  to="/recuperar-senha"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Esqueci minha senha
                </Link>
              </div>

              {/* Botão Entrar */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            {/* Link para cadastro */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              Não tem conta?{' '}
              <Link to="/signup" className="text-primary hover:text-primary/80 font-medium">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
