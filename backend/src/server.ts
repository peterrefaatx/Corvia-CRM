import { server } from './app';
import { config } from './config';
import prisma from './lib/prisma';
import { startScheduler } from './jobs/scheduler';

const PORT = config.port;

server.listen(PORT, () => {
  console.log('🚀 Corvia CRM Server Started');
  console.log('================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Frontend: ${config.frontendUrl}`);
  console.log(`🔧 Environment: ${config.nodeEnv}`);
  console.log('================================');
  
  // Start scheduled jobs
  startScheduler();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
