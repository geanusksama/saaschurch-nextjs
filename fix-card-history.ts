import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.memberEventHistory.findMany({
    where: { cardId: null },
  });

  console.log(`Found ${events.length} events with null cardId`);

  let count = 0;
  for (const evt of events) {
    if (evt.metadata && typeof evt.metadata === 'object' && (evt.metadata as any).cardId) {
      const cardId = (evt.metadata as any).cardId;
      if (typeof cardId === 'string' && cardId.length > 0) {
        await prisma.memberEventHistory.update({
          where: { id: evt.id },
          data: { cardId: cardId },
        });
        count++;
      }
    }
  }

  console.log(`Fixed ${count} events`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
