/**
 * ResponseCollector - Collects initial responses from multiple models in parallel
 * 
 * This component is responsible for:
 * - Sending queries to all selected models in parallel
 * - Implementing 30-second timeout per model
 * - Collecting successful responses
 * - Logging failures but continuing if at least 2 responses succeed
 * - Returning aggregated results
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 9.1
 */

import type { Query, Model, CollectionResult, ModelResponse, ModelFailure } from '../models/types.js';

/**
 * Timeout duration for each model response (30 seconds)
 */
const MODEL_TIMEOUT_MS = 30000;

/**
 * Minimum number of successful responses required to continue
 */
const MIN_SUCCESSFUL_RESPONSES = 2;

export class ResponseCollector {
  /**
   * Collect responses from multiple models in parallel
   * 
   * Validates Requirements:
   * - 1.1: Requests responses from all configured models
   * - 1.2: Each model generates response independently (no context shared)
   * - 1.3: Continues with available responses and logs failures
   * - 7.1: Requests in parallel from all models
   * - 7.2: 30-second timeout per model
   * - 9.1: Continues if at least 2 responses succeed
   * 
   * @param query The user query to send to models
   * @param models Array of models to query
   * @returns Collection result with responses, failures, and duration
   * @throws Error if fewer than 2 models provide successful responses
   */
  async collectResponses(query: Query, models: Model[]): Promise<CollectionResult> {
    const startTime = Date.now();
    
    // Validate input
    if (!models || models.length === 0) {
      throw new Error('No models provided for response collection');
    }

    // Create promises for all model requests (Requirement 7.1: parallel execution)
    const modelPromises = models.map(model => 
      this.collectSingleResponse(query, model)
    );

    // Wait for all promises to settle (both fulfilled and rejected)
    const results = await Promise.allSettled(modelPromises);

    // Separate successful responses from failures
    const responses: ModelResponse[] = [];
    const failures: ModelFailure[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        // Log failure (Requirement 1.3)
        failures.push({
          modelId: models[index].id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          timestamp: new Date(),
        });
      }
    });

    const duration = Date.now() - startTime;

    // Check if we have minimum required responses (Requirement 9.1)
    if (responses.length < MIN_SUCCESSFUL_RESPONSES) {
      throw new Error(
        `Insufficient responses: got ${responses.length}, need at least ${MIN_SUCCESSFUL_RESPONSES}. ` +
        `Failures: ${failures.map(f => `${f.modelId}: ${f.error}`).join('; ')}`
      );
    }

    return {
      responses,
      failures,
      duration,
    };
  }

  /**
   * Collect response from a single model with timeout
   * 
   * Validates Requirements:
   * - 1.2: Model generates response independently (no context provided)
   * - 7.2: 30-second timeout enforcement
   * 
   * @param query The user query
   * @param model The model to query
   * @returns Model response
   * @throws Error if model fails or times out
   */
  private async collectSingleResponse(query: Query, model: Model): Promise<ModelResponse> {
    // Create timeout promise (Requirement 7.2)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Model ${model.id} exceeded 30-second timeout`));
      }, MODEL_TIMEOUT_MS);
    });

    // Create model request promise
    // Requirement 1.2: No context provided - models respond independently
    const responsePromise = model.adapter.generateResponse(query.text);

    // Race between response and timeout
    try {
      const response = await Promise.race([responsePromise, timeoutPromise]);
      return response;
    } catch (error) {
      // Re-throw with model context for better error messages
      throw new Error(
        `Model ${model.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
