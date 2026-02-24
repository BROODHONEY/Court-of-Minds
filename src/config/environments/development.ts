/**
 * Development environment configuration
 * Validates Requirements: 8.1, 8.2
 */

import { AppConfig } from '../types.js';

export const developmentConfig: Partial<AppConfig> = {
  environment: 'development',
  
  server: {
    port: 3000,
    host: '0.0.0.0',
    enableAuth: false,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
  },

  database: {
    host: 'localhost',
    port: 5432,
    database: 'court_of_minds_dev',
    user: 'postgres',
    password: 'postgres',
    ssl: false,
    maxConnections: 10,
    connectionTimeout: 5000,
  },

  modelBehavior: {
    timeout: 30000,
    maxTokens: 2000,
    temperature: 0.7,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  session: {
    retentionDays: 7, // Shorter retention for dev
    cleanupIntervalHours: 24,
    maxConcurrentSessions: 10,
  },

  deliberation: {
    minDebateRounds: 1,
    maxDebateRounds: 5,
    sessionTimeoutMs: 300000, // 5 minutes
    analysisTimeoutMs: 10000, // 10 seconds
    debateRoundTimeoutMs: 60000, // 60 seconds
    consensusTimeoutMs: 60000, // 60 seconds
    convergenceThreshold: 0.2,
  },

  security: {
    enableAuth: false,
    jwtExpiresIn: '24h',
    rateLimitWindowMs: 60000, // 1 minute
    rateLimitMaxRequests: 100, // Generous for dev
  },

  logging: {
    level: 'debug',
    format: 'text',
    enableConsole: true,
    enableFile: false,
  },
};
