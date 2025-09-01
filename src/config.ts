import * as dotenv from 'dotenv';

dotenv.config();

export interface StreamConfig {
  name: string;
  subject: string;
}

export interface NATSConfig {
  serverUrl?: string;
  host: string;
  port: number;
  name: string;
  credsFile?: string;
  userJwt?: string;
  userSeed?: string;
}

export interface Settings {
  nats: NATSConfig;
  streams: StreamConfig[];
  logLevel: string;
  statsInterval: number;
}

function parseStreamConfig(): StreamConfig[] {
  const names = process.env.STREAM_NAMES?.split(',') || ['basic-stream'];
  const subjects = process.env.STREAM_SUBJECTS?.split(',') || ['basic.pumpfun'];

  if (names.length !== subjects.length) {
    throw new Error('Stream configuration arrays must have the same length');
  }

  return names.map((name, index) => ({
    name: name.trim(),
    subject: subjects[index].trim(),
  }));
}

export const settings: Settings = {
  nats: {
    serverUrl: process.env.NATS_SERVER_URL,
    host: process.env.NATS_HOST || 'localhost',
    port: parseInt(process.env.NATS_PORT || '4222'),
    name: process.env.NATS_NAME || 'solana-stream-consumer',
    credsFile: process.env.NATS_JWT_FILE || process.env.NATS_CREDS_FILE,
    userJwt: process.env.NATS_USER_JWT,
    userSeed: process.env.NATS_USER_SEED,
  },
  streams: parseStreamConfig(),
  logLevel: process.env.LOG_LEVEL || 'info',
  statsInterval: parseInt(process.env.STATS_INTERVAL || '5000'),
}; 