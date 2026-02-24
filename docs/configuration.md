# Configuration Management

This document describes the configuration management system for Court of Minds.

## Overview

The configuration system provides:

- **Environment-specific configurations** (development, staging, production, test)
- **Type-safe configuration access** with TypeScript interfaces
- **Validation on startup** to catch configuration errors early
- **Secure credential storage** for API keys and sensitive data
- **Environment variable overrides** for flexible deployment
- **Comprehensive documentation** for all configuration options

## Configuration Structure

The configuration is organized into logical sections:

### Server Configuration

Controls the HTTP server and API settings.

```typescript
interface ServerConfig {
  port: number;              // Server port (default: 3000)
  host: string;              // Bind address (default: 0.0.0.0)
  enableAuth: boolean;       // Enable authentication
  adminApiKey?: string;      // Admin API key for management endpoints
  corsOrigins: string[];     // Allowed CORS origins
}
```

**Environment Variables:**
- `PORT` - Server port
- `HOST` - Server host
- `ENABLE_AUTH` - Enable authentication (true/false)
- `ADMIN_API_KEY` - Admin API key (min 32 characters)
- `CORS_ORIGINS` - Comma-separated list of allowed origins

### Database Configuration

PostgreSQL database connection settings.

```typescript
interface DatabaseConfig {
  host: string;              // Database host
  port: number;              // Database port (default: 5432)
  database: string;          // Database name
  user: string;              // Database user
  password: string;          // Database password
  ssl: boolean;              // Enable SSL connection
  maxConnections: number;    // Connection pool size
  connectionTimeout: number; // Connection timeout (ms)
}
```

**Environment Variables:**
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Enable SSL (true/false)

### Model Provider Configuration

API credentials for AI model providers.

```typescript
interface ModelProviderConfig {
  openai?: {
    apiKey: string;          // OpenAI API key
    organization?: string;   // OpenAI organization ID
    models: string[];        // Available models
  };
  anthropic?: {
    apiKey: string;          // Anthropic API key
    models: string[];        // Available models
  };
  google?: {
    apiKey: string;          // Google AI API key
    models: string[];        // Available models
  };
}
```

