import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Header } from '@/components/Header'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

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
      setCooldown(60)
    } catch (error: unknown) {
      toast.error('Erro ao reenviar email')
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [cooldown])

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />

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
                  disabled={resending || cooldown > 0}
                  variant="outline"
                  className="w-full"
                >
                  {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar Email'}
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="w-full">
                  <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer">Abrir Gmail</a>
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <a href="https://outlook.live.com/mail" target="_blank" rel="noopener noreferrer">Abrir Outlook</a>
                </Button>
              </div>

              <Button
                onClick={() => navigate('/complete-profile')}
                className="w-full"
              >
                Continuar após confirmar
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
