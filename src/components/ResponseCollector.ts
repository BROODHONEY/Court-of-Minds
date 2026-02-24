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
 * Validates Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 9.1, 9.5
 */

import type { Query, Model, CollectionResult, ModelResponse, ModelFailure } from '../models/types.js';
import { errorLogger } from '../utils/errorLogger.js';

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
   * - 9.5: Logs detailed error information
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
      const error = 'No models provided for response collection';
      errorLogger.logError('ResponseCollector', error, { queryId: query.id }, query.id);
      throw new Error(error);
    }

    errorLogger.logInfo(
      'ResponseCollector',
      `Starting response collection for ${models.length} models`,
      { queryId: query.id, modelCount: models.length, modelIds: models.map(m => m.id) },
      query.id
    );

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
        errorLogger.logInfo(
          'ResponseCollector',
          `Model ${models[index].id} responded successfully`,
          { 
            queryId: query.id,
            tokens: result.value.tokens,
            latency: result.value.latency,
          },
          query.id,
          models[index].id
        );
      } else {
        // Log failure (Requirement 1.3, 9.5)
        const failure: ModelFailure = {
          modelId: models[index].id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          timestamp: new Date(),
        };
        failures.push(failure);
        
        errorLogger.logError(
          'ResponseCollector',
          result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          { 
            queryId: query.id,
            modelId: models[index].id,
          },
          query.id,
          models[index].id
        );
      }
    });

    const duration = Date.now() - startTime;

    // Check if we have minimum required responses (Requirement 9.1)
    if (responses.length < MIN_SUCCESSFUL_RESPONSES) {
      const error = `Insufficient responses: got ${responses.length}, need at least ${MIN_SUCCESSFUL_RESPONSES}. ` +
        `Failures: ${failures.map(f => `${f.modelId}: ${f.error}`).join('; ')}`;
      
      errorLogger.logError(
        'ResponseCollector',
        error,
        {
          queryId: query.id,
          successCount: responses.length,
          failureCount: failures.length,
          failures: failures,
        },
        query.id
      );
      
      throw new Error(error);
    }

    errorLogger.logInfo(
      'ResponseCollector',
      `Response collection completed: ${responses.length} successes, ${failures.length} failures`,
      {
        queryId: query.id,
        successCount: responses.length,
        failureCount: failures.length,
        duration,
      },
      query.id
    );

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
   * - 9.5: Detailed error logging
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
      const errorMsg = `Model ${model.id} failed: ${error instanceof Error ? error.message : String(error)}`;
      
      errorLogger.logError(
        'ResponseCollector',
        error instanceof Error ? error : new Error(String(error)),
        {
          queryId: query.id,
          modelId: model.id,
          timeout: MODEL_TIMEOUT_MS,
        },
        query.id,
        model.id
      );
      
      throw new Error(errorMsg);
    }
  }
}
