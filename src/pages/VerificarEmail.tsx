import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Header } from '@/components/Header'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email =
    searchParams.get('email') ||
    (typeof window !== 'undefined' ? window.localStorage.getItem('pending_email') || '' : '')

  console.log('📧 Email na tela de confirmação:', email)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Email não informado')
      return
    }
    
    setLoading(true)
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
      setLoading(false)
    }
  }

  const handleCreateNewAccount = async () => {
    if (!email) {
      toast.error('Email não informado')
      return
    }

    setLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-unconfirmed-user', {
        body: { email },
      })
      
      if (error) throw error
      if (data && typeof (data as { error?: string }).error === 'string') {
        throw new Error((data as { error: string }).error)
      }
      
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('pending_email')
      }
      await supabase.auth.signOut()
      navigate('/signup')
      toast.success('Conta anterior removida. Crie uma nova.')
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao remover conta'
      toast.error('Erro: ' + message)
    } finally {
      setLoading(false)
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
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-center mb-4">
              <Mail className="h-16 w-16 text-primary" />
            </div>
            
            <h2 className="text-2xl font-bold text-center">
              Confirme seu Email
            </h2>

            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Email enviado para:
              </p>
              <p className="text-lg font-bold text-gray-900 break-all">
                {email}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="flex items-start text-sm text-gray-700">
                <span className="text-green-600 mr-2">✓</span>
                Verifique sua caixa de entrada
              </p>
              <p className="flex items-start text-sm text-gray-700">
                <span className="text-green-600 mr-2">✓</span>
                Clique no link de confirmação em até 24h
              </p>
              <p className="flex items-start text-sm text-orange-600">
                <span className="mr-2">⚠️</span>
                Não recebeu? Verifique o spam
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleResendEmail}
                variant="outline"
                className="w-full"
                disabled={loading || cooldown > 0}
              >
                Reenviar Email
              </Button>

              <Button
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Ir para Login após Confirmar
              </Button>
            </div>

            <div className="text-center text-sm">
              Email errado?{' '}
              <button
                onClick={handleCreateNewAccount}
                className="text-primary hover:underline font-medium"
                disabled={loading}
              >
                Criar nova conta
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
