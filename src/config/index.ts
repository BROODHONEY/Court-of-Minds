/**
 * Configuration management module
 * Provides centralized configuration loading, validation, and secure credential storage
 * Validates Requirements: 8.1, 8.2
 */

export * from './types.js';
export * from './loader.js';
export * from './validator.js';
export * from './credentials.js';

// Re-export environment-specific configs for testing
export { developmentConfig } from './environments/development.js';
export { stagingConfig } from './environments/staging.js';
export { productionConfig } from './environments/production.js';
export { testConfig } from './environments/test.js';
