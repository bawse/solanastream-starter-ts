import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

export interface StreamConfig {
  name: string;
  subject: string;
  stream: string;
}

export interface NATSConfig {
  host: string;
  port: number;
  name: string;
  jwt?: string;
  nkey?: string;
  jwtFile?: string;
  nkeyFile?: string;
  tls?: {
    cert?: string;
    key?: string;
    ca?: string;
  };
}

export interface Settings {
  nats: NATSConfig;
  streams: StreamConfig[];
  logLevel: string;
  statsInterval: number;
}

function loadCredentialFile(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  try {
    return readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    console.warn(`Failed to load credential file ${filePath}:`, error);
    return undefined;
  }
}

function parseStreamConfig(): StreamConfig[] {
  const names = process.env.STREAM_NAMES?.split(',') || ['pumpfun', 'pumpswap'];
  const subjects = process.env.STREAM_SUBJECTS?.split(',') || ['parsedtx.pumpfun', 'parsedtx.pumpswap'];
  const streams = process.env.JETSTREAM_NAMES?.split(',') || ['PARSED_PUMPFUN', 'PARSED_PUMPSWAP'];

  if (names.length !== subjects.length || names.length !== streams.length) {
    throw new Error('Stream configuration arrays must have the same length');
  }

  return names.map((name, index) => ({
    name: name.trim(),
    subject: subjects[index].trim(),
    stream: streams[index].trim(),
  }));
}

export const settings: Settings = {
  nats: {
    host: process.env.NATS_HOST || 'localhost',
    port: parseInt(process.env.NATS_PORT || '4222'),
    name: process.env.NATS_NAME || 'solana-stream-consumer',
    jwt: process.env.NATS_JWT || loadCredentialFile(process.env.NATS_JWT_FILE),
    nkey: process.env.NATS_NKEY || loadCredentialFile(process.env.NATS_NKEY_FILE),
    jwtFile: process.env.NATS_JWT_FILE,
    nkeyFile: process.env.NATS_NKEY_FILE,
    tls: {
      cert: process.env.NATS_TLS_CERT,
      key: process.env.NATS_TLS_KEY,
      ca: process.env.NATS_TLS_CA,
    },
  },
  streams: parseStreamConfig(),
  logLevel: process.env.LOG_LEVEL || 'info',
  statsInterval: parseInt(process.env.STATS_INTERVAL || '5000'),
}; 