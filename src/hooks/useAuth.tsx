import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('=== useAuth INICIALIZOU ===');
    console.log('🕐 Timestamp:', new Date().toISOString());
    
    let mounted = true;
    let initialSessionChecked = false;

    // PASSO 1: Buscar sessão existente PRIMEIRO
    console.log('🔍 Chamando getSession()...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📦 getSession() retornou:');
      console.log('  - session:', session ? 'EXISTE ✅' : 'NULL ❌');
      console.log('  - user:', session?.user?.email || 'null');
      
      if (mounted) {
        initialSessionChecked = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        console.log('✅ Estado atualizado:');
        console.log('  - user setado:', session?.user?.email || 'null');
        console.log('  - loading: false');
      } else {
        console.log('⚠️ Componente desmontado, ignorando update');
      }
    });

    // PASSO 2: Configurar listener DEPOIS
    console.log('👂 Configurando onAuthStateChange listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔔 onAuthStateChange DISPAROU:');
        console.log('  - event:', event);
        console.log('  - session:', session ? 'existe' : 'null');
        console.log('  - initialSessionChecked:', initialSessionChecked);
        console.log('  - mounted:', mounted);
        
        if (mounted && initialSessionChecked) {
          console.log('  ✅ Atualizando estado...');
          setSession(session);
          setUser(session?.user ?? null);
        } else {
          console.log('  ⏭️ Ignorando (ainda não inicializou ou desmontou)');
        }
      }
    );

    return () => {
      console.log('🧹 useAuth CLEANUP');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/complete-profile`
      }
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return { user, session, loading, signIn, signUp, signOut };
}
