const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const email = "engcom-soft@hotmail.com";
  const user = await prisma.user.findUnique({
    where: { email }
  });
  console.log("USER IN DATABASE:");
  console.log(JSON.stringify(user, null, 2));
  if (user) {
    const members = await prisma.member.findMany({
      where: { userId: user.id }
    });
    console.log("MEMBERS LINKED TO THIS USER ID:");
    console.log(JSON.stringify(members, null, 2));
  }
  await prisma.$disconnect();
}
main();
