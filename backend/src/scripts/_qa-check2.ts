import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const requests = await prisma.request.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true, tenantId: true, requesterId: true, channel: true,
      rawPrompt: true, parsedIntent: true, status: true, createdAt: true,
    },
  });
  console.log('REQUESTS:', JSON.stringify(requests, null, 2));

  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('MESSAGES:', JSON.stringify(messages, null, 2));

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, slackUserId: true },
  });
  console.log('USERS:', JSON.stringify(users, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
