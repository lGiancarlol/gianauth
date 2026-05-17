require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Owner
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const hashed = await bcrypt.hash("admin123", 10);
    await prisma.user.create({ data: { username: "admin", password: hashed, role: "owner" } });
    console.log("[seed] Owner created: admin / admin123");
  } else {
    console.log("[seed] Owner already exists.");
  }

  // Productos de ejemplo
  const products = [
    { name: "Producto Básico", slug: "basico" },
    { name: "Producto Pro", slug: "pro" },
    { name: "Producto Premium", slug: "premium" },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }
  console.log("[seed] Sample products created.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
