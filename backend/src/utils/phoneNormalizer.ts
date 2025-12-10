/**
 * Phone Number Normalizer
 * Strips all non-numeric characters for comparison
 * Handles US phone numbers with or without country code
 * 
 * Examples:
 * +1 (505) 122-7204 → 5051227204
 * +15051227204 → 5051227204
 * (505) 122-7204 → 5051227204
 * 5051227204 → 5051227204
 */

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let normalized = phone.replace(/\D/g, '');
  
  // If it starts with 1 and is 11 digits (US country code), remove the 1
  if (normalized.length === 11 && normalized.startsWith('1')) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

export function normalizeAddress(address: string): string {
  if (!address) return '';
  // Trim and convert to lowercase for case-insensitive comparison
  return address.trim().toLowerCase();
}
