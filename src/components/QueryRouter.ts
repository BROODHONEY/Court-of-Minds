/**
 * QueryRouter - Routes queries to appropriate handlers based on mode
 * 
 * This component is responsible for:
 * - Validating query input and user permissions
 * - Creating session identifiers
 * - Routing to DirectQueryHandler for single-model mode
 * - Routing to DeliberationOrchestrator for multi-model mode
 * 
 * Validates Requirements: 2.1, 2.2, 10.1
 */

import type { Query, QueryMode, SessionResult, Model } from '../models/types.js';
import type { SessionStore } from './SessionStore.js';
import type { ModelRegistry } from './ModelRegistry.js';

/**
 * Interface for query handlers
 */
export interface QueryHandler {
  handle(query: Query, models: Model[]): Promise<SessionResult>;
}

export class QueryRouter {
  constructor(
    private sessionStore: SessionStore,
    private modelRegistry: ModelRegistry,
    private directHandler: QueryHandler,
    private deliberationHandler: QueryHandler
  ) {}

  /**
   * Route a query to the appropriate handler based on mode
   * 
   * Validates Requirements:
   * - 2.1: Present list of available models for single-model mode
   * - 2.2: Route query to specific model in single-model mode
   * - 10.1: Display options for single-model or multi-model mode
   * 
   * @param query The user query to route
   * @param mode The execution mode (single or multi-model)
   * @returns Session result with final response
   * @throws Error if validation fails
   */
  async route(query: Query, mode: QueryMode): Promise<SessionResult> {
    // Validate query input
    this.validateQuery(query);

    // Get models based on mode and selection
    const models = this.getModelsForQuery(query, mode);

    // Validate model count based on mode
    this.validateModelCount(models, mode);

    // Route to appropriate handler
    if (mode === 'single') {
      return await this.directHandler.handle(query, models);
    } else {
      return await this.deliberationHandler.handle(query, models);
    }
  }

  /**
   * Validate query input
   * 
   * @param query The query to validate
   * @throws Error if query is invalid
   */
  private validateQuery(query: Query): void {
    if (!query.text || query.text.trim() === '') {
      throw new Error('Query text is required');
    }

    if (!query.userId || query.userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!query.id || query.id.trim() === '') {
      throw new Error('Query ID is required');
    }
  }

  /**
   * Get models for the query based on mode and selection
   * 
   * @param query The query with optional model selection
   * @param mode The execution mode
   * @returns Array of models to use
   * @throws Error if models not found or invalid
   */
  private getModelsForQuery(query: Query, mode: QueryMode): Model[] {
    if (mode === 'single') {
      // Single-model mode: require exactly one model selected
      if (!query.selectedModels || query.selectedModels.length !== 1) {
        throw new Error('Single-model mode requires exactly one model to be selected');
      }

      const modelId = query.selectedModels[0];
      const model = this.modelRegistry.getModel(modelId);

      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      if (!model.enabled) {
        throw new Error(`Model is disabled: ${modelId}`);
      }

      return [model];
    } else {
      // Multi-model mode: use selected models or all enabled models
      if (query.selectedModels && query.selectedModels.length > 0) {
        const models: Model[] = [];
        
        for (const modelId of query.selectedModels) {
          const model = this.modelRegistry.getModel(modelId);
          
          if (!model) {
            throw new Error(`Model not found: ${modelId}`);
          }

          if (!model.enabled) {
            throw new Error(`Model is disabled: ${modelId}`);
          }

          models.push(model);
        }

        return models;
      } else {
        // Use all enabled models
        const enabledModels = this.modelRegistry.getEnabledModels();
        
        if (enabledModels.length === 0) {
          throw new Error('No enabled models available');
        }

        return enabledModels;
      }
    }
  }

  /**
   * Validate model count based on mode
   * 
   * Validates Requirements:
   * - 1.5: Support minimum 2 and maximum 10 models per session
   * - 9.3: Return error if fewer than 2 models in multi-model mode
   * 
   * @param models The models to validate
   * @param mode The execution mode
   * @throws Error if model count is invalid
   */
  private validateModelCount(models: Model[], mode: QueryMode): void {
    if (mode === 'single') {
      if (models.length !== 1) {
        throw new Error(`Single-model mode requires exactly 1 model, got ${models.length}`);
      }
    } else {
      // Multi-model mode
      if (models.length < 2) {
        throw new Error(`Multi-model mode requires at least 2 models, got ${models.length}`);
      }

      if (models.length > 10) {
        throw new Error(`Multi-model mode supports maximum 10 models, got ${models.length}`);
      }
    }
  }

  /**
   * Get available models for user selection
   * 
   * @returns Array of all available models
   */
  getAvailableModels(): Model[] {
    return this.modelRegistry.getAvailableModels();
  }

  /**
   * Get enabled models for multi-model sessions
   * 
   * @returns Array of enabled models
   */
  getEnabledModels(): Model[] {
    return this.modelRegistry.getEnabledModels();
  }
}
