import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'
import { useState } from 'react'
import ureBrasilLogo from '@/assets/ure-brasil-logo.png'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const [resending, setResending] = useState(false)

  const handleResend = async () => {
    if (!email) {
      toast.error('Email não informado')
      return
    }
    
    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })
      
      if (error) throw error
      toast.success('Email reenviado!')
    } catch (error: any) {
      toast.error('Erro ao reenviar email')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Link to="/login" className="flex items-center">
              <span className="text-muted-foreground text-sm">Já confirmou?</span>
              <span className="text-primary font-medium ml-1">Entrar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 shadow-lg">
            <div className="text-center mb-6">
              <Mail className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Confirme seu Email
              </h1>
            </div>

            <div className="bg-primary/10 rounded-lg p-4 mb-6 space-y-3">
              {email && (
                <div>
                  <p className="font-medium text-foreground">Email enviado para:</p>
                  <p className="text-sm text-muted-foreground break-all">{email}</p>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                ✓ Verifique sua caixa de entrada
              </p>
              
              <p className="text-sm text-muted-foreground">
                ✓ Clique no link de confirmação
              </p>
              
              <p className="text-sm text-muted-foreground">
                ⚠️ Não recebeu? Verifique o spam
              </p>
            </div>

            <div className="space-y-3">
              {email && (
                <Button
                  onClick={handleResend}
                  disabled={resending}
                  variant="outline"
                  className="w-full"
                >
                  {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reenviar Email
                </Button>
              )}

              <Button
                onClick={() => navigate('/complete-profile')}
                className="w-full"
              >
                Completar meu Perfil
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Email errado?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-primary hover:underline"
              >
                Criar nova conta
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
