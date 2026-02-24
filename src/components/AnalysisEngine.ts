/**
 * Analysis Engine Component
 * 
 * Identifies similarities, differences, and patterns across model responses.
 * Implements semantic similarity analysis to find common themes and unique approaches.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 9.5
 */

import {
  ModelResponse,
  AnalysisReport,
  Theme,
  Approach,
  Difference,
  DifferenceType
} from '../models/types';
import { errorLogger } from '../utils/errorLogger.js';

/**
 * Interface for the Analysis Engine component
 */
export interface IAnalysisEngine {
  analyze(responses: ModelResponse[]): Promise<AnalysisReport>;
}

/**
 * Simple word tokenizer for text analysis
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3); // Filter out short words
}

/**
 * Calculate cosine similarity between two text strings
 */
function cosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  // Build vocabulary
  const vocab = new Set([...tokens1, ...tokens2]);
  
  // Create frequency vectors
  const vector1: number[] = [];
  const vector2: number[] = [];
  
  vocab.forEach(word => {
    vector1.push(tokens1.filter(t => t === word).length);
    vector2.push(tokens2.filter(t => t === word).length);
  });
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Extract key phrases from text (simple n-gram extraction)
 */
function extractKeyPhrases(text: string, n: number = 3): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  const phrases: string[] = [];
  
  for (let i = 0; i <= words.length - n; i++) {
    phrases.push(words.slice(i, i + n).join(' '));
  }
  
  return phrases;
}

/**
 * Identify methodology keywords in text
 */
function identifyMethodology(text: string): string {
  const methodologyKeywords = {
    'analytical': ['analyze', 'analysis', 'examine', 'evaluate', 'assess', 'study'],
    'systematic': ['step', 'process', 'procedure', 'method', 'approach', 'systematic'],
    'comparative': ['compare', 'contrast', 'versus', 'difference', 'similarity'],
    'empirical': ['data', 'evidence', 'observation', 'experiment', 'test'],
    'theoretical': ['theory', 'concept', 'principle', 'framework', 'model'],
    'practical': ['implement', 'apply', 'practice', 'execute', 'perform']
  };
  
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = {};
  
  for (const [methodology, keywords] of Object.entries(methodologyKeywords)) {
    scores[methodology] = keywords.filter(keyword => lowerText.includes(keyword)).length;
  }
  
  // Return methodology with highest score
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'general';
  
  return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'general';
}

/**
 * Categorize a difference between responses
 */
function categorizeDifference(response1: string, response2: string): DifferenceType {
  const r1Lower = response1.toLowerCase();
  const r2Lower = response2.toLowerCase();
  
  // Check for conclusion differences (result-oriented words)
  const conclusionWords = ['therefore', 'thus', 'conclude', 'result', 'outcome', 'final', 'answer', 'solution'];
  const hasConclusion1 = conclusionWords.some(word => r1Lower.includes(word));
  const hasConclusion2 = conclusionWords.some(word => r2Lower.includes(word));
  
  if (hasConclusion1 || hasConclusion2) {
    return 'conclusion';
  }
  
  // Check for assumption differences
  const assumptionWords = ['assume', 'given', 'suppose', 'presume', 'premise', 'if', 'provided'];
  const hasAssumption1 = assumptionWords.some(word => r1Lower.includes(word));
  const hasAssumption2 = assumptionWords.some(word => r2Lower.includes(word));
  
  if (hasAssumption1 || hasAssumption2) {
    return 'assumptions';
  }
  
  // Check for reasoning differences
  const reasoningWords = ['because', 'since', 'reason', 'explain', 'why', 'cause', 'due to'];
  const hasReasoning1 = reasoningWords.some(word => r1Lower.includes(word));
  const hasReasoning2 = reasoningWords.some(word => r2Lower.includes(word));
  
  if (hasReasoning1 || hasReasoning2) {
    return 'reasoning';
  }
  
  // Default to methodology
  return 'methodology';
}

/**
 * Analysis Engine implementation
 */
