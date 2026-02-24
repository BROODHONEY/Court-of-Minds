/**
 * Test environment configuration
 * Validates Requirements: 8.1, 8.2
 */

import { AppConfig } from '../types.js';

export const testConfig: Partial<AppConfig> = {
  environment: 'test',
  
  server: {
    port: 3001,
    host: 'localhost',
    enableAuth: false,
    corsOrigins: ['http://localhost:3001'],
  },

  database: {
    host: 'localhost',
    port: 5432,
    database: 'court_of_minds_test',
    user: 'postgres',
    password: 'postgres',
    ssl: false,
    maxConnections: 5,
    connectionTimeout: 3000,
  },

  modelBehavior: {
    timeout: 5000, // Shorter for tests
    maxTokens: 500,
    temperature: 0.7,
    retryAttempts: 1, // Fewer retries for tests
    retryDelay: 100,
  },

  session: {
    retentionDays: 1,
    cleanupIntervalHours: 1,
    maxConcurrentSessions: 5,
  },

  deliberation: {
    minDebateRounds: 1,
    maxDebateRounds: 3,
    sessionTimeoutMs: 30000, // 30 seconds for tests
    analysisTimeoutMs: 5000,
    debateRoundTimeoutMs: 10000,
    consensusTimeoutMs: 10000,
    convergenceThreshold: 0.2,
  },

  security: {
    enableAuth: false,
    jwtExpiresIn: '1h',
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 1000, // No real rate limiting in tests
  },

  logging: {
    level: 'error', // Quiet during tests
    format: 'text',
    enableConsole: false,
    enableFile: false,
  },
};
