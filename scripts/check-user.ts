
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'dccf.virtualcontato@gmail.com';
  console.log(`Checking user: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('User NOT FOUND');
  } else {
    console.log('User found:');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`IsActive: ${user.isActive}`);
    console.log(`IsOnline: ${user.isOnline}`);
    console.log(`Password Hash: ${user.password.substring(0, 10)}...`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

