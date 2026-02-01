// Validação de CPF
export function validateCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  let remainder;
  
  // Valida primeiro dígito
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;
  
  // Valida segundo dígito
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;
  
  return true;
}

// Formatar CPF
export function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/);
  
  if (!match) return value;
  
  return !match[2]
    ? match[1]
    : `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}${match[4] ? `-${match[4]}` : ''}`;
}

// Validação de email
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Formatar telefone
export function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,2})(\d{0,5})(\d{0,4})$/);
  
  if (!match) return value;
  
  return !match[2]
    ? match[1]
    : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
}

// Formatar CEP
export function formatCEP(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,5})(\d{0,3})$/);
  
  if (!match) return value;
  
  return !match[2] ? match[1] : `${match[1]}-${match[2]}`;
}

// Formatar número de matrícula em blocos com ponto (ex: 1.234.567.890)
export function formatEnrollmentNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.length <= 3) return cleaned;

  const firstGroupLength = cleaned.length % 3 || 3;
  const groups = [cleaned.slice(0, firstGroupLength)];

  for (let i = firstGroupLength; i < cleaned.length; i += 3) {
    groups.push(cleaned.slice(i, i + 3));
  }

  return groups.join('.');
}

// Formatar data de nascimento (dd/mm/aaaa)
export function formatBirthDateBR(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  const match = cleaned.match(/^(\d{0,2})(\d{0,2})(\d{0,4})$/);
  if (!match) return value;
  const d = match[1];
  const m = match[2];
  const y = match[3];
  return [d, m, y].filter(Boolean).join('/');
}

// Converter texto dd/mm/aaaa para Date válida
export function parseBirthDateBR(text: string): Date | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const date = new Date(year, month, day);
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) return null;
  return date;
}

// Detectar domínio de email temporário (lista curada inicial)
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'mailinator.com',
  'yopmail.com',
  'fakeinbox.com',
  'moakt.com',
  'tempmail.com',
  'tempmail.plus',
  'temporary-mail.net',
  'throwaway.email',
  'dispostable.com',
  'getnada.com',
  'anonbox.net',
  'burnermail.io',
  'trashmail.com',
  'tempail.com',
  'mintemail.com',
  'linshi-email.com',
  'dayrep.com',
  'maildrop.cc',
  'mytemp.email'
]);

export function isDisposableEmailDomain(email: string): boolean {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0) return false;
  const domain = email.slice(atIndex + 1).toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Heurística simples para subdomínios
  const parts = domain.split('.');
  if (parts.length > 2) {
    const base = parts.slice(-2).join('.');
    if (DISPOSABLE_DOMAINS.has(base)) return true;
  }
  return false;
}

// Validação de senha forte
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4
  feedback: string[];
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Mínimo 8 caracteres
  if (password.length < 8) {
    feedback.push('Mínimo 8 caracteres');
  } else {
    score++;
  }

  // Letra maiúscula
  if (!/[A-Z]/.test(password)) {
    feedback.push('Pelo menos 1 letra maiúscula');
  } else {
    score++;
  }

  // Letra minúscula
  if (!/[a-z]/.test(password)) {
    feedback.push('Pelo menos 1 letra minúscula');
  } else {
    score++;
  }

  // Número
  if (!/[0-9]/.test(password)) {
    feedback.push('Pelo menos 1 número');
  } else {
    score++;
  }

  // Caractere especial (opcional - bônus)
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++;
  }

  // Senhas comuns
  const commonPasswords = [
    '12345678',
    'password',
    'qwerty123',
    'abc12345',
    'senha123',
    'admin123',
    '11111111',
    '00000000',
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    return {
      isValid: false,
      score: 0,
      feedback: ['Senha muito usada. Tente uma mais única!'],
    };
  }

  return {
    isValid: feedback.length === 0,
    score: Math.min(score, 4),
    feedback,
  };
}
