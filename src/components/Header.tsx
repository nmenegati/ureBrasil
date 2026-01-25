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
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [hasActiveCard, setHasActiveCard] = useState(false);
  const [hasPhysicalCard, setHasPhysicalCard] = useState(false);
  
  const [isPWA, setIsPWA] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isLandingPage = location.pathname === '/';
  const isCarteirinhaPage = location.pathname === '/carteirinha';
  const isPerfilPage = location.pathname === '/perfil';
  
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
        setIsProfileComplete(false);
        setHasActiveCard(false);
        setHasPhysicalCard(false);
        return;
      }
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id, profile_completed, full_name, institution, course, street')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile?.id) {
        setIsProfileComplete(false);
        setHasActiveCard(false);
        setHasPhysicalCard(false);
        return;
      }
      const profileCompletedByFields =
        !!profile.full_name &&
        !!profile.institution &&
        !!profile.course &&
        !!profile.street;
      setIsProfileComplete(!!profile.profile_completed || profileCompletedByFields);

      const { data: card } = await supabase
        .from('student_cards')
        .select('status, card_number, is_physical')
        .eq('student_id', profile.id)
        .maybeSingle();
      const activeCard =
        !!card && card.status === 'active' && !!card.card_number;
      setHasActiveCard(activeCard);
      const physicalCard = !!card && card.is_physical === true;
      setHasPhysicalCard(physicalCard);
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
  const showPhysicalOption = hasActiveCard && !hasPhysicalCard;

  const avatarMenuItems: {
    label: string;
    icon: typeof User;
    onClick: () => void;
    highlight?: boolean;
    primary?: boolean;
  }[] = [];

  if (isCarteirinhaPage) {
    avatarMenuItems.push({
      label: 'Meu Perfil',
      icon: User,
      onClick: () => navigate(profileLink),
    });
  } else if (isPerfilPage) {
    avatarMenuItems.push({
      label: 'Minha Carteirinha',
      icon: CreditCard,
      onClick: () => navigate(hasActiveCard ? '/carteirinha' : '/dashboard'),
      primary: true,
    });
  } else {
    avatarMenuItems.push({
      label: 'Minha Carteirinha',
      icon: CreditCard,
      onClick: () => navigate(hasActiveCard ? '/carteirinha' : '/dashboard'),
      primary: true,
    });
    avatarMenuItems.push({
      label: 'Meu Perfil',
      icon: User,
      onClick: () => navigate(profileLink),
    });
  }

  if (showPhysicalOption) {
    avatarMenuItems.push({
      label: 'Carteira Física por R$24',
      icon: Package,
      highlight: true,
      onClick: () => navigate('/adquirir-fisica'),
    });
  }

  const themeLabel = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
  const themeIcon = theme === 'dark' ? Sun : Moon;

  avatarMenuItems.push({
    label: themeLabel,
    icon: themeIcon,
    onClick: toggleTheme,
  });

  avatarMenuItems.push({
    label: 'Sair',
    icon: LogOut,
    onClick: handleSignOut,
  });
  
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
                    {avatarMenuItems.map((item, index) => {
                      let itemClass = 'cursor-pointer';
                      if (item.primary) {
                        itemClass += ' bg-ure-yellow text-ure-dark hover:bg-ure-yellow/90 font-bold py-3';
                      } else if (item.highlight) {
                        itemClass += ' bg-ure-yellow/10 text-foreground hover:bg-ure-yellow/20 font-semibold py-2';
                      }
                      return (
                        <DropdownMenuItem
                          key={index}
                          onClick={item.onClick}
                          className={itemClass}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
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
