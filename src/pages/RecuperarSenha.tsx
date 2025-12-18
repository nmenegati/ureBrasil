import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sun, Moon, Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Digite seu email');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`
    });

    if (error) {
      console.error('Erro ao enviar email:', error);
      toast.error('Erro ao enviar email. Tente novamente.');
      setLoading(false);
      return;
    }

    setEmailSent(true);
    setLoading(false);
  };

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
            
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Lembrou a senha? <span className="font-semibold text-primary">Entrar</span>
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
              Recuperar senha
            </h1>
            <p className="text-muted-foreground">
              {emailSent 
                ? 'Verifique sua caixa de entrada' 
                : 'Digite seu email para receber o link de recuperação'
              }
            </p>
          </div>

          {/* Card */}
          <div className="bg-card rounded-2xl shadow-xl p-6 md:p-8 border border-border">
            {emailSent ? (
              /* Mensagem de sucesso */
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    Email enviado!
                  </h2>
                  <p className="text-muted-foreground">
                    Enviamos um link de recuperação para:
                  </p>
                  <p className="font-medium text-foreground bg-muted px-4 py-2 rounded-lg">
                    {email}
                  </p>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm text-foreground">
                  <p>
                    💡 Não recebeu? Verifique sua pasta de spam ou lixo eletrônico.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => setEmailSent(false)}
                    variant="outline"
                    className="w-full h-12 border-border"
                  >
                    Tentar outro email
                  </Button>
                  
                  <Link to="/login" className="block">
                    <Button
                      variant="ghost"
                      className="w-full h-12 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar para login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              /* Formulário */
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">
                    Email da conta
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background text-foreground placeholder:text-muted-foreground border-input focus:border-primary focus:ring-primary/20 text-base h-11"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite o email cadastrado na sua conta
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>

                <Link to="/login" className="block">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-12 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para login
                  </Button>
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
