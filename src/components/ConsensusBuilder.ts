/**
 * Consensus Builder Component
 * 
 * Facilitates agreement on a final solution among models.
 * Collects final proposals, analyzes similarity, identifies majority agreement,
 * synthesizes hybrid solutions when needed, and generates rationale.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.4
 */

import {
  Model,
  DebateResult,
  ConsensusResult,
  Solution,
  Insight,
  Query,
  ModelResponse
} from '../models/types.js';

/**
 * Configuration for consensus building
 */
interface ConsensusConfig {
  /** Timeout for consensus phase in milliseconds */
  timeout: number;
  /** Threshold for majority agreement (0-1) */
  majorityThreshold: number;
  /** Similarity threshold for clustering proposals (0-1) */
  similarityThreshold: number;
}

/**
 * Default consensus configuration
 */
const DEFAULT_CONFIG: ConsensusConfig = {
  timeout: 60000, // 60 seconds
  majorityThreshold: 0.5,
  similarityThreshold: 0.6
};

/**
 * A proposal from a model with metadata
 */
interface Proposal {
  modelId: string;
  text: string;
  insights: string[];
}

/**
 * Interface for the Consensus Builder component
 */
export interface IConsensusBuilder {
  buildConsensus(
    query: Query,
    debate: DebateResult,
    models: Model[]
  ): Promise<ConsensusResult>;
}

/**
 * Calculate text similarity using word overlap (Jaccard similarity)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
  
  const words2 = new Set(
    text2.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
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
 * Format the consensus prompt for collecting final proposals
 */
function formatConsensusPrompt(
  query: Query,
  debate: DebateResult
): string {
  let prompt = `Final Consensus Round:\n\n`;
  
  prompt += `Original Query: ${query.text}\n\n`;
  
  prompt += `Debate Summary:\n`;
  prompt += `- Total rounds: ${debate.rounds.length}\n`;
  prompt += `- Convergence score: ${debate.convergenceScore.toFixed(2)}\n\n`;
  
  prompt += `Debate History:\n`;
  debate.rounds.forEach(round => {
    prompt += `Round ${round.roundNumber} (disagreement: ${round.disagreementLevel.toFixed(2)}):\n`;
    round.exchanges.forEach(exchange => {
      if (exchange.revisedPosition) {
        prompt += `  ${exchange.modelId}: ${exchange.revisedPosition.substring(0, 150)}...\n`;
      } else if (exchange.defense) {
        prompt += `  ${exchange.modelId}: ${exchange.defense.substring(0, 150)}...\n`;
      }
    });
  });
  prompt += '\n';
  
  prompt += `Instructions:
Based on the complete debate, provide your final proposed solution.
Your proposal should:
1. Incorporate valid insights from other models
2. Address weaknesses identified during debate
3. Represent your best answer to the original query

Format your response as:
FINAL_SOLUTION: [Your complete solution]
INCORPORATED_INSIGHTS: [List key insights from other models that you incorporated]`;
  
  return prompt;
}

/**
 * Parse a consensus response into a proposal
 */
function parseConsensusResponse(responseText: string, modelId: string): Proposal {
  const lines = responseText.split('\n');
  
  let solution = '';
  let insights: string[] = [];
  let currentSection: 'none' | 'solution' | 'insights' = 'none';
  
  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    
    // Detect section headers
    if (upper.startsWith('FINAL_SOLUTION:') || upper.startsWith('FINAL SOLUTION:')) {
      currentSection = 'solution';
      const content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (content) solution += content + '\n';
      continue;
    } else if (upper.startsWith('INCORPORATED_INSIGHTS:') || upper.startsWith('INCORPORATED INSIGHTS:')) {
      currentSection = 'insights';
      const content = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (content) insights.push(content);
      continue;
    }
    
    // Add content to current section
    if (trimmed) {
      switch (currentSection) {
        case 'solution':
          solution += trimmed + '\n';
          break;
        case 'insights':
          // Split by common delimiters
          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
            insights.push(trimmed.substring(1).trim());
          } else {
            insights.push(trimmed);
          }
          break;
      }
    }
  }
  
  // Fallback: if parsing failed, use entire response as solution
  if (!solution) {
    solution = responseText;
  }
  
  return {
    modelId,
    text: solution.trim(),
    insights: insights.filter(i => i.length > 0)
  };
}

