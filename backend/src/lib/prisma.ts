import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Database connection retry logic
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

async function connectWithRetry(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    retryCount = 0; // Reset on successful connection
  } catch (error) {
    retryCount++;
    console.error(`❌ Database connection failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry();
    } else {
      console.error('💥 Max database connection retries reached. Exiting...');
      process.exit(1);
    }
  }
}

// Handle connection errors during runtime
prisma.$on('error' as never, (e: any) => {
  console.error('Database error:', e);
  // Attempt to reconnect
  connectWithRetry().catch(err => {
    console.error('Failed to reconnect to database:', err);
  });
});

// Initial connection
connectWithRetry();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;






















