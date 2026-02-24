/**
 * Configuration loader
 * Loads and merges configuration from environment-specific files and environment variables
 * Validates Requirements: 8.1, 8.2
 */

import { config as dotenvConfig } from 'dotenv';
import { AppConfig, ConfigurationError, ModelProviderConfig } from './types.js';
import { validateConfig } from './validator.js';
import { developmentConfig } from './environments/development.js';
import { stagingConfig } from './environments/staging.js';
import { productionConfig } from './environments/production.js';
import { testConfig } from './environments/test.js';

// Load environment variables from .env file
dotenvConfig();

/**
 * Gets the current environment
 */
function getEnvironment(): 'development' | 'staging' | 'production' | 'test' {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development' || env === 'staging' || env === 'production' || env === 'test') {
    return env;
  }
  
  console.warn(`Unknown NODE_ENV "${env}", defaulting to development`);
  return 'development';
}

/**
 * Loads base configuration for the current environment
 */
function loadBaseConfig(): Partial<AppConfig> {
  const environment = getEnvironment();
  
  switch (environment) {
    case 'development':
      return developmentConfig;
    case 'staging':
      return stagingConfig;
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return developmentConfig;
  }
}

/**
 * Loads model provider configuration from environment variables
 * Validates Requirement 8.2: API credentials requirement
 */
function loadModelProviders(): ModelProviderConfig {
  const providers: ModelProviderConfig = {};

  // OpenAI configuration
  if (process.env.OPENAI_API_KEY) {
    providers.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION,
      models: process.env.OPENAI_MODELS?.split(',') || ['gpt-4', 'gpt-3.5-turbo'],
    };
  }

  // Anthropic configuration
  if (process.env.ANTHROPIC_API_KEY) {
    providers.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: process.env.ANTHROPIC_MODELS?.split(',') || [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
      ],
    };
  }

  // Google configuration
  if (process.env.GOOGLE_API_KEY) {
    providers.google = {
      apiKey: process.env.GOOGLE_API_KEY,
      models: process.env.GOOGLE_MODELS?.split(',') || ['gemini-pro'],
    };
  }

  return providers;
}

/**
 * Applies environment variable overrides to configuration
 */
