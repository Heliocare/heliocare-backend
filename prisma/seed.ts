import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { Password } from "../src/utils/password.js";

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Create Super Admin
  const adminEmail = process.env.SUPER_ADMIN_EMAIL as string;
  const hashedPassword = await Password.hash(process.env.SUPER_ADMIN_PASSWORD as string);

  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log(`✅ Super Admin created: ${superAdmin.email}`);
  console.log("🏁 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
