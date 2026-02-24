/**
 * Unit tests for ConsensusBuilder component
 * 
 * Tests basic functionality, majority agreement, hybrid synthesis,
 * and timeout handling.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConsensusBuilder } from './ConsensusBuilder.js';
import {
  Query,
  DebateResult,
  Model,
  ModelAdapter,
  ModelResponse,
  ModelInfo,
  Context
} from '../models/types.js';

/**
 * Mock model adapter for testing
 */
class MockAdapter implements ModelAdapter {
  private responses: string[];
  private responseIndex: number = 0;
  
  constructor(
    private modelId: string,
    responses: string[]
  ) {
    this.responses = responses;
  }
  
  async generateResponse(prompt: string, context?: Context): Promise<ModelResponse> {
    const response = this.responses[this.responseIndex % this.responses.length];
    this.responseIndex++;
    
    return {
      modelId: this.modelId,
      text: response,
      tokens: response.split(' ').length,
      latency: 100,
      timestamp: new Date()
    };
  }
  
  getModelInfo(): ModelInfo {
    return {
      provider: 'mock',
      modelName: this.modelId,
      capabilities: ['test']
    };
  }
}

describe('ConsensusBuilder', () => {
  let consensusBuilder: ConsensusBuilder;
  let query: Query;
  let debate: DebateResult;
  
  beforeEach(() => {
    consensusBuilder = new ConsensusBuilder();
    
    query = {
      id: 'test-query',
      text: 'What is the best approach to solve this problem?',
      userId: 'test-user',
      timestamp: new Date()
    };
    
    debate = {
      rounds: [
        {
          roundNumber: 1,
          exchanges: [
            {
              modelId: 'model1',
              critique: 'Model 2 has a good point about efficiency',
              defense: 'My approach focuses on simplicity',
              revisedPosition: 'Use a simple and efficient approach',
              timestamp: new Date()
            },
            {
              modelId: 'model2',
              critique: 'Model 1 is too simple',
              defense: 'My approach is more comprehensive',
              revisedPosition: 'Use a comprehensive efficient approach',
              timestamp: new Date()
            }
          ],
          disagreementLevel: 0.3
        }
      ],
      convergenceScore: 0.7,
      duration: 5000
    };
  });
  
  it('should build consensus with majority agreement', async () => {
    // Create models with similar proposals
    const models: Model[] = [
      {
        id: 'model1',
        provider: 'mock',
        name: 'Model 1',
        enabled: true,
        adapter: new MockAdapter('model1', [
          'FINAL_SOLUTION: Use a balanced approach that combines simplicity with efficiency\nINCORPORATED_INSIGHTS: Focus on efficiency from model2'
        ])
      },
      {
        id: 'model2',
        provider: 'mock',
        name: 'Model 2',
        enabled: true,
        adapter: new MockAdapter('model2', [
          'FINAL_SOLUTION: Use a balanced approach combining simplicity and efficiency\nINCORPORATED_INSIGHTS: Simplicity from model1'
        ])
      },
      {
        id: 'model3',
        provider: 'mock',
        name: 'Model 3',
        enabled: true,
        adapter: new MockAdapter('model3', [
          'FINAL_SOLUTION: A completely different approach using advanced techniques'
        ])
      }
    ];
    
    const result = await consensusBuilder.buildConsensus(query, debate, models);
    
    // Verify result structure
    expect(result).toBeDefined();
    expect(result.finalSolution).toBeDefined();
    expect(result.finalSolution.text).toBeTruthy();
    expect(result.finalSolution.supportingModels.length).toBeGreaterThan(0);
    expect(result.agreementLevel).toBeGreaterThan(0);
    expect(result.agreementLevel).toBeLessThanOrEqual(1);
    expect(result.rationale).toBeTruthy();
    expect(result.duration).toBeGreaterThan(0);
  });
  
  it('should synthesize hybrid solution when no majority', async () => {
    // Create models with very different proposals to ensure no clustering
    const models: Model[] = [
      {
        id: 'model1',
        provider: 'mock',
        name: 'Model 1',
        enabled: true,
        adapter: new MockAdapter('model1', [
          'FINAL_SOLUTION: Implement machine learning algorithms using neural networks and deep learning frameworks\nINCORPORATED_INSIGHTS: None',
          'YES' // Validation response
        ])
      },
      {
        id: 'model2',
        provider: 'mock',
        name: 'Model 2',
        enabled: true,
        adapter: new MockAdapter('model2', [
          'FINAL_SOLUTION: Create database schema with relational tables and SQL queries for data storage\nINCORPORATED_INSIGHTS: None',
          'YES' // Validation response
        ])
      },
      {
        id: 'model3',
        provider: 'mock',
        name: 'Model 3',
        enabled: true,
        adapter: new MockAdapter('model3', [
          'FINAL_SOLUTION: Design user interface components with React hooks and TypeScript interfaces\nINCORPORATED_INSIGHTS: None',
          'YES' // Validation response
        ])
      }
    ];
    
    const result = await consensusBuilder.buildConsensus(query, debate, models);
    
    // Verify hybrid synthesis
    expect(result).toBeDefined();
    expect(result.finalSolution).toBeDefined();
    expect(result.finalSolution.text).toBeTruthy();
    expect(result.rationale).toContain('hybrid');
    expect(result.duration).toBeGreaterThan(0);
  });
  
  it('should complete within timeout', async () => {
    const shortTimeout = new ConsensusBuilder({ timeout: 100 });
    
    // Create models with slow responses
    const slowAdapter = new MockAdapter('slow', [
      'FINAL_SOLUTION: This is a solution'
    ]);
    
    // Override generateResponse to be slow
    slowAdapter.generateResponse = async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        modelId: 'slow',
        text: 'FINAL_SOLUTION: Too slow',
        tokens: 10,
        latency: 200,
        timestamp: new Date()
      };
    };
    
    const models: Model[] = [
      {
        id: 'slow',
        provider: 'mock',
        name: 'Slow Model',
        enabled: true,
        adapter: slowAdapter
      }
    ];
    
    const result = await shortTimeout.buildConsensus(query, debate, models);
    
    // Should return fallback result
    expect(result).toBeDefined();
    expect(result.finalSolution).toBeDefined();
    expect(result.duration).toBeLessThan(150); // Should timeout quickly
  });
  
  it('should handle model failures gracefully', async () => {
    const failingAdapter = new MockAdapter('failing', []);
    failingAdapter.generateResponse = async () => {
      throw new Error('Model failed');
    };
    
    const models: Model[] = [
      {
        id: 'failing',
        provider: 'mock',
        name: 'Failing Model',
        enabled: true,
        adapter: failingAdapter
      },
      {
        id: 'working',
        provider: 'mock',
        name: 'Working Model',
        enabled: true,
        adapter: new MockAdapter('working', [
          'FINAL_SOLUTION: This works fine'
        ])
      }
    ];
    
    const result = await consensusBuilder.buildConsensus(query, debate, models);
    
    // Should still produce a result with working model
    expect(result).toBeDefined();
    expect(result.finalSolution).toBeDefined();
  });
  
  it('should extract and incorporate insights', async () => {
    const models: Model[] = [
      {
        id: 'model1',
        provider: 'mock',
        name: 'Model 1',
        enabled: true,
        adapter: new MockAdapter('model1', [
          'FINAL_SOLUTION: Combined approach\nINCORPORATED_INSIGHTS:\n- Insight from model2 about efficiency\n- Insight from model3 about scalability'
        ])
      },
      {
        id: 'model2',
        provider: 'mock',
        name: 'Model 2',
        enabled: true,
        adapter: new MockAdapter('model2', [
          'FINAL_SOLUTION: Combined approach\nINCORPORATED_INSIGHTS:\n- Insight from model1 about simplicity'
        ])
      }
    ];
    
    const result = await consensusBuilder.buildConsensus(query, debate, models);
    
    // Verify insights are extracted
    expect(result.finalSolution.incorporatedInsights.length).toBeGreaterThan(0);
    expect(result.finalSolution.incorporatedInsights.every(i => i.incorporated)).toBe(true);
  });
  
  it('should generate appropriate rationale', async () => {
    const models: Model[] = [
      {
        id: 'model1',
        provider: 'mock',
        name: 'Model 1',
        enabled: true,
        adapter: new MockAdapter('model1', [
          'FINAL_SOLUTION: Solution A'
        ])
      },
      {
        id: 'model2',
        provider: 'mock',
        name: 'Model 2',
        enabled: true,
        adapter: new MockAdapter('model2', [
          'FINAL_SOLUTION: Solution A'
        ])
      }
    ];
    
    const result = await consensusBuilder.buildConsensus(query, debate, models);
    
    // Rationale should explain how consensus was reached
    expect(result.rationale).toBeTruthy();
    expect(result.rationale.length).toBeGreaterThan(20);
    expect(
      result.rationale.includes('majority') || result.rationale.includes('hybrid')
    ).toBe(true);
  });
});