/**
 * Cluster proposals by similarity
 */
function clusterProposals(
  proposals: Proposal[],
  similarityThreshold: number
): Map<number, Proposal[]> {
  const clusters = new Map<number, Proposal[]>();
  let nextClusterId = 0;
  
  // Assign each proposal to a cluster
  const proposalClusters = new Map<string, number>();
  
  for (const proposal of proposals) {
    let assignedCluster: number | null = null;
    
    // Check if this proposal is similar to any existing cluster
    for (const [clusterId, clusterProposals] of clusters.entries()) {
      // Compare with first proposal in cluster (representative)
      const representative = clusterProposals[0];
      const similarity = calculateTextSimilarity(proposal.text, representative.text);
      
      if (similarity >= similarityThreshold) {
        assignedCluster = clusterId;
        break;
      }
    }
    
    // If no similar cluster found, create new cluster
    if (assignedCluster === null) {
      assignedCluster = nextClusterId++;
      clusters.set(assignedCluster, []);
    }
    
    clusters.get(assignedCluster)!.push(proposal);
    proposalClusters.set(proposal.modelId, assignedCluster);
  }
  
  return clusters;
}

/**
 * Select the best proposal from a cluster
 */
function selectRepresentative(cluster: Proposal[]): Proposal {
  if (cluster.length === 1) {
    return cluster[0];
  }
  
  // Select the proposal with most insights incorporated
  let best = cluster[0];
  let maxInsights = best.insights.length;
  
  for (const proposal of cluster) {
    if (proposal.insights.length > maxInsights) {
      best = proposal;
      maxInsights = proposal.insights.length;
    }
  }
  
  return best;
}

/**
 * Synthesize a hybrid solution from multiple proposals
 */
function synthesizeHybrid(proposals: Proposal[]): string {
  // Extract common elements from all proposals
  const allWords = proposals.map(p => 
    new Set(p.text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3))
  );
  
  // Find words that appear in majority of proposals
  const wordCounts = new Map<string, number>();
  allWords.forEach(wordSet => {
    wordSet.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });
  
  const commonWords = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= proposals.length / 2)
    .map(([word, _]) => word);
  
  // Build hybrid by taking sentences that contain common words
  const sentences: string[] = [];
  const seenSentences = new Set<string>();
  
  proposals.forEach(proposal => {
    const proposalSentences = proposal.text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    proposalSentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase();
      const sentenceWords = sentenceLower.replace(/[^\w\s]/g, ' ').split(/\s+/);
      
      // Check if sentence contains common words
      const hasCommonWords = sentenceWords.some(w => commonWords.includes(w));
      
      if (hasCommonWords && !seenSentences.has(sentenceLower)) {
        sentences.push(sentence);
        seenSentences.add(sentenceLower);
      }
    });
  });
  
  // If no sentences found, concatenate key points from each proposal
  if (sentences.length === 0) {
    proposals.forEach(proposal => {
      const firstSentence = proposal.text.split(/[.!?]+/)[0]?.trim();
      if (firstSentence) {
        sentences.push(firstSentence);
      }
    });
  }
  
  return sentences.join('. ') + '.';
}

/**
 * Format validation prompt for hybrid solution
 */
function formatValidationPrompt(query: Query, hybridSolution: string): string {
  return `Please validate the following proposed solution to the query.

Original Query: ${query.text}

Proposed Solution: ${hybridSolution}

Does this solution adequately address the query? Respond with:
YES - if the solution is acceptable
NO - if the solution has significant issues

Response: `;
}

/**
 * Consensus Builder implementation
 */
export class ConsensusBuilder implements IConsensusBuilder {
  private config: ConsensusConfig;
  
