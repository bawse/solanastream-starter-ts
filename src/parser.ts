import { getLogger } from './logger';

export class Parser {
  private logger = getLogger('Parser');
  private messageCount = 0;

  constructor() {
    this.logger.info('Parser initialized');
  }

  async processTransaction(streamName: string, data: any): Promise<void> {
    try {
      this.messageCount++;
      
      // Print the message to console
      console.log(`\n[${streamName}] Message #${this.messageCount}:`);
      console.log(JSON.stringify(data, null, 2));
      
    } catch (error) {
      this.logger.error(`Error processing message from ${streamName}:`, error);
    }
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  async stop(): Promise<void> {
    this.logger.info('Parser stopping', {
      totalMessages: this.messageCount,
    });
  }
} 