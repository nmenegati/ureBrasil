// src/lib/emailValidation.ts
import disposableDomains from 'disposable-email-domains'

export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1]
  
  // Verificar na biblioteca
  if (disposableDomains.includes(domain)) {
    return true
  }
  
  // Verificar domínios personalizados (opcional)
  const customBlocked = [
    'tempmail.net',
    'throwaway.email'
  ]
  
  return customBlocked.includes(domain)
}