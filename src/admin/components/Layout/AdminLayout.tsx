import { ReactNode, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  LogOut,
  LayoutDashboard,
  FileText,
  CreditCard,
  Printer,
  Bell,
  LifeBuoy,
  Megaphone,
  Menu,
  User as UserIcon,
} from 'lucide-react';
import { useAdminAuth } from '@/admin/hooks/useAdminAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface AdminLayoutProps {
  children?: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { adminUser, loading, signOut, isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navLinkClass = (isActive: boolean) =>
    [
      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-slate-900 text-slate-50 shadow-sm'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
    ].join(' ');

  const bottomChipClass = (isActive: boolean) =>
    [
      'px-2.5 py-1 rounded-full whitespace-nowrap border text-xs',
      isActive
        ? 'bg-slate-900 text-slate-50 border-slate-900'
        : 'bg-slate-50 text-slate-600 border-slate-200',
    ].join(' ');

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-slate-200">
        <div className="h-16 flex items-center px-5 border-b border-slate-200">
          <span className="text-base font-semibold tracking-tight text-slate-900">
            URE Console
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              navLinkClass(isActive)
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/admin/tickets"
            className={({ isActive }) =>
              navLinkClass(isActive)
            }
          >
            <LifeBuoy className="w-4 h-4" />
            <span>Tickets</span>
          </NavLink>
          <NavLink
            to="/admin/documents"
            className={({ isActive }) =>
              navLinkClass(isActive)
            }
          >
            <FileText className="w-4 h-4" />
            <span>Documentos</span>
          </NavLink>
          <NavLink
            to="/admin/payments"
            className={({ isActive }) =>
              navLinkClass(isActive)
            }
          >
            <CreditCard className="w-4 h-4" />
            <span>Pagamentos</span>
          </NavLink>
          <NavLink
            to="/admin/cards"
            className={({ isActive }) =>
              navLinkClass(isActive)
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
                  navLinkClass(isActive)
                }
              >
                <Megaphone className="w-4 h-4" />
                <span>Notificações</span>
              </NavLink>
              <NavLink
                to="/admin/logs"
                className={({ isActive }) =>
                  navLinkClass(isActive)
                }
              >
                <Bell className="w-4 h-4" />
                <span>Logs</span>
              </NavLink>
              <NavLink
                to="/admin/admin-users"
                className={({ isActive }) =>
                  navLinkClass(isActive)
                }
              >
                <FileText className="w-4 h-4" />
                <span>Admins</span>
              </NavLink>
              <NavLink
                to="/admin/settings"
                className={({ isActive }) =>
                  navLinkClass(isActive)
                }
              >
                <FileText className="w-4 h-4" />
                <span>Configurações</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{adminUser.role.toUpperCase()}</span>
            <span className="text-slate-500">Administrador</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-white">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <Menu className="w-4 h-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b">
                  <SheetTitle className="text-sm font-semibold">
                    URE Console
                  </SheetTitle>
                </SheetHeader>
                <nav className="px-2 py-3 space-y-1 text-sm flex-1">
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) => navLinkClass(isActive)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </NavLink>
                  <NavLink
                    to="/admin/tickets"
                    className={({ isActive }) => navLinkClass(isActive)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LifeBuoy className="w-4 h-4" />
                    <span>Tickets</span>
                  </NavLink>
                  <NavLink
                    to="/admin/documents"
                    className={({ isActive }) => navLinkClass(isActive)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Documentos</span>
                  </NavLink>
                  <NavLink
                    to="/admin/payments"
                    className={({ isActive }) => navLinkClass(isActive)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pagamentos</span>
                  </NavLink>
                  <NavLink
                    to="/admin/cards"
                    className={({ isActive }) => navLinkClass(isActive)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Carteirinhas</span>
                  </NavLink>
                  {isSuperAdmin && (
                    <>
                      <NavLink
                        to="/admin/notifications"
                        className={({ isActive }) => navLinkClass(isActive)}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Megaphone className="w-4 h-4" />
                        <span>Notificações</span>
                      </NavLink>
                      <NavLink
                        to="/admin/logs"
                        className={({ isActive }) => navLinkClass(isActive)}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Bell className="w-4 h-4" />
                        <span>Logs</span>
                      </NavLink>
                      <NavLink
                        to="/admin/admin-users"
                        className={({ isActive }) => navLinkClass(isActive)}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Admins</span>
                      </NavLink>
                      <NavLink
                        to="/admin/settings"
                        className={({ isActive }) => navLinkClass(isActive)}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Configurações</span>
                      </NavLink>
                    </>
                  )}
                </nav>
                <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 flex items-center justify-between">
                  <span className="text-slate-500">Sair da console</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-slate-900">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600 border border-slate-200"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-slate-50 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-900">
                  {adminUser.name || 'Admin'}
                </span>
                <span className="text-[10px] text-slate-500">
                  Administrador
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 bg-slate-50">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
