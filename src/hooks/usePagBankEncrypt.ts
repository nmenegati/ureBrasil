import { useState, useCallback } from 'react';

declare global {
  interface Window {
    PagSeguro: {
      encryptCard: (params: {
        publicKey: string;
        holder: string;
        number: string;
        expMonth: string;
        expYear: string;
        securityCode: string;
      }) => { encryptedCard: string; hasErrors: boolean; errors: any[] };
    };
  }
}

const PAGBANK_PUBLIC_KEY = import.meta.env.VITE_PAGBANK_PUBLIC_KEY || '';

export function usePagBankEncrypt() {
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSdk = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.PagSeguro) {
        setSdkReady(true);
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';
      script.onload = () => { setSdkReady(true); resolve(); };
      script.onerror = () => reject(new Error('Falha ao carregar SDK PagBank'));
      document.body.appendChild(script);
    });
  }, []);

  const encryptCard = useCallback(async (cardData: {
    number: string;
    holderName: string;
    expMonth: string;
    expYear: string;
    securityCode: string;
  }) => {
    setLoading(true);
    try {
      if (!window.PagSeguro) await loadSdk();

      const result = window.PagSeguro.encryptCard({
        publicKey: PAGBANK_PUBLIC_KEY,
        holder: cardData.holderName,
        number: cardData.number.replace(/\s/g, ''),
        expMonth: cardData.expMonth,
        expYear: cardData.expYear.length === 2 ? '20' + cardData.expYear : cardData.expYear,
        securityCode: cardData.securityCode,
      });

      if (result.hasErrors) {
        console.error('Erros na criptografia:', result.errors);
        throw new Error('Erro ao criptografar cartão');
      }

      return result.encryptedCard;
    } finally {
      setLoading(false);
    }
  }, [loadSdk]);

  return { loadSdk, encryptCard, sdkReady, loading };
}
