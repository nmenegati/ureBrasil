import { useLocation } from 'react-router-dom';
import { ChatWidget } from '@/components/ChatWidget';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function ChatWrapper() {
  const location = useLocation();
  const { user } = useAuth();
  const [rejectedDocs, setRejectedDocs] = useState<{ type: string; reason: string }[]>([]);

  // Rotas onde o chat deve aparecer
  const allowedRoutes = [
    '/complete-profile',
    '/upload-documentos',
    '/escolher-plano',
    '/pagamento',
    '/checkout',
    '/checkout-fisica'
  ];

  const suggestedQuestionsMap: Record<string, string[]> = {
    '/complete-profile': ['Não achei minha instituição', 'Como preencho o endereço?'],
    '/escolher-plano': ['Qual plano escolher?', 'Tenho direito ao plano de Direito?'],
    '/pagamento': ['Como pagar com PIX?', 'Meu cartão foi recusado'],
    '/upload-documentos': ['Quais documentos enviar?', 'Documento foi rejeitado'],
    '/checkout': ['O que é a carteira física?', 'Como funciona o frete?'],
    '/checkout-fisica': ['O que é a carteira física?', 'Como funciona o frete?']
  };

  const shouldShowChat = allowedRoutes.some(route => location.pathname.startsWith(route));
  
  // Pegar as perguntas da rota atual ou array vazio
  const currentQuestions = Object.entries(suggestedQuestionsMap).find(([route]) => 
    location.pathname.startsWith(route)
  )?.[1] || [];

  // Buscar documentos rejeitados se estiver na página de upload
  useEffect(() => {
    const fetchRejectedDocs = async () => {
      if (!user) return;
      if (!location.pathname.includes('upload-documentos')) return;

      const { data } = await supabase
        .from('documents')
        .select('type, rejection_reason')
        .eq('student_id', user.id) // Assuming user.id is student_id or relation is handled via student_profiles
        .eq('status', 'rejected');
      
      // Need to map user_id to student_id first if needed, but let's try direct relation or fix query
      // Actually, documents table usually links to student_id (profile id), not user_id directly.
      // Let's fetch profile first to be safe
      
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (profile) {
         const { data: docs } = await supabase
          .from('documents')
          .select('type, rejection_reason')
          .eq('student_id', profile.id)
          .eq('status', 'rejected');
          
         if (docs && docs.length > 0) {
           setRejectedDocs(docs.map(d => ({
             type: d.type,
             reason: d.rejection_reason || 'Motivo não especificado'
           })));
         } else {
            setRejectedDocs([]);
         }
      }
    };

    if (shouldShowChat && user) {
      fetchRejectedDocs();
    }
  }, [location.pathname, user, shouldShowChat]);

  if (!shouldShowChat) return null;

  return (
    <ChatWidget 
      rejectedDocs={rejectedDocs} 
      currentPage={location.pathname}
      suggestedQuestions={currentQuestions}
    />
  );
}
