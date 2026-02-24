/**
 * Staging environment configuration
 * Validates Requirements: 8.1, 8.2
 */

import { AppConfig } from '../types.js';

export const stagingConfig: Partial<AppConfig> = {
  environment: 'staging',
  
  server: {
    port: 3000,
    host: '0.0.0.0',
    enableAuth: true,
    corsOrigins: ['https://staging.courtofminds.example.com'],
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'court_of_minds_staging',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: true,
    maxConnections: 20,
    connectionTimeout: 10000,
  },

  modelBehavior: {
    timeout: 30000,
    maxTokens: 2000,
    temperature: 0.7,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  session: {
    retentionDays: 30,
    cleanupIntervalHours: 12,
    maxConcurrentSessions: 50,
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
    enableAuth: true,
    jwtExpiresIn: '12h',
    rateLimitWindowMs: 60000, // 1 minute
    rateLimitMaxRequests: 50,
  },

  logging: {
    level: 'info',
    format: 'json',
    enableConsole: true,
    enableFile: true,
    filePath: '/var/log/court-of-minds/app.log',
  },
};
