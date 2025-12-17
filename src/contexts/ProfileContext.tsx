import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProfileContextType {
  avatarUrl: string | null;
  fullName: string | null;
  updateAvatar: (url: string) => void;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!user) {
      setAvatarUrl(null);
      setFullName(null);
      return;
    }
    
    const { data } = await supabase
      .from('student_profiles')
      .select('avatar_url, full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setAvatarUrl(data.avatar_url);
      setFullName(data.full_name);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const updateAvatar = (url: string) => {
    setAvatarUrl(url);
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  return (
    <ProfileContext.Provider value={{ avatarUrl, fullName, updateAvatar, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
