require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@toko.local";
  const adminName = process.env.ADMIN_NAME || "Admin Toko";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin12345";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
      },
    });
  }

  const existingSetting = await prisma.storeSetting.findUnique({ where: { id: 1 } });
  if (!existingSetting) {
    await prisma.storeSetting.create({ data: { id: 1 } });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
