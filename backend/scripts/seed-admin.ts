/**
 * Run once after first deploy to create the initial admin user:
 *   npx tsx scripts/seed-admin.ts
 *
 * Set env vars before running:
 *   DATABASE_URL=mysql://...
 *   ADMIN_EMAIL=admin@yourcompany.com
 *   ADMIN_NAME="Your Name"
 *   ADMIN_PASSWORD=StrongPassword123
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME ?? 'Admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists. Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  });
  console.log(`Admin user created: ${user.email} (id=${user.id})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
