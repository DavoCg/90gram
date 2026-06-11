// Bootstrap script: promote an existing user to the admin role so they can access apps/admin.
// The user must already exist (sign in once via the mobile app or the admin login to create the
// row), then run:
//   pnpm --filter @getvinyls/admin promote you@example.com
// Reads DATABASE_URL from the repo root .env (same DB as everything else).
import '../src/lib/load-env';
import { prisma } from '@getvinyls/db';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: pnpm --filter @getvinyls/admin promote <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email "${email}". Sign in once to create the account, then retry.`);
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.info(`User "${email}" is already an admin.`);
    return;
  }

  await prisma.user.update({ where: { email }, data: { role: 'admin' } });
  console.info(`Promoted "${email}" to admin.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
