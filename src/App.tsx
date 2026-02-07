import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import React, { Suspense, useEffect } from "react";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ChatWrapper } from "./components/ChatWrapper";

// ========================================
// CARREGAMENTO IMEDIATO (Fluxo de Aquisição + PWA)
// ========================================
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import CompleteProfile from "./pages/CompleteProfile";
import EscolherPlano from "./pages/EscolherPlano";
import Pagamento from "./pages/Pagamento";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import Checkout from "./pages/Checkout";
import UploadDocumentos from "./pages/UploadDocumentos";
import GerarCarteirinha from "./pages/GerarCarteirinha";
import Carteirinha from "./pages/Carteirinha";
import NotFound from "./pages/NotFound";

// ========================================
// LAZY LOADING (Páginas Secundárias)
// ========================================
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Perfil = React.lazy(() => import("./pages/Perfil"));
const MeusPagamentos = React.lazy(() => import("./pages/MeusPagamentos"));
const MeusTickets = React.lazy(() => import("./pages/MeusTickets"));
const AdquirirFisica = React.lazy(() => import("./pages/AdquirirFisica"));
const VerificarEmail = React.lazy(() => import("./pages/VerificarEmail"));
const RecuperarSenha = React.lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha = React.lazy(() => import("./pages/RedefinirSenha"));
const AdminEditEmail = React.lazy(() => import("./pages/AdminEditEmail"));
const StatusValidacao = React.lazy(() => import("./pages/StatusValidacao"));
const AguardandoAprovacao = React.lazy(() => import("./pages/AguardandoAprovacao").then(m => ({ default: m.AguardandoAprovacao })));
const Termos = React.lazy(() => import("./pages/Termos"));
const Privacidade = React.lazy(() => import("./pages/Privacidade"));

// ========================================
// LAZY LOADING (Admin - Mais Pesado)
// ========================================
const AdminLogin = React.lazy(() => import("./admin/pages/AdminLogin"));
const AdminDashboardPage = React.lazy(() => import("./admin/pages/Dashboard"));
const AdminTicketsPage = React.lazy(() => import("./admin/pages/Tickets"));
const AdminDocumentsPage = React.lazy(() => import("./admin/pages/Documents"));
const AdminPaymentsPage = React.lazy(() => import("./admin/pages/Payments"));
const AdminCardsPage = React.lazy(() => import("./admin/pages/Cards"));
const NotificationsPage = React.lazy(() => import("./admin/pages/Notifications"));
const LogsPage = React.lazy(() => import("./admin/pages/Logs"));
const AdminUsersPage = React.lazy(() => import("./admin/pages/AdminUsers"));
const AdminSettingsPage = React.lazy(() => import("./admin/pages/Settings"));

const queryClient = new QueryClient();

// Fallback simples para lazy loading
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname;
    const isAdminDomain = hostname.startsWith("console.");
    if (isAdminDomain && !window.location.pathname.startsWith("/admin")) {
      window.location.replace("/admin/login");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} storageKey="ure-theme">
        <TooltipProvider>
          <ProfileProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter 
              future={{ 
                v7_startTransition: true, 
                v7_relativeSplatPath: true 
              }}
            >
            <ChatWrapper />
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* FLUXO DE AQUISIÇÃO (Carregamento Imediato) */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/escolher-plano" element={
                <ProtectedRoute>
                  <EscolherPlano />
                </ProtectedRoute>
              } />
              <Route path="/pagamento" element={
                <ProtectedRoute>
                  <Pagamento />
                </ProtectedRoute>
              } />
              <Route path="/pagamento/sucesso" element={
                <ProtectedRoute>
                  <PaymentSuccessPage />
                </ProtectedRoute>
              } />
              <Route path="/checkout" element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              } />
              <Route path="/upload-documentos" element={
                <ProtectedRoute>
                  <UploadDocumentos />
                </ProtectedRoute>
              } />
              <Route path="/gerar-carteirinha" element={
                <ProtectedRoute>
                  <GerarCarteirinha />
                </ProtectedRoute>
              } />
              <Route path="/carteirinha" element={
                <ProtectedRoute>
                  <Carteirinha />
                </ProtectedRoute>
              } />

              {/* PÁGINAS SECUNDÁRIAS (Lazy Loading) */}
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/verificar-email" element={<VerificarEmail />} />
              <Route path="/recuperar-senha" element={<RecuperarSenha />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/edit-email" element={
                <ProtectedRoute>
                  <AdminEditEmail />
                </ProtectedRoute>
              } />
              <Route path="/status-validacao" element={
                <ProtectedRoute>
                  <StatusValidacao />
                </ProtectedRoute>
              } />
              <Route path="/aguardando-aprovacao" element={
                <ProtectedRoute>
                  <AguardandoAprovacao />
                </ProtectedRoute>
              } />
              <Route path="/adquirir-fisica" element={
                <ProtectedRoute>
                  <AdquirirFisica />
                </ProtectedRoute>
              } />
              <Route path="/meus-pagamentos" element={
                <ProtectedRoute>
                  <MeusPagamentos />
                </ProtectedRoute>
              } />
              <Route path="/meus-tickets" element={
                <ProtectedRoute>
                  <MeusTickets />
                </ProtectedRoute>
              } />
              <Route path="/perfil" element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              } />

              {/* ADMIN (Lazy Loading) */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/tickets" element={<AdminTicketsPage />} />
              <Route path="/admin/documents" element={<AdminDocumentsPage />} />
              <Route path="/admin/payments" element={<AdminPaymentsPage />} />
              <Route path="/admin/cards" element={<AdminCardsPage />} />
              <Route path="/admin/notifications" element={<NotificationsPage />} />
              <Route path="/admin/logs" element={<LogsPage />} />
                <Route path="/admin/admin-users" element={<AdminUsersPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />

                {/* CATCH-ALL */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </ProfileProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
