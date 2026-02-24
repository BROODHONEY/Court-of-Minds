/**
 * DeliberationOrchestrator - Coordinates multi-model deliberation pipeline
 * 
 * This component is responsible for:
 * - Coordinating all phases: collection → analysis → debate → consensus
 * - Updating session status after each phase
 * - Handling phase transitions
 * - Implementing overall timeout (5 minutes for ≤5 models)
 * 
 * Validates Requirements: 1.1, 7.5
 */

import type { Query, Model, SessionResult } from '../models/types.js';
import type { SessionStore } from './SessionStore.js';
import type { QueryHandler } from './QueryRouter.js';
import { ResponseCollector } from './ResponseCollector.js';
import { AnalysisEngine } from './AnalysisEngine.js';
import { DebateOrchestrator } from './DebateOrchestrator.js';
import { ConsensusBuilder } from './ConsensusBuilder.js';

/**
 * Configuration for deliberation orchestration
 */
interface DeliberationConfig {
  /** Overall timeout in milliseconds (default: 5 minutes for ≤5 models) */
  timeout: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DeliberationConfig = {
  timeout: 5 * 60 * 1000, // 5 minutes
};

export class DeliberationOrchestrator implements QueryHandler {
  private responseCollector: ResponseCollector;
  private analysisEngine: AnalysisEngine;
  private debateOrchestrator: DebateOrchestrator;
  private consensusBuilder: ConsensusBuilder;
  private config: DeliberationConfig;

  constructor(
    private sessionStore: SessionStore,
    config: Partial<DeliberationConfig> = {}
  ) {
    this.responseCollector = new ResponseCollector();
    this.analysisEngine = new AnalysisEngine();
    this.debateOrchestrator = new DebateOrchestrator();
    this.consensusBuilder = new ConsensusBuilder();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle a multi-model deliberation query
   * 
   * Validates Requirements:
   * - 1.1: Requests responses from all configured models
   * - 7.5: Completes within 5 minutes for ≤5 models
   * 
   * @param query The user query
   * @param models Array of models to participate in deliberation
   * @returns Session result with final consensus
   * @throws Error if deliberation fails or times out
   */
  async handle(query: Query, models: Model[]): Promise<SessionResult> {
    const startTime = Date.now();

    // Validate model count
    if (models.length < 2) {
      throw new Error(`Multi-model mode requires at least 2 models, got ${models.length}`);
    }

    if (models.length > 10) {
      throw new Error(`Multi-model mode supports maximum 10 models, got ${models.length}`);
    }

    // Create session
    const session = await this.sessionStore.createSession(query, 'multi');

    // Set up overall timeout (Requirement 7.5)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Deliberation exceeded 5-minute timeout'));
      }, this.config.timeout);
    });

    try {
      // Execute deliberation pipeline with timeout
      const result = await Promise.race([
        this.executeDeliberation(session.id, query, models),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      // Mark session as failed
      await this.sessionStore.updateSession(session.id, {
        status: 'failed',
        errors: [
          {
            modelId: 'orchestrator',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          },
        ],
      });

      throw error;
    }
  }

  /**
   * Execute the complete deliberation pipeline
   * 
   * Phases:
   * 1. Collection - Gather initial responses from all models
   * 2. Analysis - Identify similarities and differences
   * 3. Debate - Structured debate between models
   * 4. Consensus - Build final agreed solution
   * 
   * @param sessionId The session ID
   * @param query The user query
   * @param models Array of participating models
   * @returns Session result with final consensus
   */
  private async executeDeliberation(
    sessionId: string,
    query: Query,
    models: Model[]
  ): Promise<SessionResult> {
    // Phase 1: Response Collection
    await this.sessionStore.updateSession(sessionId, {
      status: 'collecting',
    });

    const collectionResult = await this.responseCollector.collectResponses(
      query,
      models
    );

    // Update session with collected responses
    await this.sessionStore.updateSession(sessionId, {
      status: 'analyzing',
      responses: collectionResult.responses,
      errors: collectionResult.failures,
    });

    // Phase 2: Analysis
    const analysisReport = await this.analysisEngine.analyze(
      collectionResult.responses
    );

    // Update session with analysis
    await this.sessionStore.updateSession(sessionId, {
      status: 'debating',
      analysis: analysisReport,
    });

    // Phase 3: Debate
    // Filter models to only those that provided successful responses
    const successfulModelIds = new Set(
      collectionResult.responses.map((r) => r.modelId)
    );
    const debateModels = models.filter((m) => successfulModelIds.has(m.id));

    const debateResult = await this.debateOrchestrator.conductDebate(
      query,
      collectionResult.responses,
      analysisReport,
      debateModels
    );

    // Update session with debate results
    await this.sessionStore.updateSession(sessionId, {
      status: 'consensus',
      debate: debateResult,
    });

    // Phase 4: Consensus
    const consensusResult = await this.consensusBuilder.buildConsensus(
      query,
      debateResult,
      debateModels
    );

    // Update session with final consensus
    await this.sessionStore.updateSession(sessionId, {
      status: 'completed',
      consensus: consensusResult,
      completedAt: new Date(),
    });

    // Retrieve final session
    const finalSession = await this.sessionStore.getSession(sessionId);

    if (!finalSession) {
      throw new Error('Failed to retrieve final session');
    }

    // Return result with final consensus solution
    return {
      sessionId,
      result: consensusResult.finalSolution.text,
      session: finalSession,
    };
  }

  /**
   * Get the response collector instance (for testing)
   */
  getResponseCollector(): ResponseCollector {
    return this.responseCollector;
  }

  /**
   * Get the analysis engine instance (for testing)
   */
  getAnalysisEngine(): AnalysisEngine {
    return this.analysisEngine;
  }

  /**
   * Get the debate orchestrator instance (for testing)
   */
  getDebateOrchestrator(): DebateOrchestrator {
    return this.debateOrchestrator;
  }

  /**
   * Get the consensus builder instance (for testing)
   */
  getConsensusBuilder(): ConsensusBuilder {
    return this.consensusBuilder;
  }
}
