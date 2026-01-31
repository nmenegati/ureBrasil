export function formatBirthDate(dateString: string | null | undefined): string {
  if (!dateString) return "";

  const datePart = dateString.includes("T") ? dateString.split("T")[0] : dateString;
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

