# Solanastream Starter (TypeScript)

A TypeScript starter template for consuming Solana data streams via NATS with JWT/NKey authentication support.

## Features

- 🔐 **JWT/NKey Authentication** - Secure NATS authentication using JWT tokens and NKey cryptographic keys
- 🌊 **Ephemeral Push Consumer** - Efficiently consumes messages using NATS JetStream ephemeral push consumers
- 📊 **Real-time Stats** - Built-in message rate and processing statistics
- 🔧 **Configurable Streams** - Easy configuration for multiple Solana data streams
- 📝 **Structured Logging** - Winston-based logging with configurable levels
- 🛡️ **Error Handling** - Robust error handling and graceful shutdown
- 🚀 **TypeScript** - Full TypeScript support with proper types
- 📤 **Simple Output** - Messages are printed to console in JSON format for easy inspection

## Prerequisites

- Node.js 18+ 
- NATS server with JetStream enabled
- Valid JWT and NKey credentials for NATS authentication

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd solanastream-starter-ts
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment template:
```bash
cp .env.example .env
```

4. Configure your environment variables (see [Configuration](#configuration) below)

5. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

#### NATS Configuration
```env
NATS_HOST=your-nats-server.com
NATS_PORT=4222
NATS_NAME=solana-stream-consumer
```

#### Authentication (choose one method)

**Option 1: Credentials Files (Recommended)**
```env
NATS_JWT_FILE=path/to/your/jwt.creds
NATS_NKEY_FILE=path/to/your/nkey.creds
```

**Option 2: Inline Credentials**
```env
NATS_JWT=your_jwt_token_here
NATS_NKEY=your_nkey_here
```

**Option 3: Combined Credentials File**
```env
NATS_JWT_FILE=path/to/your/combined.creds  # Contains both JWT and NKey
NATS_NKEY_FILE=path/to/your/combined.creds
```

#### TLS Configuration (Optional)
```env
NATS_TLS_CERT=path/to/cert.pem
NATS_TLS_KEY=path/to/key.pem
NATS_TLS_CA=path/to/ca.pem
```

#### Stream Configuration
```env
STREAM_NAMES=pumpfun,pumpswap
STREAM_SUBJECTS=parsedtx.pumpfun,parsedtx.pumpswap
JETSTREAM_NAMES=PARSED_PUMPFUN,PARSED_PUMPSWAP
```

#### Logging
```env
LOG_LEVEL=info
STATS_INTERVAL=5000
```

### Authentication Setup

#### Getting JWT and NKey Credentials

1. **From NATS Account Server**: If using NATS account server, download your `.creds` file
2. **From nsc CLI**: Generate credentials using the NATS Security CLI:
   ```bash
   nsc generate creds -a YOUR_ACCOUNT -u YOUR_USER
   ```
3. **Manual Creation**: Create JWT and NKey separately

#### Credentials File Format

A typical `.creds` file contains both JWT and NKey:
```
-----BEGIN NATS USER JWT-----
eyJ0eXAiOiJKV1QiLCJhbGciOiJFZDI1NTE5LW5rZXkifQ...
------END NATS USER JWT------

************************* IMPORTANT *************************
NKEY Seed printed below can be used to sign and prove identity.
NKEYs are sensitive and should be treated as secrets.

-----BEGIN USER NKEY SEED-----
SUABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ567...
------END USER NKEY SEED-----
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Watch Mode (Auto-rebuild)
```bash
npm run watch
```

## Project Structure

```
src/
├── index.ts          # Main entry point
├── consumer.ts       # NATS consumer implementation
├── parser.ts         # Transaction data parser
├── config.ts         # Configuration management
└── logger.ts         # Logging setup

logs/                 # Log files (created automatically)
├── combined.log      # All logs
└── error.log         # Error logs only

dist/                 # Compiled JavaScript (after build)
```

## Customization

### Adding New Streams

1. Update your `.env` file with new stream configuration:
```env
STREAM_NAMES=pumpfun,pumpswap,newstream
STREAM_SUBJECTS=parsedtx.pumpfun,parsedtx.pumpswap,parsedtx.newstream
JETSTREAM_NAMES=PARSED_PUMPFUN,PARSED_PUMPSWAP,PARSED_NEWSTREAM
```

2. Add custom processing logic in `src/parser.ts`:
```typescript
private async customProcessing(streamName: string, transaction: SolanaTransaction): Promise<void> {
  switch (streamName) {
    case 'newstream':
      await this.processNewStreamTransaction(transaction);
      break;
    // ... existing cases
  }
}
```

### Modifying Message Processing

Edit the `processTransaction` method in `src/parser.ts` to implement your custom logic:

```typescript
async processTransaction(streamName: string, data: any): Promise<void> {
  // Your custom processing logic here
  // Currently just prints to console - modify as needed
  console.log(`\n[${streamName}] Message:`, data);
}
```

## Monitoring

The consumer provides built-in monitoring with the following metrics:

- **Messages**: Total messages received
- **Rate/s**: Messages per second
- **Parsed**: Successfully parsed messages
- **Uptime**: Consumer uptime

Stats are logged every 5 seconds (configurable via `STATS_INTERVAL`).

## Error Handling

The application includes comprehensive error handling:

- **Connection errors**: Automatic retry and reconnection
- **Message parsing errors**: Logged but don't stop processing
- **Processing errors**: Individual message errors don't affect others
- **Graceful shutdown**: Proper cleanup on SIGINT/SIGTERM

## Logging

Logs are written to:
- **Console**: Formatted, colorized output
- **logs/combined.log**: All log levels
- **logs/error.log**: Error level only

Log levels: `error`, `warn`, `info`, `debug`

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript
- `npm run dev` - Run with ts-node (development)
- `npm run watch` - Watch mode with auto-compilation
- `npm run clean` - Remove compiled files

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the logs in `logs/` directory
2. Verify NATS connection and authentication
3. Check stream and subject configuration
4. Review environment variables

## Security Notes

- Never commit `.env` files or credential files to version control
- Store credentials securely and rotate them regularly
- Use TLS in production environments
- Limit NKey permissions to minimum required scope 