/**
 * ModelRegistry Property-Based Tests
 * 
 * Property-based tests for model configuration validation using fast-check.
 * These tests validate universal properties that should hold across all inputs.
 * 
 * Feature: ai-court-system
 * Task: 3.3 Write property tests for model configuration
 */

import * as fc from 'fast-check';
import { ModelRegistry } from './ModelRegistry.js';
import type { ModelConfig } from '../models/types.js';

describe('ModelRegistry - Property-Based Tests', () => {
  describe('Property 31: API credentials requirement', () => {
    // Feature: ai-court-system, Property 31: API credentials requirement
    // **Validates: Requirements 8.2**
    it('should reject model registration without valid API credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary model configurations with invalid API keys
          fc.record({
            id: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
            apiKey: fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '), // Invalid API keys
            modelName: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            enabled: fc.boolean(),
            maxTokens: fc.integer({ min: 1, max: 10000 }),
            temperature: fc.float({ min: 0, max: 2 }),
            timeout: fc.integer({ min: 1, max: 300 }),
          }),
          async (config) => {
            const registry = new ModelRegistry();
            
            // Attempt to register model with invalid API key should throw
            expect(() => {
              registry.registerModel(config as ModelConfig);
            }).toThrow(/API key is required/);
            
            // Verify model was not registered
            expect(registry.getModel(config.id)).toBeNull();
            expect(registry.getModelCount()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept model registration with valid API credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary model configurations with valid API keys
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
            apiKey: fc.string({ minLength: 1 }).filter(key => key.trim().length > 0), // Valid API keys
            modelName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            enabled: fc.boolean(),
            maxTokens: fc.integer({ min: 1, max: 10000 }),
            temperature: fc.float({ min: 0, max: 2 }),
            timeout: fc.integer({ min: 1, max: 300 }),
          }),
          async (config) => {
            const registry = new ModelRegistry();
            
            // Registration with valid API key should succeed
            registry.registerModel(config as ModelConfig);
            
            // Verify model was registered
            const model = registry.getModel(config.id);
            expect(model).not.toBeNull();
            expect(model?.id).toBe(config.id);
            expect(registry.getModelCount()).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 32: Model enable/disable toggle', () => {
    // Feature: ai-court-system, Property 32: Model enable/disable toggle
    // **Validates: Requirements 8.3**
    it('should toggle model enabled state between true and false', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary model configuration
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
            apiKey: fc.string({ minLength: 1 }).filter(key => key.trim().length > 0),
            modelName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            enabled: fc.boolean(), // Initial enabled state
            maxTokens: fc.integer({ min: 1, max: 10000 }),
            temperature: fc.float({ min: 0, max: 2 }),
            timeout: fc.integer({ min: 1, max: 300 }),
          }),
          // Generate a sequence of toggle operations
          fc.array(fc.constantFrom('enable', 'disable'), { minLength: 1, maxLength: 10 }),
          async (config, operations) => {
            const registry = new ModelRegistry();
            registry.registerModel(config as ModelConfig);
            
            let expectedState = config.enabled;
            
            // Apply each toggle operation
            for (const operation of operations) {
              if (operation === 'enable') {
                registry.enableModel(config.id);
                expectedState = true;
              } else {
                registry.disableModel(config.id);
                expectedState = false;
              }
              
              // Verify state after each operation
              const model = registry.getModel(config.id);
              expect(model?.enabled).toBe(expectedState);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain enabled state across multiple models independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple model configurations
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
              apiKey: fc.string({ minLength: 1 }).filter(key => key.trim().length > 0),
              modelName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              enabled: fc.boolean(),
              maxTokens: fc.integer({ min: 1, max: 10000 }),
              temperature: fc.float({ min: 0, max: 2 }),
              timeout: fc.integer({ min: 1, max: 300 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (configs) => {
            // Ensure unique IDs
            const uniqueConfigs = configs.map((config, index) => ({
              ...config,
              id: `${config.id}-${index}`,
            }));
            
            const registry = new ModelRegistry();
            
            // Register all models
            uniqueConfigs.forEach(config => {
              registry.registerModel(config as ModelConfig);
            });
            
            // Toggle first model
            registry.disableModel(uniqueConfigs[0].id);
            
            // Verify first model is disabled
            expect(registry.getModel(uniqueConfigs[0].id)?.enabled).toBe(false);
            
            // Verify other models maintain their original state
            for (let i = 1; i < uniqueConfigs.length; i++) {
              const model = registry.getModel(uniqueConfigs[i].id);
              expect(model?.enabled).toBe(uniqueConfigs[i].enabled);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 33: Disabled model exclusion', () => {
    // Feature: ai-court-system, Property 33: Disabled model exclusion
    // **Validates: Requirements 8.4**
    it('should exclude disabled models from enabled models list', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple model configurations with varying enabled states
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
              apiKey: fc.string({ minLength: 1 }).filter(key => key.trim().length > 0),
              modelName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              enabled: fc.boolean(),
              maxTokens: fc.integer({ min: 1, max: 10000 }),
              temperature: fc.float({ min: 0, max: 2 }),
              timeout: fc.integer({ min: 1, max: 300 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (configs) => {
            // Ensure unique IDs
            const uniqueConfigs = configs.map((config, index) => ({
              ...config,
              id: `${config.id}-${index}`,
            }));
            
            const registry = new ModelRegistry();
            
            // Register all models
            uniqueConfigs.forEach(config => {
              registry.registerModel(config as ModelConfig);
            });
            
            // Get enabled models
            const enabledModels = registry.getEnabledModels();
            const enabledIds = enabledModels.map(m => m.id);
            
            // Verify all enabled models are actually enabled
            enabledModels.forEach(model => {
              expect(model.enabled).toBe(true);
            });
            
            // Verify all disabled models are excluded
            uniqueConfigs.forEach(config => {
              if (!config.enabled) {
                expect(enabledIds).not.toContain(config.id);
              } else {
                expect(enabledIds).toContain(config.id);
              }
            });
            
            // Verify count matches
            const expectedEnabledCount = uniqueConfigs.filter(c => c.enabled).length;
            expect(enabledModels.length).toBe(expectedEnabledCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all models (enabled and disabled) in available models list', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple model configurations
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
              apiKey: fc.string({ minLength: 1 }).filter(key => key.trim().length > 0),
              modelName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              enabled: fc.boolean(),
              maxTokens: fc.integer({ min: 1, max: 10000 }),
              temperature: fc.float({ min: 0, max: 2 }),
              timeout: fc.integer({ min: 1, max: 300 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (configs) => {
            // Ensure unique IDs
            const uniqueConfigs = configs.map((config, index) => ({
              ...config,
              id: `${config.id}-${index}`,
            }));
            
            const registry = new ModelRegistry();
            
            // Register all models
            uniqueConfigs.forEach(config => {
              registry.registerModel(config as ModelConfig);
            });
            
            // Get all available models
            const availableModels = registry.getAvailableModels();
            const availableIds = availableModels.map(m => m.id);
            
            // Verify all registered models are in available list
            uniqueConfigs.forEach(config => {
              expect(availableIds).toContain(config.id);
            });
            
            // Verify count matches
            expect(availableModels.length).toBe(uniqueConfigs.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should dynamically update enabled models list when models are disabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple enabled model configurations
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              provider: fc.constantFrom('openai', 'anthropic', 'google', 'custom'),
              apiKey: fc.string({ minLength: 1 }).filter(key => key.trim().length > 0),
              modelName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
              enabled: fc.constant(true), // All start enabled
              maxTokens: fc.integer({ min: 1, max: 10000 }),
              temperature: fc.float({ min: 0, max: 2 }),
              timeout: fc.integer({ min: 1, max: 300 }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          // Generate indices of models to disable
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 5 }),
          async (configs, indicesToDisable) => {
            // Ensure unique IDs
            const uniqueConfigs = configs.map((config, index) => ({
              ...config,
              id: `${config.id}-${index}`,
            }));
            
            const registry = new ModelRegistry();
            
            // Register all models (all enabled initially)
            uniqueConfigs.forEach(config => {
              registry.registerModel(config as ModelConfig);
            });
            
            // Initial check - all should be enabled
            expect(registry.getEnabledModels().length).toBe(uniqueConfigs.length);
            
            // Disable models at specified indices
            const disabledIds = new Set<string>();
            indicesToDisable.forEach(index => {
              if (index < uniqueConfigs.length) {
                const modelId = uniqueConfigs[index].id;
                registry.disableModel(modelId);
                disabledIds.add(modelId);
              }
            });
            
            // Get enabled models after disabling
            const enabledModels = registry.getEnabledModels();
            const enabledIds = enabledModels.map(m => m.id);
            
            // Verify disabled models are excluded
            disabledIds.forEach(disabledId => {
              expect(enabledIds).not.toContain(disabledId);
            });
            
            // Verify enabled models are included
            uniqueConfigs.forEach(config => {
              if (!disabledIds.has(config.id)) {
                expect(enabledIds).toContain(config.id);
              }
            });
            
            // Verify count is correct
            const expectedCount = uniqueConfigs.length - disabledIds.size;
            expect(enabledModels.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