function applyEnvironmentOverrides(config: Partial<AppConfig>): Partial<AppConfig> {
  // Server overrides
  if (process.env.PORT) {
    if (!config.server) config.server = {} as any;
    config.server!.port = parseInt(process.env.PORT);
  }

  if (process.env.HOST) {
    if (!config.server) config.server = {} as any;
    config.server!.host = process.env.HOST;
  }

  if (process.env.ENABLE_AUTH !== undefined) {
    if (!config.server) config.server = {} as any;
    if (!config.security) config.security = {} as any;
    config.server!.enableAuth = process.env.ENABLE_AUTH === 'true';
    config.security!.enableAuth = process.env.ENABLE_AUTH === 'true';
  }

  if (process.env.ADMIN_API_KEY) {
    if (!config.server) config.server = {} as any;
    if (!config.security) config.security = {} as any;
    config.server!.adminApiKey = process.env.ADMIN_API_KEY;
    config.security!.adminApiKey = process.env.ADMIN_API_KEY;
  }

  if (process.env.CORS_ORIGINS) {
    if (!config.server) config.server = {} as any;
    config.server!.corsOrigins = process.env.CORS_ORIGINS.split(',');
  }

  // Database overrides
  if (process.env.DB_HOST) {
    if (!config.database) config.database = {} as any;
    config.database!.host = process.env.DB_HOST;
  }

  if (process.env.DB_PORT) {
    if (!config.database) config.database = {} as any;
    config.database!.port = parseInt(process.env.DB_PORT);
  }

  if (process.env.DB_NAME) {
    if (!config.database) config.database = {} as any;
    config.database!.database = process.env.DB_NAME;
  }

  if (process.env.DB_USER) {
    if (!config.database) config.database = {} as any;
    config.database!.user = process.env.DB_USER;
  }

  if (process.env.DB_PASSWORD) {
    if (!config.database) config.database = {} as any;
    config.database!.password = process.env.DB_PASSWORD;
  }

  if (process.env.DB_SSL !== undefined) {
    if (!config.database) config.database = {} as any;
    config.database!.ssl = process.env.DB_SSL === 'true';
  }

  // Model behavior overrides
  if (process.env.MODEL_TIMEOUT) {
    if (!config.modelBehavior) config.modelBehavior = {} as any;
    config.modelBehavior!.timeout = parseInt(process.env.MODEL_TIMEOUT) * 1000;
  }

  if (process.env.MODEL_MAX_TOKENS) {
    if (!config.modelBehavior) config.modelBehavior = {} as any;
    config.modelBehavior!.maxTokens = parseInt(process.env.MODEL_MAX_TOKENS);
  }

  if (process.env.MODEL_TEMPERATURE) {
    if (!config.modelBehavior) config.modelBehavior = {} as any;
    config.modelBehavior!.temperature = parseFloat(process.env.MODEL_TEMPERATURE);
  }

  // Session overrides
  if (process.env.SESSION_RETENTION_DAYS) {
    if (!config.session) config.session = {} as any;
    config.session!.retentionDays = parseInt(process.env.SESSION_RETENTION_DAYS);
  }

  // Deliberation overrides
  if (process.env.MIN_DEBATE_ROUNDS) {
    if (!config.deliberation) config.deliberation = {} as any;
    config.deliberation!.minDebateRounds = parseInt(process.env.MIN_DEBATE_ROUNDS);
  }

  if (process.env.MAX_DEBATE_ROUNDS) {
    if (!config.deliberation) config.deliberation = {} as any;
    config.deliberation!.maxDebateRounds = parseInt(process.env.MAX_DEBATE_ROUNDS);
  }

  if (process.env.SESSION_TIMEOUT) {
    if (!config.deliberation) config.deliberation = {} as any;
    config.deliberation!.sessionTimeoutMs = parseInt(process.env.SESSION_TIMEOUT);
  }

  // Security overrides
  if (process.env.JWT_SECRET) {
    if (!config.security) config.security = {} as any;
    config.security!.jwtSecret = process.env.JWT_SECRET;
  }

  if (process.env.JWT_EXPIRES_IN) {
    if (!config.security) config.security = {} as any;
    config.security!.jwtExpiresIn = process.env.JWT_EXPIRES_IN;
  }

  // Logging overrides
  if (process.env.LOG_LEVEL) {
    if (!config.logging) config.logging = {} as any;
    const level = process.env.LOG_LEVEL.toLowerCase();
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
      config.logging!.level = level;
    }
  }

  if (process.env.LOG_FORMAT) {
    if (!config.logging) config.logging = {} as any;
    const format = process.env.LOG_FORMAT.toLowerCase();
    if (format === 'json' || format === 'text') {
      config.logging!.format = format;
    }
  }

  return config;
}

/**
 * Loads and validates the complete application configuration
 * Throws ConfigurationError if configuration is invalid
 */
export function loadConfig(): AppConfig {
  try {
    // Load base configuration for environment
    let config = loadBaseConfig();

    // Load model providers from environment
    const modelProviders = loadModelProviders();
    config.modelProviders = modelProviders;

    // Apply environment variable overrides
    config = applyEnvironmentOverrides(config);

    // Validate the complete configuration
    validateConfig(config as AppConfig);

    return config as AppConfig;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(`Failed to load configuration: ${error}`);
  }
}

/**
 * Gets a specific configuration section
 */
export function getConfig<K extends keyof AppConfig>(section: K): AppConfig[K] {
  const config = loadConfig();
  return config[section];
}

/**
 * Checks if a specific model provider is configured
 */
export function isProviderConfigured(provider: 'openai' | 'anthropic' | 'google'): boolean {
  const config = loadConfig();
  return config.modelProviders[provider] !== undefined;
}

/**
 * Gets the list of configured model providers
 */
export function getConfiguredProviders(): Array<'openai' | 'anthropic' | 'google'> {
  const config = loadConfig();
  const providers: Array<'openai' | 'anthropic' | 'google'> = [];

  if (config.modelProviders.openai) providers.push('openai');
  if (config.modelProviders.anthropic) providers.push('anthropic');
  if (config.modelProviders.google) providers.push('google');

  return providers;
}