  constructor(config: Partial<ConsensusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Build consensus among models on a final solution
   * 
   * Validates Requirements:
   * - 5.1: Facilitates agreement on final solution
   * - 5.2: Presents all debate arguments to all models
   * - 5.3: Requires each model to propose final solution incorporating insights
   * - 5.4: Identifies solution with highest agreement
   * - 5.5: Synthesizes hybrid solution if no majority
   * - 5.6: Presents final solution with supporting rationale
   * - 7.4: Completes within 60 seconds
   * 
   * @param query The original user query
   * @param debate Debate results from DebateOrchestrator
   * @param models Array of models participating in consensus
   * @returns Consensus result with final solution and rationale
   */
  async buildConsensus(
    query: Query,
    debate: DebateResult,
    models: Model[]
  ): Promise<ConsensusResult> {
    const startTime = Date.now();
    
    // Set up timeout (Requirement 7.4: 60 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Consensus timeout exceeded')), this.config.timeout);
    });
    
    try {
      const result = await Promise.race([
        this.performConsensus(query, debate, models, startTime),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'Consensus timeout exceeded') {
        // Return a fallback consensus result
        return this.createFallbackConsensus(query, debate, models, startTime);
      }
      throw error;
    }
  }
  
  /**
   * Perform the actual consensus building logic
   */
  private async performConsensus(
    query: Query,
    debate: DebateResult,
    models: Model[],
    startTime: number
  ): Promise<ConsensusResult> {
    // Step 1: Collect final proposals from all models (Requirements 5.1, 5.2, 5.3)
    const proposals = await this.collectProposals(query, debate, models);
    
    // Step 2: Compute pairwise similarity scores and cluster proposals
    const clusters = clusterProposals(proposals, this.config.similarityThreshold);
    
    // Step 3: Identify majority agreement (Requirement 5.4)
    const largestCluster = this.findLargestCluster(clusters);
    const agreementLevel = largestCluster.length / proposals.length;
    
    let finalSolution: Solution;
    let rationale: string;
    
    // Step 4: Check if majority exists (>50%)
    if (agreementLevel > this.config.majorityThreshold) {
      // Majority agreement exists - select representative from largest cluster
      const representative = selectRepresentative(largestCluster);
      
      finalSolution = {
        text: representative.text,
        supportingModels: largestCluster.map(p => p.modelId),
        incorporatedInsights: this.extractInsights(largestCluster),
        confidence: agreementLevel
      };
      
      rationale = this.generateMajorityRationale(
        largestCluster,
        proposals.length,
        agreementLevel
      );
    } else {
      // No majority - synthesize hybrid solution (Requirement 5.5)
      const hybridText = synthesizeHybrid(proposals);
      
      // Validate hybrid with all models
      const validationResults = await this.validateHybrid(query, hybridText, models);
      const approvalCount = validationResults.filter(v => v).length;
      const hybridAgreement = approvalCount / models.length;
      
      finalSolution = {
        text: hybridText,
        supportingModels: models.map(m => m.id),
        incorporatedInsights: this.extractInsights(proposals),
        confidence: hybridAgreement
      };
      
      rationale = this.generateHybridRationale(
        proposals,
        clusters.size,
        approvalCount,
        models.length
      );
    }
    
    const duration = Date.now() - startTime;
    
    return {
      finalSolution,
      agreementLevel,
      rationale,
      duration
    };
  }
  
  /**
   * Collect final proposals from all models
   */
  private async collectProposals(
    query: Query,
    debate: DebateResult,
    models: Model[]
  ): Promise<Proposal[]> {
    const prompt = formatConsensusPrompt(query, debate);
    
    // Request proposals from all models in parallel
    const proposalPromises = models.map(async (model) => {
      try {
        const context = {
          debateHistory: debate.rounds
        };
        
        const response = await model.adapter.generateResponse(prompt, context);
        return parseConsensusResponse(response.text, model.id);
      } catch (error) {
        console.error(`Model ${model.id} failed during consensus:`, error);
        // Return a fallback proposal
        return {
          modelId: model.id,
          text: 'Unable to generate proposal',
          insights: []
        };
      }
    });
    
    const proposals = await Promise.all(proposalPromises);
    return proposals.filter(p => p.text !== 'Unable to generate proposal');
  }
  
