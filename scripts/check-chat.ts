import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Querying recent AI Chat messages...');

  const messages = await prisma.aiChatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      session: {
        include: {
          agent: true
        }
      }
    }
  });

  console.log(`Found ${messages.length} messages:`);
  for (const msg of messages.reverse()) {
    console.log(`\n========================================`);
    console.log(`Session ID: ${msg.sessionId}`);
    console.log(`Agent Name: ${msg.session.agent.name}`);
    console.log(`Role: ${msg.role}`);
    console.log(`Content: ${msg.content}`);
    console.log(`Created At: ${msg.createdAt.toISOString()}`);
  }
}

main()
  .catch(err => console.error(err))
  .finally(async () => {
    await prisma.$disconnect();
  });
