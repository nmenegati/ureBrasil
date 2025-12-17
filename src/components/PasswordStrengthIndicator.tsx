interface PasswordStrengthIndicatorProps {
  password: string;
}

const calculateStrength = (password: string): { score: number; label: string; colorClass: string } => {
  let points = 0;
  
  if (password.length >= 6) points += 1;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password)) points += 1;
  if (/[A-Z]/.test(password)) points += 1;
  if (/[0-9]/.test(password)) points += 1;
  if (/[^a-zA-Z0-9]/.test(password)) points += 1;
  
  if (points <= 2) return { score: 25, label: 'Fraca', colorClass: 'bg-red-500 text-red-500' };
  if (points <= 4) return { score: 50, label: 'Média', colorClass: 'bg-yellow-500 text-yellow-500' };
  if (points <= 5) return { score: 75, label: 'Boa', colorClass: 'bg-blue-500 text-blue-500' };
  return { score: 100, label: 'Forte', colorClass: 'bg-green-500 text-green-500' };
};

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  if (!password) return null;
  
  const { score, label, colorClass } = calculateStrength(password);
  const [bgColor, textColor] = colorClass.split(' ');
  
  return (
    <div className="space-y-1 mt-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Força da senha:</span>
        <span className={`font-medium ${textColor}`}>{label}</span>
      </div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${bgColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};
