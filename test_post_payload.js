const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const payload = {
      title: "Peniel Sede",
      date: "2026-06-12",
      time: "19h",
      location: "Chacara Valinho",
      value: 120,
      limit: 100,
      status: "active",
      description: "Teste",
      dateLabel: "12 e 13",
      departureLocation: "AD Campinas",
      eventLocation: "",
      latitude: "-22.9087",
      longitude: "-47.0998",
      extraFieldsConfig: {
        spouse: true,
        children: true,
        ecclesiastical: false
      },
      campoId: "be2f95ec-cf98-4e81-b4c6-428018b5cbc3"
    };

    const event = await prisma.penielEvent.create({
      data: {
        campoId: payload.campoId,
        title: payload.title,
        date: new Date(payload.date),
        time: payload.time,
        location: payload.location,
        value: Number(payload.value),
        limit: Number(payload.limit),
        status: payload.status || "active",
        description: payload.description || "",
        dateLabel: payload.dateLabel || null,
        departureLocation: payload.departureLocation || null,
        eventLocation: payload.eventLocation || null,
        latitude: payload.latitude || null,
        longitude: payload.longitude || null,
        extraFieldsConfig: payload.extraFieldsConfig || {}
      }
    });
    console.log("SUCCESS!", event);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
