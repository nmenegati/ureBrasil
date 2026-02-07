import { ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, FileText, CreditCard, Printer, Bell, LifeBuoy, Megaphone } from 'lucide-react';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';

interface AdminLayoutProps {
  children?: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { adminUser, loading, signOut, isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();

  if (loading) {
    console.log('[AdminGuard] adminUser:', adminUser);
    console.log('[AdminGuard] redirecting to:', 'loading-screen');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="text-slate-300 mt-4 text-sm">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    console.log('[AdminGuard] adminUser:', adminUser);
    console.log('[AdminGuard] redirecting to:', '/admin/login');
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex md:flex-col w-60 bg-slate-900 text-slate-100">
        <div className="h-16 flex items-center px-4 border-b border-slate-800">
          <span className="text-lg font-semibold tracking-tight">URE Console</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
              ].join(' ')
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/admin/tickets"
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
              ].join(' ')
            }
          >
            <LifeBuoy className="w-4 h-4" />
            <span>Tickets</span>
          </NavLink>
          <NavLink
            to="/admin/documents"
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
              ].join(' ')
            }
          >
            <FileText className="w-4 h-4" />
            <span>Documentos</span>
          </NavLink>
          <NavLink
            to="/admin/payments"
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
              ].join(' ')
            }
          >
            <CreditCard className="w-4 h-4" />
            <span>Pagamentos</span>
          </NavLink>
          <NavLink
            to="/admin/cards"
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
              ].join(' ')
            }
          >
            <Printer className="w-4 h-4" />
            <span>Carteirinhas</span>
          </NavLink>
          {isSuperAdmin && (
            <>
              <NavLink
                to="/admin/notifications"
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
                  ].join(' ')
                }
              >
                <Megaphone className="w-4 h-4" />
                <span>Notificações</span>
              </NavLink>
              <NavLink
                to="/admin/logs"
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
                  ].join(' ')
                }
              >
                <Bell className="w-4 h-4" />
                <span>Logs</span>
              </NavLink>
              <NavLink
                to="/admin/admin-users"
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
                  ].join(' ')
                }
              >
                <FileText className="w-4 h-4" />
                <span>Admins</span>
              </NavLink>
              <NavLink
                to="/admin/settings"
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60',
                  ].join(' ')
                }
              >
                <FileText className="w-4 h-4" />
                <span>Configurações</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-200">{adminUser.role.toUpperCase()}</span>
            <span className="text-slate-400">Administrador</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="md:hidden flex flex-col border-b bg-white">
          <div className="flex items-center justify-between px-4 h-14">
            <span className="font-semibold text-slate-900">URE Console</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
          <nav className="md:hidden flex gap-1 px-2 pb-2 overflow-x-auto text-xs text-slate-600">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full whitespace-nowrap',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                ].join(' ')
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/tickets"
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full whitespace-nowrap',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                ].join(' ')
              }
            >
              Tickets
            </NavLink>
            <NavLink
              to="/admin/documents"
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full whitespace-nowrap',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                ].join(' ')
              }
            >
              Documentos
            </NavLink>
            <NavLink
              to="/admin/payments"
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full whitespace-nowrap',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                ].join(' ')
              }
            >
              Pagamentos
            </NavLink>
            <NavLink
              to="/admin/cards"
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full whitespace-nowrap',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                ].join(' ')
              }
            >
              Carteirinhas
            </NavLink>
            {isSuperAdmin && (
              <>
                <NavLink
                  to="/admin/notifications"
                  className={({ isActive }) =>
                    [
                      'px-2 py-1 rounded-full whitespace-nowrap',
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                    ].join(' ')
                  }
                >
                  Notificações
                </NavLink>
                <NavLink
                  to="/admin/logs"
                  className={({ isActive }) =>
                    [
                      'px-2 py-1 rounded-full whitespace-nowrap',
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                    ].join(' ')
                  }
                >
                  Logs
                </NavLink>
                <NavLink
                  to="/admin/admin-users"
                  className={({ isActive }) =>
                    [
                      'px-2 py-1 rounded-full whitespace-nowrap',
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                    ].join(' ')
                  }
                >
                  Admins
                </NavLink>
                <NavLink
                  to="/admin/settings"
                  className={({ isActive }) =>
                    [
                      'px-2 py-1 rounded-full whitespace-nowrap',
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100',
                    ].join(' ')
                  }
                >
                  Configurações
                </NavLink>
              </>
            )}
          </nav>
        </header>

        <main className="flex-1 p-4 md:p-6 bg-slate-50">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