**Environment Variables:**
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_ORGANIZATION` - OpenAI organization ID (optional)
- `OPENAI_MODELS` - Comma-separated list of models (default: gpt-4,gpt-3.5-turbo)
- `ANTHROPIC_API_KEY` - Anthropic API key
- `ANTHROPIC_MODELS` - Comma-separated list of models
- `GOOGLE_API_KEY` - Google AI API key
- `GOOGLE_MODELS` - Comma-separated list of models

**Requirements:**
- At least one provider must be configured
- API keys are required for each configured provider
- API keys should be kept secure and never committed to version control

### Model Behavior Configuration

Controls how models are invoked and behave.

```typescript
interface ModelBehaviorConfig {
  timeout: number;           // Model response timeout (ms)
  maxTokens: number;         // Maximum tokens per response
  temperature: number;       // Model temperature (0-2)
  retryAttempts: number;     // Number of retry attempts
  retryDelay: number;        // Delay between retries (ms)
}
```

**Environment Variables:**
- `MODEL_TIMEOUT` - Timeout in seconds (converted to ms)
- `MODEL_MAX_TOKENS` - Maximum tokens
- `MODEL_TEMPERATURE` - Temperature (0-2)

### Session Configuration

Session storage and retention settings.

```typescript
interface SessionConfig {
  retentionDays: number;         // Session retention period
  cleanupIntervalHours: number;  // Cleanup frequency
  maxConcurrentSessions: number; // Max concurrent sessions
}
```

**Environment Variables:**
- `SESSION_RETENTION_DAYS` - Retention period in days

### Deliberation Configuration

Controls the deliberation process parameters.

```typescript
interface DeliberationConfig {
  minDebateRounds: number;       // Minimum debate rounds
  maxDebateRounds: number;       // Maximum debate rounds
  sessionTimeoutMs: number;      // Overall session timeout
  analysisTimeoutMs: number;     // Analysis phase timeout
  debateRoundTimeoutMs: number;  // Debate round timeout
  consensusTimeoutMs: number;    // Consensus phase timeout
  convergenceThreshold: number;  // Convergence threshold (0-1)
}
```

**Environment Variables:**
- `MIN_DEBATE_ROUNDS` - Minimum debate rounds
- `MAX_DEBATE_ROUNDS` - Maximum debate rounds
- `SESSION_TIMEOUT` - Overall session timeout (ms)

### Security Configuration

Authentication and security settings.

```typescript
interface SecurityConfig {
  enableAuth: boolean;           // Enable authentication
  adminApiKey?: string;          // Admin API key
  jwtSecret?: string;            // JWT signing secret
  jwtExpiresIn: string;          // JWT expiration time
  rateLimitWindowMs: number;     // Rate limit window
  rateLimitMaxRequests: number;  // Max requests per window
}
```

**Environment Variables:**
- `ENABLE_AUTH` - Enable authentication (true/false)
- `ADMIN_API_KEY` - Admin API key (min 32 characters)
- `JWT_SECRET` - JWT signing secret (min 32 characters)
- `JWT_EXPIRES_IN` - JWT expiration (e.g., "8h", "1d")

### Logging Configuration

Logging behavior and output settings.

```typescript
interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}
```

**Environment Variables:**
- `LOG_LEVEL` - Log level (debug/info/warn/error)
- `LOG_FORMAT` - Log format (json/text)

## Environment-Specific Configurations

### Development

Optimized for local development:
- No authentication required
- Shorter session retention (7 days)
- Debug logging enabled
- Generous rate limits
- Local database without SSL

### Staging

Pre-production testing environment:
- Authentication enabled
- 30-day session retention
- JSON logging to file
- Moderate rate limits
- SSL database connection

### Production

Production deployment:
- Authentication required
- 30-day session retention
- JSON logging to file
- Strict rate limits
- SSL database connection
- Higher connection pool size

### Test

Automated testing environment:
- No authentication
- Short timeouts for fast tests
- Minimal logging
- Small connection pool
- In-memory or test database

## Usage

### Loading Configuration

```typescript
import { loadConfig } from './config/index.js';

// Load complete configuration
const config = loadConfig();

// Access specific sections
console.log(`Server port: ${config.server.port}`);
console.log(`Database: ${config.database.database}`);
```

### Getting Specific Sections

```typescript
import { getConfig } from './config/index.js';

// Get only the section you need
const serverConfig = getConfig('server');
const dbConfig = getConfig('database');
```

### Checking Provider Configuration

```typescript
import { isProviderConfigured, getConfiguredProviders } from './config/index.js';

// Check if a specific provider is configured
if (isProviderConfigured('openai')) {
  console.log('OpenAI is configured');
}

// Get all configured providers
const providers = getConfiguredProviders();
console.log(`Configured providers: ${providers.join(', ')}`);
```

## Secure Credential Storage

The system includes utilities for encrypting and managing sensitive credentials.

### CredentialStore

Encrypts and decrypts credentials using AES-256-GCM.

```typescript
import { CredentialStore } from './config/credentials.js';

// Initialize with master password
const store = new CredentialStore();
store.initialize(process.env.MASTER_PASSWORD!);

// Encrypt a credential
const encrypted = store.encrypt('my-api-key-12345');

// Decrypt a credential
const decrypted = store.decrypt(encrypted);
```

### Credential Utilities

```typescript
import { CredentialStore } from './config/credentials.js';

// Mask a credential for display
const masked = CredentialStore.mask('sk-1234567890abcdef');
// Output: "sk-1***************cdef"

// Validate credential strength
const isValid = CredentialStore.validate('my-api-key', 20);

// Generate a secure random key
const apiKey = CredentialStore.generate(32);

