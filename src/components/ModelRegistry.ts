/**
 * ModelRegistry - Manages available AI models, configurations, and health status
 * 
 * This component is responsible for:
 * - Maintaining a registry of configured models
 * - Performing health checks on model endpoints
 * - Providing model instances to other components
 * - Handling model enable/disable operations
 * 
 * Validates Requirements: 8.1, 8.3, 8.4, 8.5
 */

import type { Model, ModelConfig, HealthStatus, ModelAdapter } from '../models/types.js';
import { OpenAIAdapter, AnthropicAdapter, GoogleAdapter, BaseModelAdapter } from '../adapters/index.js';

/**
 * Custom adapter for extensibility
 */
class CustomAdapter extends BaseModelAdapter {
  protected async generateResponseInternal(prompt: string): Promise<Omit<import('../models/types.js').ModelResponse, 'modelId' | 'latency' | 'timestamp'>> {
    throw new Error('Custom adapter not implemented');
  }

  getModelInfo(): import('../models/types.js').ModelInfo {
    return {
      provider: 'custom',
      modelName: 'custom-model',
      capabilities: ['text-generation'],
    };
  }
}

export class ModelRegistry {
  private models: Map<string, Model> = new Map();

  /**
   * Get all available models (both enabled and disabled)
   * @returns Array of all registered models
   */
  getAvailableModels(): Model[] {
    return Array.from(this.models.values());
  }

  /**
   * Get a specific model by ID
   * @param modelId The unique identifier of the model
   * @returns The model if found, null otherwise
   */
  getModel(modelId: string): Model | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Register a new model with the registry
   * Validates Requirements: 8.1 (provider support), 8.2 (API credentials)
   * 
   * @param config Model configuration
   * @throws Error if configuration is invalid or API key is missing
   */
  registerModel(config: ModelConfig): void {
    // Validate API credentials (Requirement 8.2)
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API key is required for model registration');
    }

    // Validate required fields
    if (!config.id || config.id.trim() === '') {
      throw new Error('Model ID is required');
    }

    if (!config.modelName || config.modelName.trim() === '') {
      throw new Error('Model name is required');
    }

    // Create appropriate adapter based on provider (Requirement 8.1)
    let adapter: ModelAdapter;
    
    switch (config.provider) {
      case 'openai':
        adapter = new OpenAIAdapter({
          modelId: config.id,
          apiKey: config.apiKey,
          modelName: config.modelName,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          timeout: config.timeout * 1000, // Convert seconds to milliseconds
        });
        break;
      
      case 'anthropic':
        adapter = new AnthropicAdapter({
          modelId: config.id,
          apiKey: config.apiKey,
          modelName: config.modelName,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          timeout: config.timeout * 1000,
        });
        break;
      
      case 'google':
        adapter = new GoogleAdapter({
          modelId: config.id,
          apiKey: config.apiKey,
          modelName: config.modelName,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          timeout: config.timeout * 1000,
        });
        break;
      
      case 'custom':
        adapter = new CustomAdapter(config.id, config.timeout * 1000);
        break;
      
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    // Create and store the model
    const model: Model = {
      id: config.id,
      provider: config.provider,
      name: config.modelName,
      enabled: config.enabled,
      adapter,
    };

    this.models.set(config.id, model);
  }

  /**
   * Disable a model, excluding it from multi-model sessions
   * Validates Requirements: 8.3 (enable/disable), 8.4 (exclusion when disabled)
   * 
   * @param modelId The ID of the model to disable
   * @throws Error if model not found
   */
  disableModel(modelId: string): void {
    const model = this.models.get(modelId);
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    model.enabled = false;
  }

  /**
   * Enable a model, making it available for multi-model sessions
   * Validates Requirement: 8.3 (enable/disable)
   * 
   * @param modelId The ID of the model to enable
   * @throws Error if model not found
   */
  enableModel(modelId: string): void {
    const model = this.models.get(modelId);
    
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    model.enabled = true;
  }

  /**
   * Check the health of a model by attempting a simple request
   * Validates Requirement: 8.5 (validate connectivity)
   * 
   * @param modelId The ID of the model to check
   * @returns Health status including response time or error
   */
  async checkHealth(modelId: string): Promise<HealthStatus> {
    const model = this.models.get(modelId);
    
    if (!model) {
      return {
        healthy: false,
        error: `Model not found: ${modelId}`,
        timestamp: new Date(),
      };
    }

    const startTime = Date.now();

    try {
      // Attempt a simple health check request
      await model.adapter.generateResponse('Health check: respond with OK');
      
      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        responseTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get all enabled models (for use in multi-model sessions)
   * Validates Requirement: 8.4 (exclude disabled models)
   * 
   * @returns Array of enabled models only
   */
  getEnabledModels(): Model[] {
    return Array.from(this.models.values()).filter(model => model.enabled);
  }

  /**
   * Remove a model from the registry
   * 
   * @param modelId The ID of the model to remove
   * @returns true if model was removed, false if not found
   */
  removeModel(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  /**
   * Clear all models from the registry
   */
  clear(): void {
    this.models.clear();
  }

  /**
   * Get the count of registered models
   * 
   * @returns Total number of registered models
   */
  getModelCount(): number {
    return this.models.size;
  }

  /**
   * Get the count of enabled models
   * 
   * @returns Number of enabled models
   */
  getEnabledModelCount(): number {
    return this.getEnabledModels().length;
  }
}