  /**
   * Find the largest cluster of proposals
   */
  private findLargestCluster(clusters: Map<number, Proposal[]>): Proposal[] {
    let largest: Proposal[] = [];
    
    for (const cluster of clusters.values()) {
      if (cluster.length > largest.length) {
        largest = cluster;
      }
    }
    
    return largest;
  }
  
  /**
   * Extract insights from proposals
   */
  private extractInsights(proposals: Proposal[]): Insight[] {
    const insights: Insight[] = [];
    const seenInsights = new Set<string>();
    
    proposals.forEach(proposal => {
      proposal.insights.forEach(insight => {
        const normalized = insight.toLowerCase().trim();
        if (!seenInsights.has(normalized) && insight.length > 0) {
          insights.push({
            source: proposal.modelId,
            description: insight,
            incorporated: true
          });
          seenInsights.add(normalized);
        }
      });
    });
    
    return insights;
  }
  
  /**
   * Validate hybrid solution with all models
   */
  private async validateHybrid(
    query: Query,
    hybridSolution: string,
    models: Model[]
  ): Promise<boolean[]> {
    const validationPrompt = formatValidationPrompt(query, hybridSolution);
    
    const validationPromises = models.map(async (model) => {
      try {
        const response = await model.adapter.generateResponse(validationPrompt);
        const responseUpper = response.text.toUpperCase();
        return responseUpper.includes('YES');
      } catch (error) {
        console.error(`Model ${model.id} failed during validation:`, error);
        return false;
      }
    });
    
    return await Promise.all(validationPromises);
  }
  
  /**
   * Generate rationale for majority consensus
   */
  private generateMajorityRationale(
    cluster: Proposal[],
    totalProposals: number,
    agreementLevel: number
  ): string {
    const percentage = (agreementLevel * 100).toFixed(0);
    const modelIds = cluster.map(p => p.modelId).join(', ');
    
    let rationale = `Consensus reached through majority agreement. `;
    rationale += `${cluster.length} out of ${totalProposals} models (${percentage}%) `;
    rationale += `converged on a similar solution. `;
    rationale += `Supporting models: ${modelIds}. `;
    
    // Add insight summary
    const totalInsights = cluster.reduce((sum, p) => sum + p.insights.length, 0);
    if (totalInsights > 0) {
      rationale += `The solution incorporates ${totalInsights} key insights from the debate.`;
    }
    
    return rationale;
  }
  
  /**
   * Generate rationale for hybrid consensus
   */
  private generateHybridRationale(
    proposals: Proposal[],
    clusterCount: number,
    approvalCount: number,
    totalModels: number
  ): string {
    const percentage = ((approvalCount / totalModels) * 100).toFixed(0);
    
    let rationale = `Consensus reached through hybrid synthesis. `;
    rationale += `No single solution achieved majority agreement (${clusterCount} distinct approaches identified). `;
    rationale += `A hybrid solution was synthesized by combining common elements from all proposals. `;
    rationale += `The hybrid solution was validated and approved by ${approvalCount} out of ${totalModels} models (${percentage}%). `;
    
    // Add insight summary
    const totalInsights = proposals.reduce((sum, p) => sum + p.insights.length, 0);
    if (totalInsights > 0) {
      rationale += `The solution incorporates ${totalInsights} insights from across all models.`;
    }
    
    return rationale;
  }
  
  /**
   * Create a fallback consensus result when timeout occurs
   */
  private createFallbackConsensus(
    query: Query,
    debate: DebateResult,
    models: Model[],
    startTime: number
  ): ConsensusResult {
    // Use the last round's exchanges as basis for fallback
    const lastRound = debate.rounds[debate.rounds.length - 1];
    const fallbackText = lastRound?.exchanges[0]?.revisedPosition || 
                        lastRound?.exchanges[0]?.defense || 
                        'Unable to reach consensus within time limit';
    
    return {
      finalSolution: {
        text: fallbackText,
        supportingModels: [models[0]?.id || 'unknown'],
        incorporatedInsights: [],
        confidence: 0.5
      },
      agreementLevel: 0.5,
      rationale: 'Consensus building exceeded time limit. Returning best available solution from debate.',
      duration: Date.now() - startTime
    };
  }
}
