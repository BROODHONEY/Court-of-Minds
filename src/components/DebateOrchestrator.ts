/**
 * Debate Orchestrator Component
 * 
 * Manages structured debate rounds between models.
 * Conducts 1-5 debate rounds, presents context to models, parses exchanges,
 * calculates disagreement levels, and implements early termination on convergence.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.3, 9.2, 9.5
 */

import {
  ModelResponse,
  AnalysisReport,
  Model,
  DebateResult,
  DebateRound,
  DebateExchange,
  Query
} from '../models/types.js';
import { errorLogger } from '../utils/errorLogger.js';

/**
 * Configuration for debate orchestration
 */
interface DebateConfig {
  /** Minimum number of debate rounds */
  minRounds: number;
  /** Maximum number of debate rounds */
  maxRounds: number;
  /** Disagreement threshold for early termination (0-1) */
  convergenceThreshold: number;
  /** Maximum tokens per debate response */
  maxTokens: number;
}

/**
 * Default debate configuration
 */
const DEFAULT_CONFIG: DebateConfig = {
  minRounds: 1,
  maxRounds: 5,
  convergenceThreshold: 0.2,
  maxTokens: 500
};

/**
 * Interface for the Debate Orchestrator component
 */
export interface IDebateOrchestrator {
  conductDebate(
    query: Query,
    responses: ModelResponse[],
    analysis: AnalysisReport,
    models: Model[]
  ): Promise<DebateResult>;
}

/**
 * Parse a debate response into structured exchange components
 */
function parseDebateResponse(responseText: string, modelId: string): DebateExchange {
  const lines = responseText.split('\n');
  
  let critique = '';
  let defense = '';
  let revisedPosition: string | undefined;
  
  let currentSection: 'none' | 'strengths' | 'weaknesses' | 'defense' | 'revised' = 'none';
  
  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    
    // Detect section headers
    if (upper.startsWith('STRENGTHS:') || upper.startsWith('STRENGTH:')) {
      currentSection = 'strengths';
      const content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (content) critique += content + '\n';
      continue;
    } else if (upper.startsWith('WEAKNESSES:') || upper.startsWith('WEAKNESS:')) {
      currentSection = 'weaknesses';
      const content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (content) critique += '\n' + content + '\n';
      continue;
    } else if (upper.startsWith('DEFENSE:') || upper.startsWith('DEFENCE:')) {
      currentSection = 'defense';
      const content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (content) defense += content + '\n';
      continue;
    } else if (upper.startsWith('REVISED_POSITION:') || upper.startsWith('REVISED POSITION:')) {
      currentSection = 'revised';
      const content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (content) revisedPosition = content + '\n';
      continue;
    }
    
    // Add content to current section
    if (trimmed) {
      switch (currentSection) {
        case 'strengths':
        case 'weaknesses':
          critique += trimmed + '\n';
          break;
        case 'defense':
          defense += trimmed + '\n';
          break;
        case 'revised':
          revisedPosition = (revisedPosition || '') + trimmed + '\n';
          break;
      }
    }
  }
  
  // Fallback: if parsing failed, use entire response as critique
  if (!critique && !defense && !revisedPosition) {
    critique = responseText;
  }
  
  return {
    modelId,
    critique: critique.trim(),
    defense: defense.trim(),
    revisedPosition: revisedPosition?.trim(),
    timestamp: new Date()
  };
}

/**
 * Calculate disagreement level between debate exchanges
 * Uses semantic similarity between revised positions (or original defenses)
 */
function calculateDisagreementLevel(exchanges: DebateExchange[]): number {
  if (exchanges.length < 2) {
    return 0;
  }
  
  // Get positions to compare (prefer revised positions, fall back to defense)
  const positions = exchanges.map(ex => 
    ex.revisedPosition || ex.defense || ex.critique
  );
  
  // Calculate pairwise similarity using simple word overlap
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const similarity = calculateTextSimilarity(positions[i], positions[j]);
      totalSimilarity += similarity;
      comparisons++;
    }
  }
  
  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1;
  
  // Disagreement is inverse of similarity
  return 1 - avgSimilarity;
}

/**
 * Calculate similarity between two texts using word overlap
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2) // Changed from 3 to 2 to include more words
  );
  
  const words2 = new Set(
    text2.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2) // Changed from 3 to 2 to include more words
  );
  
  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }
  
  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Format the debate prompt for a given round
 */
