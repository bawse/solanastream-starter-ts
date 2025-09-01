import {
  connect,
  StringCodec,
  NatsConnection,
  ConnectionOptions,
  credsAuthenticator,
} from "nats";
import { readFileSync } from 'fs';
import { settings, StreamConfig } from "./config";
import { getLogger } from "./logger";
import { Parser } from "./parser";

export class NATSConsumer {
  private nc!: NatsConnection;
  private logger = getLogger("NATSConsumer");
  private messageCount = 0;
  private startTime = Date.now();
  private running = false;
  private parser: Parser;
  private statsInterval?: NodeJS.Timeout;

  constructor() {
    this.parser = new Parser();
  }

  async start(): Promise<void> {
    this.logger.info("Starting consumer", { streamCount: settings.streams.length });
    await this.connect();
    this.running = true;

    for (const stream of settings.streams) {
      await this.subscribe(stream);
    }

    this.reportStats();
  }

  private async connect(): Promise<void> {
    const { serverUrl, host, port, name, credsFile, userJwt, userSeed } = settings.nats;
    const url = serverUrl || `nats://${host}:${port}`;

    // Build connection options
    const opts: ConnectionOptions = {
      servers: url,
      name,
    };

    // Configure authentication
    if (credsFile) {
      this.logger.info("Using credentials file authentication");
      opts.authenticator = credsAuthenticator(readFileSync(credsFile));
    } else if (userJwt && userSeed) {
      this.logger.info("Using inline JWT + NKey seed authentication");
      const creds = `-----BEGIN NATS USER JWT-----\n${userJwt}\n------END NATS USER JWT------\n\n-----BEGIN USER NKEY SEED-----\n${userSeed}\n------END USER NKEY SEED-----`;
      opts.authenticator = credsAuthenticator(new TextEncoder().encode(creds));
    } else {
      const err = new Error("NATS authentication not configured. Provide NATS_CREDS_FILE/NATS_JWT_FILE or NATS_USER_JWT and NATS_USER_SEED.");
      this.logger.error(err.message);
      throw err;
    }

    try {
      this.nc = await connect(opts);
      this.logger.info("Connected to NATS", { url, name });
    } catch (error) {
      this.logger.error("Failed to connect to NATS:", error);
      throw error;
    }
  }

  private async subscribe(streamConfig: StreamConfig): Promise<void> {
    const { subject, name } = streamConfig;
    this.logger.info(`Subscribing to ${subject}`);

    try {
      // Core NATS subscription. Requires permission to subscribe to the subject.
      const sub = this.nc.subscribe(subject);
      (async () => {
        for await (const msg of sub) {
          if (!this.running) break;
          try {
            await this.handleMessage(name, msg.data);
          } catch (error) {
            this.logger.error(`Error handling message from ${name}:`, error);
          }
        }
      })().catch((err) => {
        this.logger.error(`Subscription error for ${name}:`, err);
      });

      this.logger.info(`Successfully subscribed to ${name}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to ${name}:`, err);
      throw err;
    }
  }

  private async handleMessage(streamName: string, data: Uint8Array): Promise<void> {
    this.messageCount++;

    try {
      const json = JSON.parse(StringCodec().decode(data));

      // Optional: Log received messages (uncomment for debugging)
      // this.logger.debug(`[${streamName}] Received message #${this.messageCount}`, json);

      // Process transaction through parser
      await this.parser.processTransaction(streamName, json);
    } catch (err) {
      this.logger.error("Failed to parse message as JSON:", err);
    }
  }

  private reportStats(): void {
    this.statsInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const rate = elapsed > 0 ? (this.messageCount / elapsed).toFixed(2) : '0';
      const messageCount = this.parser.getMessageCount();

      this.logger.info("Consumer Stats", {
        messages: this.messageCount,
        'rate/s': rate,
        parsed: messageCount,
        uptime: `${elapsed.toFixed(0)}s`,
      });
    }, settings.statsInterval);
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping consumer");
    this.running = false;

    // Clear stats interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Stop parser
    await this.parser.stop();

    // Gracefully close NATS connection
    if (this.nc) {
      await this.nc.drain();
    }

    this.logger.info("Consumer stopped", {
      totalMessages: this.messageCount,
      totalParsed: this.parser.getMessageCount(),
    });
  }

  // Getter methods for monitoring
  getMessageCount(): number {
    return this.messageCount;
  }

  getParsedCount(): number {
    return this.parser.getMessageCount();
  }

  isRunning(): boolean {
    return this.running;
  }
} 