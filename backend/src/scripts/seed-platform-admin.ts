// One-off bootstrap: creates the first PlatformAdmin. No public registration
// surface exists for this on purpose — run manually, once, per environment.
//   npm run seed:platform-admin -- --email=admin@example.com --password=secret123
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main() {
  const email = readArg('email');
  const password = readArg('password');

  if (!email || !password) {
    console.error(
      'Usage: npm run seed:platform-admin -- --email=admin@example.com --password=secret123',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.platformAdmin.findUnique({
      where: { email },
    });
    if (existing) {
      console.error(`A platform admin with email ${email} already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.platformAdmin.create({
      data: { email, passwordHash, isGlobalAdmin: true },
    });
    console.log(`Created global platform admin ${admin.email} (${admin.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
