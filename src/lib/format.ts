// Fuso esplicito: in produzione il server gira in UTC e le date vanno mostrate all'ora italiana
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Rome",
});
const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export const formatDate = (date: Date | string) => dateFormatter.format(new Date(date));
export const formatDateTime = (date: Date | string) => dateTimeFormatter.format(new Date(date));
export const formatEuro = (value: number) => euroFormatter.format(value);

const isoDateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" });

// YYYY-MM-DD nel fuso italiano: toISOString() userebbe UTC e sbaglierebbe giorno intorno alla mezzanotte
export const isoDateRome = (date: Date = new Date()) => isoDateFormatter.format(date);

export function daysUntil(date: Date) {
  const day = (d: Date) => new Date(`${isoDateRome(d)}T00:00:00.000Z`).getTime();
  return Math.round((day(new Date(date)) - day(new Date())) / 86_400_000);
}
