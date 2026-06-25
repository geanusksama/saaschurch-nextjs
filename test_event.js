const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const campo = await prisma.campo.findFirst({ where: { deletedAt: null } });
    if (!campo) {
      console.log("No campo found.");
      return;
    }
    const event = await prisma.penielEvent.create({
      data: {
        campoId: campo.id,
        title: "Test Event",
        date: new Date(),
        time: "19:00",
        location: "Test Location",
        value: 120.00,
        limit: 100,
        status: "active",
        description: "Test description",
        dateLabel: "12 e 13",
        departureLocation: "AD Campinas",
        eventLocation: "Chacara Valinho",
        latitude: "-22.9087",
        longitude: "-47.0998",
        extraFieldsConfig: { spouse: true, children: true, ecclesiastical: false }
      }
    });
    console.log("Success creating event!", event);
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
