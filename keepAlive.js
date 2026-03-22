import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import config from './src/config/index.js';

const prisma = new PrismaClient();

console.log('🔄 Database Keep-Alive Service Started');
console.log(`📅 Schedule: Every 5 minutes`);
console.log(`🌐 Database: ${config.nodeEnv === 'production' ? 'Production' : 'Development'}`);

async function pingDatabase() {
  const timestamp = new Date().toISOString();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✅ [${timestamp}] Database ping successful`);
  } catch (error) {
    console.error(`❌ [${timestamp}] Database ping failed:`, error.message);
  }
}

cron.schedule('*/5 * * * *', pingDatabase);

pingDatabase();

process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping Keep-Alive Service...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Stopping Keep-Alive Service...');
  await prisma.$disconnect();
  process.exit(0);
});
