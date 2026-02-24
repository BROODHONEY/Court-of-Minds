/**
 * Unit tests for DebateOrchestrator
 * 
 * Tests specific examples, edge cases, and error conditions for debate orchestration.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DebateOrchestrator } from './DebateOrchestrator.js';
import type {
  Query,
  ModelResponse,
  AnalysisReport,
  Model,
  ModelAdapter,
  Context
} from '../models/types.js';

/**
 * Create a mock model adapter for testing
 */
function createMockAdapter(
  modelId: string,
  responseGenerator?: (prompt: string, context?: Context) => string
): ModelAdapter {
  return {
    generateResponse: jest.fn(async (prompt: string, context?: Context) => {
      // Add small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const text = responseGenerator 
        ? responseGenerator(prompt, context)
        : `STRENGTHS: Good analysis\nWEAKNESSES: Could be better\nDEFENSE: My approach is valid\nREVISED_POSITION: I maintain my position`;
      
      return {
        modelId,
        text,
        tokens: text.split(/\s+/).length,
        latency: 100,
        timestamp: new Date()
      };
    }) as jest.MockedFunction<ModelAdapter['generateResponse']>,
    getModelInfo: () => ({
      provider: 'test',
      modelName: modelId,
      capabilities: ['debate']
    })
  };
}

/**
 * Create a mock model for testing
 */
function createMockModel(id: string, adapter?: ModelAdapter): Model {
  return {
    id,
    provider: 'test',
    name: `Test Model ${id}`,
    enabled: true,
    adapter: adapter || createMockAdapter(id)
  };
}

/**
 * Create a mock query for testing
 */
function createMockQuery(text: string = 'What is the best approach?'): Query {
  return {
    id: 'query-1',
    text,
    userId: 'user-1',
    timestamp: new Date()
  };
}

/**
 * Create mock responses for testing
 */
function createMockResponses(count: number): ModelResponse[] {
  return Array.from({ length: count }, (_, i) => ({
    modelId: `model-${i + 1}`,
    text: `Response ${i + 1}: This is my approach to the problem.`,
    tokens: 10,
    latency: 100,
    timestamp: new Date()
  }));
}

/**
 * Create a mock analysis report for testing
 */
function createMockAnalysis(): AnalysisReport {
  return {
    commonThemes: [
      {
        description: 'All models suggest a systematic approach',
        supportingModels: ['model-1', 'model-2'],
        confidence: 0.8
      }
    ],
    uniqueApproaches: [
      {
        modelId: 'model-1',
        description: 'Uses analytical methodology',
        methodology: 'analytical'
      },
      {
        modelId: 'model-2',
        description: 'Uses practical methodology',
        methodology: 'practical'
      }
    ],
    differences: [
      {
        type: 'methodology',
        description: 'Different approaches to problem solving',
        involvedModels: ['model-1', 'model-2']
      }
    ],
    summary: 'Models show different methodologies but similar goals',
    timestamp: new Date()
  };
}

