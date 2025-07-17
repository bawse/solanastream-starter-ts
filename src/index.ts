import { NATSConsumer } from './consumer';
import { getLogger } from './logger';
import { settings } from './config';

const logger = getLogger('Main');

async function main(): Promise<void> {
  logger.info('Starting Solana Stream Consumer', {
    version: require('../package.json').version,
    nodeVersion: process.version,
    streams: settings.streams.map(s => s.name),
  });

  const consumer = new NATSConsumer();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await consumer.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  try {
    // Start the consumer
    await consumer.start();
    logger.info('Consumer started successfully');
    
    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start consumer:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main }; 