import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Menu, X, Sun, Moon, Check, Rocket, Calculator, Ticket, Bus, GraduationCap, Scale, BookOpen, Instagram, Linkedin, Phone, Video } from "lucide-react";
import heroPhoneMockup from "@/assets/hero-phone-mockup.png";
import jurisStudentImage from "@/assets/juris-student.jpg";

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

      {/* Benefits Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              Economize de Verdade!
            </h2>
            <p className="text-xl text-muted-foreground">
              Descontos e benefícios em todo Brasil
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Benefit 1 - Meia-Entrada */}
            <Card className="bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-ure-blue/10 flex items-center justify-center">
                  <Ticket className="w-12 h-12 text-ure-blue" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Meia-Entrada
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Cinemas, teatros, shows, eventos esportivos e culturais. Economize até 50%!
                </p>
                <div className="bg-ure-green/10 text-ure-green px-4 py-2 rounded-lg font-bold">
                  Economia média: R$ 40/mês
                </div>
              </CardContent>
            </Card>

            {/* Benefit 2 - Transporte */}
            <Card className="bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-ure-green/10 flex items-center justify-center">
                  <Bus className="w-12 h-12 text-ure-green" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Transporte
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Descontos em transporte público e intermunicipal em diversas cidades.
                </p>
                <div className="bg-ure-green/10 text-ure-green px-4 py-2 rounded-lg font-bold">
                  Economia média: R$ 80/mês
                </div>
              </CardContent>
            </Card>

            {/* Benefit 3 - Educação */}
            <Card className="bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-ure-yellow/10 flex items-center justify-center">
                  <GraduationCap className="w-12 h-12 text-ure-yellow" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  Educação
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Cursos online, softwares, livros, plataformas de estudo e muito mais.
                </p>
                <div className="bg-ure-green/10 text-ure-green px-4 py-2 rounded-lg font-bold">
                  Economia média: R$ 60/mês
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Savings Banner */}
          <div className="bg-ure-green/10 dark:bg-ure-green/20 rounded-2xl p-8 text-center space-y-4 border-2 border-ure-green/20">
            <p className="text-3xl sm:text-4xl font-black text-foreground">
              💰 Potencial de economia: Até R$ 180/mês = R$ 2.160/ano!
            </p>
            <p className="text-lg text-muted-foreground font-medium">
              Sua carteirinha se paga em menos de uma semana!
            </p>
          </div>
        </div>
      </section>

      {/* JurisEstudante Section */}
      <section className="py-20 bg-gradient-to-br from-[#252543] to-[#3d3d5c] text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Badge */}
              <Badge className="bg-ure-green text-white border-none px-4 py-2 text-sm font-bold">
                ✨ Exclusivo para Direito
              </Badge>

              {/* Title */}
              <div className="space-y-3">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                  JurisEstudante
                </h2>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-16 bg-ure-yellow"></div>
                  <p className="text-3xl sm:text-4xl font-black text-ure-yellow">
                    Sua carreira começa aqui
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
                Carteirinha especial para estudantes de Direito com benefícios exclusivos voltados para sua formação e preparação para OAB.
              </p>

              {/* Benefits */}
              <div className="space-y-6">
                {/* Benefit 1 */}
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <Scale className="w-7 h-7 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      Descontos em Cursos Jurídicos
                    </h3>
                    <p className="text-white/80">
                      Preparatórios OAB, pós-graduações e especializações
                    </p>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-7 h-7 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      Material de Estudo Exclusivo
                    </h3>
                    <p className="text-white/80">
                      Simulados, cronogramas, e-books e videoaulas
                    </p>
                  </div>
                </div>

                {/* Benefit 3 */}
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-7 h-7 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      Eventos e Congressos
                    </h3>
                    <p className="text-white/80">
                      Acesso facilitado a eventos jurídicos pelo Brasil
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <Button 
                size="lg"
                className="bg-ure-yellow text-[#1A1A2E] hover:bg-ure-yellow/90 text-lg px-8 py-6 h-auto font-bold w-full sm:w-auto"
              >
                Quero a JurisEstudante
              </Button>
            </div>

            {/* Right Content - Image */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src={jurisStudentImage}
                  alt="Estudante de Direito estudando com materiais jurídicos"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-[#F5F5F5] dark:bg-[#1A1A2E]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              Escolha Seu Plano
            </h2>
            <p className="text-xl text-muted-foreground">
              Transparente, simples e sem surpresas
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Plan 1 - Digital Geral */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-ure-blue relative">
              <CardContent className="pt-8 pb-6 flex flex-col h-full">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Digital Geral
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ensino médio, superior, cursos
                  </p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-ure-blue">R$ 29</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 flex-grow">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Carteirinha digital</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">QR Code de verificação</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Validade até 31/03/2026</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Emissão em até 2h</span>
                  </div>
                </div>

                <Button className="w-full bg-ure-orange text-white hover:bg-ure-orange/90 font-bold">
                  Solicitar Agora
                </Button>
              </CardContent>
            </Card>

            {/* Plan 2 - Digital + Física Geral */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-ure-green relative">
              <CardContent className="pt-8 pb-6 flex flex-col h-full">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Digital + Física
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Completo
                  </p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-ure-green">R$ 39</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 flex-grow">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Carteirinha digital</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">QR Code de verificação</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Validade até 31/03/2026</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Emissão em até 2h</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Carteirinha física em casa</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Envio em até 7 dias úteis</span>
                  </div>
                </div>

                <Button className="w-full bg-ure-orange text-white hover:bg-ure-orange/90 font-bold">
                  Solicitar Agora
                </Button>
              </CardContent>
            </Card>

            {/* Plan 3 - Digital Direito */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-purple-600 relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white border-none px-4 py-1 text-xs font-bold">
                JURISESTUDANTE
              </Badge>
              <CardContent className="pt-8 pb-6 flex flex-col h-full">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Digital Direito
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Para futuros advogados
                  </p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-purple-600">R$ 49</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 flex-grow">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Carteirinha digital</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">QR Code de verificação</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Validade até 31/03/2026</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Emissão em até 2h</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Benefícios exclusivos Direito</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Material de estudo OAB</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Descontos em cursos jurídicos</span>
                  </div>
                </div>

                <Button className="w-full bg-ure-yellow text-[#1A1A2E] hover:bg-ure-yellow/90 font-bold">
                  Solicitar JurisEstudante
                </Button>
              </CardContent>
            </Card>

            {/* Plan 4 - Digital + Física Direito */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-purple-600 relative ring-2 ring-ure-yellow/50">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white border-none px-4 py-1 text-xs font-bold">
                JURISESTUDANTE
              </Badge>
              <CardContent className="pt-8 pb-6 flex flex-col h-full">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Digital + Física Direito
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pacote completo
                  </p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-purple-600">R$ 59</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 flex-grow">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Carteirinha digital</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">QR Code de verificação</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Validade até 31/03/2026</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Emissão em até 2h</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Carteirinha física em casa</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Envio em até 7 dias úteis</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Benefícios exclusivos Direito</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Material de estudo OAB</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Descontos em cursos jurídicos</span>
                  </div>
                </div>

                <Button className="w-full bg-ure-yellow text-[#1A1A2E] hover:bg-ure-yellow/90 font-bold">
                  Solicitar JurisEstudante
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              Dúvidas Frequentes
            </h2>
            <p className="text-xl text-muted-foreground">
              Tudo o que você precisa saber
            </p>
          </div>

          {/* Accordion */}
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  Como funciona a validação dos documentos?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Utilizamos inteligência artificial para validar seus documentos automaticamente. Em casos duvidosos, nossa equipe faz revisão manual. Todo o processo leva em média 2 horas.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  A carteirinha é válida em todo Brasil?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim! A carteirinha URE é válida em todo território nacional, seguindo a legislação de meia-entrada estudantil.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  Quanto tempo demora para receber?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                A versão digital fica disponível em até 2 horas após aprovação. A física é produzida e enviada em até 7 dias úteis.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  Quais documentos preciso enviar?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                RG ou CNH, comprovante de endereço recente (máx 3 meses), comprovante de matrícula ou declaração da instituição, e uma foto 3x4 ou selfie com fundo neutro.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  Posso cancelar e pedir reembolso?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim, você tem 7 dias após a compra para solicitar reembolso total, conforme Código de Defesa do Consumidor.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  Como funciona a JurisEstudante?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                É nossa carteirinha especial para estudantes de Direito, com acesso a materiais de estudo para OAB, descontos em cursos jurídicos e eventos da área.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  A carteirinha física é obrigatória?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Não! A versão digital já garante todos os benefícios. A física é opcional para quem prefere ter o documento físico também.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">
                  Até quando vale minha carteirinha?
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Todas as carteirinhas emitidas valem até 31/03/2026, independente da data de emissão.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-ure-blue text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* COLUNA 1 - SOBRE */}
            <div className="space-y-4">
              <div className="flex flex-col leading-none mb-4">
                <span className="text-3xl font-black text-white">URE</span>
                <span className="text-sm font-semibold text-ure-yellow">BRASIL</span>
              </div>
              <p className="text-white/90 text-sm leading-relaxed">
                Carteirinha estudantil digital e física, válida em todo território nacional. Economia real para estudantes.
              </p>
              <div className="flex items-center space-x-4 pt-2">
                <a 
                  href="#" 
                  className="text-white hover:text-ure-yellow transition-all duration-300 hover:scale-110"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a 
                  href="#" 
                  className="text-white hover:text-ure-yellow transition-all duration-300 hover:scale-110"
                  aria-label="TikTok"
                >
                  <Video className="h-5 w-5" />
                </a>
                <a 
                  href="#" 
                  className="text-white hover:text-ure-yellow transition-all duration-300 hover:scale-110"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
                <a 
                  href="#" 
                  className="text-white hover:text-ure-yellow transition-all duration-300 hover:scale-110"
                  aria-label="WhatsApp"
                >
                  <Phone className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* COLUNA 2 - LINKS RÁPIDOS */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Links Rápidos</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Como Funciona
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Benefícios
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    JurisEstudante
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Planos
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Validar Carteirinha
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Área do Aluno
                  </a>
                </li>
              </ul>
            </div>

            {/* COLUNA 3 - LEGAL */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Institucional</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Termos de Uso
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Política de Privacidade
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Contato
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Trabalhe Conosco
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200">
                    Suporte
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* RODAPÉ FINAL */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="text-center space-y-2">
              <p className="text-white/80 text-sm">
                © 2025 URE Brasil - União Representativa dos Estudantes e Juventude do Brasil. Todos os direitos reservados.
              </p>
              <p className="text-white/60 text-xs">
                CNPJ: XX.XXX.XXX/0001-XX
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
