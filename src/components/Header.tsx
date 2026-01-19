import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Menu, X, Sun, Moon, User, LogOut, Home, CreditCard, Bell, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';
import { supabase } from '@/integrations/supabase/client';

interface HeaderProps {
  variant?: 'landing' | 'app';
}

export function Header({ variant = 'app' }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { avatarUrl, fullName: profileFullName } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const resolvedTheme = (typeof theme === 'string' ? theme : 'light');
  const [scrolled, setScrolled] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showPhysicalOption, setShowPhysicalOption] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  
  const [isPWA, setIsPWA] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isLandingPage = location.pathname === '/';
  
  useEffect(() => {
    const checkPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      ((navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIsPWA(checkPWA);
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) {
        setNotificationCount(0);
        return;
      }
      setNotificationCount(0);
    };
    fetchNotifications();
  }, [user]);
  
  useEffect(() => {
    const checkPhysicalCard = async () => {
      if (!user) {
        setShowPhysicalOption(false);
        setIsProfileComplete(false);
        return;
      }
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id, profile_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile?.id) {
        setShowPhysicalOption(false);
        setIsProfileComplete(false);
        return;
      }
      setIsProfileComplete(!!profile.profile_completed);
      const { data: card } = await supabase
        .from('student_cards')
        .select('status, is_physical')
        .eq('student_id', profile.id)
        .maybeSingle();
      const shouldShow =
        !!card && card.status === 'active' && card.is_physical === false;
      setShowPhysicalOption(shouldShow);
    };
    checkPhysicalCard();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  
  const firstName = profileFullName?.split(' ')[0] || 
                    user?.user_metadata?.full_name?.split(' ')[0] || 
                    user?.email?.split('@')[0] || 
                    'Usuário';
  
  const initials = firstName.substring(0, 2).toUpperCase();
  const profileLink = isProfileComplete ? '/perfil' : '/complete-profile';
  
  const scrollToSection = (sectionName: string) => {
    const sectionIds: Record<string, string> = {
      'Como Funciona': 'como-funciona',
      'Benefícios': 'beneficios',
      'LexPraxis': 'lex-praxis',
      'Planos': 'planos',
      'Dúvidas': 'faq',
    };

    const sectionId = sectionIds[sectionName];
    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  const menuItems = ['Como Funciona', 'Benefícios', 'LexPraxis', 'Planos', 'Dúvidas'];
  
  // Determine background based on variant - both use CSS variables for theme support
  const headerBg = scrolled
    ? 'bg-secondary/85 backdrop-blur-lg shadow-sm'
    : 'bg-background/95 backdrop-blur-lg border-b border-border';
  
  return (
    <header className={`sticky top-0 z-50 ${headerBg}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-[72px]">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <img
              src={ureBrasilLogo}
              alt="URE Brasil - União Representativa dos Estudantes"
              className="h-9 sm:h-11 w-auto object-contain"
            />
            <div
              className={`hidden md:flex flex-col items-start justify-center -space-y-0.5 ml-2 ${
                resolvedTheme === 'light'
                  ? (scrolled
                      ? 'bg-gradient-to-r from-primary-foreground via-primary-foreground to-primary-foreground'
                      : 'bg-gradient-to-r from-foreground via-primary to-foreground')
                  : (scrolled
                      ? 'bg-gradient-to-r from-secondary-foreground via-secondary-foreground to-secondary-foreground'
                      : 'bg-gradient-to-r from-foreground via-foreground to-foreground')
              } bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer`}
            >
              <span className="text-[10px] font-medium tracking-wide uppercase">
                UNIÃO REPRESENTATIVA
              </span>
              <span className="text-[10px] font-bold tracking-wide uppercase">
                DOS ESTUDANTES DO BRASIL
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Only on landing page and not PWA */}
          {isLandingPage && !isPWA && (
            <nav className="hidden lg:flex items-center space-x-1">
              {menuItems.map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  className={scrolled ? 'text-secondary-foreground hover:text-primary font-medium' : 'text-foreground hover:text-primary font-medium'}
                  onClick={() => scrollToSection(item)}
                >
                  {item}
                </Button>
              ))}
            </nav>
          )}

          {/* Right Section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {user && (
              <Button 
                variant="ghost" 
                size="icon" 
                className={`relative ${scrolled ? 'text-secondary-foreground hover:text-primary hover:bg-secondary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                onClick={() => navigate('/notificacoes')}
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white border-0">
                    {notificationCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* Auth Section */}
            {user ? (
              <>
                {/* Removido botão principal Minha Carteirinha - destaque no dropdown */}
                
                {/* Avatar with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                      <Avatar className="h-9 w-9 border-2 border-primary">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={firstName} />}
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`font-medium hidden sm:block ${scrolled ? 'text-secondary-foreground' : 'text-foreground'}`}>
                        {firstName}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  
                  <DropdownMenuContent align="end" className="w-56 bg-popover border border-border">
                    <DropdownMenuItem
                      onClick={() => navigate('/dashboard')}
                      className="bg-ure-yellow text-ure-dark hover:bg-ure-yellow/90 font-bold py-3 cursor-pointer"
                    >
                      <CreditCard className="mr-2 h-5 w-5" />
                      Minha Carteirinha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate(profileLink)}
                      className="cursor-pointer"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Meu Perfil
                    </DropdownMenuItem>
                    {showPhysicalOption && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => navigate('/adquirir-fisica')}
                          className="text-ure-blue font-medium cursor-pointer"
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Adquirir Carteirinha Física - R$ 19
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={toggleTheme}
                      className="cursor-pointer"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="mr-2 h-4 w-4" />
                          Modo Claro
                        </>
                      ) : (
                        <>
                          <Moon className="mr-2 h-4 w-4" />
                          Modo Escuro
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-red-600 focus:text-red-600"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button 
                  asChild 
                  variant="header-outline" 
                  className={`hidden sm:inline-flex ${
                    scrolled
                      ? 'text-secondary-foreground hover:text-secondary-foreground hover:bg-secondary/20'
                      : 'text-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button 
                  asChild 
                  variant="brand-primary"
                  className="hidden sm:inline-flex"
                >
                  <Link to="/signup">Cadastrar</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Toggle - Only on landing page */}
            {isLandingPage && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menu - Only on landing page */}
        {isLandingPage && isMobileMenuOpen && (
          <div className="lg:hidden py-4 space-y-2 animate-fade-in">
            {menuItems.map((item) => (
              <Button
                key={item}
                variant="ghost"
                className="w-full justify-start text-foreground hover:text-primary"
                onClick={() => scrollToSection(item)}
              >
                {item}
              </Button>
            ))}
            <div className="pt-4 space-y-2">
              {user ? (
                <Button 
                  variant="hero-primary" 
                  className="w-full"
                  onClick={() => {
                    navigate('/dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Minha Carteirinha
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="header-outline"
                    className={`w-full ${
                      scrolled
                        ? 'text-secondary-foreground hover:text-secondary-foreground hover:bg-secondary/20'
                        : 'text-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Link to="/login">Entrar</Link>
                  </Button>
                  <Button asChild variant="brand-primary" className="w-full">
                    <Link to="/signup">Cadastrar</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
