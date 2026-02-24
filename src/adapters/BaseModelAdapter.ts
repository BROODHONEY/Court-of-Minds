/**
 * BaseModelAdapter - Abstract base class for model adapters
 * 
 * Provides common functionality for timeout handling and error management
 */

import type { ModelAdapter, ModelResponse, Context, ModelInfo } from '../models/types.js';

export abstract class BaseModelAdapter implements ModelAdapter {
  protected timeout: number;
  protected modelId: string;

  constructor(modelId: string, timeout: number = 30000) {
    this.modelId = modelId;
    this.timeout = timeout;
  }

  /**
   * Generate a response with timeout protection
   */
  async generateResponse(prompt: string, context?: Context): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const response = await this.withTimeout(
        this.generateResponseInternal(prompt, context),
        this.timeout
      );

      return {
        ...response,
        modelId: this.modelId,
        latency: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Timeout') {
        throw new Error(`Model ${this.modelId} timed out after ${this.timeout}ms`);
      }
      throw error;
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
