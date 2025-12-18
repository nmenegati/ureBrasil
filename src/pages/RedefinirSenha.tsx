import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sun, Moon, Loader2, Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

export default function RedefinirSenha() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Verificar se há sessão válida (usuário veio do link de recuperação)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        // Aguardar um pouco pois o Supabase pode estar processando o token do URL
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            setSessionReady(true);
          } else {
            toast.error('Link de recuperação inválido ou expirado');
            navigate('/recuperar-senha');
          }
        }, 1000);
      }
    };

    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Erro ao redefinir senha:', error);
      if (error.message.includes('same')) {
        toast.error('A nova senha deve ser diferente da atual');
      } else {
        toast.error('Erro ao redefinir senha. Tente novamente.');
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    toast.success('Senha alterada com sucesso!');
    
    // Redirecionar para login após 3 segundos
    setTimeout(() => {
      navigate('/login');
    }, 3000);
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm sticky top-0 z-10 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/">
            <img src={ureBrasilLogo} alt="URE Brasil" className="h-10" />
          </Link>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleDarkMode}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-md mx-auto">
          
          {/* Título */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {success ? 'Senha alterada!' : 'Criar nova senha'}
            </h1>
            <p className="text-muted-foreground">
              {success 
                ? 'Você já pode fazer login com sua nova senha' 
                : 'Digite sua nova senha abaixo'
              }
            </p>
          </div>

          {/* Card */}
          <div className="bg-card rounded-2xl shadow-xl p-6 md:p-8 border border-border">
            {success ? (
              /* Mensagem de sucesso */
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    Tudo certo!
                  </h2>
                  <p className="text-muted-foreground">
                    Sua senha foi alterada com sucesso.
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Redirecionando para login em 3 segundos...
                </p>

                <Link to="/login" className="block">
                  <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                    Ir para login
                  </Button>
                </Link>
              </div>
            ) : (
              /* Formulário */
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>

                {/* Nova senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground font-medium">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      maxLength={20}
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
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Mínimo 6 caracteres</span>
                    <span>{password.length}/20</span>
                  </div>
                  {password && <PasswordStrengthIndicator password={password} />}
                </div>

                {/* Confirmar senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground font-medium">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      maxLength={20}
                      className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 pr-10 text-base h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não coincidem</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading || password !== confirmPassword}
                  className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
