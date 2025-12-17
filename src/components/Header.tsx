import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Menu, X, Sun, Moon, User, LogOut, Home, CreditCard } from 'lucide-react';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

interface HeaderProps {
  variant?: 'landing' | 'app';
}

export function Header({ variant = 'app' }: HeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  const [isPWA, setIsPWA] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isLandingPage = location.pathname === '/';
  
  useEffect(() => {
    const checkPWA = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPWA(checkPWA);
  }, []);
  
  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 
                    user?.email?.split('@')[0] || 
                    'Usuário';
  
  const initials = firstName.substring(0, 2).toUpperCase();
  
  const scrollToSection = (sectionName: string) => {
    const sectionIds: Record<string, string> = {
      'Como Funciona': 'como-funciona',
      'Benefícios': 'beneficios',
      'JurisEstudante': 'juris-estudante',
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

  const menuItems = ['Como Funciona', 'Benefícios', 'JurisEstudante', 'Planos', 'Dúvidas'];
  
  // Determine background based on variant - both use CSS variables for theme support
  const headerBg = 'bg-background/95 backdrop-blur-lg border-b border-border';
  
  return (
    <header className={`sticky top-0 z-50 ${headerBg}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <img
              src={ureBrasilLogo}
              alt="URE Brasil - União Representativa dos Estudantes"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation - Only on landing page and not PWA */}
          {isLandingPage && !isPWA && (
            <nav className="hidden lg:flex items-center space-x-1">
              {menuItems.map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  className="text-foreground hover:text-primary font-medium"
                  onClick={() => scrollToSection(item)}
                >
                  {item}
                </Button>
              ))}
            </nav>
          )}

          {/* Right Section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Dark Mode Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleDarkMode} 
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Auth Section */}
            {user ? (
              <>
                {/* Início Button - Only when logged in, not PWA, and not on dashboard */}
                {!isPWA && user && location.pathname !== '/dashboard' && (
                  <Button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="bg-ure-orange hover:bg-ure-orange/90 text-white gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Minha Carteirinha
                  </Button>
                )}
                
                {/* Avatar with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                      <Avatar className="h-9 w-9 border-2 border-primary">
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium hidden sm:block text-foreground">
                        {firstName}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  
                  <DropdownMenuContent align="end" className="w-48 bg-popover border border-border">
                    {/* Página Inicial - só aparece se NÃO estiver na landing */}
                    {location.pathname !== '/' && (
                      <DropdownMenuItem 
                        onClick={() => navigate('/')}
                        className="cursor-pointer"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        Página Inicial
                      </DropdownMenuItem>
                    )}
                    
                    {/* Minha Carteirinha - só aparece se NÃO estiver no dashboard */}
                    {location.pathname !== '/dashboard' && (
                      <DropdownMenuItem 
                        onClick={() => navigate('/dashboard')}
                        className="cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Minha Carteirinha
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem 
                      onClick={() => navigate('/perfil')}
                      className="cursor-pointer"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleSignOut}
                      className="cursor-pointer text-destructive"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
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
                  className="hidden sm:inline-flex"
                >
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button 
                  asChild 
                  className="bg-ure-orange text-white hover:bg-ure-orange/90 hidden sm:inline-flex"
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
                  <Button asChild variant="header-outline" className="w-full">
                    <Link to="/login">Entrar</Link>
                  </Button>
                  <Button asChild className="w-full bg-ure-orange text-white hover:bg-ure-orange/90">
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
