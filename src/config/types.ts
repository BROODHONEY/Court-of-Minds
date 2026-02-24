/**
 * Configuration type definitions
 * Validates Requirements: 8.1, 8.2
 */

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  enableAuth: boolean;
  adminApiKey?: string;
  corsOrigins: string[];
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
}

/**
 * Model provider configuration
 */
export interface ModelProviderConfig {
  openai?: {
    apiKey: string;
    organization?: string;
    models: string[];
  };
  anthropic?: {
    apiKey: string;
    models: string[];
  };
  google?: {
    apiKey: string;
    models: string[];
  };
}

/**
 * Model behavior configuration
 */
export interface ModelBehaviorConfig {
  timeout: number;
  maxTokens: number;
  temperature: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  retentionDays: number;
  cleanupIntervalHours: number;
  maxConcurrentSessions: number;
}

/**
 * Deliberation configuration
 */
export interface DeliberationConfig {
  minDebateRounds: number;
  maxDebateRounds: number;
  sessionTimeoutMs: number;
  analysisTimeoutMs: number;
  debateRoundTimeoutMs: number;
  consensusTimeoutMs: number;
  convergenceThreshold: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  enableAuth: boolean;
  adminApiKey?: string;
  jwtSecret?: string;
  jwtExpiresIn: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}

/**
 * Complete application configuration
 */
export interface AppConfig {
  environment: 'development' | 'staging' | 'production' | 'test';
  server: ServerConfig;
  database: DatabaseConfig;
  modelProviders: ModelProviderConfig;
  modelBehavior: ModelBehaviorConfig;
  session: SessionConfig;
  deliberation: DeliberationConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
}

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
