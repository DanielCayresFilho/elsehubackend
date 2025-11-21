import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@elsehu.com';
  const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const hashedPassword = await bcrypt.hash(defaultAdminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: defaultAdminEmail },
    update: {},
    create: {
      name: 'Administrador',
      email: defaultAdminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Administrador seed configurado: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Erro ao executar seed Prisma', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

