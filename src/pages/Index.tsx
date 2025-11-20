import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Menu, X, Sun, Moon, Check, Rocket, Calculator } from "lucide-react";
import heroPhoneMockup from "@/assets/hero-phone-mockup.png";

const Index = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const menuItems = [
    "Como Funciona",
    "Benefícios",
    "JurisEstudante",
    "Planos",
    "FAQ",
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="flex flex-col leading-none">
                <span className="text-2xl sm:text-3xl font-black text-ure-blue">URE</span>
                <span className="text-xs sm:text-sm font-semibold text-ure-green">BRASIL</span>
              </div>
            </div>

            {/* Desktop Menu */}
            <nav className="hidden lg:flex items-center space-x-1">
              {menuItems.map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  className="text-foreground hover:text-primary font-medium"
                >
                  {item}
                </Button>
              ))}
            </nav>

            {/* Right Section */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="hover:bg-muted"
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>

              {/* Login Button - Hidden on mobile */}
              <Button variant="header-outline" className="hidden sm:inline-flex">
                Login
              </Button>

              {/* CTA Button */}
              <Button className="bg-ure-orange text-white hover:bg-ure-orange/90 hidden sm:inline-flex">
                Solicitar Agora
              </Button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden py-4 space-y-2 animate-fade-in">
              {menuItems.map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  className="w-full justify-start text-foreground hover:text-primary"
                >
                  {item}
                </Button>
              ))}
              <div className="pt-4 space-y-2">
                <Button variant="header-outline" className="w-full">
                  Login
                </Button>
                <Button className="w-full bg-ure-orange text-white hover:bg-ure-orange/90">
                  Solicitar Agora
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 sm:pt-24 gradient-hero overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center py-12 lg:py-0">
            {/* Left Content */}
            <div className="space-y-6 sm:space-y-8 text-center lg:text-left">
              {/* Promo Badge */}
              <div className="inline-block">
                <Badge className="bg-ure-yellow text-ure-dark px-4 py-2 text-sm sm:text-base font-bold animate-pulse-slow">
                  🔥 PROMOÇÃO - A partir de R$ 29
                </Badge>
              </div>

              {/* Main Heading */}
              <div className="space-y-2 sm:space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-tight">
                  Sua Carteirinha
                  <br />
                  Estudantil
                </h1>
                <div className="flex items-center gap-2 sm:gap-3 justify-center lg:justify-start">
                  <div className="h-1 sm:h-1.5 w-12 sm:w-16 bg-ure-yellow"></div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-ure-yellow">
                    em Minutos!
                  </h2>
                </div>
              </div>

              {/* Subtitle */}
              <p className="text-base sm:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                100% digital, válida em todo Brasil, com tecnologia de verificação
                por QR Code. Aproveite descontos em cultura, transporte, educação e
                muito mais!
              </p>

              {/* Feature Badges */}
              <div className="flex flex-wrap gap-2 sm:gap-3 justify-center lg:justify-start">
                {[
                  "Emissão em até 2 horas",
                  "Válida nacionalmente",
                  "Verificação por IA",
                ].map((feature) => (
                  <Badge
                    key={feature}
                    variant="secondary"
                    className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium"
                  >
                    <Check className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {feature}
                  </Badge>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
                <Button
                  variant="hero-primary"
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto w-full sm:w-auto"
                >
                  <Rocket className="mr-2 h-5 w-5" />
                  Solicitar Minha Carteirinha
                </Button>
                <Button
                  variant="hero-outline"
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto w-full sm:w-auto"
                >
                  Ver Como Funciona
                </Button>
                <Button
                  variant="hero-accent"
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto hidden xl:inline-flex"
                >
                  <Calculator className="mr-2 h-5 w-5" />
                  Calcular Economia
                </Button>
              </div>

              {/* Social Proof */}
              <p className="text-sm sm:text-base text-white/80 flex items-center justify-center lg:justify-start gap-2">
                ✨ Mais de 15.000 estudantes já economizaram com a URE
              </p>
            </div>

            {/* Right Content - Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end mt-8 lg:mt-0">
              <div className="relative animate-float">
                <img
                  src={heroPhoneMockup}
                  alt="Carteirinha Digital URE no celular"
                  className="w-full max-w-sm lg:max-w-md drop-shadow-2xl"
                />
                {/* Floating Status Card */}
                <div className="absolute -top-4 -right-4 sm:-right-8 bg-white dark:bg-card rounded-2xl shadow-2xl p-3 sm:p-4 animate-float backdrop-blur-lg border border-border">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-ure-green rounded-full p-1.5 sm:p-2">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-foreground">
                        Status: Aprovado!
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Carteira ativa
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-[#F5F5F5] dark:bg-[#1A1A2E]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              Como Funciona? É Simples e Rápido!
            </h2>
            <p className="text-xl text-muted-foreground">
              Sua carteirinha em 4 passos
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-ure-blue flex items-center justify-center">
                  <span className="text-3xl font-black text-white">1</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Cadastre-se
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Crie sua conta com email e senha. Rápido e seguro.
                </p>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-ure-green flex items-center justify-center">
                  <span className="text-3xl font-black text-white">2</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Envie Documentos
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Faça upload do RG, comprovante de matrícula e foto 3x4.
                </p>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-ure-yellow flex items-center justify-center">
                  <span className="text-3xl font-black text-ure-dark">3</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Validação Express
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa IA valida seus docs em minutos. Você recebe notificação.
                </p>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-ure-orange flex items-center justify-center">
                  <span className="text-3xl font-black text-white">4</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Receba e Use!
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Carteirinha digital na hora. Física em até 7 dias (se escolher).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