export class AnalysisEngine implements IAnalysisEngine {
  private readonly SIMILARITY_THRESHOLD = 0.3; // Threshold for considering responses similar
  private readonly TIMEOUT_MS = 10000; // 10 second timeout
  
  /**
   * Analyze multiple model responses to identify patterns and differences
   * 
   * @param responses Array of model responses to analyze
   * @returns Analysis report with themes, approaches, and differences
   */
  async analyze(responses: ModelResponse[]): Promise<AnalysisReport> {
    const startTime = Date.now();
    
    errorLogger.logInfo(
      'AnalysisEngine',
      `Starting analysis of ${responses.length} responses`,
      { responseCount: responses.length, modelIds: responses.map(r => r.modelId) }
    );
    
    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout exceeded')), this.TIMEOUT_MS);
    });
    
    // Perform analysis with timeout
    const analysisPromise = this.performAnalysis(responses);
    
    try {
      const result = await Promise.race([analysisPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      errorLogger.logInfo(
        'AnalysisEngine',
        `Analysis completed successfully in ${duration}ms`,
        {
          responseCount: responses.length,
          themesFound: result.commonThemes.length,
          differencesFound: result.differences.length,
          duration,
        }
      );
      
      return result;
    } catch (error) {
      // If timeout, return partial results
      if (error instanceof Error && error.message === 'Analysis timeout exceeded') {
        errorLogger.logWarning(
          'AnalysisEngine',
          'Analysis timeout - returning partial results',
          { responseCount: responses.length, timeout: this.TIMEOUT_MS }
        );
        return this.createEmptyReport();
      }
      
      errorLogger.logError(
        'AnalysisEngine',
        error instanceof Error ? error : new Error(String(error)),
        { responseCount: responses.length }
      );
      throw error;
    }
  }
  
  /**
   * Perform the actual analysis logic
   */
  private async performAnalysis(responses: ModelResponse[]): Promise<AnalysisReport> {
    // Step 1: Identify common themes using clustering
    const commonThemes = this.identifyCommonThemes(responses);
    
    // Step 2: Extract unique approaches from each response
    const uniqueApproaches = this.extractUniqueApproaches(responses);
    
    // Step 3: Categorize differences between responses
    const differences = this.categorizeDifferences(responses);
    
    // Step 4: Generate natural language summary
    const summary = this.generateSummary(commonThemes, uniqueApproaches, differences, responses);
    
    return {
      commonThemes,
      uniqueApproaches,
      differences,
      summary,
      timestamp: new Date()
    };
  }
  
  /**
   * Identify common themes across all responses using semantic similarity
   */
  private identifyCommonThemes(responses: ModelResponse[]): Theme[] {
    const themes: Theme[] = [];
    
    if (responses.length === 0) {
      return themes;
    }
    
    // Extract key phrases from all responses
    const allPhrases = responses.map(r => ({
      modelId: r.modelId,
      phrases: extractKeyPhrases(r.text, 3)
    }));
    
    // Find phrases that appear in multiple responses
    const phraseOccurrences = new Map<string, string[]>();
    
    allPhrases.forEach(({ modelId, phrases }) => {
      phrases.forEach(phrase => {
        if (!phraseOccurrences.has(phrase)) {
          phraseOccurrences.set(phrase, []);
        }
        if (!phraseOccurrences.get(phrase)!.includes(modelId)) {
          phraseOccurrences.get(phrase)!.push(modelId);
        }
      });
    });
    
    // Create themes from phrases that appear in multiple responses
    phraseOccurrences.forEach((modelIds, phrase) => {
      if (modelIds.length >= 2) {
        themes.push({
          description: phrase,
          supportingModels: modelIds,
          confidence: modelIds.length / responses.length
        });
      }
    });
    
    // Sort by confidence and take top themes
    themes.sort((a, b) => b.confidence - a.confidence);
    
    // If no phrase-based themes found, create a general theme
    if (themes.length === 0) {
      // Calculate overall similarity
      let totalSimilarity = 0;
      let comparisons = 0;
      
      for (let i = 0; i < responses.length; i++) {
        for (let j = i + 1; j < responses.length; j++) {
          totalSimilarity += cosineSimilarity(responses[i].text, responses[j].text);
          comparisons++;
        }
      }
      
      const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
      
      if (avgSimilarity > this.SIMILARITY_THRESHOLD) {
        themes.push({
          description: 'All models provide similar overall approaches',
          supportingModels: responses.map(r => r.modelId),
          confidence: avgSimilarity
        });
      }
    }
    
    return themes.slice(0, 5); // Return top 5 themes
  }
  
  /**
   * Extract unique approaches from each response
   */
  private extractUniqueApproaches(responses: ModelResponse[]): Approach[] {
    const approaches: Approach[] = [];
    
    responses.forEach(response => {
      // Identify methodology
      const methodology = identifyMethodology(response.text);
      
      // Extract first sentence or first 100 chars as description
      const sentences = response.text.split(/[.!?]+/);
      const description = sentences[0]?.trim() || response.text.substring(0, 100);
      
      approaches.push({
        modelId: response.modelId,
        description: description,
        methodology: methodology
      });
    });
    
    return approaches;
  }
  
  /**
   * Categorize differences between responses
   */
  private categorizeDifferences(responses: ModelResponse[]): Difference[] {
    const differences: Difference[] = [];
    
    if (responses.length < 2) {
      return differences;
    }
    
    // Compare each pair of responses
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const r1 = responses[i];
        const r2 = responses[j];
        
        const similarity = cosineSimilarity(r1.text, r2.text);
        
        // If responses are dissimilar, categorize the difference
        if (similarity < this.SIMILARITY_THRESHOLD) {
          const diffType = categorizeDifference(r1.text, r2.text);
          
          differences.push({
            type: diffType,
            description: `${r1.modelId} and ${r2.modelId} differ in their ${diffType}`,
            involvedModels: [r1.modelId, r2.modelId]
          });
        }
      }
    }
    
    // Deduplicate differences by type and involved models
    const uniqueDifferences = differences.filter((diff, index, self) =>
      index === self.findIndex(d =>
        d.type === diff.type &&
        d.involvedModels.sort().join(',') === diff.involvedModels.sort().join(',')
      )
    );
    
    return uniqueDifferences;
  }
  
  /**
   * Generate natural language summary of the analysis
   */
  private generateSummary(
    themes: Theme[],
    approaches: Approach[],
    differences: Difference[],
    responses: ModelResponse[]
  ): string {
    const parts: string[] = [];
    
    // Summary of responses
    parts.push(`Analyzed ${responses.length} model response${responses.length !== 1 ? 's' : ''}.`);
    
    // Common themes
    if (themes.length > 0) {
      parts.push(`Found ${themes.length} common theme${themes.length !== 1 ? 's' : ''} across responses.`);
    } else {
      parts.push('No significant common themes identified.');
    }
    
    // Unique approaches
    const methodologies = new Set(approaches.map(a => a.methodology));
    if (methodologies.size > 1) {
      parts.push(`Models employed ${methodologies.size} different methodologies: ${Array.from(methodologies).join(', ')}.`);
    } else {
      parts.push(`All models used a ${approaches[0]?.methodology || 'similar'} approach.`);
    }
    
    // Differences
    if (differences.length > 0) {
      const diffTypes = differences.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const diffSummary = Object.entries(diffTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      
      parts.push(`Identified ${differences.length} difference${differences.length !== 1 ? 's' : ''}: ${diffSummary}.`);
    } else {
      parts.push('Models show strong agreement with minimal differences.');
    }
    
    return parts.join(' ');
  }
  
  /**
   * Create an empty report (used for timeout scenarios)
   */
  private createEmptyReport(): AnalysisReport {
    return {
      commonThemes: [],
      uniqueApproaches: [],
      differences: [],
      summary: 'Analysis incomplete due to timeout',
      timestamp: new Date()
    };
  }
}