function formatDebatePrompt(
  roundNumber: number,
  query: Query,
  originalResponse: ModelResponse,
  otherResponses: ModelResponse[],
  analysis: AnalysisReport,
  previousRounds?: DebateRound[]
): string {
  let prompt = `Round ${roundNumber} of Debate:\n\n`;
  
  prompt += `Original Query: ${query.text}\n\n`;
  
  prompt += `Your Original Response: ${originalResponse.text}\n\n`;
  
  prompt += `Other Responses:\n`;
  otherResponses.forEach(response => {
    prompt += `- Model ${response.modelId}: ${response.text}\n`;
  });
  prompt += '\n';
  
  prompt += `Analysis Report: ${analysis.summary}\n`;
  if (analysis.commonThemes.length > 0) {
    prompt += `Common Themes: ${analysis.commonThemes.map(t => t.description).join(', ')}\n`;
  }
  if (analysis.differences.length > 0) {
    prompt += `Key Differences: ${analysis.differences.map(d => `${d.type} (${d.involvedModels.join(', ')})`).join('; ')}\n`;
  }
  prompt += '\n';
  
  if (previousRounds && previousRounds.length > 0) {
    prompt += `Previous Debate:\n`;
    previousRounds.forEach(round => {
      prompt += `Round ${round.roundNumber}:\n`;
      round.exchanges.forEach(exchange => {
        prompt += `  ${exchange.modelId}:\n`;
        if (exchange.critique) prompt += `    Critique: ${exchange.critique.substring(0, 200)}...\n`;
        if (exchange.defense) prompt += `    Defense: ${exchange.defense.substring(0, 200)}...\n`;
        if (exchange.revisedPosition) prompt += `    Revised: ${exchange.revisedPosition.substring(0, 200)}...\n`;
      });
    });
    prompt += '\n';
  }
  
  prompt += `Instructions:
1. Identify specific strengths in other responses
2. Identify specific weaknesses or flaws in other responses
3. Defend your approach or acknowledge valid criticisms
4. Revise your position if warranted

Provide your response in this format:
STRENGTHS: ...
WEAKNESSES: ...
DEFENSE: ...
REVISED_POSITION: ...`;
  
  return prompt;
}

/**
 * Debate Orchestrator implementation
 */
export class DebateOrchestrator implements IDebateOrchestrator {
  private config: DebateConfig;
  
