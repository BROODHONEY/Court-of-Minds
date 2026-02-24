/**
 * QueryRouter Unit Tests
 * 
 * Tests for query routing logic, validation, and model selection
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { QueryRouter, QueryHandler } from '../QueryRouter.js';
import { ModelRegistry } from '../ModelRegistry.js';
import { InMemorySessionStore } from '../SessionStore.js';
import type { Query, Model, SessionResult, ModelConfig } from '../../models/types.js';

// Mock query handler for testing
class MockQueryHandler implements QueryHandler {
  public lastQuery: Query | null = null;
  public lastModels: Model[] | null = null;

  async handle(query: Query, models: Model[]): Promise<SessionResult> {
    this.lastQuery = query;
    this.lastModels = models;

    return {
      sessionId: 'test-session-id',
      result: 'Mock result',
      session: {
        id: 'test-session-id',
        userId: query.userId,
        query,
        mode: models.length === 1 ? 'single' : 'multi',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }
}

describe('QueryRouter', () => {
  let router: QueryRouter;
  let sessionStore: InMemorySessionStore;
  let modelRegistry: ModelRegistry;
  let directHandler: MockQueryHandler;
  let deliberationHandler: MockQueryHandler;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    modelRegistry = new ModelRegistry();
    directHandler = new MockQueryHandler();
    deliberationHandler = new MockQueryHandler();

    router = new QueryRouter(
      sessionStore,
      modelRegistry,
      directHandler,
      deliberationHandler
    );

    // Register test models
    const modelConfigs: ModelConfig[] = [
      {
        id: 'model-1',
        provider: 'openai',
        apiKey: 'test-key-1',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      },
      {
        id: 'model-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        modelName: 'claude-3',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      },
      {
        id: 'model-3',
        provider: 'google',
        apiKey: 'test-key-3',
        modelName: 'gemini-pro',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      },
      {
        id: 'model-disabled',
        provider: 'openai',
        apiKey: 'test-key-disabled',
        modelName: 'gpt-3.5',
        enabled: false,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      },
    ];

    modelConfigs.forEach((config) => modelRegistry.registerModel(config));
  });

  describe('Query Validation', () => {
    it('should reject query with empty text', async () => {
      const query: Query = {
        id: 'query-1',
        text: '',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'Query text is required'
      );
    });

    it('should reject query with empty userId', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: '',
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should reject query with empty id', async () => {
      const query: Query = {
        id: '',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'Query ID is required'
      );
    });
  });

  describe('Single-Model Mode', () => {
    it('should route to direct handler with exactly one model', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-1'],
        timestamp: new Date(),
      };

      await router.route(query, 'single');

      expect(directHandler.lastQuery).toBe(query);
      expect(directHandler.lastModels).toHaveLength(1);
      expect(directHandler.lastModels![0].id).toBe('model-1');
    });

    it('should reject single-model mode without selected model', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'Single-model mode requires exactly one model to be selected'
      );
    });

    it('should reject single-model mode with multiple models', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-1', 'model-2'],
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'Single-model mode requires exactly one model to be selected'
      );
    });

    it('should reject single-model mode with disabled model', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-disabled'],
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'Model is disabled: model-disabled'
      );
    });

    it('should reject single-model mode with non-existent model', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['non-existent'],
        timestamp: new Date(),
      };

      await expect(router.route(query, 'single')).rejects.toThrow(
        'Model not found: non-existent'
      );
    });
  });

  describe('Multi-Model Mode', () => {
    it('should route to deliberation handler with multiple models', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-1', 'model-2'],
        timestamp: new Date(),
      };

      await router.route(query, 'multi');

      expect(deliberationHandler.lastQuery).toBe(query);
      expect(deliberationHandler.lastModels).toHaveLength(2);
      expect(deliberationHandler.lastModels!.map((m) => m.id)).toEqual([
        'model-1',
        'model-2',
      ]);
    });

    it('should use all enabled models when no selection provided', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await router.route(query, 'multi');

      expect(deliberationHandler.lastModels).toHaveLength(3);
      expect(deliberationHandler.lastModels!.map((m) => m.id).sort()).toEqual([
        'model-1',
        'model-2',
        'model-3',
      ]);
    });

    it('should reject multi-model mode with fewer than 2 models', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-1'],
        timestamp: new Date(),
      };

      await expect(router.route(query, 'multi')).rejects.toThrow(
        'Multi-model mode requires at least 2 models, got 1'
      );
    });

    it('should reject multi-model mode with more than 10 models', async () => {
      // Register 11 models
      for (let i = 4; i <= 11; i++) {
        modelRegistry.registerModel({
          id: `model-${i}`,
          provider: 'openai',
          apiKey: `test-key-${i}`,
          modelName: 'gpt-4',
          enabled: true,
          maxTokens: 1000,
          temperature: 0.7,
          timeout: 30,
        });
      }

      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await expect(router.route(query, 'multi')).rejects.toThrow(
        'Multi-model mode supports maximum 10 models, got 11'
      );
    });

    it('should reject multi-model mode with disabled model in selection', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-1', 'model-disabled'],
        timestamp: new Date(),
      };

      await expect(router.route(query, 'multi')).rejects.toThrow(
        'Model is disabled: model-disabled'
      );
    });

    it('should reject multi-model mode with non-existent model in selection', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        selectedModels: ['model-1', 'non-existent'],
        timestamp: new Date(),
      };

      await expect(router.route(query, 'multi')).rejects.toThrow(
        'Model not found: non-existent'
      );
    });
  });

  describe('Model Retrieval', () => {
    it('should return all available models', () => {
      const models = router.getAvailableModels();
      expect(models).toHaveLength(4);
    });

    it('should return only enabled models', () => {
      const models = router.getEnabledModels();
      expect(models).toHaveLength(3);
      expect(models.every((m) => m.enabled)).toBe(true);
    });
  });
});
