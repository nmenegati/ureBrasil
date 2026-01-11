import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Typewriter } from "@/components/ui/typewriter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Check,
  Rocket,
  Calculator,
  Ticket,
  Bus,
  GraduationCap,
  Scale,
  BookOpen,
  Instagram,
  Linkedin,
  Phone,
  Video,
  Star,
  UserPlus,
  CreditCard,
  FileCheck,
} from "lucide-react";
import { Header } from "@/components/Header";
import heroPhoneMockup from "@/assets/hero-phone-mockup.png";
import jurisStudentImage from "@/assets/juris-student.jpg";
import carteirinhaGeral1 from "@/assets/carteirinha-geral-1.jpeg";
import carteirinhaGeral2 from "@/assets/carteirinha-geral-2.jpeg";
import carteirinhaDireito1 from "@/assets/carteirinha-direito-1.jpg";
import carteirinhaDireito2 from "@/assets/carteirinha-direito-2.jpg";
import ureBrasilLogo from "@/assets/ure-brasil-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const carteirinhaSlides = [carteirinhaGeral1, carteirinhaGeral2, carteirinhaDireito1, carteirinhaDireito2];

  // Auto-rotate carousel
  useEffect(() => {
    if (isHovering) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carteirinhaSlides.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [isHovering, carteirinhaSlides.length]);

  return (
    <div className="min-h-screen">
      <Header variant="landing" />

      {/* Hero Section */}
      <section className="relative -mt-16 sm:-mt-20 pt-36 pb-16 md:pt-44 md:pb-20 bg-gradient-to-br from-ure-gradient-start to-ure-gradient-end overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center py-12 lg:py-0">
            {/* Left Content */}
            <div className="space-y-4 sm:space-y-6 text-center lg:text-left relative z-20">
              {/* Promo Badge */}
              <div className="inline-block">
                <Badge className="bg-ure-yellow text-ure-dark px-4 py-2 text-sm sm:text-base font-bold animate-pulse-slow">
                  🔥 PROMOÇÃO - A partir de R$ 29
                </Badge>
              </div>

              {/* Main Heading */}
              <div className="space-y-1 sm:space-y-2">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-tight">
                  Sua Carteirinha Estudantil Digital, Simples e Válida em Todo o Brasil
                </h1>
                <div className="flex items-center gap-2 sm:gap-3 justify-center lg:justify-start">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-ure-yellow min-h-[80px] sm:min-h-[96px] lg:min-h-[112px] xl:min-h-[128px] flex items-center">
                    <Typewriter
                      text={[
                        "Aprovação rápida",
                        "100% Digital no seu celular",
                        "Documento estudantil válido nacionalmente",
                      ]}
                      speed={70}
                      deleteSpeed={40}
                      waitTime={2000}
                      loop={true}
                      className="inline-block"
                      showCursor={false}
                    />
                  </h2>
                </div>
              </div>

              {/* Subtitle */}
              <p className="text-base sm:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Pare de pagar inteira. Tenha em mãos uma carteirinha estudantil digital, válida conforme a Lei da Meia-Entrada, para usar em cinemas, shows, teatros e eventos culturais.
              </p>

              {/* Feature Badges - Removed as per new design focus on text, or keep if user didn't ask to remove? 
                  User didn't explicitly ask to remove badges, but the new copy seems self-contained. 
                  I'll keep them but update if needed. Actually, the prompt implies replacing content. 
                  The new subtitle and typewriter cover the badge content. I will remove the old badges to clean up.
              */}

              {/* CTA Buttons */}
              <div className="flex flex-col items-center lg:items-start pt-4 sm:pt-6 space-y-4">
                <Button
                  variant="hero-primary"
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto w-full sm:w-auto shadow-xl hover:scale-105 transition-transform"
                  onClick={() => navigate('/signup')}
                >
                  <Rocket className="mr-2 h-5 w-5" />
                  Quero Minha Carteirinha Digital 🎟️
                </Button>
                
                {/* Microtext below CTA */}
                <p className="text-sm text-white/80 font-medium">
                  Processo online • Pagamento seguro • Uso imediato após aprovação
                </p>
              </div>
            </div>

            {/* Right Content - Carousel de Carteirinhas */}
            <div className="relative flex justify-center lg:justify-end mt-8 lg:mt-0 z-10">
              <div className="relative w-full max-w-[380px] sm:max-w-[440px] lg:max-w-[500px]">
                {/* Carousel Container */}
                <div
                  className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden"
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  {/* Carousel Slides */}
                  {carteirinhaSlides.map((slide, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        index === currentSlide ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <img
                        src={slide}
                        alt={`Carteirinha de estudante ${index + 1}`}
                        className="w-full h-full rounded-3xl shadow-2xl object-cover border-2 border-white/20"
                      />
                    </div>
                  ))}

                  {/* Pagination Dots */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                    {carteirinhaSlides.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          index === currentSlide ? "bg-white w-8" : "bg-white/40 hover:bg-white/60 w-2"
                        }`}
                        aria-label={`Ir para slide ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Floating Status Card */}
                <div className="absolute -top-6 -right-6 bg-white dark:bg-card rounded-2xl shadow-2xl p-3 sm:p-4 animate-float backdrop-blur-lg border border-border z-30">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-ure-green rounded-full p-1.5 sm:p-2">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-foreground">Status: Aprovado!</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Carteira ativa</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prova de Confiança Section */}
      <section className="py-8 bg-white dark:bg-[#1A1A2E] border-b border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm md:text-base font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-ure-green" />
              Documento estudantil digital
            </span>
            <span className="hidden md:block text-gray-300 dark:text-gray-700">•</span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-ure-green" />
              Processo seguro
            </span>
            <span className="hidden md:block text-gray-300 dark:text-gray-700">•</span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-ure-green" />
              Validação para evitar fraudes
            </span>
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground/80">
            Atendimento humano sempre que precisar.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="py-20 bg-white dark:bg-[#1A1A2E]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Faça Tudo em Poucos Minutos</h2>
            <p className="text-xl text-muted-foreground">Sem filas, sem papelada e sem complicação.</p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 - Cadastro */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="relative w-20 h-20 rounded-full bg-ure-blue flex items-center justify-center">
                  <UserPlus className="w-10 h-10 text-white" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-background border-2 border-ure-blue flex items-center justify-center text-sm font-bold text-ure-blue">1</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Cadastro Rápido</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Crie sua conta em menos de 2 minutos. Seus dados são protegidos conforme a LGPD.
                </p>
              </CardContent>
            </Card>

            {/* Step 2 - Pagamento Online */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="relative w-20 h-20 rounded-full bg-ure-green flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-white" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-background border-2 border-ure-green flex items-center justify-center text-sm font-bold text-ure-green">2</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Pagamento Online</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pague com PIX ou cartão. O pagamento libera automaticamente o envio para validação.
                </p>
              </CardContent>
            </Card>

            {/* Step 3 - Envio e Validação */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="relative w-20 h-20 rounded-full bg-ure-orange flex items-center justify-center">
                  <FileCheck className="w-10 h-10 text-white" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-background border-2 border-ure-orange flex items-center justify-center text-sm font-bold text-ure-orange">3</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Carteirinha Digital</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Após a aprovação, sua carteirinha fica disponível no seu painel para uso direto no celular.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Economize de Verdade Section */}
      <section id="beneficios" className="py-20 bg-gray-100 dark:bg-gray-800 transition-colors">
        <div className="container mx-auto px-4">
          {/* Cabeçalho */}
          <div className="text-center mb-12">
            {/* Linha decorativa amarela */}
            <div className="w-24 h-1 bg-[#FFD100] mx-auto mb-6"></div>

            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">Economize de Verdade ao Longo do Ano</h2>
          </div>

          {/* Grid de 3 Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 - Meia-Entrada */}
            <div className="bg-white dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              {/* Círculo com ícone */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Ticket className="w-10 h-10 text-blue-600 dark:text-blue-300" />
              </div>

              {/* Título */}
              <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Pague Meia em Eventos Culturais</h3>

              {/* Descrição */}
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Use sua carteirinha estudantil em cinemas, teatros, shows e eventos culturais conforme a legislação vigente.
              </p>
            </div>

            {/* Card 2 - Transporte */}
            <div className="bg-white dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              {/* Círculo com ícone */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Bus className="w-10 h-10 text-green-600 dark:text-green-300" />
              </div>

              {/* Título */}
              <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Mais Liberdade para se Deslocar</h3>

              {/* Descrição */}
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Tenha acesso a benefícios estudantis e descontos disponíveis para estudantes em transporte e serviços parceiros.
              </p>
            </div>

            {/* Card 3 - Educação */}
            <div className="bg-white dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              {/* Círculo com ícone */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-yellow-600 dark:text-yellow-300" />
              </div>

              {/* Título */}
              <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Vantagens para Quem Estuda</h3>

              {/* Descrição */}
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Benefícios em cursos, plataformas educacionais, softwares e serviços voltados ao público estudantil.
              </p>
            </div>
          </div>

          {/* Banner de Economia Total */}
          <div className="mt-12 text-center">
            <div className="inline-block bg-green-100 dark:bg-green-900 border-2 border-green-500 dark:border-green-400 p-8 rounded-2xl max-w-3xl">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-4xl">💰</span>
                <p className="text-2xl md:text-3xl font-bold text-green-800 dark:text-green-200">
                  Ela se paga rapidamente
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-lg mb-6">
                Com poucos usos ao longo do ano, o valor da carteirinha já se transforma em economia.
                <br />
                <span className="text-sm italic mt-2 block">Estimativa baseada em uso recorrente de meia-entrada em atividades culturais.</span>
              </p>
              <Button
                variant="hero-primary"
                size="lg"
                className="text-lg px-8 py-6 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Rocket className="mr-2 h-5 w-5" />
                Quero Economizar!
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 bg-white dark:bg-[#1A1A2E]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              Mais de 15.000 estudantes já confiam na URE
            </h2>
            <p className="text-xl text-muted-foreground">Veja o que nossos usuários dizem</p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* Testimonial 1 */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-border">
              <CardContent className="pt-8 pb-6 space-y-4">
                {/* Stars */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-ure-yellow text-ure-yellow" />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-foreground leading-relaxed text-base">
                  "Recebi minha carteirinha em menos de 1 hora! Super rápido e fácil. Já usei no cinema e funcionou
                  perfeitamente."
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4">
                  <Avatar className="h-12 w-12 bg-ure-green">
                    <AvatarFallback className="bg-ure-green text-white font-bold text-lg">M</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-foreground">Maria Silva</p>
                    <p className="text-sm text-muted-foreground">Estudante de Administração - SP</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testimonial 2 */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-border">
              <CardContent className="pt-8 pb-6 space-y-4">
                {/* Stars */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-ure-yellow text-ure-yellow" />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-foreground leading-relaxed text-base">
                  "A LexPraxis foi essencial na minha preparação para OAB. Os materiais exclusivos são excelentes!"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4">
                  <Avatar className="h-12 w-12 bg-ure-blue">
                    <AvatarFallback className="bg-ure-blue text-white font-bold text-lg">J</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-foreground">João Santos</p>
                    <p className="text-sm text-muted-foreground">Estudante de Direito - RJ</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testimonial 3 */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-border">
              <CardContent className="pt-8 pb-6 space-y-4">
                {/* Stars */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-ure-yellow text-ure-yellow" />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-foreground leading-relaxed text-base">
                  "Já economizei mais de R$ 200 em apenas 2 meses. A carteirinha se pagou várias vezes!"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4">
                  <Avatar className="h-12 w-12 bg-ure-yellow">
                    <AvatarFallback className="bg-ure-yellow text-ure-dark font-bold text-lg">A</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-foreground">Ana Costa</p>
                    <p className="text-sm text-muted-foreground">Estudante de Enfermagem - MG</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Stat 1 */}
            <div className="text-center space-y-2">
              <p className="text-5xl sm:text-6xl font-black text-ure-blue">15.000+</p>
              <p className="text-lg font-semibold text-foreground">Estudantes ativos</p>
            </div>

            {/* Stat 2 */}
            <div className="text-center space-y-2">
              <p className="text-5xl sm:text-6xl font-black text-ure-green">R$ 2.160</p>
              <p className="text-lg font-semibold text-foreground">Economia média/ano</p>
            </div>

            {/* Stat 3 */}
            <div className="text-center space-y-2">
              <p className="text-5xl sm:text-6xl font-black text-ure-yellow">4.8/5</p>
              <p className="text-lg font-semibold text-foreground">Avaliação média</p>
            </div>
          </div>
        </div>
      </section>

      {/* LexPraxis Section */}
      <section id="lex-praxis" className="py-20 bg-gradient-to-br from-[#252543] to-[#3d3d5c] text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Badge */}
              <Badge className="bg-ure-green text-white border-none px-4 py-2 text-sm font-bold">
                ✨ Exclusivo para Estudante de Direito
              </Badge>

              {/* Title */}
              <div className="space-y-2">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">LexPraxis — Para Quem Leva a Carreira Jurídica a Sério</h2>
              </div>

              {/* Description */}
              <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
                Mais que uma carteirinha estudantil. Uma identificação pensada para estudantes de Direito que buscam economia, posicionamento e preparação desde a faculdade.
              </p>

              {/* Benefits */}
              <div className="space-y-6">
                {/* Benefit 1 */}
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <Scale className="w-7 h-7 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Benefícios Educacionais Jurídicos</h3>
                    <p className="text-white/80">Acesso a vantagens e condições especiais em cursos, eventos e serviços voltados à área jurídica.</p>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-7 h-7 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Ambiente Acadêmico Profissional</h3>
                    <p className="text-white/80">Uma carteirinha alinhada à sua formação e ao seu futuro profissional.</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                size="lg"
                className="bg-ure-yellow text-[#1A1A2E] hover:bg-ure-yellow/90 text-lg px-8 py-6 h-auto font-bold w-full sm:w-auto"
                onClick={() => navigate('/signup')}
              >
                Garantir Minha LexPraxis ⚖️
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
      <section id="planos" className="py-20 bg-gray-50 dark:bg-[#1A1A2E]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Escolha Seu Plano</h2>
            <p className="text-xl text-muted-foreground">Transparente, simples e sem surpresas</p>
          </div>

          {/* Pricing Grid - 2 Digital Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plan 1 - Carteira Digital (Geral) */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-ure-blue relative">
              <CardContent className="pt-8 pb-6 flex flex-col h-full">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Carteira Estudantil Digital (Geral)</h3>
                  <p className="text-sm text-muted-foreground mb-4">Educação básica e ensino superior</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-ure-blue">R$ 29</span>
                    <span className="text-muted-foreground">/ano</span>
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
                    <span className="text-sm text-foreground">Acesso ilimitado ao app</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">Suporte prioritário</span>
                  </div>
                </div>

                <Button className="w-full bg-ure-orange text-white hover:bg-ure-orange/90 font-bold" onClick={() => navigate('/signup')}>
                  Solicitar Agora
                </Button>
              </CardContent>
            </Card>

            {/* Plan 2 - Digital Direito (Destacado) */}
            <Card className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-yellow-500 relative ring-2 ring-yellow-500/30 shadow-xl">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black border-none px-4 py-1 text-xs font-bold">
                LEXPRAXIS
              </Badge>
              <CardContent className="pt-8 pb-6 flex flex-col h-full">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Carteira Estudantil LexPraxis</h3>
                  <p className="text-sm text-muted-foreground mb-4">Exclusiva para estudantes de Direito</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-yellow-500">R$ 44</span>
                    <span className="text-muted-foreground">/ano</span>
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
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground font-bold">Rede de networking jurídico</span>
                  </div>
                </div>

                <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-600 font-bold" onClick={() => navigate('/signup')}>
                  Solicitar LexPraxis
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Physical Card Info */}
          <div className="mt-12 max-w-3xl mx-auto">
            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                  <h4 className="text-xl font-bold text-foreground">
                    Carteirinha Física Disponível
                  </h4>
                </div>
                
                <p className="text-muted-foreground mb-4">
                  Após o pagamento, você poderá adicionar a versão física em PVC 
                  de alta qualidade por apenas <strong className="text-foreground">R$ 15,00</strong>
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-ure-green" />
                    <span className="text-foreground">Material PVC durável</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-ure-green" />
                    <span className="text-foreground">Frete para todo Brasil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-ure-green" />
                    <span className="text-foreground">Entrega em 7-10 dias</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-white dark:bg-[#252543]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Dúvidas Frequentes</h2>
            <p className="text-xl text-muted-foreground">Tudo o que você precisa saber</p>
          </div>

          {/* Accordion */}
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Como funciona a validação dos documentos?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Utilizamos inteligência artificial para validar seus documentos automaticamente. Em casos duvidosos,
                nossa equipe faz revisão manual. Todo o processo leva em média 2 horas.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">A carteirinha é válida em todo Brasil?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim! A carteirinha URE é válida em todo território nacional, seguindo a legislação de meia-entrada
                estudantil.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Quanto tempo demora para receber?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                A versão digital fica disponível em até 2 horas após aprovação. A física é produzida e enviada em até 7
                dias úteis.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Quais documentos preciso enviar?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                RG ou CNH, comprovante de endereço recente (máx 3 meses), comprovante de matrícula ou declaração da
                instituição, e uma foto 3x4 ou selfie com fundo neutro.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Posso cancelar e pedir reembolso?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim, você tem 7 dias após a compra para solicitar reembolso total, conforme Código de Defesa do
                Consumidor.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Como funciona a LexPraxis?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                É nossa carteirinha especial para estudantes de Direito, com acesso a materiais de estudo para OAB,
                descontos em cursos jurídicos e eventos da área.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">A carteirinha física é obrigatória?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Não! A versão digital já garante todos os benefícios. A física é opcional para quem prefere ter o
                documento físico também.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Até quando vale minha carteirinha?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Todas as carteirinhas emitidas valem até 31/03/2026, independente da data de emissão.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 lg:py-24 bg-gradient-to-br from-[#FF6B35] to-[#FF5722] text-white relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Pulsing Badge */}
            <div className="inline-block">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-6 py-3 text-base font-bold animate-pulse">
                ⏰ Oferta por tempo limitado
              </Badge>
            </div>

            {/* Heading */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white">Comece a Economizar Hoje!</h2>

            {/* Subtitle */}
            <p className="text-xl lg:text-2xl text-white/90 font-medium">
              Sua carteirinha estudantil válida em todo Brasil em poucos minutos.
            </p>

            {/* Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 py-8">
              {/* Counter 1 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                <div className="text-4xl lg:text-5xl font-black text-white mb-2">2 horas</div>
                <div className="text-sm lg:text-base text-white/80 font-medium">Tempo médio de emissão</div>
              </div>

              {/* Counter 2 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                <div className="text-4xl lg:text-5xl font-black text-white mb-2">R$ 29</div>
                <div className="text-sm lg:text-base text-white/80 font-medium">Preço a partir de</div>
              </div>

              {/* Counter 3 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                <div className="text-4xl lg:text-5xl font-black text-white mb-2">31/03/26</div>
                <div className="text-sm lg:text-base text-white/80 font-medium">Validade até</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="bg-white text-ure-orange hover:bg-white/90 font-bold text-lg px-8 py-6 h-auto shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all duration-300"
                onClick={() => navigate('/signup')}
              >
                🚀 Solicitar Agora
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white bg-transparent text-white hover:bg-white/10 font-semibold text-lg px-8 py-6 h-auto"
              >
                📱 Falar no WhatsApp
              </Button>
            </div>

            {/* Trust Badges */}
            <p className="text-sm lg:text-base text-white/90 pt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1">✅ Pagamento 100% seguro</span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">✅ Suporte via WhatsApp</span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">✅ Garantia de 7 dias</span>
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0D7DBF] text-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* COLUNA 1 - SOBRE */}
            <div className="space-y-4">
              <div className="flex flex-col leading-none mb-4">
                <span className="text-3xl font-black text-white">URE</span>
                <span className="text-sm font-semibold text-ure-yellow">BRASIL</span>
              </div>
              <p className="text-white/90 text-sm leading-relaxed">
                Carteirinha estudantil digital e física, válida em todo território nacional. Economia real para
                estudantes.
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
                  <a
                    href="#"
                    className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200"
                  >
                    Validar Carteirinha
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200"
                  >
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
                  <a
                    href="#"
                    className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200"
                  >
                    Termos de Uso
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200"
                  >
                    Política de Privacidade
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200"
                  >
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-white/90 text-sm hover:text-white hover:underline transition-all duration-200"
                  >
                    Contato
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* RODAPÉ FINAL */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="text-center space-y-2">
              <p className="text-white/80 text-sm">
                © 2025 URE Brasil - União Representativa dos Estudantes e Juventude do Brasil. Todos os direitos
                reservados.
              </p>
              <p className="text-white/60 text-xs">CNPJ: XX.XXX.XXX/0001-XX</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