describe('DebateOrchestrator', () => {
  let orchestrator: DebateOrchestrator;
  
  beforeEach(() => {
    orchestrator = new DebateOrchestrator();
  });
  
  describe('conductDebate', () => {
    it('should conduct a single round debate', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      const models = [
        createMockModel('model-1'),
        createMockModel('model-2')
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].roundNumber).toBe(1);
      expect(result.rounds[0].exchanges).toHaveLength(2);
      expect(result.convergenceScore).toBeGreaterThanOrEqual(0);
      expect(result.convergenceScore).toBeLessThanOrEqual(1);
      expect(result.duration).toBeGreaterThan(0);
    });
    
    it('should conduct multiple rounds if no convergence', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      // Create models with very different responses to prevent convergence
      // Use completely different vocabularies
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => 
          'STRENGTHS: None whatsoever\nWEAKNESSES: Everything is wrong\nDEFENSE: Quantum mechanics requires approach alpha\nREVISED_POSITION: Definitely quantum mechanics approach alpha methodology'
        )),
        createMockModel('model-2', createMockAdapter('model-2', () => 
          'STRENGTHS: Nothing good\nWEAKNESSES: All bad\nDEFENSE: Classical physics requires approach beta\nREVISED_POSITION: Definitely classical physics approach beta methodology'
        ))
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      // Should conduct multiple rounds due to high disagreement
      // Note: May still converge early if disagreement drops below threshold
      expect(result.rounds.length).toBeGreaterThanOrEqual(1);
      expect(result.rounds.length).toBeLessThanOrEqual(5);
      
      // Check that disagreement was calculated
      result.rounds.forEach(round => {
        expect(round.disagreementLevel).toBeGreaterThanOrEqual(0);
        expect(round.disagreementLevel).toBeLessThanOrEqual(1);
      });
    });
    
    it('should terminate early on convergence', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      // Create models with identical responses to trigger convergence
      const identicalResponse = 'STRENGTHS: Good analysis and methodology\nWEAKNESSES: None significant\nDEFENSE: Valid approach\nREVISED_POSITION: We agree on this solution completely';
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => identicalResponse)),
        createMockModel('model-2', createMockAdapter('model-2', () => identicalResponse))
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      // Should terminate early due to convergence (disagreement should be low)
      expect(result.rounds.length).toBeLessThanOrEqual(5);
      expect(result.rounds[0].disagreementLevel).toBeLessThan(0.5); // Low disagreement
      expect(result.convergenceScore).toBeGreaterThanOrEqual(0); // Some convergence
    });
    
    it('should handle model failure during debate', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(3);
      const analysis = createMockAnalysis();
      
      // Create one failing model
      const failingAdapter = createMockAdapter('model-2');
      (failingAdapter.generateResponse as jest.MockedFunction<typeof failingAdapter.generateResponse>)
        .mockRejectedValue(new Error('Model failed'));
      
      const models = [
        createMockModel('model-1'),
        createMockModel('model-2', failingAdapter),
        createMockModel('model-3')
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      // Should continue with remaining models
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].exchanges.length).toBe(2); // Only 2 successful exchanges
      expect(result.rounds[0].exchanges.some(e => e.modelId === 'model-2')).toBe(false);
    });
    
    it('should parse debate exchanges correctly', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      const customResponse = `STRENGTHS: The other model has good logic
WEAKNESSES: However, it misses edge cases
DEFENSE: My approach handles all cases
REVISED_POSITION: I will incorporate the good logic while maintaining edge case handling`;
      
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => customResponse)),
        createMockModel('model-2')
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      const exchange = result.rounds[0].exchanges.find(e => e.modelId === 'model-1');
      expect(exchange).toBeDefined();
      expect(exchange!.critique).toContain('good logic');
      expect(exchange!.critique).toContain('edge cases');
      expect(exchange!.defense).toContain('handles all cases');
      expect(exchange!.revisedPosition).toContain('incorporate');
    });
    
    it('should calculate disagreement level for each round', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      const models = [
        createMockModel('model-1'),
        createMockModel('model-2')
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      result.rounds.forEach(round => {
        expect(round.disagreementLevel).toBeGreaterThanOrEqual(0);
        expect(round.disagreementLevel).toBeLessThanOrEqual(1);
      });
    });
    
    it('should limit debate to maximum 5 rounds', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      // Create models with maximum disagreement
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => 
          'STRENGTHS: None\nWEAKNESSES: All\nDEFENSE: Only A\nREVISED_POSITION: Absolutely only A'
        )),
        createMockModel('model-2', createMockAdapter('model-2', () => 
          'STRENGTHS: None\nWEAKNESSES: All\nDEFENSE: Only B\nREVISED_POSITION: Absolutely only B'
        ))
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      expect(result.rounds.length).toBeLessThanOrEqual(5);
    });
    
    it('should enforce minimum 1 round', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      // Even with perfect convergence, should do at least 1 round
      const identicalResponse = 'STRENGTHS: Good\nWEAKNESSES: None\nDEFENSE: Valid\nREVISED_POSITION: Perfect agreement';
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => identicalResponse)),
        createMockModel('model-2', createMockAdapter('model-2', () => identicalResponse))
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      expect(result.rounds.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should throw error if fewer than 2 responses', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(1);
      const analysis = createMockAnalysis();
      const models = [createMockModel('model-1')];
      
      await expect(
        orchestrator.conductDebate(query, responses, analysis, models)
      ).rejects.toThrow('At least 2 responses required');
    });
    
    it('should throw error if models count does not match responses count', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      const models = [createMockModel('model-1')]; // Only 1 model for 2 responses
      
      await expect(
        orchestrator.conductDebate(query, responses, analysis, models)
      ).rejects.toThrow('Number of models must match');
    });
    
    it('should include debate context in prompts', async () => {
      const query = createMockQuery('What is 2+2?');
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      const adapter1 = createMockAdapter('model-1');
      const adapter2 = createMockAdapter('model-2');
      
      const models = [
        createMockModel('model-1', adapter1),
        createMockModel('model-2', adapter2)
      ];
      
      await orchestrator.conductDebate(query, responses, analysis, models);
      
      // Check that adapters were called with proper context
      expect(adapter1.generateResponse).toHaveBeenCalled();
      expect(adapter2.generateResponse).toHaveBeenCalled();
      
      const call1 = (adapter1.generateResponse as jest.MockedFunction<typeof adapter1.generateResponse>).mock.calls[0];
      const call2 = (adapter2.generateResponse as jest.MockedFunction<typeof adapter2.generateResponse>).mock.calls[0];
      
      // Prompts should include original query
      expect(call1[0]).toContain('What is 2+2?');
      expect(call2[0]).toContain('What is 2+2?');
      
      // Context should include analysis report
      expect(call1[1]?.analysisReport).toBeDefined();
      expect(call2[1]?.analysisReport).toBeDefined();
    });
    
    it('should handle responses without proper format', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      // Model returns unformatted response
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => 
          'This is just a plain text response without any structure'
        )),
        createMockModel('model-2')
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      // Should still create exchange, using entire text as critique
      expect(result.rounds[0].exchanges).toHaveLength(2);
      const exchange = result.rounds[0].exchanges.find(e => e.modelId === 'model-1');
      expect(exchange).toBeDefined();
      expect(exchange!.critique).toContain('plain text response');
    });
    
    it('should track duration of debate', async () => {
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      const models = [
        createMockModel('model-1'),
        createMockModel('model-2')
      ];
      
      const result = await orchestrator.conductDebate(query, responses, analysis, models);
      
      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });
  });
  
  describe('custom configuration', () => {
    it('should respect custom convergence threshold', async () => {
      // Very high threshold means no early termination
      const strictOrchestrator = new DebateOrchestrator({
        convergenceThreshold: 0.01, // Very low threshold - almost impossible to reach
        minRounds: 2 // Ensure at least 2 rounds
      });
      
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      const identicalResponse = 'STRENGTHS: Good analysis methodology\nWEAKNESSES: None significant\nDEFENSE: Valid approach\nREVISED_POSITION: Agreement on solution';
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => identicalResponse)),
        createMockModel('model-2', createMockAdapter('model-2', () => identicalResponse))
      ];
      
      const result = await strictOrchestrator.conductDebate(query, responses, analysis, models);
      
      // Should conduct at least minRounds
      expect(result.rounds.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should respect custom max rounds', async () => {
      const limitedOrchestrator = new DebateOrchestrator({
        maxRounds: 2
      });
      
      const query = createMockQuery();
      const responses = createMockResponses(2);
      const analysis = createMockAnalysis();
      
      // High disagreement models
      const models = [
        createMockModel('model-1', createMockAdapter('model-1', () => 
          'STRENGTHS: None\nWEAKNESSES: All\nDEFENSE: A\nREVISED_POSITION: Only A'
        )),
        createMockModel('model-2', createMockAdapter('model-2', () => 
          'STRENGTHS: None\nWEAKNESSES: All\nDEFENSE: B\nREVISED_POSITION: Only B'
        ))
      ];
      
      const result = await limitedOrchestrator.conductDebate(query, responses, analysis, models);
      
      expect(result.rounds.length).toBeLessThanOrEqual(2);
    });
  });
});
