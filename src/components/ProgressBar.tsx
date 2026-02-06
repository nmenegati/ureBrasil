import { User, CreditCard, FileText, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'profile', label: 'Perfil', icon: User },
  { key: 'payment', label: 'Pagamento', icon: CreditCard },
  { key: 'documents', label: 'Documentos', icon: FileText },
  { key: 'card', label: 'Carteirinha', icon: GraduationCap },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

interface ProgressBarProps {
  currentStep: StepKey;
  className?: string;
}

export function ProgressBar({ currentStep, className }: ProgressBarProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const completedSteps = currentIndex < 0 ? 0 : currentIndex;
  const percentage =
    currentIndex < 0
      ? 0
      : Math.round(((currentIndex + 1) / STEPS.length) * 100);
  const barFillPercent =
    currentIndex < 0 ? 0 : (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <div
      className={cn(
//        'w-full max-w-3xl mx-auto',
        'bg-ure-blue/5 border rounded-lg shadow-sm mb-6 py-2 px-3',
        className
      )}
    >
      <div className="relative mb-1">
        <div className="flex justify-between items-center relative z-10 px-4">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                    isCompleted
                      ? 'bg-ure-blue text-white'
                      : isCurrent
                      ? 'bg-blue-200 text-blue-600 border-2 border-blue-600'
                      : 'bg-gray-300 text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium hidden sm:block whitespace-nowrap leading-tight',
                    isCompleted
                      ? 'text-blue-600 font-semibold'
                      : isCurrent
                      ? 'text-blue-600'
                      : 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="absolute top-4 sm:top-3 left-8 right-8 h-1.5 bg-gray-200 rounded-full">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700"
            style={{ width: `${barFillPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
