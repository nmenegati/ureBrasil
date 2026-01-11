import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import VerificarEmail from "./pages/VerificarEmail";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import AdminEditEmail from "./pages/AdminEditEmail";
import UploadDocumentos from "./pages/UploadDocumentos";
import EscolherPlano from "./pages/EscolherPlano";
import StatusValidacao from "./pages/StatusValidacao";
import Pagamento from "./pages/Pagamento";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import Perfil from "./pages/Perfil";
import Checkout from "./pages/Checkout";
import Carteirinha from "./pages/Carteirinha";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ChatWrapper } from "./components/ChatWrapper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="ure-theme">
      <TooltipProvider>
        <ProfileProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <ChatWrapper />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
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
            <Route path="/upload-documentos" element={
              <ProtectedRoute>
                <UploadDocumentos />
              </ProtectedRoute>
            } />
            <Route path="/escolher-plano" element={
              <ProtectedRoute>
                <EscolherPlano />
              </ProtectedRoute>
            } />
            <Route path="/status-validacao" element={
              <ProtectedRoute>
                <StatusValidacao />
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
            <Route path="/perfil" element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            } />
            <Route path="/carteirinha" element={
              <ProtectedRoute>
                <Carteirinha />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </ProfileProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
