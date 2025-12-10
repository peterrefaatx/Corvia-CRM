/**
 * Timezone-Aware Date Utilities
 * Handles date calculations in configured timezone
 */

import { config } from '../config';

/**
 * Get current date/time in configured timezone
 * Returns a Date object representing the current time in Cairo timezone
 * This works regardless of the server's timezone setting
 */
export function getNowInTimezone(): Date {
  const now = new Date();
  
  // Get the UTC timestamp
  const utcTime = now.getTime();
  
  // Get timezone offset in minutes for Cairo
  const timezoneOffset = getTimezoneOffset(config.timezone);
  
  // Calculate Cairo time from UTC
  // We need to account for the local timezone offset to get true UTC first
  const localOffset = now.getTimezoneOffset(); // minutes behind UTC (negative for ahead)
  const utcTimestamp = utcTime + (localOffset * 60 * 1000);
  
  // Now add Cairo offset to get Cairo time
  const cairoTime = utcTimestamp + (timezoneOffset * 60 * 1000);
  
  return new Date(cairoTime);
}

/**
 * Get timezone offset in minutes for a given timezone
 * Positive values are east of UTC, negative are west
 */
function getTimezoneOffset(timezone: string): number {
  // Common timezone offsets (in minutes from UTC)
  const timezoneOffsets: { [key: string]: number } = {
    'Africa/Cairo': 120,  // UTC+2 (EET) or UTC+3 (EEST with DST)
    'America/New_York': -300,  // UTC-5 (EST) or UTC-4 (EDT with DST)
    'Europe/London': 0,  // UTC+0 (GMT) or UTC+1 (BST with DST)
    'Asia/Dubai': 240,  // UTC+4
    'Asia/Riyadh': 180,  // UTC+3
    'UTC': 0
  };
  
  // Get base offset
  const baseOffset = timezoneOffsets[timezone] || 0;
  
  // For Cairo, check if DST is active (roughly April-October)
  if (timezone === 'Africa/Cairo') {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    // DST typically April (3) to October (9) - simplified
    if (month >= 3 && month <= 9) {
      return 180; // UTC+3 during DST
    }
    return 120; // UTC+2 standard time
  }
  
  return baseOffset;
}

/**
 * Get current hour in configured timezone
 */
export function getCurrentHourInTimezone(): number {
  const now = getNowInTimezone();
  return now.getHours();
}

/**
 * Get current date in configured timezone with time set to 00:00:00
 */
export function getTodayInTimezone(): Date {
  const now = getNowInTimezone();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Check if current time is before 4 AM in configured timezone
 */
export function isBeforeFourAM(): boolean {
  return getCurrentHourInTimezone() < 4;
}

/**
 * Get "work day" date considering 4 AM cutoff
 * If before 4 AM, returns previous day
 */
export function getWorkDayDate(): Date {
  const now = getNowInTimezone();
  const today = new Date(now);
  
  if (now.getHours() < 4) {
    today.setDate(today.getDate() - 1);
  }
  
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Format time in 12-hour format with AM/PM
 */
export function formatTime12Hour(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}

/**
 * Note: For production, consider using a proper timezone library like:
 * - date-fns-tz
 * - luxon
 * - moment-timezone
 * 
 * This implementation is simplified and may not handle all DST edge cases.
 */
