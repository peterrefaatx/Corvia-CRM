import prisma from '../lib/prisma';

async function addFields() {
  try {
    // Add columns using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS negotiable TEXT;
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS license TEXT;
    `);
    
    console.log('✅ Fields added successfully!');
  } catch (error) {
    console.error('Error adding fields:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addFields();
