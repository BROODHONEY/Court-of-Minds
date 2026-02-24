/**
 * Configuration validation utilities
 * Validates Requirements: 8.1, 8.2
 */

import { AppConfig, ConfigurationError } from './types.js';

/**
 * Validates the complete application configuration
 * Throws ConfigurationError if validation fails
 */
export function validateConfig(config: AppConfig): void {
  validateServerConfig(config.server);
  validateDatabaseConfig(config.database);
  validateModelProviders(config.modelProviders);
  validateModelBehavior(config.modelBehavior);
  validateSessionConfig(config.session);
  validateDeliberationConfig(config.deliberation);
  validateSecurityConfig(config.security);
  validateLoggingConfig(config.logging);
}

/**
 * Validates server configuration
 */
function validateServerConfig(config: AppConfig['server']): void {
  if (!config.port || config.port < 1 || config.port > 65535) {
    throw new ConfigurationError('Server port must be between 1 and 65535');
  }

  if (!config.host || config.host.trim() === '') {
    throw new ConfigurationError('Server host must be specified');
  }

  if (config.enableAuth && !config.adminApiKey) {
    throw new ConfigurationError('Admin API key is required when authentication is enabled');
  }

  if (config.adminApiKey && config.adminApiKey.length < 32) {
    throw new ConfigurationError('Admin API key must be at least 32 characters for security');
  }
}

/**
 * Validates database configuration
 */
function validateDatabaseConfig(config: AppConfig['database']): void {
  if (!config.host || config.host.trim() === '') {
    throw new ConfigurationError('Database host must be specified');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    throw new ConfigurationError('Database port must be between 1 and 65535');
  }

  if (!config.database || config.database.trim() === '') {
    throw new ConfigurationError('Database name must be specified');
  }

  if (!config.user || config.user.trim() === '') {
    throw new ConfigurationError('Database user must be specified');
  }

  if (!config.password || config.password.trim() === '') {
    throw new ConfigurationError('Database password must be specified');
  }

  if (config.maxConnections < 1) {
    throw new ConfigurationError('Database max connections must be at least 1');
  }

  if (config.connectionTimeout < 1000) {
    throw new ConfigurationError('Database connection timeout must be at least 1000ms');
  }
}

/**
 * Validates model provider configuration
 * Validates Requirement 8.2: API credentials requirement
 */
function validateModelProviders(config: AppConfig['modelProviders']): void {
  const hasAnyProvider = config.openai || config.anthropic || config.google;
  
  if (!hasAnyProvider) {
    throw new ConfigurationError(
      'At least one model provider (OpenAI, Anthropic, or Google) must be configured'
    );
  }

  // Validate OpenAI configuration
  if (config.openai) {
    if (!config.openai.apiKey || config.openai.apiKey.trim() === '') {
      throw new ConfigurationError('OpenAI API key is required when OpenAI provider is configured');
    }
    if (!config.openai.models || config.openai.models.length === 0) {
      throw new ConfigurationError('At least one OpenAI model must be specified');
    }
  }

  // Validate Anthropic configuration
  if (config.anthropic) {
    if (!config.anthropic.apiKey || config.anthropic.apiKey.trim() === '') {
      throw new ConfigurationError('Anthropic API key is required when Anthropic provider is configured');
    }
    if (!config.anthropic.models || config.anthropic.models.length === 0) {
      throw new ConfigurationError('At least one Anthropic model must be specified');
    }
  }

  // Validate Google configuration
  if (config.google) {
    if (!config.google.apiKey || config.google.apiKey.trim() === '') {
      throw new ConfigurationError('Google API key is required when Google provider is configured');
    }
    if (!config.google.models || config.google.models.length === 0) {
      throw new ConfigurationError('At least one Google model must be specified');
    }
  }
}

/**
 * Validates model behavior configuration
 */
function validateModelBehavior(config: AppConfig['modelBehavior']): void {
  if (config.timeout < 1000) {
    throw new ConfigurationError('Model timeout must be at least 1000ms');
  }

  if (config.maxTokens < 1) {
    throw new ConfigurationError('Model max tokens must be at least 1');
  }

  if (config.temperature < 0 || config.temperature > 2) {
    throw new ConfigurationError('Model temperature must be between 0 and 2');
  }

  if (config.retryAttempts < 0 || config.retryAttempts > 10) {
    throw new ConfigurationError('Model retry attempts must be between 0 and 10');
  }

  if (config.retryDelay < 100) {
    throw new ConfigurationError('Model retry delay must be at least 100ms');
  }
}

/**
 * Validates session configuration
 */
function validateSessionConfig(config: AppConfig['session']): void {
  if (config.retentionDays < 1) {
    throw new ConfigurationError('Session retention days must be at least 1');
  }

  if (config.cleanupIntervalHours < 1) {
    throw new ConfigurationError('Session cleanup interval must be at least 1 hour');
  }

  if (config.maxConcurrentSessions < 1) {
    throw new ConfigurationError('Max concurrent sessions must be at least 1');
  }
}

/**
 * Validates deliberation configuration
 */
function validateDeliberationConfig(config: AppConfig['deliberation']): void {
  if (config.minDebateRounds < 1) {
    throw new ConfigurationError('Minimum debate rounds must be at least 1');
  }

  if (config.maxDebateRounds < config.minDebateRounds) {
    throw new ConfigurationError('Maximum debate rounds must be >= minimum debate rounds');
  }

  if (config.maxDebateRounds > 10) {
    throw new ConfigurationError('Maximum debate rounds cannot exceed 10');
  }

  if (config.sessionTimeoutMs < 10000) {
    throw new ConfigurationError('Session timeout must be at least 10000ms');
  }

  if (config.analysisTimeoutMs < 1000) {
    throw new ConfigurationError('Analysis timeout must be at least 1000ms');
  }

  if (config.debateRoundTimeoutMs < 1000) {
    throw new ConfigurationError('Debate round timeout must be at least 1000ms');
  }

  if (config.consensusTimeoutMs < 1000) {
    throw new ConfigurationError('Consensus timeout must be at least 1000ms');
  }

  if (config.convergenceThreshold < 0 || config.convergenceThreshold > 1) {
    throw new ConfigurationError('Convergence threshold must be between 0 and 1');
  }
}

/**
 * Validates security configuration
 */
function validateSecurityConfig(config: AppConfig['security']): void {
  if (config.enableAuth) {
    if (!config.adminApiKey || config.adminApiKey.length < 32) {
      throw new ConfigurationError('Admin API key must be at least 32 characters when auth is enabled');
    }

    if (config.jwtSecret && config.jwtSecret.length < 32) {
      throw new ConfigurationError('JWT secret must be at least 32 characters');
    }
  }

  if (config.rateLimitWindowMs < 1000) {
    throw new ConfigurationError('Rate limit window must be at least 1000ms');
  }

  if (config.rateLimitMaxRequests < 1) {
    throw new ConfigurationError('Rate limit max requests must be at least 1');
  }
}

/**
 * Validates logging configuration
 */
function validateLoggingConfig(config: AppConfig['logging']): void {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(config.level)) {
    throw new ConfigurationError(`Log level must be one of: ${validLevels.join(', ')}`);
  }

  const validFormats = ['json', 'text'];
  if (!validFormats.includes(config.format)) {
    throw new ConfigurationError(`Log format must be one of: ${validFormats.join(', ')}`);
  }

  if (config.enableFile && !config.filePath) {
    throw new ConfigurationError('Log file path must be specified when file logging is enabled');
  }
}

/**
 * Validates that required environment variables are set
 */
export function validateEnvironmentVariables(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
