// Formatação de datas para tela e e-mail — regra 11.19 e seção 17: tudo gravado em UTC,
// exibido no horário de Brasília. Roda no cliente e no servidor.
const TZ = "America/Sao_Paulo";

// "17 de dezembro de 2026" (seção 17: datas por extenso).
export function formatDateLong(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

// "17/12/2026 14:05" no horário de Brasília (listas).
export function formatDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

// "17/12/2026 14:05:09" no horário de Brasília, com segundos (trilha).
export function formatDateTimeSeconds(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ })
    .format(new Date(iso))
    .replace(",", "");
}

// "17/12/2026" no horário de Brasília (listas).
export function formatDateShort(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(new Date(iso));
}
