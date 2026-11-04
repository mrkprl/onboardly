const romeHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  hourCycle: "h23",
});

// YYYY-MM-DD dei form -> Date alle 09:00 ora italiana, con l'offset corretto anche in ora legale
export function romeMorning(isoDay: string) {
  const utcNine = new Date(`${isoDay}T09:00:00Z`);
  const romeHour = Number(romeHourFormatter.format(utcNine));
  return new Date(utcNine.getTime() - (romeHour - 9) * 3_600_000);
}

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