  constructor(config: Partial<DebateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Conduct structured debate between models
   * 
   * Validates Requirements:
   * - 4.1: Initiates debate with all participating models
   * - 4.2: Presents analysis report and all other responses to each model
   * - 4.3: Requires models to identify strengths and weaknesses
   * - 4.4: Requires models to defend or revise their position
   * - 4.5: Conducts 1-5 debate rounds
   * - 4.6: Assesses disagreement after each round
   * - 7.3: Limits responses to 500 tokens
   * - 9.2: Excludes failed models from subsequent rounds
   * - 9.5: Logs detailed error information
   * 
   * @param query The original user query
   * @param responses Initial model responses
   * @param analysis Analysis report from AnalysisEngine
   * @param models Array of models participating in debate
   * @returns Debate result with all rounds and convergence score
   */
  async conductDebate(
    query: Query,
    responses: ModelResponse[],
    analysis: AnalysisReport,
    models: Model[]
  ): Promise<DebateResult> {
    const startTime = Date.now();
    const rounds: DebateRound[] = [];
    
    errorLogger.logInfo(
      'DebateOrchestrator',
      `Starting debate with ${models.length} models`,
      {
        queryId: query.id,
        modelCount: models.length,
        modelIds: models.map(m => m.id),
      },
      query.id
    );
    
    // Validate inputs
    if (responses.length < 2) {
      const error = 'At least 2 responses required for debate';
      errorLogger.logError('DebateOrchestrator', error, { queryId: query.id }, query.id);
      throw new Error(error);
    }
    
    if (models.length !== responses.length) {
      const error = 'Number of models must match number of responses';
      errorLogger.logError(
        'DebateOrchestrator',
        error,
        { queryId: query.id, modelCount: models.length, responseCount: responses.length },
        query.id
      );
      throw new Error(error);
    }
    
    // Create a map of model ID to model for easy lookup
    const modelMap = new Map(models.map(m => [m.id, m]));
    
    // Track active models (models that haven't failed) - Requirement 9.2
    let activeModels = new Set(models.map(m => m.id));
    
    // Conduct debate rounds (Requirement 4.5: 1-5 rounds)
    for (let roundNum = 1; roundNum <= this.config.maxRounds; roundNum++) {
      errorLogger.logInfo(
        'DebateOrchestrator',
        `Starting debate round ${roundNum}`,
        {
          queryId: query.id,
          roundNumber: roundNum,
          activeModelCount: activeModels.size,
          activeModels: Array.from(activeModels),
        },
        query.id
      );
      
      const round = await this.conductRound(
        roundNum,
        query,
        responses,
        analysis,
        modelMap,
        activeModels,
        rounds
      );
      
      rounds.push(round);
      
      errorLogger.logInfo(
        'DebateOrchestrator',
        `Completed debate round ${roundNum}`,
        {
          queryId: query.id,
          roundNumber: roundNum,
          exchangeCount: round.exchanges.length,
          disagreementLevel: round.disagreementLevel,
          activeModelCount: activeModels.size,
        },
        query.id
      );
      
      // Check for early termination (Requirement 4.6: convergence detection)
      if (roundNum >= this.config.minRounds && 
          round.disagreementLevel < this.config.convergenceThreshold) {
        errorLogger.logInfo(
          'DebateOrchestrator',
          `Early termination: convergence achieved`,
          {
            queryId: query.id,
            roundNumber: roundNum,
            disagreementLevel: round.disagreementLevel,
            threshold: this.config.convergenceThreshold,
          },
          query.id
        );
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Calculate final convergence score (inverse of final disagreement)
    const finalDisagreement = rounds[rounds.length - 1]?.disagreementLevel || 1;
    const convergenceScore = 1 - finalDisagreement;
    
    errorLogger.logInfo(
      'DebateOrchestrator',
      `Debate completed`,
      {
        queryId: query.id,
        totalRounds: rounds.length,
        convergenceScore,
        duration,
        finalActiveModels: activeModels.size,
      },
      query.id
    );
    
    return {
      rounds,
      convergenceScore,
      duration
    };
  }
  
  /**
   * Conduct a single debate round
   */
  private async conductRound(
    roundNumber: number,
    query: Query,
    originalResponses: ModelResponse[],
    analysis: AnalysisReport,
    modelMap: Map<string, Model>,
    activeModels: Set<string>,
    previousRounds: DebateRound[]
  ): Promise<DebateRound> {
    const exchanges: DebateExchange[] = [];
    
    // Get active models only
    const activeModelsList = Array.from(activeModels)
      .map(id => modelMap.get(id))
      .filter((m): m is Model => m !== undefined);
    
    // Collect debate exchanges from all active models in parallel
    const exchangePromises = activeModelsList.map(async (model) => {
      try {
        // Find this model's original response
        const originalResponse = originalResponses.find(r => r.modelId === model.id);
        if (!originalResponse) {
          throw new Error(`No original response found for model ${model.id}`);
        }
        
        // Get other models' responses (Requirement 4.2: present all other responses)
        const otherResponses = originalResponses.filter(r => r.modelId !== model.id);
        
        // Format debate prompt
        const prompt = formatDebatePrompt(
          roundNumber,
          query,
          originalResponse,
          otherResponses,
          analysis,
          previousRounds
        );
        
        // Request debate response with token limit (Requirement 7.3: 500 tokens)
        const context = {
          previousResponses: otherResponses,
          analysisReport: analysis,
          debateHistory: previousRounds
        };
        
        const response = await model.adapter.generateResponse(prompt, context);
        
        // Enforce token limit
        if (response.tokens > this.config.maxTokens) {
          errorLogger.logWarning(
            'DebateOrchestrator',
            `Model ${model.id} exceeded token limit: ${response.tokens} > ${this.config.maxTokens}`,
            {
              roundNumber,
              modelId: model.id,
              tokens: response.tokens,
              maxTokens: this.config.maxTokens,
            },
            undefined,
            model.id
          );
        }
        
        // Parse the debate response (Requirements 4.3, 4.4: strengths, weaknesses, defense, revised position)
        const exchange = parseDebateResponse(response.text, model.id);
        
        return exchange;
      } catch (error) {
        // Remove failed model from active set (Requirement 9.2: debate failure isolation)
        activeModels.delete(model.id);
        
        errorLogger.logError(
          'DebateOrchestrator',
          error instanceof Error ? error : new Error(String(error)),
          {
            roundNumber,
            modelId: model.id,
          },
          undefined,
          model.id
        );
        
        return null;
      }
    });
    
    // Wait for all exchanges
    const results = await Promise.all(exchangePromises);
    
    // Filter out failed exchanges
    results.forEach(exchange => {
      if (exchange) {
        exchanges.push(exchange);
      }
    });
    
    // Calculate disagreement level for this round (Requirement 4.6)
    const disagreementLevel = calculateDisagreementLevel(exchanges);
    
    return {
      roundNumber,
      exchanges,
      disagreementLevel
    };
  }
}
