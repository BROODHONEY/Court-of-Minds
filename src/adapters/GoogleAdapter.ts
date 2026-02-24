/**
 * GoogleAdapter - Adapter for Google AI models (Gemini)
 * 
 * Handles communication with Google's Generative AI API
 */

import { BaseModelAdapter } from './BaseModelAdapter.js';
import type { ModelResponse, Context, ModelInfo } from '../models/types.js';

export interface GoogleConfig {
  modelId: string;
  apiKey: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class GoogleAdapter extends BaseModelAdapter {
  private apiKey: string;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: GoogleConfig) {
    super(config.modelId, config.timeout);
    this.apiKey = config.apiKey;
    this.modelName = config.modelName;
    this.maxTokens = config.maxTokens || 2000;
    this.temperature = config.temperature || 0.7;
  }

  protected async generateResponseInternal(
    prompt: string,
    context?: Context
  ): Promise<Omit<ModelResponse, 'modelId' | 'latency' | 'timestamp'>> {
    // Build the full prompt with context
    let fullPrompt = '';
    
    if (context) {
      const contextText = this.formatContext(context);
      if (contextText) {
        fullPrompt += contextText + '\n\n';
      }
    }
    
    fullPrompt += prompt;

    // Make API call
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt,
          }],
        }],
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = `Google API error: ${response.status} - ${JSON.stringify(error)}`;
      
      // Check if it's a rate limit error
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text: string }>;
        };
      }>;
      usageMetadata?: { totalTokenCount: number };
    };

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Google API');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Invalid response structure from Google API');
    }

    const text = candidate.content.parts[0].text;
    const tokens = data.usageMetadata?.totalTokenCount || this.estimateTokens(text);

    return {
      text,
      tokens,
    };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'google',
      modelName: this.modelName,
      capabilities: ['chat', 'completion', 'multimodal'],
    };
  }

  /**
   * Format context for inclusion in the prompt
   */
  private formatContext(context: Context): string {
    let contextText = '';

    if (context.previousResponses && context.previousResponses.length > 0) {
      contextText += 'Previous responses from other models:\n\n';
      context.previousResponses.forEach((resp) => {
        contextText += `Model ${resp.modelId}:\n${resp.text}\n\n`;
      });
    }

    if (context.analysisReport) {
      contextText += 'Analysis Report:\n\n';
      contextText += `Summary: ${context.analysisReport.summary}\n\n`;
      
      if (context.analysisReport.commonThemes.length > 0) {
        contextText += 'Common Themes:\n';
        context.analysisReport.commonThemes.forEach((theme) => {
          contextText += `- ${theme.description}\n`;
        });
        contextText += '\n';
      }

      if (context.analysisReport.differences.length > 0) {
        contextText += 'Key Differences:\n';
        context.analysisReport.differences.forEach((diff) => {
          contextText += `- ${diff.type}: ${diff.description}\n`;
        });
        contextText += '\n';
      }
    }

    if (context.debateHistory && context.debateHistory.length > 0) {
      contextText += 'Debate History:\n\n';
      context.debateHistory.forEach((round) => {
        contextText += `Round ${round.roundNumber}:\n`;
        round.exchanges.forEach((exchange) => {
          contextText += `  Model ${exchange.modelId}:\n`;
          contextText += `    Critique: ${exchange.critique}\n`;
          contextText += `    Defense: ${exchange.defense}\n`;
          if (exchange.revisedPosition) {
            contextText += `    Revised Position: ${exchange.revisedPosition}\n`;
          }
        });
        contextText += '\n';
      });
    }

    return contextText;
  }
}
