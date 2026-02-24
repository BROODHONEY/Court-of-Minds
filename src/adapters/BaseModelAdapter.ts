/**
 * BaseModelAdapter - Abstract base class for model adapters
 * 
 * Provides common functionality for timeout handling and error management
 * Implements retry logic with exponential backoff and circuit breaker pattern
 */

import type { ModelAdapter, ModelResponse, Context, ModelInfo } from '../models/types.js';
import { retryWithBackoff, isRateLimitError } from '../utils/retryWithBackoff.js';
import { errorLogger } from '../utils/errorLogger.js';
import { circuitBreakerRegistry } from '../utils/circuitBreaker.js';

export abstract class BaseModelAdapter implements ModelAdapter {
  protected timeout: number;
  protected modelId: string;

  constructor(modelId: string, timeout: number = 30000) {
    this.modelId = modelId;
    this.timeout = timeout;
  }

  /**
   * Generate a response with timeout protection, retry logic, and circuit breaker
   * 
   * Validates Requirements:
   * - 9.4: Retry with exponential backoff for rate limits (up to 3 attempts)
   * - 9.5: Log detailed error information
   * - Circuit breaker for external services
   */
  async generateResponse(prompt: string, context?: Context): Promise<ModelResponse> {
    const startTime = Date.now();
    const circuitBreaker = circuitBreakerRegistry.getBreaker(this.modelId);

    try {
      // Execute with circuit breaker protection
      const response = await circuitBreaker.execute(async () => {
        // Execute with retry logic for rate limits
        return await retryWithBackoff(
          async () => {
            return await this.withTimeout(
              this.generateResponseInternal(prompt, context),
              this.timeout
            );
          },
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            isRetryable: isRateLimitError,
            onRetry: (attempt, error, delayMs) => {
              errorLogger.logWarning(
                'BaseModelAdapter',
                `Retry attempt ${attempt} for model ${this.modelId} after ${delayMs}ms`,
                {
                  error: error.message,
                  delayMs,
                  attempt,
                },
                undefined,
                this.modelId
              );
            },
          }
        );
      });

      return {
        ...response,
        modelId: this.modelId,
        latency: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorDetails = error instanceof Error ? error : new Error(String(error));
      
      // Log detailed error information (Requirement 9.5)
      errorLogger.logError(
        'BaseModelAdapter',
        errorDetails,
        {
          modelId: this.modelId,
          timeout: this.timeout,
          latency: Date.now() - startTime,
          hasContext: !!context,
        },
        undefined,
        this.modelId
      );
      
      if (errorDetails.message === 'Timeout') {
        throw new Error(`Model ${this.modelId} timed out after ${this.timeout}ms`);
      }
      throw errorDetails;
    }
  }

  /**
   * Abstract method to be implemented by specific adapters
   */
  protected abstract generateResponseInternal(
    prompt: string,
    context?: Context
  ): Promise<Omit<ModelResponse, 'modelId' | 'latency' | 'timestamp'>>;

  /**
   * Get model information
   */
  abstract getModelInfo(): ModelInfo;

  /**
   * Wraps a promise with a timeout
   */
  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Count tokens in text (simple approximation)
   * Real implementations should use provider-specific tokenizers
   */
  protected estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