// Hash a credential (one-way)
const hash = CredentialStore.hash('my-api-key');

// Compare plaintext with hash
const matches = CredentialStore.compare('my-api-key', hash);
```

### CredentialCache

In-memory cache with automatic expiration.

```typescript
import { credentialCache } from './config/credentials.js';

// Cache a credential for 1 hour
credentialCache.set('openai-key', apiKey, 3600000);

// Retrieve from cache
const cached = credentialCache.get('openai-key');

// Remove from cache
credentialCache.delete('openai-key');

// Clear all cached credentials
credentialCache.clear();
```

## Configuration Validation

The system validates configuration on startup and throws descriptive errors:

```typescript
import { validateConfig } from './config/validator.js';

try {
  validateConfig(config);
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}
```

### Common Validation Errors

- **Missing API credentials**: At least one model provider must be configured
- **Invalid port**: Port must be between 1 and 65535
- **Weak admin key**: Admin API key must be at least 32 characters
- **Invalid timeout**: Timeouts must be positive numbers
- **Invalid temperature**: Temperature must be between 0 and 2
- **Invalid debate rounds**: Max rounds must be >= min rounds

## Best Practices

### Security

1. **Never commit credentials** to version control
2. **Use strong admin keys** (minimum 32 characters, random)
3. **Enable authentication** in staging and production
4. **Use SSL** for database connections in production
5. **Rotate API keys** regularly
6. **Use environment variables** for sensitive data

### Configuration Management

1. **Use environment-specific configs** for different deployment stages
2. **Override with environment variables** for deployment flexibility
3. **Validate on startup** to catch errors early
4. **Document custom settings** in your deployment guide
5. **Test configuration changes** in staging before production

### API Keys

1. **Store securely** using environment variables or key management services
2. **Mask in logs** using `CredentialStore.mask()`
3. **Validate strength** using `CredentialStore.validate()`
4. **Cache temporarily** using `CredentialCache` to reduce lookups
5. **Monitor usage** to detect unauthorized access

## Example .env File

```bash
# Environment
NODE_ENV=production

# Server
PORT=3000
HOST=0.0.0.0
ENABLE_AUTH=true
ADMIN_API_KEY=your-secure-32-character-admin-key-here
CORS_ORIGINS=https://courtofminds.example.com

# Database
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=court_of_minds
DB_USER=app_user
DB_PASSWORD=your-secure-database-password
DB_SSL=true

# Model Providers
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GOOGLE_API_KEY=your-google-api-key-here

# Model Behavior
MODEL_TIMEOUT=30
MODEL_MAX_TOKENS=2000
MODEL_TEMPERATURE=0.7

# Session
SESSION_RETENTION_DAYS=30

# Deliberation
MIN_DEBATE_ROUNDS=1
MAX_DEBATE_ROUNDS=5
SESSION_TIMEOUT=300000

# Security
JWT_SECRET=your-secure-32-character-jwt-secret-here
JWT_EXPIRES_IN=8h

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## Troubleshooting

### Configuration won't load

- Check that `.env` file exists and is readable
- Verify environment variable names match exactly
- Check for syntax errors in `.env` file
- Ensure required variables are set

### Validation errors

- Read the error message carefully - it tells you what's wrong
- Check that API keys are provided for configured providers
- Verify numeric values are in valid ranges
- Ensure admin key is at least 32 characters

### Database connection fails

- Verify database credentials are correct
- Check that database server is accessible
- Ensure SSL setting matches database configuration
- Check firewall rules and network connectivity

### Model provider errors

- Verify API keys are valid and active
- Check that you have credits/quota available
- Ensure model names are correct
- Test API keys using provider's official tools

## Related Documentation

- [API Documentation](./api-documentation.md)
- [Database Setup](./database-setup.md)
- [Error Handling](./error-handling.md)
- [Session Store Implementation](./session-store-implementation.md)
