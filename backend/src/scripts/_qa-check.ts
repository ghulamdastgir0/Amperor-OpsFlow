import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slackTeamId: true, slackBotToken: true, slackQueryChannelId: true },
  });
  console.log('TENANTS:', JSON.stringify(tenants.map(t => ({...t, slackBotToken: t.slackBotToken ? '[set]' : null})), null, 2));

  const users = await prisma.user.findMany({
    where: { slackUserId: { not: null } },
    select: { id: true, tenantId: true, email: true, name: true, role: true, slackUserId: true, isActive: true },
  });
  console.log('SLACK-LINKED USERS:', JSON.stringify(users, null, 2));

  const recentMessages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('RECENT MESSAGES:', JSON.stringify(recentMessages, null, 2));

  const recentRequests = await prisma.request.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('RECENT REQUESTS:', JSON.stringify(recentRequests, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
