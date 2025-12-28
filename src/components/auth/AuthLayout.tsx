import { ReactNode } from 'react';
import ureBrasilLogo from '@/assets/ure-brasil-logo.png';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src={ureBrasilLogo} 
            alt="URE Brasil" 
            className="h-12 w-auto object-contain mx-auto"
          />
        </div>

        {/* Card com backdrop blur */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
