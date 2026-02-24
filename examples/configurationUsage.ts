/**
 * Configuration System Usage Examples
 * Demonstrates how to use the configuration management system
 */

import {
  loadConfig,
  getConfig,
  isProviderConfigured,
  getConfiguredProviders,
  CredentialStore,
  credentialCache,
  ConfigurationError,
} from '../src/config/index.js';

/**
 * Example 1: Loading and accessing configuration
 */
function example1_LoadConfiguration() {
  console.log('=== Example 1: Loading Configuration ===\n');

  try {
    // Load complete configuration
    const config = loadConfig();

    console.log(`Environment: ${config.environment}`);
    console.log(`Server port: ${config.server.port}`);
    console.log(`Database: ${config.database.database}`);
    console.log(`Authentication: ${config.security.enableAuth ? 'enabled' : 'disabled'}`);
    console.log(`Log level: ${config.logging.level}`);
    console.log();

    // Access specific sections
    const serverConfig = getConfig('server');
    console.log(`Server listening on ${serverConfig.host}:${serverConfig.port}`);
    console.log();

  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('Configuration error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

/**
 * Example 2: Checking model provider configuration
 */
function example2_CheckProviders() {
  console.log('=== Example 2: Checking Model Providers ===\n');

  try {
    // Check if specific providers are configured
    const hasOpenAI = isProviderConfigured('openai');
    const hasAnthropic = isProviderConfigured('anthropic');
    const hasGoogle = isProviderConfigured('google');

    console.log(`OpenAI configured: ${hasOpenAI}`);
    console.log(`Anthropic configured: ${hasAnthropic}`);
    console.log(`Google configured: ${hasGoogle}`);
    console.log();

    // Get all configured providers
    const providers = getConfiguredProviders();
    console.log(`Configured providers: ${providers.join(', ')}`);
    console.log();

    // Access provider-specific configuration
    const config = loadConfig();
    if (config.modelProviders.openai) {
      console.log('OpenAI models:', config.modelProviders.openai.models.join(', '));
    }
    if (config.modelProviders.anthropic) {
      console.log('Anthropic models:', config.modelProviders.anthropic.models.join(', '));
    }
    if (config.modelProviders.google) {
      console.log('Google models:', config.modelProviders.google.models.join(', '));
    }
    console.log();

  } catch (error) {
    console.error('Error checking providers:', error);
  }
}

/**
 * Example 3: Using credential utilities
 */
function example3_CredentialUtilities() {
  console.log('=== Example 3: Credential Utilities ===\n');

  // Mask credentials for display
  const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
  const masked = CredentialStore.mask(apiKey);
  console.log(`Original: ${apiKey}`);
  console.log(`Masked: ${masked}`);
  console.log();

  // Validate credential strength
  const weakKey = 'test123';
  const strongKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
  
  console.log(`Weak key valid: ${CredentialStore.validate(weakKey)}`);
  console.log(`Strong key valid: ${CredentialStore.validate(strongKey)}`);
  console.log();

  // Generate a secure random key
  const generatedKey = CredentialStore.generate(32);
  console.log(`Generated key: ${generatedKey}`);
  console.log(`Generated key length: ${generatedKey.length}`);
  console.log();

  // Hash a credential (one-way)
  const hash = CredentialStore.hash('my-secret-key');
  console.log(`Hash: ${hash}`);
  console.log(`Hash matches: ${CredentialStore.compare('my-secret-key', hash)}`);
  console.log(`Wrong key matches: ${CredentialStore.compare('wrong-key', hash)}`);
  console.log();
}

/**
 * Example 4: Using credential encryption
 */
function example4_CredentialEncryption() {
  console.log('=== Example 4: Credential Encryption ===\n');

  try {
    // Initialize credential store with master password
    const store = new CredentialStore();
    const masterPassword = 'this-is-a-very-secure-master-password-at-least-32-chars';
    store.initialize(masterPassword);

    // Encrypt a credential
    const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = store.encrypt(apiKey);
    
    console.log('Encrypted credential:');
    console.log(`  Encrypted: ${encrypted.encrypted.substring(0, 40)}...`);
    console.log(`  IV: ${encrypted.iv}`);
    console.log(`  Auth Tag: ${encrypted.authTag}`);
    console.log();

    // Decrypt the credential
    const decrypted = store.decrypt(encrypted);
    console.log(`Decrypted: ${decrypted}`);
    console.log(`Match: ${decrypted === apiKey}`);
    console.log();

  } catch (error) {
    console.error('Encryption error:', error);
  }
}

/**
 * Example 5: Using credential cache
 */
function example5_CredentialCache() {
  console.log('=== Example 5: Credential Cache ===\n');

  // Cache a credential for 1 hour
  const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
  credentialCache.set('openai-key', apiKey, 3600000);
  console.log('Cached OpenAI key');

  // Retrieve from cache
  const cached = credentialCache.get('openai-key');
  console.log(`Retrieved from cache: ${cached ? CredentialStore.mask(cached) : 'not found'}`);
  console.log();

  // Cache multiple credentials
  credentialCache.set('anthropic-key', 'sk-ant-abc123', 3600000);
  credentialCache.set('google-key', 'AIza-xyz789', 3600000);
  console.log(`Cache size: ${credentialCache.size()}`);
  console.log();

  // Remove a credential
  credentialCache.delete('google-key');
  console.log(`After delete, cache size: ${credentialCache.size()}`);
  console.log();

  // Clear all
  credentialCache.clear();
  console.log(`After clear, cache size: ${credentialCache.size()}`);
  console.log();
}

/**
 * Example 6: Handling configuration errors
 */
function example6_ErrorHandling() {
  console.log('=== Example 6: Error Handling ===\n');

  try {
    // This will fail if no providers are configured
    const config = loadConfig();
    console.log('Configuration loaded successfully');
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('Configuration error:', error.message);
      console.log('\nTo fix this:');
      console.log('1. Copy .env.example to .env');
      console.log('2. Add at least one model provider API key');
      console.log('3. Ensure all required fields are filled');
    } else {
      console.error('Unexpected error:', error);
    }
  }
  console.log();
}

/**
 * Example 7: Environment-specific behavior
 */
function example7_EnvironmentSpecific() {
  console.log('=== Example 7: Environment-Specific Behavior ===\n');

  try {
    const config = loadConfig();

    // Different behavior based on environment
    switch (config.environment) {
      case 'development':
        console.log('Running in development mode');
        console.log('- Debug logging enabled');
        console.log('- Authentication disabled');
        console.log('- Generous timeouts');
        break;

      case 'staging':
        console.log('Running in staging mode');
        console.log('- Info logging enabled');
        console.log('- Authentication enabled');
        console.log('- Production-like settings');
        break;

      case 'production':
        console.log('Running in production mode');
        console.log('- Info logging enabled');
        console.log('- Authentication required');
        console.log('- Strict rate limits');
        console.log('- SSL database connection');
        break;

      case 'test':
        console.log('Running in test mode');
        console.log('- Minimal logging');
        console.log('- Short timeouts');
        console.log('- In-memory storage');
        break;
    }
    console.log();

    // Show environment-specific settings
    console.log('Environment-specific settings:');
    console.log(`  Session retention: ${config.session.retentionDays} days`);
    console.log(`  Max concurrent sessions: ${config.session.maxConcurrentSessions}`);
    console.log(`  Rate limit: ${config.security.rateLimitMaxRequests} requests per ${config.security.rateLimitWindowMs / 1000}s`);
    console.log();

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Run all examples
 */
function runAllExamples() {
  console.log('Court of Minds - Configuration System Examples');
  console.log('='.repeat(60));
  console.log();

  example1_LoadConfiguration();
  example2_CheckProviders();
  example3_CredentialUtilities();
  example4_CredentialEncryption();
  example5_CredentialCache();
  example6_ErrorHandling();
  example7_EnvironmentSpecific();

  console.log('='.repeat(60));
  console.log('Examples complete!');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  example1_LoadConfiguration,
  example2_CheckProviders,
  example3_CredentialUtilities,
  example4_CredentialEncryption,
  example5_CredentialCache,
  example6_ErrorHandling,
  example7_EnvironmentSpecific,
};
