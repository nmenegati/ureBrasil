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

export function validateCardForm(input: {
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
}): { valid: boolean; message?: string } {
  const cardNumberClean = input.cardNumber.replace(/\s/g, "");

  if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
    return { valid: false, message: "Número do cartão inválido" };
  }

  if (input.cardName.trim().length < 3) {
    return { valid: false, message: "Nome no cartão inválido" };
  }

  if (!/^\d{2}\/\d{2}$/.test(input.cardExpiry)) {
    return { valid: false, message: "Data de validade inválida" };
  }

  if (input.cardCvv.length < 3) {
    return { valid: false, message: "CVV inválido" };
  }

  return { valid: true };
}
