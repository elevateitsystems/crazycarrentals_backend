
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const startServer = async () => {
  await prisma.$connect();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`API running at http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received. Shutting down...`);

    server.close(() => {
      void prisma.$disconnect().finally(() => {
        process.exit(0);
      });
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

startServer().catch(async (error: unknown) => {
  console.error('Failed to start server:', error);
  await prisma.$disconnect();
  process.exit(1);
});
