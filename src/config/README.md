# Configuration Management

This directory contains the configuration management system for Court of Minds.

## Structure

```
config/
├── types.ts              # TypeScript type definitions for all config sections
├── validator.ts          # Configuration validation logic
├── loader.ts             # Configuration loading and merging
├── credentials.ts        # Secure credential storage utilities
├── index.ts              # Public API exports
├── environments/         # Environment-specific configurations
│   ├── development.ts    # Development environment config
│   ├── staging.ts        # Staging environment config
│   ├── production.ts     # Production environment config
│   └── test.ts           # Test environment config
└── README.md             # This file
```

## Key Features

### Type-Safe Configuration

All configuration is strongly typed using TypeScript interfaces, providing:
- Compile-time type checking
- IDE autocomplete support
- Clear documentation of available options
- Prevention of typos and invalid values

### Environment-Specific Configs

Pre-configured settings for different deployment environments:
- **Development**: Local development with debug logging
- **Staging**: Pre-production testing environment
- **Production**: Production deployment with security enabled
- **Test**: Automated testing with minimal logging

### Validation on Startup

Configuration is validated when loaded, catching errors early:
- Required fields are present
- Values are within valid ranges
- API credentials are provided
- Security settings are appropriate

### Environment Variable Overrides

Any configuration value can be overridden using environment variables:
- Flexible deployment without code changes
- Support for container orchestration
- Integration with secret management systems
- Easy configuration in CI/CD pipelines

### Secure Credential Storage

Utilities for managing sensitive data:
- AES-256-GCM encryption for credentials
- Credential masking for logs
- Strength validation
- In-memory caching with expiration
- Secure random key generation

## Usage

### Basic Usage

```typescript
import { loadConfig } from './config/index.js';

// Load complete configuration
const config = loadConfig();

// Access configuration values
console.log(`Server port: ${config.server.port}`);
console.log(`Database: ${config.database.database}`);
```

### Getting Specific Sections

```typescript
import { getConfig } from './config/index.js';

// Get only what you need
const serverConfig = getConfig('server');
const dbConfig = getConfig('database');
```

### Checking Providers

```typescript
import { isProviderConfigured, getConfiguredProviders } from './config/index.js';

// Check if OpenAI is configured
if (isProviderConfigured('openai')) {
  console.log('OpenAI is available');
}

// Get all configured providers
const providers = getConfiguredProviders();
```

### Credential Management

```typescript
import { CredentialStore, credentialCache } from './config/index.js';

// Mask credentials for logging
const masked = CredentialStore.mask(apiKey);
console.log(`API Key: ${masked}`);

// Cache credentials
credentialCache.set('openai-key', apiKey, 3600000);
const cached = credentialCache.get('openai-key');

// Encrypt credentials
const store = new CredentialStore();
store.initialize(masterPassword);
const encrypted = store.encrypt(apiKey);
const decrypted = store.decrypt(encrypted);
```

## Configuration Sections

### Server Configuration
- Port and host settings
- Authentication settings
- CORS configuration
- Admin API key

### Database Configuration
- PostgreSQL connection settings
- Connection pool size
- SSL configuration
- Timeouts

### Model Provider Configuration
- OpenAI API credentials
- Anthropic API credentials
- Google AI API credentials
- Available models per provider

### Model Behavior Configuration
- Response timeouts
- Token limits
- Temperature settings
- Retry logic

### Session Configuration
- Retention period
- Cleanup frequency
- Concurrent session limits

### Deliberation Configuration
- Debate round limits
- Phase timeouts
- Convergence thresholds

### Security Configuration
- Authentication settings
- JWT configuration
- Rate limiting
- API keys

### Logging Configuration
- Log levels
- Output formats
- Console and file logging

## Environment Variables

See `.env.example` for a complete list of supported environment variables.

Key variables:
- `NODE_ENV` - Environment (development/staging/production/test)
- `PORT` - Server port
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database settings
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` - Model provider keys
- `ENABLE_AUTH` - Enable authentication
- `ADMIN_API_KEY` - Admin API key
- `LOG_LEVEL` - Logging level

## Validation Rules

The validator enforces:
- At least one model provider must be configured
- API keys are required for each configured provider
- Admin API key must be at least 32 characters
- Port numbers must be between 1 and 65535
- Timeouts must be positive numbers
- Temperature must be between 0 and 2
- Max debate rounds must be >= min debate rounds

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use strong admin keys** (minimum 32 characters)
3. **Enable authentication** in staging and production
4. **Use SSL** for database connections in production
5. **Rotate API keys** regularly
6. **Mask credentials** in logs using `CredentialStore.mask()`
7. **Validate credential strength** using `CredentialStore.validate()`

## Error Handling

Configuration errors throw `ConfigurationError` with descriptive messages:

```typescript
try {
  const config = loadConfig();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
    // Handle configuration error
  }
}
```

## Testing

Test configuration is optimized for automated testing:
- Short timeouts for fast tests
- Minimal logging to reduce noise
- Small connection pools
- No authentication required

## Documentation

See `docs/configuration.md` for comprehensive documentation including:
- Detailed configuration options
- Environment-specific settings
- Usage examples
- Troubleshooting guide
- Best practices

## Examples

See `examples/configurationUsage.ts` for working examples of:
- Loading configuration
- Checking providers
- Using credential utilities
- Encrypting credentials
- Caching credentials
- Error handling
- Environment-specific behavior
