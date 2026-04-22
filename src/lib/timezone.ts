export const TIMEZONES = [
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC"
];

export function getStationTimezone(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('transformation-radio-timezone');
    if (saved) return saved;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch(e) {
      return "UTC";
    }
  }
  return "UTC";
}

export function setStationTimezone(tz: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('transformation-radio-timezone', tz);
  }
}

/**
 * Returns a native Date object representing the precise year, month, day, hour, and minute 
 * of the *target timezone* at this exact physical moment in time.
 * Even though the returned Date object is technically constructed in the environment's local timezone,
 * calling .getHours(), .getDate() etc on it will return the Target Timezone's digits.
 */
export function getCurrentTimeInTimezone(tz: string): Date {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const z = {} as Record<string, string>;
  parts.forEach(p => z[p.type] = p.value);
  
  // Format into ISO-like string and parse
  const pseudoIso = `${z.year}-${z.month.padStart(2, '0')}-${z.day.padStart(2, '0')}T${parseInt(z.hour) === 24 ? '00' : z.hour.padStart(2, '0')}:${z.minute.padStart(2, '0')}:${z.second.padStart(2, '0')}`;
  
  return new Date(pseudoIso);
}
