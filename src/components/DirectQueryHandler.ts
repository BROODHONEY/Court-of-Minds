/**
 * DirectQueryHandler - Handles single-model queries without deliberation
 * 
 * This component is responsible for:
 * - Routing query to selected model only
 * - Returning response directly without additional phases
 * - Storing minimal session data
 * 
 * Validates Requirements: 2.2, 2.3, 2.4
 */

import type { Query, Model, SessionResult, ModelResponse } from '../models/types.js';
import type { SessionStore } from './SessionStore.js';
import type { QueryHandler } from './QueryRouter.js';

/**
 * Timeout for single model response (30 seconds)
 */
const SINGLE_MODEL_TIMEOUT_MS = 30000;

export class DirectQueryHandler implements QueryHandler {
  constructor(private sessionStore: SessionStore) {}

  /**
   * Handle a single-model query
   * 
   * Validates Requirements:
   * - 2.2: Route query only to selected model
   * - 2.3: Bypass analysis, debate, and consensus phases
   * - 2.4: Return response directly to user
   * 
   * @param query The user query
   * @param models Array containing exactly one model
   * @returns Session result with direct response
   * @throws Error if query fails or times out
   */
  async handle(query: Query, models: Model[]): Promise<SessionResult> {
    // Validate that we have exactly one model
    if (models.length !== 1) {
      throw new Error(`DirectQueryHandler requires exactly 1 model, got ${models.length}`);
    }

    const model = models[0];

    // Create session with single-model mode (Requirement 2.3: minimal session data)
    const session = await this.sessionStore.createSession(query, 'single');

    try {
      // Route query to selected model only (Requirement 2.2)
      const response = await this.queryModel(query, model);

      // Update session with response
      await this.sessionStore.updateSession(session.id, {
        status: 'completed',
        responses: [response],
        completedAt: new Date(),
      });

      // Retrieve updated session
      const updatedSession = await this.sessionStore.getSession(session.id);

      if (!updatedSession) {
        throw new Error('Failed to retrieve updated session');
      }

      // Return response directly (Requirement 2.4)
      return {
        sessionId: session.id,
        result: response.text,
        session: updatedSession,
      };
    } catch (error) {
      // Mark session as failed
      await this.sessionStore.updateSession(session.id, {
        status: 'failed',
        errors: [
          {
            modelId: model.id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          },
        ],
      });

      throw error;
    }
  }

  /**
   * Query a single model with timeout
   * 
   * @param query The user query
   * @param model The model to query
   * @returns Model response
   * @throws Error if model fails or times out
   */
  private async queryModel(query: Query, model: Model): Promise<ModelResponse> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Model ${model.id} exceeded 30-second timeout`));
      }, SINGLE_MODEL_TIMEOUT_MS);
    });

    // Create model request promise
    const responsePromise = model.adapter.generateResponse(query.text);

    // Race between response and timeout
    try {
      const response = await Promise.race([responsePromise, timeoutPromise]);
      return response;
    } catch (error) {
      throw new Error(
        `Model ${model.id} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
