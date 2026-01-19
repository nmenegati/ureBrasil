import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

// Tipos do PagSeguro
declare global {
  interface Window {
    PagSeguroDirectPayment: {
      setSessionId: (sessionId: string) => void
      getBrand: (params: { 
        cardBin: string
        success: (response: { brand: { name: string } }) => void
        error: (error: unknown) => void 
      }) => void
      createCardToken: (params: {
        cardNumber: string
        brand: string
        cvv: string
        expirationMonth: string
        expirationYear: string
        success: (response: { card: { token: string } }) => void
        error: (error: unknown) => void
      }) => void
    }
  }
}

export function usePagBank() {
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const { toast } = useToast()

  // Carregar script do PagBank
  const loadPagBankScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.PagSeguroDirectPayment) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://stc.sandbox.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load PagBank script'))
      document.body.appendChild(script)
    })
  }, [])

  // Gerar sessão
  const generateSession = useCallback(async () => {
    try {
      setLoading(true)
      await loadPagBankScript()

      const { data, error } = await supabase.functions.invoke('pagbank-session', {
        method: 'POST',
      })

      if (error) throw error
      if (!data.success) throw new Error(data.error)

      const newSessionId = data.sessionId
      setSessionId(newSessionId)
      window.PagSeguroDirectPayment.setSessionId(newSessionId)

      console.log('PagBank session created')
      return newSessionId
    } catch (error) {
      console.error('Error generating session:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao inicializar pagamento.',
        variant: 'destructive',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }, [loadPagBankScript, toast])

  // Obter bandeira do cartão
  const getCardBrand = useCallback((cardNumber: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const cardBin = cardNumber.replace(/\s/g, '').substring(0, 6)

      window.PagSeguroDirectPayment.getBrand({
        cardBin,
        success: (response) => resolve(response.brand.name),
        error: (error) => reject(error),
      })
    })
  }, [])

  // Criar token do cartão
  const createCardToken = useCallback(async (cardData: {
    cardNumber: string
    cardholderName: string
    expirationMonth: string
    expirationYear: string
    cvv: string
  }): Promise<string> => {
    try {
      const brand = await getCardBrand(cardData.cardNumber)

      return new Promise((resolve, reject) => {
        window.PagSeguroDirectPayment.createCardToken({
          cardNumber: cardData.cardNumber.replace(/\s/g, ''),
          brand,
          cvv: cardData.cvv,
          expirationMonth: cardData.expirationMonth,
          expirationYear: cardData.expirationYear,
          success: (response) => resolve(response.card.token),
          error: (error) => reject(error),
        })
      })
    } catch (error) {
      console.error('Error creating card token:', error)
      throw error
    }
  }, [getCardBrand])

  // Processar pagamento
  const processCardPayment = useCallback(async (paymentData: {
    cardToken: string
    cardholderName: string
    cardholderCPF: string
    cardholderPhone: string
    cardholderBirthDate: string
    installments: number
    amount: number
    planId: string
  }) => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase.functions.invoke('pagbank-payment-card', {
        method: 'POST',
        body: { ...paymentData, userId: user.id },
      })

      if (error) throw error
      if (!data.success) throw new Error(data.error)

      toast({
        title: 'Pagamento processado!',
        description: 'Aguardando confirmação.',
      })

      return data
    } catch (error) {
      console.error('Error processing payment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Tente novamente.'
      toast({
        title: 'Erro no pagamento',
        description: errorMessage,
        variant: 'destructive',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return {
    loading,
    sessionId,
    generateSession,
    getCardBrand,
    createCardToken,
    processCardPayment,
  }
}
