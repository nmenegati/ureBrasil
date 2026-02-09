export function maskCardNumber(value: string): string {
  const numbers = value.replace(/\D/g, "");
  return numbers.replace(/(\d{4})(?=\d)/g, "$1 ").slice(0, 19);
}

export function maskExpiry(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length >= 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  }
  return numbers;
}

export function maskCvv(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function getValidityDate(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const validityYear = currentMonth < 3 ? currentYear : currentYear + 1;
  return `31/03/${validityYear}`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

