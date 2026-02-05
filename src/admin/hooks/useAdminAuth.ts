import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Enums, Tables } from '@/integrations/supabase/types';

type AdminRole = Enums<'user_role'>;

type UserRoleRow = Tables<'user_roles'>;

interface AdminUser {
  id: string;
  userId: string;
  role: AdminRole;
  isSuper?: boolean;
  name?: string | null;
}

const ADMIN_ROLES: AdminRole[] = ['admin', 'manager'];
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());

  console.log('[useAdminAuth] user:', user?.id);
  console.log('[useAdminAuth] adminUser:', adminUser);
  console.log('[useAdminAuth] isLoading:', loading);

  const loadAdminUser = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setAdminUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const adminClient = supabase as any;
    let adminRow: any | null = null;

    try {
      const { data, error } = await adminClient
        .from('admin_users')
        .select('*')
        .eq('auth_user_id', currentUser.id)
        .maybeSingle();

      if (!error && data) {
        adminRow = data;
      }
    } catch {
    }

    if (!adminRow && currentUser.email) {
      try {
        const { data, error } = await adminClient
          .from('admin_users')
          .select('*')
          .eq('email', currentUser.email)
          .maybeSingle();

        if (!error && data) {
          adminRow = data;
        }
      } catch {
      }
    }

    if (adminRow) {
      if (adminRow.is_active === false) {
        setAdminUser(null);
        setLoading(false);
        return;
      }

      const isSuper = adminRow.role === 'super';
      const mappedRole: AdminRole =
        adminRow.role === 'manager'
          ? 'manager'
          : 'admin';

      setAdminUser({
        id: adminRow.id || adminRow.user_id || currentUser.id,
        userId: adminRow.user_id || currentUser.id,
        role: mappedRole,
        isSuper,
        name: adminRow.full_name ?? null,
      });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('id,user_id,role')
      .eq('user_id', currentUser.id)
      .maybeSingle<UserRoleRow>();

    if (error || !data || !ADMIN_ROLES.includes(data.role as AdminRole)) {
      setAdminUser(null);
      setLoading(false);
      return;
    }

    setAdminUser({
      id: data.id,
      userId: data.user_id,
      role: data.role as AdminRole,
      isSuper: false,
      name: null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const currentUser = data.user ?? null;
      setUser(currentUser);
      loadAdminUser(currentUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      loadAdminUser(nextUser);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAdminUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAdminUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;

    const updateLastActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'focus',
    ];

    events.forEach((event) => {
      window.addEventListener(event, updateLastActivity);
    });

    const interval = setInterval(() => {
      if (!user) return;
      const now = Date.now();
      if (now - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
        signOut();
      }
    }, 60_000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateLastActivity);
      });
      clearInterval(interval);
    };
  }, [user, signOut]);

  const getAdminUser = useCallback(() => adminUser, [adminUser]);

  const checkRole = useCallback(
    (role: AdminRole) => {
      if (!adminUser) return false;
      if (adminUser.role === 'manager') return true;
      return adminUser.role === role;
    },
    [adminUser]
  );

  const isSuperAdmin = !!adminUser?.isSuper;

  return {
    user,
    adminUser,
    loading,
    getAdminUser,
    checkRole,
    isSuperAdmin,
    signOut,
  };
}
