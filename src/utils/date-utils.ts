export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function hoursBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Resolves relative natural-language dates like "tomorrow", "today" to YYYY-MM-DD */
export function resolveRelativeDate(text: string, base: Date = new Date()): string | null {
  const t = text.toLowerCase().trim();
  const clone = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  if (/\btoday\b/.test(t)) return toIso(clone(base));
  if (/\btomorrow\b/.test(t)) {
    const d = clone(base);
    d.setDate(d.getDate() + 1);
    return toIso(d);
  }
  if (/\bday after tomorrow\b/.test(t)) {
    const d = clone(base);
    d.setDate(d.getDate() + 2);
    return toIso(d);
  }

  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  // Scan every "<number> <word>" and "<word> <number>" pair (e.g. "20 august" or
  // "august 20") and use the first one whose word is actually a month name —
  // this avoids false hits like "2 people" being mistaken for a day+month.
  const dayThenMonth = [...t.matchAll(/(\d{1,2})\s+([a-z]+)/g)];
  const monthThenDay = [...t.matchAll(/([a-z]+)\s+(\d{1,2})/g)];
  const candidates: { day: number; monthName: string }[] = [
    ...dayThenMonth.map((m) => ({ day: parseInt(m[1], 10), monthName: m[2] })),
    ...monthThenDay.map((m) => ({ day: parseInt(m[2], 10), monthName: m[1] })),
  ];

  for (const { day, monthName } of candidates) {
    const monthIdx = months.findIndex((mo) => mo.startsWith(monthName) && monthName.length >= 3);
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      let year = base.getFullYear();
      const candidate = new Date(year, monthIdx, day);
      if (candidate < clone(base)) year += 1; // roll to next year if date already passed
      return toIso(new Date(year, monthIdx, day));
    }
  }

  // ISO-ish date already
  const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  return null;
}
