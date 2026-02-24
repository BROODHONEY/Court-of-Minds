/**
 * DirectQueryHandler Unit Tests
 * 
 * Tests for single-model query handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DirectQueryHandler } from '../DirectQueryHandler.js';
import { InMemorySessionStore } from '../SessionStore.js';
import type { Query, Model, ModelAdapter, ModelResponse, ModelInfo } from '../../models/types.js';

// Mock model adapter for testing
class MockModelAdapter implements ModelAdapter {
  constructor(
    private modelId: string,
    private shouldFail: boolean = false,
    private delay: number = 0
  ) {}

  async generateResponse(prompt: string): Promise<ModelResponse> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error('Mock adapter failure');
    }

    return {
      modelId: this.modelId,
      text: `Response from ${this.modelId}: ${prompt}`,
      tokens: 50,
      latency: this.delay,
      timestamp: new Date(),
    };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'mock',
      modelName: this.modelId,
      capabilities: ['text-generation'],
    };
  }
}

describe('DirectQueryHandler', () => {
  let handler: DirectQueryHandler;
  let sessionStore: InMemorySessionStore;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    handler = new DirectQueryHandler(sessionStore);
  });

  describe('Successful Query Handling', () => {
    it('should handle single-model query successfully', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'What is the capital of France?',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1'),
      };

      const result = await handler.handle(query, [model]);

      expect(result.sessionId).toBeDefined();
      expect(result.result).toContain('Response from model-1');
      expect(result.result).toContain(query.text);
      expect(result.session.status).toBe('completed');
      expect(result.session.mode).toBe('single');
      expect(result.session.responses).toHaveLength(1);
      expect(result.session.responses![0].modelId).toBe('model-1');
    });

    it('should return response directly without additional phases', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1'),
      };

      const result = await handler.handle(query, [model]);

      // Verify no analysis, debate, or consensus phases
      expect(result.session.analysis).toBeUndefined();
      expect(result.session.debate).toBeUndefined();
      expect(result.session.consensus).toBeUndefined();
    });

    it('should store minimal session data', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1'),
      };

      const result = await handler.handle(query, [model]);

      // Verify session has minimal data
      expect(result.session.query).toEqual(query);
      expect(result.session.mode).toBe('single');
      expect(result.session.responses).toHaveLength(1);
      expect(result.session.completedAt).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should reject if not exactly one model provided', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const models: Model[] = [
        {
          id: 'model-1',
          provider: 'openai',
          name: 'gpt-4',
          enabled: true,
          adapter: new MockModelAdapter('model-1'),
        },
        {
          id: 'model-2',
          provider: 'anthropic',
          name: 'claude-3',
          enabled: true,
          adapter: new MockModelAdapter('model-2'),
        },
      ];

      await expect(handler.handle(query, models)).rejects.toThrow(
        'DirectQueryHandler requires exactly 1 model, got 2'
      );
    });

    it('should handle model failure gracefully', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1', true), // shouldFail = true
      };

      await expect(handler.handle(query, [model])).rejects.toThrow(
        'Model model-1 failed'
      );

      // Verify session was marked as failed
      const sessions = await sessionStore.listSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('failed');
      expect(sessions[0].errors).toHaveLength(1);
      expect(sessions[0].errors![0].modelId).toBe('model-1');
    });

    it('should handle model timeout', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1', false, 31000), // 31 seconds delay
      };

      await expect(handler.handle(query, [model])).rejects.toThrow(
        'exceeded 30-second timeout'
      );

      // Verify session was marked as failed
      const sessions = await sessionStore.listSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('failed');
    }, 35000); // Increase test timeout to 35 seconds
  });

  describe('Session Management', () => {
    it('should create session with correct mode', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1'),
      };

      await handler.handle(query, [model]);

      const sessions = await sessionStore.listSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].mode).toBe('single');
    });

    it('should update session status to completed', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const model: Model = {
        id: 'model-1',
        provider: 'openai',
        name: 'gpt-4',
        enabled: true,
        adapter: new MockModelAdapter('model-1'),
      };

      await handler.handle(query, [model]);

      const sessions = await sessionStore.listSessions('user-1');
      expect(sessions[0].status).toBe('completed');
      expect(sessions[0].completedAt).toBeDefined();
    });
  });
});
