import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Typewriter } from "@/components/ui/typewriter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImageAutoSlider } from "@/components/ui/image-auto-slider";
import { BorderTrail } from "@/components/ui/border-trail";
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
  Loader2,
} from "lucide-react";
import { Header } from "@/components/Header";
import heroPhoneMockup from "@/assets/hero-phone-mockup.png";
import jurisStudentImage from "@/assets/juris-student.jpg";
import carteirinhaGeral1 from "@/assets/carteirinha-geral-1.jpeg";
import carteirinhaGeral2 from "@/assets/carteirinha-geral-2.jpeg";
import carteirinhaDireito1 from "@/assets/carteirinha-direito-1.jpg";
import carteirinhaDireito2 from "@/assets/carteirinha-direito-2.jpg";
import ureBrasilLogo from "@/assets/ure-brasil-logo.png";
import human01 from "@/assets/human-01.jpg";
import human02 from "@/assets/human-02.jpg";
import human03 from "@/assets/human-03.jpg";
import human04 from "@/assets/human-04.jpg";
import human05 from "@/assets/human-05.jpg";
import human06 from "@/assets/human-06.jpg";
import human07 from "@/assets/human-07.jpg";
import human08 from "@/assets/human-08.jpg";
import human09 from "@/assets/human-09.jpg";
import human10 from "@/assets/human-10.jpg";
import human11 from "@/assets/human-11.jpg";
import human12 from "@/assets/human-12.jpg";
import iconeCinema from "@/assets/icone-cinema.png";
import iconeShow from "@/assets/icone-show.png";
import iconeTeatro from "@/assets/icone-teatro.png";
import iconeEsporte from "@/assets/icone-esporte.png";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PolicyModal } from "@/components/PolicyModal";
import { goToStudentCardFlow } from "@/lib/cardNavigation";

