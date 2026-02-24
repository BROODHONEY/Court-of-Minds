/**
 * OpenAIAdapter - Adapter for OpenAI models (GPT-3.5, GPT-4, etc.)
 * 
 * Handles communication with OpenAI's API
 */

import { BaseModelAdapter } from './BaseModelAdapter.js';
import type { ModelResponse, Context, ModelInfo } from '../models/types.js';

export interface OpenAIConfig {
  modelId: string;
  apiKey: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class OpenAIAdapter extends BaseModelAdapter {
  private apiKey: string;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: OpenAIConfig) {
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
    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];

    // Add context if provided
    if (context) {
      if (context.previousResponses && context.previousResponses.length > 0) {
        const contextText = this.formatContext(context);
        messages.push({
          role: 'system',
          content: contextText,
        });
      }
    }

    // Add the main prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    // Make API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI API');
    }

    const text = data.choices[0].message.content;
    const tokens = data.usage?.total_tokens || this.estimateTokens(text);

    return {
      text,
      tokens,
    };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'openai',
      modelName: this.modelName,
      capabilities: ['chat', 'completion', 'reasoning'],
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
