/**
 * Unit tests for ResponseCollector
 * 
 * Tests specific examples, edge cases, and error conditions for response collection.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResponseCollector } from './ResponseCollector.js';
import type { Query, Model, ModelAdapter, ModelResponse } from '../models/types.js';

// Mock adapter factory
function createMockAdapter(
  modelId: string,
  responseText: string,
  delay: number = 0,
  shouldFail: boolean = false
): ModelAdapter {
  return {
    async generateResponse(prompt: string): Promise<ModelResponse> {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      if (shouldFail) {
        throw new Error(`Mock failure for ${modelId}`);
      }

      return {
        modelId,
        text: responseText,
        tokens: responseText.split(' ').length,
        latency: delay,
        timestamp: new Date(),
      };
    },
    getModelInfo() {
      return {
        provider: 'mock',
        modelName: modelId,
        capabilities: ['text-generation'],
      };
    },
  };
}

// Mock model factory
function createMockModel(
  id: string,
  responseText: string = 'Mock response',
  delay: number = 0,
  shouldFail: boolean = false
): Model {
  return {
    id,
    provider: 'mock',
    name: `Mock Model ${id}`,
    enabled: true,
    adapter: createMockAdapter(id, responseText, delay, shouldFail),
  };
}

describe('ResponseCollector', () => {
  let collector: ResponseCollector;
  let mockQuery: Query;

  beforeEach(() => {
    collector = new ResponseCollector();
    mockQuery = {
      id: 'query-1',
      text: 'What is the meaning of life?',
      userId: 'user-1',
      timestamp: new Date(),
    };
  });

  describe('successful collection', () => {
    it('should collect responses from all models in parallel', async () => {
      const models = [
        createMockModel('model-1', 'Response 1', 100),
        createMockModel('model-2', 'Response 2', 100),
        createMockModel('model-3', 'Response 3', 100),
      ];

      const startTime = Date.now();
      const result = await collector.collectResponses(mockQuery, models);
      const duration = Date.now() - startTime;

      // Should complete in ~100ms (parallel) not ~300ms (sequential)
      expect(duration).toBeLessThan(250);
      expect(result.responses).toHaveLength(3);
      expect(result.failures).toHaveLength(0);
      expect(result.responses.map(r => r.modelId)).toEqual(['model-1', 'model-2', 'model-3']);
    });

    it('should collect responses with correct metadata', async () => {
      const models = [
        createMockModel('model-1', 'Response from model 1'),
        createMockModel('model-2', 'Response from model 2'),
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(2);
      
      result.responses.forEach(response => {
        expect(response).toHaveProperty('modelId');
        expect(response).toHaveProperty('text');
        expect(response).toHaveProperty('tokens');
        expect(response).toHaveProperty('latency');
        expect(response).toHaveProperty('timestamp');
        expect(response.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should handle exactly 2 models (minimum)', async () => {
      const models = [
        createMockModel('model-1', 'Response 1'),
        createMockModel('model-2', 'Response 2'),
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(2);
      expect(result.failures).toHaveLength(0);
    });

    it('should handle 10 models (maximum)', async () => {
      const models = Array.from({ length: 10 }, (_, i) =>
        createMockModel(`model-${i + 1}`, `Response ${i + 1}`)
      );

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(10);
      expect(result.failures).toHaveLength(0);
    });
  });

  describe('partial failures', () => {
    it('should continue if at least 2 models succeed', async () => {
      const models = [
        createMockModel('model-1', 'Response 1'),
        createMockModel('model-2', 'Response 2'),
        createMockModel('model-3', '', 0, true), // This one fails
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(2);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].modelId).toBe('model-3');
      expect(result.failures[0].error).toContain('Mock failure');
    });

    it('should log all failures with timestamps', async () => {
      const models = [
        createMockModel('model-1', 'Response 1'),
        createMockModel('model-2', 'Response 2'),
        createMockModel('model-3', '', 0, true),
        createMockModel('model-4', '', 0, true),
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(2);
      expect(result.failures).toHaveLength(2);
      
      result.failures.forEach(failure => {
        expect(failure).toHaveProperty('modelId');
        expect(failure).toHaveProperty('error');
        expect(failure).toHaveProperty('timestamp');
        expect(failure.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should handle majority failures (3 fail, 2 succeed)', async () => {
      const models = [
        createMockModel('model-1', 'Response 1'),
        createMockModel('model-2', 'Response 2'),
        createMockModel('model-3', '', 0, true),
        createMockModel('model-4', '', 0, true),
        createMockModel('model-5', '', 0, true),
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(2);
      expect(result.failures).toHaveLength(3);
    });
  });

  describe('timeout handling', () => {
    it('should timeout models that exceed 30 seconds', async () => {
      const models = [
        createMockModel('model-1', 'Response 1', 100),
        createMockModel('model-2', 'Response 2', 100),
        createMockModel('model-3', 'Response 3', 35000), // Exceeds 30s timeout
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.responses).toHaveLength(2);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].modelId).toBe('model-3');
      expect(result.failures[0].error).toContain('exceeded 30-second timeout');
    }, 35000); // Set test timeout to 35 seconds

    it('should complete quickly when slow model times out', async () => {
      const models = [
        createMockModel('model-1', 'Response 1', 100),
        createMockModel('model-2', 'Response 2', 100),
        createMockModel('model-3', 'Response 3', 35000), // Times out
      ];

      const startTime = Date.now();
      const result = await collector.collectResponses(mockQuery, models);
      const duration = Date.now() - startTime;

      // Should complete in ~30s (timeout) not ~35s (full delay)
      expect(duration).toBeGreaterThan(29000);
      expect(duration).toBeLessThan(32000);
      expect(result.responses).toHaveLength(2);
    }, 35000); // Set test timeout to 35 seconds
  });

  describe('error cases', () => {
    it('should throw error if fewer than 2 models succeed', async () => {
      const models = [
        createMockModel('model-1', 'Response 1'),
        createMockModel('model-2', '', 0, true),
        createMockModel('model-3', '', 0, true),
      ];

      await expect(collector.collectResponses(mockQuery, models)).rejects.toThrow(
        'Insufficient responses: got 1, need at least 2'
      );
    });

    it('should throw error if all models fail', async () => {
      const models = [
        createMockModel('model-1', '', 0, true),
        createMockModel('model-2', '', 0, true),
        createMockModel('model-3', '', 0, true),
      ];

      await expect(collector.collectResponses(mockQuery, models)).rejects.toThrow(
        'Insufficient responses: got 0, need at least 2'
      );
    });

    it('should throw error if no models provided', async () => {
      await expect(collector.collectResponses(mockQuery, [])).rejects.toThrow(
        'No models provided for response collection'
      );
    });

    it('should include failure details in error message', async () => {
      const models = [
        createMockModel('model-1', '', 0, true),
        createMockModel('model-2', '', 0, true),
      ];

      await expect(collector.collectResponses(mockQuery, models)).rejects.toThrow(
        /model-1.*Mock failure.*model-2.*Mock failure/
      );
    });
  });

  describe('model independence', () => {
    it('should not provide context to models during initial collection', async () => {
      const adapter1 = createMockAdapter('model-1', 'Response 1');
      const adapter2 = createMockAdapter('model-2', 'Response 2');
      
      const spy1 = jest.spyOn(adapter1, 'generateResponse');
      const spy2 = jest.spyOn(adapter2, 'generateResponse');

      const models: Model[] = [
        { id: 'model-1', provider: 'mock', name: 'Model 1', enabled: true, adapter: adapter1 },
        { id: 'model-2', provider: 'mock', name: 'Model 2', enabled: true, adapter: adapter2 },
      ];

      await collector.collectResponses(mockQuery, models);

      // Verify adapters were called with only the query text, no context
      expect(spy1).toHaveBeenCalledWith(mockQuery.text);
      expect(spy2).toHaveBeenCalledWith(mockQuery.text);
      
      // Verify no second argument (context) was passed
      expect(spy1).toHaveBeenCalledWith(expect.any(String));
      expect(spy2).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('duration tracking', () => {
    it('should track total collection duration', async () => {
      const models = [
        createMockModel('model-1', 'Response 1', 100),
        createMockModel('model-2', 'Response 2', 150),
      ];

      const result = await collector.collectResponses(mockQuery, models);

      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(100); // At least as long as longest model
      expect(result.duration).toBeLessThan(300); // But not sum of all models (parallel)
    });
  });
});
