import { CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'profile', label: 'Perfil' },
  { key: 'payment', label: 'Pagamento' },
  { key: 'documents', label: 'Documentos' },
  { key: 'card', label: 'Carteirinha' },
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

  return (
    <div
      className={cn(
        'w-full max-w-3xl mx-auto',
        'bg-white border rounded-lg shadow-sm mb-6 py-2 px-3',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-bold text-blue-600 min-w-[42px] text-right tabular-nums">
          {percentage}%
        </span>
      </div>

      <div className="flex justify-between items-center gap-1">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.key} className="flex flex-col items-center gap-0.5 flex-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted
                    ? 'bg-blue-600 text-white'
                    : isCurrent
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                    : 'bg-gray-200 text-gray-400'
                )}
              >
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
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
    </div>
  );
}
