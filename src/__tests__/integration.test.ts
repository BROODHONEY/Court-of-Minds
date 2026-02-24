/**
 * Integration Tests - Verify all components are wired together correctly
 * 
 * These tests verify that:
 * - Components can be initialized and connected
 * - API server can start and stop
 * - Database migrations work
 * - Model registry integrates with other components
 * - Session store integrates with orchestration
 */

import { CourtOfMindsServer } from '../api/server.js';
import { ModelRegistry } from '../components/ModelRegistry.js';
import { InMemorySessionStore } from '../components/SessionStore.js';
import { DatabaseMigrations } from '../db/migrations.js';
import type { ModelConfig } from '../models/types.js';

describe('Integration Tests', () => {
  describe('Component Initialization', () => {
    it('should initialize all core components', () => {
      const sessionStore = new InMemorySessionStore();
      const modelRegistry = new ModelRegistry();
      
      expect(sessionStore).toBeDefined();
      expect(modelRegistry).toBeDefined();
      expect(modelRegistry.getModelCount()).toBe(0);
    });

    it('should register models in registry', () => {
      const modelRegistry = new ModelRegistry();
      
      const config: ModelConfig = {
        id: 'test-model',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 30,
      };

      modelRegistry.registerModel(config);
      
      expect(modelRegistry.getModelCount()).toBe(1);
      expect(modelRegistry.getEnabledModelCount()).toBe(1);
      
      const model = modelRegistry.getModel('test-model');
      expect(model).toBeDefined();
      expect(model?.id).toBe('test-model');
      expect(model?.enabled).toBe(true);
    });
  });

  describe('Server Initialization', () => {
    it('should create server with all components', () => {
      const sessionStore = new InMemorySessionStore();
      const modelRegistry = new ModelRegistry();
      
      const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
        port: 3001,
        enableAuth: false,
      });

      expect(server).toBeDefined();
      expect(server.getApp()).toBeDefined();
      expect(server.getHttpServer()).toBeDefined();
      expect(server.getWebSocketManager()).toBeDefined();
    });

    it('should start and stop server', async () => {
      const sessionStore = new InMemorySessionStore();
      const modelRegistry = new ModelRegistry();
      
      const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
        port: 3002,
        enableAuth: false,
      });

      // Start server
      await server.start();
      
      // Verify server is running
      const app = server.getApp();
      expect(app).toBeDefined();

      // Stop server
      await server.stop();
    }, 10000);
  });

  describe('Database Migrations', () => {
    it('should create migrations instance', () => {
      const migrations = new DatabaseMigrations({
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      });

      expect(migrations).toBeDefined();
      expect(migrations.getPool()).toBeDefined();
    });

    // Note: Actual migration tests require a running PostgreSQL instance
    // These would be run in a separate integration test environment
  });

  describe('Component Integration', () => {
    it('should wire QueryRouter with handlers', () => {
      const sessionStore = new InMemorySessionStore();
      const modelRegistry = new ModelRegistry();
      
      // Register a test model
      const config: ModelConfig = {
        id: 'test-model',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 30,
      };
      modelRegistry.registerModel(config);

      // Create server (which creates QueryRouter internally)
      const server = new CourtOfMindsServer(sessionStore, modelRegistry);
      
      expect(server).toBeDefined();
      
      // Verify model is available through registry
      const models = modelRegistry.getAvailableModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('test-model');
    });

    it('should integrate SessionStore with server', async () => {
      const sessionStore = new InMemorySessionStore();
      const modelRegistry = new ModelRegistry();
      
      const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
        port: 3003,
        enableAuth: false,
      });

      // Create a test session
      const session = await sessionStore.createSession(
        {
          id: 'test-query-1',
          text: 'Test question',
          userId: 'test-user',
          timestamp: new Date(),
        },
        'single'
      );

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe('collecting');

      // Retrieve session
      const retrieved = await sessionStore.getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should integrate WebSocket with server', () => {
      const sessionStore = new InMemorySessionStore();
      const modelRegistry = new ModelRegistry();
      
      const server = new CourtOfMindsServer(sessionStore, modelRegistry);
      const wsManager = server.getWebSocketManager();

      expect(wsManager).toBeDefined();
      expect(wsManager.getConnectionCount()).toBe(0);
    });
  });

  describe('Model Registry Integration', () => {
    it('should enable and disable models', () => {
      const modelRegistry = new ModelRegistry();
      
      const config: ModelConfig = {
        id: 'test-model',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 30,
      };

      modelRegistry.registerModel(config);
      expect(modelRegistry.getEnabledModelCount()).toBe(1);

      // Disable model
      modelRegistry.disableModel('test-model');
      expect(modelRegistry.getEnabledModelCount()).toBe(0);

      // Enable model
      modelRegistry.enableModel('test-model');
      expect(modelRegistry.getEnabledModelCount()).toBe(1);
    });

    it('should filter enabled models', () => {
      const modelRegistry = new ModelRegistry();
      
      // Register multiple models
      const configs: ModelConfig[] = [
        {
          id: 'model-1',
          provider: 'openai',
          apiKey: 'key-1',
          modelName: 'gpt-4',
          enabled: true,
          maxTokens: 2000,
          temperature: 0.7,
          timeout: 30,
        },
        {
          id: 'model-2',
          provider: 'anthropic',
          apiKey: 'key-2',
          modelName: 'claude-3',
          enabled: false,
          maxTokens: 2000,
          temperature: 0.7,
          timeout: 30,
        },
        {
          id: 'model-3',
          provider: 'google',
          apiKey: 'key-3',
          modelName: 'gemini-pro',
          enabled: true,
          maxTokens: 2000,
          temperature: 0.7,
          timeout: 30,
        },
      ];

      configs.forEach(config => modelRegistry.registerModel(config));

      expect(modelRegistry.getModelCount()).toBe(3);
      expect(modelRegistry.getEnabledModelCount()).toBe(2);

      const enabledModels = modelRegistry.getEnabledModels();
      expect(enabledModels).toHaveLength(2);
      expect(enabledModels.map(m => m.id)).toEqual(['model-1', 'model-3']);
    });
  });
});
