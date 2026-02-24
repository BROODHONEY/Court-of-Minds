/**
 * ModelRegistry Tests
 * 
 * Tests for model registration, retrieval, health checks, and enable/disable operations
 */

import { ModelRegistry } from './ModelRegistry.js';
import type { ModelConfig } from '../models/types.js';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('Model Registration', () => {
    it('should register a model with valid configuration', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-api-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      registry.registerModel(config);

      const model = registry.getModel('gpt-4');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('gpt-4');
      expect(model?.provider).toBe('openai');
      expect(model?.enabled).toBe(true);
    });

    it('should throw error when API key is missing', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: '',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      expect(() => registry.registerModel(config)).toThrow('API key is required');
    });

    it('should throw error when model ID is missing', () => {
      const config: ModelConfig = {
        id: '',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      expect(() => registry.registerModel(config)).toThrow('Model ID is required');
    });

    it('should throw error when model name is missing', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: '',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      expect(() => registry.registerModel(config)).toThrow('Model name is required');
    });

    it('should support OpenAI provider', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      registry.registerModel(config);
      const model = registry.getModel('gpt-4');
      expect(model?.provider).toBe('openai');
    });

    it('should support Anthropic provider', () => {
      const config: ModelConfig = {
        id: 'claude-3',
        provider: 'anthropic',
        apiKey: 'test-key',
        modelName: 'claude-3-opus',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      registry.registerModel(config);
      const model = registry.getModel('claude-3');
      expect(model?.provider).toBe('anthropic');
    });

    it('should support Google provider', () => {
      const config: ModelConfig = {
        id: 'gemini-pro',
        provider: 'google',
        apiKey: 'test-key',
        modelName: 'gemini-pro',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      registry.registerModel(config);
      const model = registry.getModel('gemini-pro');
      expect(model?.provider).toBe('google');
    });

    it('should support custom provider', () => {
      const config: ModelConfig = {
        id: 'custom-model',
        provider: 'custom',
        apiKey: 'test-key',
        modelName: 'my-custom-model',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      registry.registerModel(config);
      const model = registry.getModel('custom-model');
      expect(model?.provider).toBe('custom');
    });

    it('should throw error for unsupported provider', () => {
      const config = {
        id: 'test',
        provider: 'unsupported' as any,
        apiKey: 'test-key',
        modelName: 'test-model',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      expect(() => registry.registerModel(config)).toThrow('Unsupported provider');
    });
  });

  describe('Model Retrieval', () => {
    beforeEach(() => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config);
    });

    it('should retrieve a registered model by ID', () => {
      const model = registry.getModel('gpt-4');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('gpt-4');
    });

    it('should return null for non-existent model', () => {
      const model = registry.getModel('non-existent');
      expect(model).toBeNull();
    });

    it('should return all available models', () => {
      const config2: ModelConfig = {
        id: 'claude-3',
        provider: 'anthropic',
        apiKey: 'test-key',
        modelName: 'claude-3-opus',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config2);

      const models = registry.getAvailableModels();
      expect(models).toHaveLength(2);
      expect(models.map(m => m.id)).toContain('gpt-4');
      expect(models.map(m => m.id)).toContain('claude-3');
    });

    it('should return empty array when no models registered', () => {
      const emptyRegistry = new ModelRegistry();
      const models = emptyRegistry.getAvailableModels();
      expect(models).toHaveLength(0);
    });
  });

  describe('Enable/Disable Operations', () => {
    beforeEach(() => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config);
    });

    it('should disable a model', () => {
      registry.disableModel('gpt-4');
      const model = registry.getModel('gpt-4');
      expect(model?.enabled).toBe(false);
    });

    it('should enable a model', () => {
      registry.disableModel('gpt-4');
      registry.enableModel('gpt-4');
      const model = registry.getModel('gpt-4');
      expect(model?.enabled).toBe(true);
    });

    it('should throw error when disabling non-existent model', () => {
      expect(() => registry.disableModel('non-existent')).toThrow('Model not found');
    });

    it('should throw error when enabling non-existent model', () => {
      expect(() => registry.enableModel('non-existent')).toThrow('Model not found');
    });

    it('should exclude disabled models from enabled models list', () => {
      const config2: ModelConfig = {
        id: 'claude-3',
        provider: 'anthropic',
        apiKey: 'test-key',
        modelName: 'claude-3-opus',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config2);

      registry.disableModel('gpt-4');

      const enabledModels = registry.getEnabledModels();
      expect(enabledModels).toHaveLength(1);
      expect(enabledModels[0].id).toBe('claude-3');
    });

    it('should include disabled models in available models list', () => {
      registry.disableModel('gpt-4');

      const allModels = registry.getAvailableModels();
      expect(allModels).toHaveLength(1);
      expect(allModels[0].id).toBe('gpt-4');
      expect(allModels[0].enabled).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return unhealthy status for non-existent model', async () => {
      const health = await registry.checkHealth('non-existent');
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Model not found');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return health status with timestamp', async () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config);

      const health = await registry.checkHealth('gpt-4');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    // Note: Actual health check with real API would require mocking or integration tests
    // This test verifies the structure but will fail on actual API call without valid credentials
    it('should handle health check errors gracefully', async () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'invalid-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 1, // Very short timeout to force failure
      };
      registry.registerModel(config);

      const health = await registry.checkHealth('gpt-4');
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should remove a model from registry', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config);

      const removed = registry.removeModel('gpt-4');
      expect(removed).toBe(true);
      expect(registry.getModel('gpt-4')).toBeNull();
    });

    it('should return false when removing non-existent model', () => {
      const removed = registry.removeModel('non-existent');
      expect(removed).toBe(false);
    });

    it('should clear all models', () => {
      const config1: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      const config2: ModelConfig = {
        id: 'claude-3',
        provider: 'anthropic',
        apiKey: 'test-key',
        modelName: 'claude-3-opus',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config1);
      registry.registerModel(config2);

      registry.clear();
      expect(registry.getModelCount()).toBe(0);
      expect(registry.getAvailableModels()).toHaveLength(0);
    });

    it('should return correct model count', () => {
      expect(registry.getModelCount()).toBe(0);

      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config);

      expect(registry.getModelCount()).toBe(1);
    });

    it('should return correct enabled model count', () => {
      const config1: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      const config2: ModelConfig = {
        id: 'claude-3',
        provider: 'anthropic',
        apiKey: 'test-key',
        modelName: 'claude-3-opus',
        enabled: false,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      registry.registerModel(config1);
      registry.registerModel(config2);

      expect(registry.getEnabledModelCount()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle registering model with same ID twice (overwrite)', () => {
      const config1: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key-1',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };
      const config2: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key-2',
        modelName: 'gpt-4-turbo',
        enabled: false,
        maxTokens: 2000,
        temperature: 0.5,
        timeout: 60,
      };

      registry.registerModel(config1);
      registry.registerModel(config2);

      expect(registry.getModelCount()).toBe(1);
      const model = registry.getModel('gpt-4');
      expect(model?.name).toBe('gpt-4-turbo');
      expect(model?.enabled).toBe(false);
    });

    it('should handle whitespace-only API key', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: '   ',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30,
      };

      expect(() => registry.registerModel(config)).toThrow('API key is required');
    });

    it('should handle model with zero timeout', () => {
      const config: ModelConfig = {
        id: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-4',
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 0,
      };

      registry.registerModel(config);
      const model = registry.getModel('gpt-4');
      expect(model).not.toBeNull();
    });
  });
});
