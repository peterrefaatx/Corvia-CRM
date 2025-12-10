import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
function validateConfig() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Warn about insecure secrets in production
  if (process.env.NODE_ENV === 'production') {
    const insecureSecrets = [
      'your-super-secret',
      'change-in-production',
      'demo',
      'test',
      'secret123'
    ];

    const jwtSecret = process.env.JWT_SECRET || '';
    const isInsecure = insecureSecrets.some(phrase => 
      jwtSecret.toLowerCase().includes(phrase)
    );

    if (isInsecure || jwtSecret.length < 32) {
      console.error('⚠️  WARNING: Insecure JWT_SECRET detected in production!');
      console.error('⚠️  Please generate a secure secret using: node generate-secrets.js');
      throw new Error('Insecure JWT_SECRET in production environment');
    }
  }
}

// Run validation
validateConfig();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  timezone: process.env.TZ || 'Africa/Cairo'
};