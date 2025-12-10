/**
 * Month Period Utility
 * Monthly period: 1st at 4 AM to next 1st at 4 AM
 * Aligns with work day reset time (4 AM)
 * 
 * Example:
 * - Jan 1, 4:00 AM to Feb 1, 3:59 AM = January period
 * - Feb 1, 4:00 AM to Mar 1, 3:59 AM = February period
 */

export function getCurrentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDate();
  
  // If it's the 1st and before 4 AM, we're still in last month's period
  if (currentDay === 1 && currentHour < 4) {
    // Last month's period
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    start.setHours(4, 0, 0, 0);
    
    // Ends today at 4 AM
    const end = new Date(now);
    end.setHours(4, 0, 0, 0);
    
    return { start, end };
  } else {
    // Current month's period starts on the 1st at 4 AM
    const start = new Date(now);
    start.setDate(1);
    start.setHours(4, 0, 0, 0);
    
    // Ends on the 1st of next month at 4 AM
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    
    return { start, end };
  }
}

export function getMonthLabel(): string {
  const { start } = getCurrentMonthBounds();
  return start.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long'
  });
}

export function isInCurrentMonth(date: Date): boolean {
  const { start, end } = getCurrentMonthBounds();
  return date >= start && date < end;
}
