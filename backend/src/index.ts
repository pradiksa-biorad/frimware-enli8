import app from './app';
import { config } from './config';
import { prisma } from './utils/prisma';

async function main() {
  await prisma.$connect();
  console.log('Database connected');

  app.listen(config.port, () => {
    console.log(`Backend running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
