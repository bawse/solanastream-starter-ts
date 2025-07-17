import {
  connect,
  StringCodec,
  JetStreamClient,
  NatsConnection,
  consumerOpts,
  createInbox,
  ConnectionOptions,
  credsAuthenticator,
  jwtAuthenticator,
  nkeyAuthenticator,
} from "nats";
import { readFileSync } from 'fs';
import { settings, StreamConfig } from "./config";
import { getLogger } from "./logger";
import { Parser } from "./parser";

export class NATSConsumer {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
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
    const { host, port, name, jwt, nkey, jwtFile, nkeyFile, tls } = settings.nats;
    const url = `nats://${host}:${port}`;
    
    // Build connection options
    const opts: ConnectionOptions = {
      servers: url,
      name,
    };

    // Configure authentication
    if (jwtFile) {
      // Use credentials file authenticator
      this.logger.info("Using credentials file authentication");
      opts.authenticator = credsAuthenticator(readFileSync(jwtFile));
    } else if (jwt && nkey) {
      // Use inline JWT + NKey - combine them into creds format
      this.logger.info("Using inline JWT + NKey authentication");
      const creds = `-----BEGIN NATS USER JWT-----\n${jwt}\n------END NATS USER JWT------\n\n-----BEGIN USER NKEY SEED-----\n${nkey}\n------END USER NKEY SEED-----`;
      opts.authenticator = credsAuthenticator(new TextEncoder().encode(creds));
    } else if (jwt) {
      // JWT only authentication
      this.logger.info("Using JWT authentication");
      opts.authenticator = jwtAuthenticator(jwt);
    } else if (nkey) {
      // NKey only authentication
      this.logger.info("Using NKey authentication");
      opts.authenticator = nkeyAuthenticator(new TextEncoder().encode(nkey));
    } else {
      this.logger.warn("No authentication configured - using anonymous connection");
    }

    // Configure TLS if provided
    if (tls?.cert || tls?.key || tls?.ca) {
      this.logger.info("Configuring TLS connection");
      opts.tls = {
        cert: tls.cert ? readFileSync(tls.cert, 'utf-8') : undefined,
        key: tls.key ? readFileSync(tls.key, 'utf-8') : undefined,
        ca: tls.ca ? readFileSync(tls.ca, 'utf-8') : undefined,
      };
    }

    try {
      this.nc = await connect(opts);
      this.js = this.nc.jetstream();
      this.logger.info("Connected to NATS", { url, name });
    } catch (error) {
      this.logger.error("Failed to connect to NATS:", error);
      throw error;
    }
  }

  private async subscribe(streamConfig: StreamConfig): Promise<void> {
    const { subject, stream, name } = streamConfig;
    this.logger.info(`Subscribing to ${subject} on stream ${stream}`);

    try {
      // Build consumer options for an ephemeral push subscriber
      const opts = consumerOpts();
      opts.ackExplicit(); // require explicit ack policy (at-least once)
      opts.manualAck(); // we will manually ack messages
      opts.deliverTo(createInbox()); // set a unique delivery subject
      opts.bindStream(stream); // bind to specific stream
      opts.maxDeliver(1); // only deliver each message once
      opts.deliverNew(); // only receive new messages

      // Subscribe to the subject with the given options
      const sub = await this.js.subscribe(subject, opts);

      // Handle messages asynchronously
      (async () => {
        for await (const msg of sub) {
          if (!this.running) {
            break;
          }
          
          try {
            await this.handleMessage(name, msg.data);
            msg.ack();
          } catch (error) {
            this.logger.error(`Error handling message from ${name}:`, error);
            // Still ack the message to avoid redelivery
            msg.ack();
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