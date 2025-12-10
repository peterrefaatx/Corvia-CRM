import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SerialNumberSettings {
  prefix: string;
  separator: string;
  counterDigits: number;
  resetDaily: boolean;
  resetMonthly: boolean;
}

export async function generateSerialNumber(): Promise<string> {
  // Load settings from database
  const settingsRecord = await prisma.systemSettings.findUnique({
    where: { key: 'serialNumber' }
  });

  // Default settings
  const defaultSettings: SerialNumberSettings = {
    prefix: 'CORV',
    separator: '-',
    counterDigits: 4,
    resetDaily: true,
    resetMonthly: false
  };

  const settings: SerialNumberSettings = settingsRecord?.value 
    ? { ...defaultSettings, ...(settingsRecord.value as any) }
    : defaultSettings;

  const today = new Date();
  const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Build the search pattern based on settings
  const separator = settings.separator || '';
  const searchPrefix = `${settings.prefix}${separator}${dateString}`;
  
  // Find the highest serial number for today (or month if resetMonthly)
  const latestLead = await prisma.lead.findFirst({
    where: {
      serialNumber: {
        startsWith: searchPrefix
      }
    },
    orderBy: {
      serialNumber: 'desc'
    }
  });

  let sequence = 1;
  if (latestLead) {
    // Extract the counter from the serial number
    // Format: PREFIX[SEP]DATE[SEP]COUNTER or PREFIXDATECOUNTER (no separator)
    if (separator) {
      const parts = latestLead.serialNumber.split(separator);
      const lastPart = parts[parts.length - 1];
      const lastSequence = parseInt(lastPart);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    } else {
      // No separator: extract counter by removing prefix and date
      // Format: PREFIXDATECOUNTER (e.g., CR20251116010)
      // Remove the known prefix and date to get just the counter
      const prefixAndDate = `${settings.prefix}${dateString}`;
      if (latestLead.serialNumber.startsWith(prefixAndDate)) {
        const counterPart = latestLead.serialNumber.substring(prefixAndDate.length);
        const lastSequence = parseInt(counterPart);
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }
    }
  }

  // Try to find an available serial number (handle race conditions)
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const counter = sequence.toString().padStart(settings.counterDigits, '0');
    const serialNumber = `${settings.prefix}${separator}${dateString}${separator}${counter}`;
    
    // Check if this serial number already exists
    const existing = await prisma.lead.findUnique({
      where: { serialNumber }
    });
    
    if (!existing) {
      return serialNumber;
    }
    
    // If exists, try next sequence number
    sequence++;
  }

  // Fallback: use timestamp-based serial number (should rarely happen)
  const timestamp = Date.now();
  return `${settings.prefix}${separator}${timestamp}`;
}