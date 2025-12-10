/**
 * Safe Calculation Utilities
 * Prevents division by zero and handles edge cases
 */

/**
 * Safely calculate percentage
 * Returns 0 if denominator is 0 or invalid
 */
export function safePercentage(numerator: number, denominator: number, decimals: number = 0): number {
  // Handle invalid inputs
  if (!isFinite(numerator) || !isFinite(denominator)) {
    return 0;
  }
  
  // Handle zero or negative denominator
  if (!denominator || denominator === 0) {
    return 0;
  }
  
  // Handle zero numerator (valid case)
  if (numerator === 0) {
    return 0;
  }
  
  const percentage = (numerator / denominator) * 100;
  
  // Round to specified decimals
  if (decimals === 0) {
    return Math.round(percentage);
  }
  
  const multiplier = Math.pow(10, decimals);
  return Math.round(percentage * multiplier) / multiplier;
}

/**
 * Safely calculate average
 * Returns 0 if array is empty or invalid
 */
export function safeAverage(values: number[], decimals: number = 0): number {
  // Handle invalid input
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  
  // Filter out invalid values
  const validValues = values.filter(v => isFinite(v));
  
  if (validValues.length === 0) {
    return 0;
  }
  
  const sum = validValues.reduce((a, b) => a + b, 0);
  const average = sum / validValues.length;
  
  // Round to specified decimals
  if (decimals === 0) {
    return Math.round(average);
  }
  
  const multiplier = Math.pow(10, decimals);
  return Math.round(average * multiplier) / multiplier;
}

/**
 * Safely calculate ratio
 * Returns 0 if denominator is 0 or invalid
 */
export function safeRatio(numerator: number, denominator: number, decimals: number = 2): number {
  // Handle invalid inputs
  if (!isFinite(numerator) || !isFinite(denominator)) {
    return 0;
  }
  
  // Handle zero or negative denominator
  if (!denominator || denominator === 0) {
    return 0;
  }
  
  const ratio = numerator / denominator;
  
  // Round to specified decimals
  const multiplier = Math.pow(10, decimals);
  return Math.round(ratio * multiplier) / multiplier;
}

/**
 * Safely divide two numbers
 * Returns defaultValue if denominator is 0
 */
export function safeDivide(numerator: number, denominator: number, defaultValue: number = 0): number {
  if (!isFinite(numerator) || !isFinite(denominator)) {
    return defaultValue;
  }
  
  if (!denominator || denominator === 0) {
    return defaultValue;
  }
  
  return numerator / denominator;
}

/**
 * Calculate quality rate (qualified / total)
 * Returns percentage with 1 decimal place
 */
export function calculateQualityRate(qualified: number, total: number): number {
  return safePercentage(qualified, total, 1);
}

/**
 * Calculate completion percentage
 * Returns percentage with 1 decimal place
 */
export function calculateCompletion(achieved: number, target: number): number {
  return safePercentage(achieved, target, 1);
}
