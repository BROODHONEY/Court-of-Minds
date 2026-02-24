/**
 * Court of Minds - Multi-model AI deliberation platform
 * Main application entry point
 * 
 * This module wires together all components and starts the server:
 * - Initializes database connection and runs migrations
 * - Sets up Model Registry with configured models
 * - Creates Session Store (PostgreSQL or in-memory)
 * - Initializes API server with all components
 * - Sets up WebSocket for real-time updates
 * - Configures automatic session cleanup
 * 
 * Validates Requirements: All (system integration)
 */

import dotenv from 'dotenv';
import { CourtOfMindsServer } from './api/server.js';
import { ModelRegistry } from './components/ModelRegistry.js';
import { PostgresSessionStore, InMemorySessionStore } from './components/SessionStore.js';
import { DatabaseMigrations } from './db/migrations.js';
import { scheduleSessionCleanup } from './utils/sessionCleanup.js';
import type { ModelConfig } from './models/types.js';

// Load environment variables
dotenv.config();

// Export types for external use
export * from './models/types.js';
export * from './adapters/index.js';
export { ModelRegistry } from './components/ModelRegistry.js';
export type { SessionStore } from './components/SessionStore.js';
export { InMemorySessionStore, PostgresSessionStore } from './components/SessionStore.js';
export { CourtOfMindsServer } from './api/server.js';

/**
 * Application configuration
 */
interface AppConfig {
  port: number;
  enableAuth: boolean;
  adminApiKey?: string;
  usePostgres: boolean;
  sessionRetentionDays: number;
}

/**
 * Load application configuration from environment
 */
function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000'),
    enableAuth: process.env.ENABLE_AUTH === 'true',
    adminApiKey: process.env.ADMIN_API_KEY,
    usePostgres: process.env.NODE_ENV !== 'test',
    sessionRetentionDays: parseInt(process.env.SESSION_RETENTION_DAYS || '30'),
  };
}

/**
 * Initialize database and run migrations
 */
async function initializeDatabase(usePostgres: boolean): Promise<PostgresSessionStore | InMemorySessionStore> {
  if (!usePostgres) {
    console.log('Using in-memory session store (development/test mode)');
    return new InMemorySessionStore();
  }

  console.log('Initializing PostgreSQL database...');
  
  const migrations = new DatabaseMigrations();
  
  // Check database connection
  const connected = await migrations.checkConnection();
  if (!connected) {
    console.error('Failed to connect to PostgreSQL database');
    console.log('Falling back to in-memory session store');
    return new InMemorySessionStore();
  }

  // Run migrations
  try {
    await migrations.runMigrations();
  } catch (error) {
    console.error('Database migration failed:', error);
    console.log('Falling back to in-memory session store');
    return new InMemorySessionStore();
  }

  // Create PostgreSQL session store
  const sessionStore = new PostgresSessionStore();
  await sessionStore.initialize();
  
  console.log('✓ PostgreSQL session store initialized');
  
  return sessionStore;
}

/**
 * Initialize Model Registry with configured models
 * Validates Requirements: 8.1, 8.2
 */
function initializeModelRegistry(): ModelRegistry {
  const registry = new ModelRegistry();

  console.log('Initializing Model Registry...');

  // Register OpenAI models if API key is provided
  if (process.env.OPENAI_API_KEY) {
    try {
      const openAIConfig: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.MODEL_TIMEOUT || '30'),
      };
      registry.registerModel(openAIConfig);
      console.log('✓ Registered OpenAI GPT-4');

      // Also register GPT-3.5 Turbo
      const gpt35Config: ModelConfig = {
        id: 'gpt-3.5-turbo',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-3.5-turbo',
        enabled: true,
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.MODEL_TIMEOUT || '30'),
      };
      registry.registerModel(gpt35Config);
      console.log('✓ Registered OpenAI GPT-3.5 Turbo');
    } catch (error) {
      console.error('Failed to register OpenAI models:', error);
    }
  }

  // Register Anthropic models if API key is provided
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const claudeConfig: ModelConfig = {
        id: 'claude-3-opus',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-opus-20240229',
        enabled: true,
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.MODEL_TIMEOUT || '30'),
      };
      registry.registerModel(claudeConfig);
      console.log('✓ Registered Anthropic Claude 3 Opus');

      // Also register Claude 3 Sonnet
      const sonnetConfig: ModelConfig = {
        id: 'claude-3-sonnet',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-sonnet-20240229',
        enabled: true,
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.MODEL_TIMEOUT || '30'),
      };
      registry.registerModel(sonnetConfig);
      console.log('✓ Registered Anthropic Claude 3 Sonnet');
    } catch (error) {
      console.error('Failed to register Anthropic models:', error);
    }
  }

  // Register Google models if API key is provided
  if (process.env.GOOGLE_API_KEY) {
    try {
      const geminiConfig: ModelConfig = {
        id: 'gemini-pro',
        provider: 'google',
        apiKey: process.env.GOOGLE_API_KEY,
        modelName: 'gemini-pro',
        enabled: true,
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
        timeout: parseInt(process.env.MODEL_TIMEOUT || '30'),
      };
      registry.registerModel(geminiConfig);
      console.log('✓ Registered Google Gemini Pro');
    } catch (error) {
      console.error('Failed to register Google models:', error);
    }
  }

  const modelCount = registry.getModelCount();
  const enabledCount = registry.getEnabledModelCount();

  if (modelCount === 0) {
    console.warn('⚠ No models registered! Please configure API keys in .env file');
    console.warn('  See .env.example for configuration options');
  } else {
    console.log(`✓ Model Registry initialized with ${modelCount} models (${enabledCount} enabled)`);
  }

  return registry;
}

/**
 * Main application startup
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Court of Minds - Multi-Model AI Deliberation Platform');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Load configuration
    const config = loadConfig();
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Port: ${config.port}`);
    console.log(`Authentication: ${config.enableAuth ? 'enabled' : 'disabled'}`);
    console.log('');

    // Initialize database and session store
    const sessionStore = await initializeDatabase(config.usePostgres);
    console.log('');

    // Initialize model registry
    const modelRegistry = initializeModelRegistry();
    console.log('');

    // Create and start server
    console.log('Starting API server...');
    const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
      port: config.port,
      enableAuth: config.enableAuth,
      adminApiKey: config.adminApiKey,
    });

    await server.start();
    console.log('');
    console.log('✓ Server started successfully');
    console.log(`✓ API available at http://localhost:${config.port}`);
    console.log(`✓ WebSocket available at ws://localhost:${config.port}/ws`);
    console.log(`✓ UI available at http://localhost:${config.port}`);
    console.log('');

    // Schedule automatic session cleanup (Requirement 6.5)
    if (config.usePostgres) {
      scheduleSessionCleanup(sessionStore, config.sessionRetentionDays);
      console.log(`✓ Automatic session cleanup scheduled (${config.sessionRetentionDays} day retention)`);
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('Court of Minds is ready to deliberate!');
    console.log('='.repeat(60));

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down gracefully...');
      
      try {
        await server.stop();
        
        if (sessionStore instanceof PostgresSessionStore) {
          await sessionStore.close();
        }
        
        console.log('✓ Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application if this is the main module
// Check both CommonJS and ES module patterns
main();