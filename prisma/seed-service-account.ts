import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/**
 * Creates (or verifies) the WORKER_SERVICE_USER_EMAIL user and assigns it
 * the WORKER_SERVICE role (see packages/config/src/permissions.ts). This
 * account never logs in via password — apps/worker signs its own
 * short-lived JWTs for it (see apps/worker/src/internal-api/internal-api-client.ts)
 * using the shared JWT_ACCESS_SECRET. The password hash below is a random,
 * discarded value purely to satisfy the non-null `passwordHash` column;
 * no one is meant to ever authenticate as this user via the normal login flow.
 *
 * Requires prisma/seed.ts to have already run at least once, since it's
 * what creates the WORKER_SERVICE role/permissions (seed.ts iterates
 * DEFAULT_ROLES generically, so it already covers this role — nothing in
 * seed.ts itself needed to change).
 */
async function main() {
  const email = process.env.WORKER_SERVICE_USER_EMAIL ?? 'worker-service@7fifteencapital.com';

  const role = await prisma.role.findUnique({ where: { code: 'WORKER_SERVICE' } });
  if (!role) {
    throw new Error(
      "WORKER_SERVICE role not found. Run the main seed first: pnpm --filter api exec prisma db seed",
    );
  }

  const unusablePasswordHash = await bcrypt.hash(randomUUID(), 10);
  const serviceUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: unusablePasswordHash,
      firstName: 'Background',
      lastName: 'Worker',
      isActive: true,
    },
    update: { isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: serviceUser.id, roleId: role.id } },
    create: { userId: serviceUser.id, roleId: role.id },
    update: {},
  });

  console.log(`  ✓ worker service account ready: ${email} (role: WORKER_SERVICE)`);
}

main()
  .catch((err) => {
    console.error('Failed to seed worker service account:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
