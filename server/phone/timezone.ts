import { DateTime } from 'luxon';

/**
 * Gets the current timezone offset for a given IANA timezone name
 * @param timezone IANA timezone name (e.g., 'America/Toronto')
 * @returns Formatted offset string (e.g., '-05:00')
 */
export function getTimezoneOffset(timezone: string): string {
  const now = DateTime.now().setZone(timezone);
  const offset = now.offset;
  const hours = Math.floor(Math.abs(offset) / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
  return `${offset >= 0 ? '+' : '-'}${hours}:${minutes}`;
}

/**
 * Checks if a scheduled time was at least 20 minutes ago
 * @param date Scheduled date in YYYY-MM-DD format
 * @param time Scheduled time in HH:mm:ss±HH:mm format
 * @param timezone User's timezone
 * @returns boolean indicating if the time was at least 20 minutes ago
 */
export function isMinutesPast(
  date: string,
  time: string,
  timezone: string,
  minutes_past: number
): boolean {
  // Extract time without timezone
  const timeWithoutTz = time.split(/[+-]/)[0];
  
  // Create ISO string with the correct timezone offset
  const scheduledDateTime = DateTime.fromFormat(
    `${date} ${timeWithoutTz}`,
    'yyyy-MM-dd HH:mm:ss',
    { zone: timezone }
  );
  
  const now = DateTime.now().setZone(timezone);
  
  // Calculate difference in minutes
  const diffMinutes = now.diff(scheduledDateTime, 'minutes').minutes;
    
  return diffMinutes >= minutes_past;
}
