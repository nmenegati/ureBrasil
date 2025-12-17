import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'
import { useState } from 'react'

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        
        <div className="text-center mb-6">
          <Mail className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            Confirme seu Email
          </h1>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6 space-y-3">
          {email && (
            <div>
              <p className="font-medium text-gray-900">Email enviado para:</p>
              <p className="text-sm text-gray-700 break-all">{email}</p>
            </div>
          )}
          
          <p className="text-sm text-gray-700">
            ✓ Verifique sua caixa de entrada
          </p>
          
          <p className="text-sm text-gray-700">
            ✓ Clique no link de confirmação
          </p>
          
          <p className="text-sm text-gray-700">
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
            onClick={() => navigate('/login')}
            className="w-full"
          >
            Ir para Login
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
          Email errado?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-blue-600 hover:underline"
          >
            Criar nova conta
          </button>
        </p>
      </div>
    </div>
  )
}
