import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function VerificarEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResendEmail = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao enviar email',
          description: error.message,
        });
      } else {
        setEmailSent(true);
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada e spam.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEmailConfirmed = async () => {
    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
    
    if (refreshedUser?.email_confirmed_at) {
      toast({
        title: 'Email confirmado!',
        description: 'Você já pode continuar.',
      });
      
      // Verificar se perfil está completo antes de redirecionar
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('profile_completed')
        .eq('user_id', refreshedUser.id)
        .maybeSingle();
      
      if (!profile || !profile.profile_completed) {
        navigate('/complete-profile');
      } else {
        navigate('/dashboard');
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Email ainda não confirmado',
        description: 'Por favor, clique no link enviado para seu email.',
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 border border-border">
          
          {/* Emoji grande + Mensagem amigável */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">👋</div>
            
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Quase lá!
            </h1>
            
            <p className="text-muted-foreground text-base">
              Para acessar esta página, você precisa estar logado na sua conta.
              É rapidinho, prometo! 😊
            </p>
          </div>

          {/* Ações */}
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/login')}
              className="w-full h-11"
            >
              Fazer Login
            </Button>
            
            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-primary font-medium hover:underline"
              >
                Criar grátis
              </button>
            </p>
          </div>

          {/* Mensagem motivacional */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              💡 Leva menos de 2 minutos para criar sua conta
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Confirme seu Email</CardTitle>
          <CardDescription>
            Para sua segurança, precisamos confirmar seu endereço de email antes de prosseguir.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription className="flex items-start gap-2">
              <Mail className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Email enviado para:</p>
                <p className="text-sm text-muted-foreground break-all">{user.email}</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Verifique sua caixa de entrada</p>
                  <p className="text-muted-foreground">Procure por um email de confirmação da URE Brasil</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Clique no link de confirmação</p>
                  <p className="text-muted-foreground">O link é válido por 24 horas</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Não recebeu?</p>
                  <p className="text-muted-foreground">Verifique sua pasta de spam ou clique no botão abaixo</p>
                </div>
              </div>
            </div>

            {emailSent && (
              <Alert className="border-primary/50">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Email de confirmação reenviado! Pode levar alguns minutos para chegar.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleResendEmail}
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Reenviar Email de Confirmação
                  </>
                )}
              </Button>

              <Button
                onClick={checkEmailConfirmed}
                className="w-full"
                variant="default"
              >
                Já confirmei meu email
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Digitou o email errado? Entre em contato pelo suporte para corrigir.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
