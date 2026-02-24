/**
 * Unit Tests for Analysis Engine
 * 
 * Tests specific examples, edge cases, and error conditions for the AnalysisEngine component.
 */

import { AnalysisEngine } from '../AnalysisEngine';
import { ModelResponse } from '../../models/types';

describe('AnalysisEngine', () => {
  let engine: AnalysisEngine;
  
  beforeEach(() => {
    engine = new AnalysisEngine();
  });
  
  describe('Basic Functionality', () => {
    test('should analyze responses and return complete report structure', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'To solve this problem, we should analyze the data systematically and identify patterns.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'The best approach is to analyze the data carefully and look for patterns in the results.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Verify report structure
      expect(report).toHaveProperty('commonThemes');
      expect(report).toHaveProperty('uniqueApproaches');
      expect(report).toHaveProperty('differences');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('timestamp');
      
      expect(Array.isArray(report.commonThemes)).toBe(true);
      expect(Array.isArray(report.uniqueApproaches)).toBe(true);
      expect(Array.isArray(report.differences)).toBe(true);
      expect(typeof report.summary).toBe('string');
      expect(report.timestamp).toBeInstanceOf(Date);
    });
    
    test('should identify common themes in similar responses', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Machine learning algorithms can be used to predict customer behavior and improve sales.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'Using machine learning algorithms, we can predict customer behavior effectively.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        },
        {
          modelId: 'model-3',
          text: 'Machine learning algorithms are excellent for predicting customer behavior patterns.',
          tokens: 90,
          latency: 480,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should find common themes
      expect(report.commonThemes.length).toBeGreaterThan(0);
      
      // Themes should have supporting models
      report.commonThemes.forEach(theme => {
        expect(theme.supportingModels.length).toBeGreaterThanOrEqual(2);
        expect(theme.confidence).toBeGreaterThan(0);
        expect(theme.confidence).toBeLessThanOrEqual(1);
      });
    });
    
    test('should extract unique approaches for each model', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'We should analyze this problem step by step using a systematic approach.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'Let me compare different solutions and evaluate their trade-offs.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should have one approach per model
      expect(report.uniqueApproaches.length).toBe(2);
      
      // Each approach should have required fields
      report.uniqueApproaches.forEach(approach => {
        expect(approach).toHaveProperty('modelId');
        expect(approach).toHaveProperty('description');
        expect(approach).toHaveProperty('methodology');
        expect(typeof approach.description).toBe('string');
        expect(typeof approach.methodology).toBe('string');
      });
      
      // Model IDs should match
      const modelIds = report.uniqueApproaches.map(a => a.modelId);
      expect(modelIds).toContain('model-1');
      expect(modelIds).toContain('model-2');
    });
    
    test('should categorize differences between responses', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Therefore, the answer is 42 based on mathematical analysis.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'Assuming we have unlimited resources, we could implement solution X.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify differences
      expect(report.differences.length).toBeGreaterThan(0);
      
      // Each difference should have valid type
      const validTypes = ['methodology', 'conclusion', 'assumptions', 'reasoning'];
      report.differences.forEach(diff => {
        expect(validTypes).toContain(diff.type);
        expect(diff.involvedModels.length).toBeGreaterThanOrEqual(2);
        expect(typeof diff.description).toBe('string');
      });
    });
    
    test('should generate meaningful summary', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'The solution involves analyzing data systematically.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'We should analyze the data using a systematic approach.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Summary should mention key aspects
      expect(report.summary).toContain('2');
      expect(report.summary.length).toBeGreaterThan(20);
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle empty responses array', async () => {
      const responses: ModelResponse[] = [];
      
      const report = await engine.analyze(responses);
      
      expect(report.commonThemes).toEqual([]);
      expect(report.uniqueApproaches).toEqual([]);
      expect(report.differences).toEqual([]);
      expect(report.summary).toContain('0');
    });
    
    test('should handle single response', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'This is a single response to analyze.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should have one approach
      expect(report.uniqueApproaches.length).toBe(1);
      
      // No differences with single response
      expect(report.differences.length).toBe(0);
      
      // Summary should mention 1 response
      expect(report.summary).toContain('1');
    });
    
    test('should handle two identical responses', async () => {
      const text = 'This is exactly the same response text.';
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text,
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text,
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify common themes
      expect(report.commonThemes.length).toBeGreaterThan(0);
      
      // Should have minimal or no differences
      expect(report.differences.length).toBe(0);
    });
    
    test('should handle completely different responses', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Quantum mechanics describes the behavior of particles at atomic scales.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'The recipe requires flour, eggs, sugar, and butter mixed together.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify differences
      expect(report.differences.length).toBeGreaterThan(0);
      
      // May have few or no common themes
      // (not asserting on commonThemes as completely different texts may still share common words)
    });
    
    test('should handle very short responses', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Yes.',
          tokens: 1,
          latency: 100,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'No.',
          tokens: 1,
          latency: 100,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should still produce a report
      expect(report.uniqueApproaches.length).toBe(2);
      expect(report.summary).toBeTruthy();
    });
    
    test('should handle very long responses', async () => {
      const longText = 'This is a very long response. '.repeat(100);
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: longText,
          tokens: 500,
          latency: 1000,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: longText + ' With a small difference at the end.',
          tokens: 505,
          latency: 1000,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should handle long text without errors
      expect(report.commonThemes.length).toBeGreaterThan(0);
      expect(report.uniqueApproaches.length).toBe(2);
    });
    
    test('should handle responses with special characters', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'The equation is: f(x) = x^2 + 2x + 1, where x ∈ ℝ.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'Using the formula f(x) = x^2 + 2x + 1 for real numbers.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should handle special characters gracefully without errors
      expect(report.uniqueApproaches.length).toBe(2);
      expect(report.summary).toBeTruthy();
    });
    
    test('should handle maximum number of responses (10)', async () => {
      const responses: ModelResponse[] = Array.from({ length: 10 }, (_, i) => ({
        modelId: `model-${i + 1}`,
        text: `This is response number ${i + 1} with some unique content about topic ${i}.`,
        tokens: 100,
        latency: 500,
        timestamp: new Date()
      }));
      
      const report = await engine.analyze(responses);
      
      // Should handle 10 responses
      expect(report.uniqueApproaches.length).toBe(10);
      expect(report.summary).toContain('10');
    });
  });
  
  describe('Performance', () => {
    test('should complete analysis within 10 seconds', async () => {
      const responses: ModelResponse[] = Array.from({ length: 10 }, (_, i) => ({
        modelId: `model-${i + 1}`,
        text: `This is a detailed response about ${i}. `.repeat(50),
        tokens: 500,
        latency: 1000,
        timestamp: new Date()
      }));
      
      const startTime = Date.now();
      const report = await engine.analyze(responses);
      const duration = Date.now() - startTime;
      
      // Should complete within 10 seconds (10000ms)
      expect(duration).toBeLessThan(10000);
      expect(report).toBeTruthy();
    });
  });
  
  describe('Difference Type Categorization', () => {
    test('should categorize conclusion differences', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'After careful analysis, I conclude that the answer is A.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'Based on the data, the result is clearly B.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify conclusion differences
      const conclusionDiffs = report.differences.filter(d => d.type === 'conclusion');
      expect(conclusionDiffs.length).toBeGreaterThan(0);
    });
    
    test('should categorize assumption differences', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Assuming we have unlimited budget, we can implement solution X which is completely different.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'Given that resources are constrained, solution Y is better and uses alternative methods.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify differences (may be categorized as assumptions or other types)
      expect(report.differences.length).toBeGreaterThan(0);
      
      // At least one difference should involve both models
      const hasBothModels = report.differences.some(d => 
        d.involvedModels.includes('model-1') && d.involvedModels.includes('model-2')
      );
      expect(hasBothModels).toBe(true);
    });
    
    test('should categorize reasoning differences', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'This works because the algorithm optimizes for speed.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'The reason this fails is due to memory constraints.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify reasoning differences
      const reasoningDiffs = report.differences.filter(d => d.type === 'reasoning');
      expect(reasoningDiffs.length).toBeGreaterThan(0);
    });
    
    test('should categorize methodology differences', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'We should use a systematic step-by-step approach.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        },
        {
          modelId: 'model-2',
          text: 'A comparative analysis of alternatives would be best.',
          tokens: 95,
          latency: 450,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      // Should identify methodology differences
      const methodologyDiffs = report.differences.filter(d => d.type === 'methodology');
      expect(methodologyDiffs.length).toBeGreaterThan(0);
    });
  });
  
  describe('Methodology Identification', () => {
    test('should identify analytical methodology', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'We need to analyze and evaluate the data carefully to assess the situation.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      expect(report.uniqueApproaches[0].methodology).toBe('analytical');
    });
    
    test('should identify systematic methodology', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Follow this step-by-step process and systematic approach to solve the problem.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      expect(report.uniqueApproaches[0].methodology).toBe('systematic');
    });
    
    test('should identify comparative methodology', async () => {
      const responses: ModelResponse[] = [
        {
          modelId: 'model-1',
          text: 'Let us compare and contrast the different approaches to find similarities and differences.',
          tokens: 100,
          latency: 500,
          timestamp: new Date()
        }
      ];
      
      const report = await engine.analyze(responses);
      
      expect(report.uniqueApproaches[0].methodology).toBe('comparative');
    });
  });
});