const Index = () => {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const [hasActiveCard, setHasActiveCard] = useState(false);
  const [checkingCard, setCheckingCard] = useState(false);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [currentHumanSlide, setCurrentHumanSlide] = useState(0);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  const carteirinhaSlides = [carteirinhaGeral1, carteirinhaGeral2, carteirinhaDireito1, carteirinhaDireito2];
  
  // Array of human images for the atmospheric section
  const humanImages = [
    human01, human02, human03, human04, human05, human06, 
    human07, human08, human09, human10, human11, human12
  ];

  // Auto-rotate carousel
  useEffect(() => {
    if (isHovering) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carteirinhaSlides.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [isHovering, carteirinhaSlides.length]);

  // Auto-rotate human background (slower fade)
  useEffect(() => {
    const timer = setInterval(() => {
      // Randomly select next image to keep it fresh, or sequential
      setCurrentHumanSlide((prev) => (prev + 1) % humanImages.length);
    }, 8000); // Change every 8 seconds

    return () => clearInterval(timer);
  }, [humanImages.length]);

  useEffect(() => {
    setTheme('light');
  }, [setTheme]);
  useEffect(() => {
    const checkActiveCard = async () => {
      if (!user?.id) {
        setHasActiveCard(false);
        return;
      }
      setCheckingCard(true);
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (profile?.id) {
        const { data: card } = await supabase
          .from('student_cards')
          .select('status')
          .eq('student_id', profile.id)
          .single();
        setHasActiveCard(card?.status === 'active');
      } else {
        setHasActiveCard(false);
      }
      setCheckingCard(false);
    };
    checkActiveCard();
  }, [user?.id]);

  const handleCTA = async () => {
    if (ctaLoading) return;
    setCtaLoading(true);
    try {
      if (!user) {
        navigate('/signup');
      } else {
        await goToStudentCardFlow(navigate);
      }
    } finally {
      setCtaLoading(false);
    }
  };
  // Testimonial Rotation Logic
  const [currentTestimonialGroup, setCurrentTestimonialGroup] = useState(0);
  const [isTestimonialHovered, setIsTestimonialHovered] = useState(false);

  const testimonials = [
    {
      text: "Já perdi a conta de quanto economizei nesses meses. A carteirinha já se pagou umas dez vezes. Valeu muito a pena!",
      name: "João Victor Lima",
      role: "Estudante de Educação Física – Recife/PE",
      avatarColor: "bg-ure-green",
      initial: "J"
    },
    {
      text: "Fiz o meu cadastro de manhã e já estava usando a meia-entrada no cinema na mesma hora. Sem burocracia nenhuma, do jeito que eu gosto.",
      name: "César L. Reis",
      role: "Jornalismo – Curitiba/PR",
      avatarColor: "bg-ure-blue",
      initial: "C"
    },
    {
      text: "A LexPraxis é um diferencial absurdo. Além de garantir minha meia-entrada, os materiais de Direito me ajudam muito na faculdade. É 2 em 1!",
      name: "Aline Domingos",
      role: "Pós-graduação em Direito – Ribeirão Preto/SP",
      avatarColor: "bg-ure-yellow",
      initial: "A"
    },
    {
      text: "Fiquei com medo de não aceitarem no estádio, mas foi tranquilo demais. Já usei nos jogos do mengão e funcionou certinho de primeira. Agora é torcer.",
      name: "Luiz Gustavo Nasaro",
      role: "Ensino Médio – Rio de Janeiro/RJ",
      avatarColor: "bg-ure-orange",
      initial: "L"
    },
    {
      text: "Poder usar a versão digital direto no celular facilita demais a vida. Já fui em cinema e exposição e a entrada foi super segura e rápida. Aprovada!",
      name: "Daysemar Nascimento",
      role: "Letras – Barbacena/MG",
      avatarColor: "bg-ure-green",
      initial: "D"
    },
    {
      text: "O cinema e o teatro fazem parte do programa de toda semana. É a melhor forma de aproveitar a cidade sem gastar uma fortuna. Tudo simples e sem dor de cabeça!",
      name: "Thais M. Vargas",
      role: "Ensino Fundamental – Aparecida de Goiania/GO",
      avatarColor: "bg-ure-blue",
      initial: "T"
    },
    {
      text: "Carteirinha on e desconto garantido! 😎 Já usei várias vezes em eventos de tecnologia e lazer. Prática, segura e aceita em qualquer lugar.",
      name: "Matheus Pacheco",
      role: "Estudante de Marketing – São Bernardo do Campo/SP",
      avatarColor: "bg-ure-yellow",
      initial: "M"
    },
    {
      text: "Mesmo na pós-graduação, as vantagens são enormes. Uso tanto para eventos culturais quanto no estádio de futebol. É um investimento que se paga rápido.",
      name: "Bruno Oliveira",
      role: "Pós-graduação em Nutrição – Salvador/BA",
      avatarColor: "bg-ure-orange",
      initial: "B"
    }
  ];

  // Helper to get current visible testimonials (3 at a time)
  const getVisibleTestimonials = () => {
    // Determine indices based on group
    let indices = [];
    if (currentTestimonialGroup === 0) indices = [0, 1, 2];
    else if (currentTestimonialGroup === 1) indices = [3, 4, 5];
    else indices = [6, 7, 0]; // Circular return

    return indices.map(i => ({ ...testimonials[i], id: i }));
  };

  useEffect(() => {
    if (isTestimonialHovered) return;

    const interval = setInterval(() => {
      setCurrentTestimonialGroup((prev) => (prev + 1) % 3);
    }, 6000);

    return () => clearInterval(interval);
  }, [isTestimonialHovered]);

  return (
    <div className="min-h-screen">
      <Header variant="landing" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-24 md:pb-20 gradient-hero overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[hsl(var(--primary-foreground)/0.92)] rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--primary-foreground)/0.92)] rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
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
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-tight drop-shadow-lg">
                  Sua Carteira do Estudante Válida em Todo o Brasil
                </h1>
                <div className="flex items-center gap-2 sm:gap-3 justify-center lg:justify-start">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-semibold tracking-tight text-ure-yellow min-h-[56px] sm:min-h-[64px] lg:min-h-[72px] xl:min-h-[80px] flex items-center drop-shadow-md">
                    <Typewriter
                      text={[
                        "100% digital no seu celular",
                        "Aprovação rápida",
                        "Carteira física disponível",
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
              <p className="text-base sm:text-lg lg:text-xl text-gray-50 font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed drop-shadow-md">
                Pare de pagar inteira. Emita sua Carteira do Estudante URE, válida pela Lei da Meia-Entrada. Economize em cinemas, shows, teatros e eventos culturais.
              </p>

              {/* Feature Badges - Removed as per new design focus on text, or keep if user didn't ask to remove? 
                  User didn't explicitly ask to remove badges, but the new copy seems self-contained. 
                  I'll keep them but update if needed. Actually, the prompt implies replacing content. 
                  The new subtitle and typewriter cover the badge content. I will remove the old badges to clean up.
              */}

              {/* CTA Buttons */}
              <div className="flex flex-col items-center pt-4 sm:pt-6 space-y-4">
                <Button
                  variant="brand-primary"
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto w-full sm:w-auto shadow-xl hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleCTA}
                  disabled={checkingCard || ctaLoading}
                >
                  {(checkingCard || ctaLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {user && hasActiveCard ? (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Ver Minha Carteira
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-5 w-5" />
                      Solicitar Carteira URE
                    </>
                  )}
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
                        className="w-full h-full rounded-3xl shadow-2xl object-cover border-2 border-[hsl(var(--primary-foreground)/0.2)]"
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
                          index === currentSlide ? "bg-[hsl(var(--primary-foreground))] w-8" : "bg-[hsl(var(--primary-foreground)/0.45)] hover:bg-[hsl(var(--primary-foreground)/0.65)] w-2"
                        }`}
                        aria-label={`Ir para slide ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Floating Status Card */}
                <div className="absolute -top-6 -right-6 bg-card dark:bg-card rounded-2xl shadow-2xl p-3 sm:p-4 animate-float backdrop-blur-lg border border-border z-30">
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
      <section className="py-8 bg-background dark:bg-[hsl(230,20%,8%)] border-b border-border dark:border-[hsl(230,14%,20%)]">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm md:text-base font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-ure-green" />
              Documento estudantil digital
            </span>
            <span className="hidden md:block text-gray-300 dark:text-gray-500">•</span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-ure-green" />
              Processo seguro
            </span>
            <span className="hidden md:block text-gray-300 dark:text-gray-500">•</span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-ure-green" />
              Verificação de autenticidade
            </span>
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground/80">
            Suporte disponível em nossos canais de atendimento.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="py-20 bg-accent dark:bg-[hsl(230,25%,12%)]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Sua meia-entrada em minutos</h2>
            <p className="text-xl text-muted-foreground">Sem complicação.</p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 - Cadastro */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="relative w-20 h-20 rounded-full bg-ure-blue flex items-center justify-center">
                  <UserPlus className="w-10 h-10 text-white" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[hsl(var(--primary-foreground))] dark:bg-background border-2 border-ure-blue flex items-center justify-center text-sm font-bold text-ure-blue">1</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Cadastro Rápido</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Crie sua conta em minutos.<br />
                  Seus dados são protegidos conforme a LGPD.
                </p>
              </CardContent>
            </Card>

            {/* Step 2 - Pagamento Online */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="relative w-20 h-20 rounded-full bg-ure-green flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-white" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[hsl(var(--primary-foreground))] dark:bg-background border-2 border-ure-green flex items-center justify-center text-sm font-bold text-ure-green">2</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Pagamento Online</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pague com PIX ou cartão.<br />
                  O pagamento libera o envio dos documentos.
                </p>
              </CardContent>
            </Card>

            {/* Step 3 - Envio e Validação */}
            <Card className="bg-background hover:-translate-y-2 transition-transform duration-300 border-border">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                <div className="relative w-20 h-20 rounded-full bg-ure-orange flex items-center justify-center">
                  <FileCheck className="w-10 h-10 text-white" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[hsl(var(--primary-foreground))] dark:bg-background border-2 border-ure-orange flex items-center justify-center text-sm font-bold text-ure-orange">3</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">Carteira do Estudante</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Envie seus documentos.<br />
                  Após validação, sua carteira estará disponível.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Economize de Verdade Section */}
      <section id="beneficios" className="py-20 bg-accent dark:bg-[hsl(230,18%,14%)] transition-colors">
        <div className="container mx-auto px-4">
          {/* Cabeçalho */}
          <div className="text-center mb-12">
            {/* Linha decorativa amarela */}
            <div className="w-24 h-1 bg-ure-yellow mx-auto mb-6"></div>

            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Use sua meia-entrada no dia a dia</h2>
          </div>

          {/* Cards de Benefícios */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Card 1 - Cinema */}
            <div className="bg-card dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center p-3">
                <img src={iconeCinema} alt="Cinema" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground text-center">Cinema</h3>
              <p className="text-muted-foreground text-center">
                Curta os lançamentos e filmes mais esperados pagando meia-entrada. Mais filmes, menos gasto no fim do mês.
              </p>
            </div>

            {/* Card 2 - Shows */}
            <div className="bg-card dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center p-3">
                <img src={iconeShow} alt="Shows" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground text-center">Shows</h3>
              <p className="text-muted-foreground text-center">
                Vá aos shows dos seus artistas favoritos pagando só metade. Diversão garantida sem pesar no bolso.
              </p>
            </div>

            {/* Card 3 - Teatro */}
            <div className="bg-card dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center p-3">
                <img src={iconeTeatro} alt="Teatro e Cultura" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground text-center">Teatro e Cultura</h3>
              <p className="text-muted-foreground text-center">
                Teatro, festivais e eventos culturais com desconto garantido. Aproveite mais pagando menos.
              </p>
            </div>

            {/* Card 4 - Esportes */}
            <div className="bg-card dark:bg-gray-700 p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center p-3">
                <img src={iconeEsporte} alt="Eventos Esportivos" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground text-center">Eventos Esportivos</h3>
              <p className="text-muted-foreground text-center">
                Eventos esportivos, feiras e atrações diversas com meia-entrada. Sua carteira abre portas (e economiza dinheiro).
              </p>
            </div>
          </div>

          {/* Banner de Economia Total */}
          <div className="mt-12 text-center">
            <div className="inline-block bg-green-100 dark:bg-green-900 border-2 border-green-500 dark:border-green-400 p-8 rounded-2xl max-w-3xl">
              <h3 className="text-2xl md:text-3xl font-bold text-green-800 dark:text-green-200 mb-4">
                Cinema, shows, teatro e eventos culturais com meia-entrada.
              </h3>
              <p className="text-muted-foreground dark:text-gray-300 text-lg mb-6">
                Um benefício simples que, no uso do dia a dia, gera economia ao longo do ano.
              </p>
              <Button
                variant="brand-primary"
                size="lg"
                className="text-lg px-8 py-6 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleCTA}
                disabled={checkingCard || ctaLoading}
              >
                {(checkingCard || ctaLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {user && hasActiveCard ? (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Ver Minha Carteirinha
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-5 w-5" />
                    Solicitar Carteirinha
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* LexPraxis Section */}
      <section id="lex-praxis" className="py-20 bg-gradient-to-br from-[#252543] to-[#3d3d5c] text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-8 flex flex-col justify-center">
              {/* Badge */}
              <Badge className="bg-ure-green text-white border-none px-4 py-2 text-sm font-bold w-fit">
                ✨ Exclusivo para Estudante de Direito
              </Badge>

              {/* Title */}
              <div className="space-y-2 max-w-3xl">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">LexPraxis — A Carteira Estudantil para Quem Escolheu o Direito</h2>
              </div>

              {/* Description */}
              <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
                Mais que uma carteirinha estudantil. Uma identificação pensada para estudantes de Direito que buscam posicionamento, preparação e economia desde a faculdade.
              </p>

              {/* Benefits */}
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Benefit 1 */}
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <Scale className="w-6 h-6 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">Benefícios Acadêmicos</h3>
                    <p className="text-white/80 text-sm">Acesso a condições especiais em cursos, eventos e atividades da área jurídica.</p>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-ure-yellow flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-[#1A1A2E]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">Apresentação Profissional</h3>
                    <p className="text-white/80 text-sm">Identificação alinhada ao ambiente jurídico, desde a formação até o início da carreira.</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-4 flex justify-center">
                <Button
                  variant="brand-primary"
                  size="lg"
                  className="text-lg px-8 py-6 h-auto font-bold w-full sm:w-auto shadow-xl hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleCTA}
                  disabled={checkingCard || ctaLoading}
                >
                  {(checkingCard || ctaLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {user && hasActiveCard ? (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Ver Minha Carteirinha
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-5 w-5" />
                      Solicitar LexPraxis
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right Content - Image */}
            <div className="lg:col-span-5 relative flex justify-center items-center">
              <div 
                className="relative w-full max-w-[320px] lg:max-w-[380px]"
              >
                <img
                  src={carteirinhaDireito1}
                  alt="Carteirinha LexPraxis"
                  className="w-full h-auto rounded-xl shadow-2xl transform hover:scale-105 transition-transform duration-500"
                />
                {/* Glow effect behind the card */}
                <div className="absolute -inset-4 bg-ure-yellow/20 blur-xl -z-10 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="relative py-20 bg-background dark:bg-[hsl(230,22%,15%)]">
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ background: 'linear-gradient(to bottom, hsl(var(--ure-blue) / 0.05), transparent)' }} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
              Mais de 15.000 estudantes já confiam na URE
            </h2>
            <p className="text-xl text-muted-foreground">
              Junte-se a milhares de estudantes economizando
            </p>
          </div>

          {/* Testimonials Grid */}
          <div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            onMouseEnter={() => setIsTestimonialHovered(true)}
            onMouseLeave={() => setIsTestimonialHovered(false)}
          >
            {getVisibleTestimonials().map((testimonial) => (
              <Card 
                key={testimonial.id} 
                className="bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border-border animate-in fade-in slide-in-from-bottom-4 zoom-in-95"
              >
                <CardContent className="pt-8 pb-6 space-y-4">
                  {/* Stars */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-5 h-5 fill-ure-yellow text-ure-yellow" />
                    ))}
                  </div>

                  {/* Review Text */}
                  <p className="text-foreground leading-relaxed text-base min-h-[100px]">
                    "{testimonial.text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-4">
                    <Avatar className={`h-12 w-12 ${testimonial.avatarColor}`}>
                      <AvatarFallback className={`${testimonial.avatarColor} text-white font-bold text-lg`}>
                        {testimonial.initial}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Atmospheric / Humanized Section */}
      <section className="relative h-[500px] md:h-[700px] w-full overflow-hidden flex items-center justify-center">
        {humanImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentHumanSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed"
              style={{ backgroundImage: `url(${image})` }}
            />
          </div>
        ))}
        
        {/* Overlays */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg max-w-4xl mx-auto leading-tight">
            "Sua vida estudantil merece ser vivida ao máximo."
          </h2>
          <p className="text-lg sm:text-xl text-gray-200 font-medium max-w-2xl mx-auto drop-shadow-md">
            Do cinema de fim de semana aos congressos que mudam sua carreira. Estamos com você em cada momento da sua jornada.
          </p>
        </div>
      </section>

  {/* Pricing Section */}
  <section id="planos" className="relative py-20 bg-gray-50 dark:bg-[hsl(230,25%,5%)] overflow-hidden border-t border-border">
    <div className="hidden dark:block absolute inset-0 pointer-events-none opacity-20" style={{ background: 'linear-gradient(to bottom, hsl(var(--ure-blue) / 0.06), transparent)' }} />
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-16 space-y-4">
        <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Escolha Sua Carteirinha</h2>
        <div className="w-24 h-[2px] bg-ure-yellow mx-auto"></div>
        <p className="text-xl text-muted-foreground">Transparente, simples e sem surpresas</p>
      </div>

      {/* Pricing Grid - 2 Digital Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Plan 1 - Carteira Digital (Geral) */}
        <Card className="group relative bg-gray-100 dark:bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent dark:border-ure-blue/30 hover:border-ure-blue hover:ring-2 hover:ring-ure-blue/30">
          <BorderTrail
            className="bg-ure-blue/50 blur-[2px]"
            size={160}
            initialOffset={10}
            transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
            delay={0}
            style={{ boxShadow: '0 0 40px 12px hsl(var(--ure-blue) / 0.25)' }}
          />
          <CardContent className="pt-8 pb-6 flex flex-col h-full">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-foreground mb-2">Carteira Estudantil Digital | URE</h3>
              <p className="text-sm text-muted-foreground mb-4">Educação básica ao ensino superior</p>
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

                <Button variant="brand-primary" className="w-full font-bold disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleCTA} disabled={checkingCard || ctaLoading}>
                  {(checkingCard || ctaLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {user && hasActiveCard ? (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Ver Minha Carteirinha
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-5 w-5" />
                      Solicitar Agora
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

        {/* Plan 2 - Digital Direito */}
        <Card className="group relative bg-gray-100 dark:bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent dark:border-ure-yellow/30 hover:border-ure-yellow hover:ring-2 hover:ring-ure-yellow/30">
          <BorderTrail
            className="bg-ure-yellow/60 blur-[2px]"
            size={170}
            initialOffset={55}
            transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
            delay={0.9}
            style={{ boxShadow: '0 0 44px 14px hsl(var(--ure-yellow) / 0.28)' }}
          />
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ure-yellow text-ure-dark border-none px-4 py-1 text-xs font-bold">
            LEXPRAXIS
          </Badge>
          <CardContent className="pt-8 pb-6 flex flex-col h-full">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-foreground mb-2">Carteira Estudantil Digital LexPraxis | URE</h3>
              <p className="text-sm text-muted-foreground mb-4">Exclusiva para estudantes de Direito</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-black text-ure-yellow">R$ 44</span>
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

                <Button variant="brand-primary" className="w-full disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleCTA} disabled={checkingCard || ctaLoading}>
                  {(checkingCard || ctaLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {user && hasActiveCard ? (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Ver Minha Carteirinha
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-5 w-5" />
                      Solicitar LexPraxis
                    </>
                  )}
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
                  Após o pagamento, você poderá adicionar a carteirinha física  
                  por apenas <strong className="text-foreground">R$ 15,00.</strong>
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
                    <span className="text-foreground">Entrega em 7-10 dias úteis</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-accent dark:bg-[hsl(230,25%,12%)]">
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
                nossa equipe faz revisão manual rapidamente. Todo o processo digital leva poucos minutos.
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
                A versão digital fica disponível imediatamente após aprovação da documentação. A física é produzida e enviada em até 7
                dias úteis.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-border rounded-lg px-6 bg-card">
              <AccordionTrigger className="hover:no-underline text-left">
                <span className="text-lg font-semibold text-foreground">Quais documentos preciso enviar?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                RG ou CNH, comprovante de matrícula ou declaração da
                instituição, uma foto 3x4 com fundo neutro e uma selfie.
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
                Todas as carteirinhas emitidas valem até 31 de março, independente da data de emissão.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 lg:py-20 bg-[#0D7DBF] text-white relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-10 w-96 h-96 bg-[hsl(var(--primary-foreground)/0.92)] rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-[hsl(var(--primary-foreground)/0.92)] rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Pulsing Badge */}
        <div className="inline-block">
          <Badge className="bg-[hsl(var(--primary-foreground)/0.2)] dark:bg-white/10 text-white border-[hsl(var(--primary-foreground)/0.3)] dark:border-white/20 backdrop-blur-sm px-6 py-3 text-base font-bold animate-pulse">
            ⏰ Oferta por tempo limitado
          </Badge>
        </div>

            {/* Heading */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white">Comece a Economizar Hoje!</h2>

            {/* Subtitle */}
            <p className="text-xl lg:text-2xl text-white/90 font-medium">
              Sua carteirinha estudantil válida em todo Brasil. Aprovação rápida, uso imediato.
            </p>

        {/* Counters removed */}

        {/* CTA Button (único, padronizado com Hero) */}
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="bg-ure-yellow text-ure-dark hover:bg-ure-yellow/90 text-lg px-8 py-6 h-auto font-bold shadow-xl hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed" 
            onClick={handleCTA}
            disabled={checkingCard || ctaLoading}
          > 
            {(checkingCard || ctaLoading) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />} 
            {user && hasActiveCard ? (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Ver Minha Carteirinha
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-5 w-5" />
                Emitir Carteirinha Agora
              </>
            )}
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
      <footer className="bg-gray-50 dark:bg-card text-foreground relative overflow-hidden">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto text-center">
            {/* COLUNA 1 - SOBRE */}
            <div className="space-y-4 flex flex-col items-center">
              <img 
                src={ureBrasilLogo} 
                alt="URE Brasil" 
                className="h-16 w-auto mb-4" 
              />
              <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                Carteirinha estudantil digital e física, válida em todo território nacional. Economia real para
                estudantes.
              </p>
              <div className="flex items-center justify-center space-x-4 pt-2">
                <a
                  href="https://instagram.com/urebrasil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="https://youtube.com/urebrasil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                  aria-label="YouTube"
                >
                  <Video className="h-5 w-5" />
                </a>
                <a
                  href="https://linkedin.com/company/urebrasil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
                <a
                  href="tel:+5531999999999"
                  className="text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110"
                  aria-label="Telefone"
                >
                  <Phone className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* COLUNA 2 - LINKS RÁPIDOS */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Links Rápidos</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Validar Carteirinha
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Área do Aluno
                  </a>
                </li>
              </ul>
            </div>

            {/* COLUNA 3 - LEGAL */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Institucional</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/termos"
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Termos de Uso
                  </a>
                </li>
                <li>
                  <a
                    href="/privacidade"
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Política de Privacidade
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsDeliveryModalOpen(true)}
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Política de Entregas
                  </button>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground text-sm hover:text-primary hover:underline transition-all duration-200 font-medium"
                  >
                    Contato
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* RODAPÉ FINAL */}
          <div className="mt-8 pt-8 border-t border-border">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">
                © 2026 URE Brasil - União Representativa dos Estudantes do Brasil. Todos os direitos
                reservados.
              </p>
              <p className="text-muted-foreground/60 text-xs">CNPJ: 04.942.797/0001-05</p>
              <p className="text-muted-foreground/60 text-xs">
                Desenvolvido por{" "}
                <a
                  href="https://vendatto.digital"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  Vendatto Digital
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
      <PolicyModal
        type="delivery"
        open={isDeliveryModalOpen}
        onOpenChange={setIsDeliveryModalOpen}
      />
    </div>
  );
};

export default Index;
