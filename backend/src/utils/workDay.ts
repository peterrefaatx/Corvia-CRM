/**
 * Work Day Utility
 * Work hours: 5 PM to 2 AM (next day)
 * Day resets at: 4 AM (2 hours after work ends)
 * 
 * "Today's Performance" shows leads from 4 AM today onwards
 * This includes leads submitted during work hours AND between shifts
 * 
 * Example:
 * - Before 4 AM: Shows yesterday 4 AM to today 4 AM
 * - After 4 AM: Shows today 4 AM to tomorrow 4 AM (or now if before tomorrow 4 AM)
 */

export function getWorkDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const currentHour = now.getHours();
  
  // If it's before 4 AM, we're still in yesterday's work day
  if (currentHour < 4) {
    // Yesterday's work day: yesterday 4 AM to today 4 AM
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(4, 0, 0, 0); // 4 AM yesterday
    
    const end = new Date(now);
    end.setHours(4, 0, 0, 0); // 4 AM today
    
    return { start, end };
  } else {
    // After 4 AM - today's work day
    // Today's work day: today 4 AM to tomorrow 4 AM
    const start = new Date(now);
    start.setHours(4, 0, 0, 0); // 4 AM today
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(4, 0, 0, 0); // 4 AM tomorrow
    
    return { start, end };
  }
}

export function getWorkDayLabel(): string {
  const { start } = getWorkDayBounds();
  return start.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Adjust a date to use 4 AM as the cutoff
 * For date range queries in reports
 */
export function adjustDateTo4AM(date: Date, isEndDate: boolean = false): Date {
  const adjusted = new Date(date);
  
  if (isEndDate) {
    // For end date, set to next day at 4 AM
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(4, 0, 0, 0);
  } else {
    // For start date, set to 4 AM of that day
    adjusted.setHours(4, 0, 0, 0);
  }
  
  return adjusted;
}

/**
 * Get date range with 4 AM cutoff
 */
export function getDateRangeWith4AMCutoff(fromDate: Date, toDate: Date): { start: Date; end: Date } {
  const start = adjustDateTo4AM(fromDate, false);
  const end = adjustDateTo4AM(toDate, true);
  
  return { start, end };
}
