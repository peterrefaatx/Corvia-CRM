/**
 * Work Day Range Utilities
 * Handles date ranges with 4 AM cutoff for work days
 */

/**
 * Convert a date string to work day range
 * Work day runs from 4 PM to 4 AM next day
 * 
 * @param dateString - Date string (YYYY-MM-DD)
 * @returns Object with start (4 PM) and end (4 AM next day) timestamps
 */
export function getWorkDayRange(dateString: string): { start: Date; end: Date } {
  const date = new Date(dateString);
  
  // Work day starts at 4 PM (16:00)
  const start = new Date(date);
  start.setHours(16, 0, 0, 0);
  
  // Work day ends at 4 AM next day
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  end.setHours(4, 0, 0, 0);
  
  return { start, end };
}

/**
 * Convert date range (from/to) to work day ranges
 * Includes all work days from 'from' date to 'to' date
 * 
 * @param fromString - Start date string (YYYY-MM-DD)
 * @param toString - End date string (YYYY-MM-DD)
 * @returns Object with start and end timestamps covering all work days
 */
export function getWorkDayRangeForPeriod(fromString: string, toString: string): { start: Date; end: Date } {
  const fromDate = new Date(fromString);
  const toDate = new Date(toString);
  
  // Start at 4 PM on the 'from' date
  const start = new Date(fromDate);
  start.setHours(16, 0, 0, 0);
  
  // End at 4 AM the day after 'to' date
  const end = new Date(toDate);
  end.setDate(end.getDate() + 1);
  end.setHours(4, 0, 0, 0);
  
  return { start, end };
}

/**
 * Get the work day date for a given timestamp
 * If time is before 4 AM, it belongs to previous day's work day
 * 
 * @param timestamp - Date object
 * @returns Work day date (at midnight)
 */
export function getWorkDayDateForTimestamp(timestamp: Date): Date {
  const workDay = new Date(timestamp);
  
  // If before 4 AM, this belongs to yesterday's work day
  if (workDay.getHours() < 4) {
    workDay.setDate(workDay.getDate() - 1);
  }
  
  workDay.setHours(0, 0, 0, 0);
  return workDay;
}
