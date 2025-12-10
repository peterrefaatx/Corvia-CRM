// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  // Create manager user
  const passwordHash = await bcrypt.hash('manager123', 12);
  
  const manager = await prisma.user.create({
    data: {
      username: 'manager',
      email: 'manager@corvia.com',
      passwordHash,
      role: 'Manager',
      fullName: 'System Manager',
      isActive: true,
    },
  });

  // Create teams
  await prisma.team.createMany({
    data: [
      { name: 'Alpha Team' },
      { name: 'Beta Team' },
      { name: 'Gamma Team' },
    ],
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });