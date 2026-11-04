import { italianHolidays, parseDay } from "@/lib/hr";
import { isoDateRome } from "@/lib/format";

const DAY = 24 * 60 * 60 * 1000;

// Le date delle assenze sono a mezzanotte UTC: qui si ragiona sempre in giorni UTC
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);
export function isIsoDay(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseDay(value);
  return !Number.isNaN(d.getTime()) && dayKey(d) === value;
}

export function isHoliday(d: Date) {
  return italianHolidays(d.getUTCFullYear()).has(dayKey(d));
}

export function isWeekend(d: Date) {
  const weekday = d.getUTCDay();
  return weekday === 0 || weekday === 6;
}

export const isWorkday = (d: Date) => !isWeekend(d) && !isHoliday(d);

// Oggi nel fuso italiano, come giorno UTC
export const todayRome = () => parseDay(isoDateRome());

// Se oggi è weekend o festivo, il primo giorno lavorativo successivo
export function referenceWorkday(from = todayRome()) {
  let d = from;
  while (!isWorkday(d)) d = addDays(d, 1);
  return d;
}

const hoursFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
export const formatHours = (hours: number) => hoursFormatter.format(hours);

const dayLabelFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
export const formatDayLong = (d: Date) => dayLabelFormatter.format(d);

const weekdayFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
export const formatWeekdayShort = (d: Date) => weekdayFormatter.format(d).replace(".", "");

const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });
export const formatMonthShort = (d: Date) => monthFormatter.format(d).replace(".", "");

const shortDateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
export const formatDayShort = (d: Date) => shortDateFormatter.format(d);

export function formatPeriod(start: Date, end: Date) {
  if (dayKey(start) === dayKey(end)) return formatDayShort(start);
  return `${formatDayShort(start)} - ${formatDayShort(end)}`;
}
