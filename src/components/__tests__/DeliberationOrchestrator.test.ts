/**
 * DeliberationOrchestrator Unit Tests
 * 
 * Tests for multi-model deliberation orchestration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DeliberationOrchestrator } from '../DeliberationOrchestrator.js';
import { InMemorySessionStore } from '../SessionStore.js';
import type { Query, Model, ModelAdapter, ModelResponse, ModelInfo, Context } from '../../models/types.js';

// Mock model adapter for testing
class MockModelAdapter implements ModelAdapter {
  private callCount = 0;

  constructor(
    private modelId: string,
    private shouldFail: boolean = false,
    private delay: number = 0
  ) {}

  async generateResponse(prompt: string, context?: Context): Promise<ModelResponse> {
    this.callCount++;

    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error(`Mock adapter failure for ${this.modelId}`);
    }

    // Generate different responses based on context
    let responseText = `Response from ${this.modelId}: ${prompt.substring(0, 50)}`;
    
    if (context?.analysisReport) {
      responseText = `Debate response from ${this.modelId}`;
    }
    
    if (context?.debateHistory) {
      responseText = `Consensus proposal from ${this.modelId}`;
    }

    return {
      modelId: this.modelId,
      text: responseText,
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

  getCallCount(): number {
    return this.callCount;
  }
}

describe('DeliberationOrchestrator', () => {
  let orchestrator: DeliberationOrchestrator;
  let sessionStore: InMemorySessionStore;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    orchestrator = new DeliberationOrchestrator(sessionStore);
  });

  describe('Successful Deliberation', () => {
    it('should complete full deliberation pipeline', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'What is the best approach to solve this problem?',
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

      const result = await orchestrator.handle(query, models);

      expect(result.sessionId).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.session.status).toBe('completed');
      expect(result.session.mode).toBe('multi');
      expect(result.session.responses).toBeDefined();
      expect(result.session.analysis).toBeDefined();
      expect(result.session.debate).toBeDefined();
      expect(result.session.consensus).toBeDefined();
      expect(result.session.completedAt).toBeDefined();
    }, 30000);

    it('should update session status through all phases', async () => {
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

      const result = await orchestrator.handle(query, models);

      // Final status should be completed
      expect(result.session.status).toBe('completed');

      // All phase data should be present
      expect(result.session.responses).toHaveLength(2);
      expect(result.session.analysis).toBeDefined();
      expect(result.session.debate).toBeDefined();
      expect(result.session.consensus).toBeDefined();
    }, 30000);

    it('should handle 3 models successfully', async () => {
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
        {
          id: 'model-3',
          provider: 'google',
          name: 'gemini-pro',
          enabled: true,
          adapter: new MockModelAdapter('model-3'),
        },
      ];

      const result = await orchestrator.handle(query, models);

      expect(result.session.responses).toHaveLength(3);
      expect(result.session.status).toBe('completed');
    }, 30000);
  });

  describe('Validation', () => {
    it('should reject fewer than 2 models', async () => {
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
      ];

      await expect(orchestrator.handle(query, models)).rejects.toThrow(
        'Multi-model mode requires at least 2 models, got 1'
      );
    });

    it('should reject more than 10 models', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const models: Model[] = [];
      for (let i = 1; i <= 11; i++) {
        models.push({
          id: `model-${i}`,
          provider: 'openai',
          name: `gpt-${i}`,
          enabled: true,
          adapter: new MockModelAdapter(`model-${i}`),
        });
      }

      await expect(orchestrator.handle(query, models)).rejects.toThrow(
        'Multi-model mode supports maximum 10 models, got 11'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle partial model failures during collection', async () => {
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
          adapter: new MockModelAdapter('model-2', true), // This one fails
        },
        {
          id: 'model-3',
          provider: 'google',
          name: 'gemini-pro',
          enabled: true,
          adapter: new MockModelAdapter('model-3'),
        },
      ];

      const result = await orchestrator.handle(query, models);

      // Should continue with 2 successful responses
      expect(result.session.responses).toHaveLength(2);
      expect(result.session.errors).toHaveLength(1);
      expect(result.session.errors![0].modelId).toBe('model-2');
      expect(result.session.status).toBe('completed');
    }, 30000);

    it('should fail if fewer than 2 models respond successfully', async () => {
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
          adapter: new MockModelAdapter('model-1', true), // Fails
        },
        {
          id: 'model-2',
          provider: 'anthropic',
          name: 'claude-3',
          enabled: true,
          adapter: new MockModelAdapter('model-2', true), // Fails
        },
      ];

      await expect(orchestrator.handle(query, models)).rejects.toThrow(
        'Insufficient responses'
      );

      // Verify session was marked as failed
      const sessions = await sessionStore.listSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('failed');
    });
  });

  describe('Session Management', () => {
    it('should create session with multi mode', async () => {
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

      await orchestrator.handle(query, models);

      const sessions = await sessionStore.listSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].mode).toBe('multi');
    }, 30000);

    it('should persist all phase data in session', async () => {
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

      const result = await orchestrator.handle(query, models);

      // Retrieve session from store
      const session = await sessionStore.getSession(result.sessionId);

      expect(session).toBeDefined();
      expect(session!.responses).toBeDefined();
      expect(session!.analysis).toBeDefined();
      expect(session!.debate).toBeDefined();
      expect(session!.consensus).toBeDefined();
    }, 30000);
  });

  describe('Component Integration', () => {
    it('should have access to all component instances', () => {
      expect(orchestrator.getResponseCollector()).toBeDefined();
      expect(orchestrator.getAnalysisEngine()).toBeDefined();
      expect(orchestrator.getDebateOrchestrator()).toBeDefined();
      expect(orchestrator.getConsensusBuilder()).toBeDefined();
    });
  });
});
