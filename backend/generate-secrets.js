/**
 * Generate secure JWT secrets for production use
 * Run with: node generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n=== JWT Secret Generator ===\n');
console.log('Copy these values to your .env file:\n');
console.log('JWT_SECRET="' + crypto.randomBytes(64).toString('hex') + '"');
console.log('JWT_REFRESH_SECRET="' + crypto.randomBytes(64).toString('hex') + '"');
console.log('\n⚠️  Keep these secrets secure and never commit them to version control!\n');
