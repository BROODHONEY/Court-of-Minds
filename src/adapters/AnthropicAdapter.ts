/**
 * AnthropicAdapter - Adapter for Anthropic models (Claude)
 * 
 * Handles communication with Anthropic's API
 */

import { BaseModelAdapter } from './BaseModelAdapter.js';
import type { ModelResponse, Context, ModelInfo } from '../models/types.js';

export interface AnthropicConfig {
  modelId: string;
  apiKey: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class AnthropicAdapter extends BaseModelAdapter {
  private apiKey: string;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: AnthropicConfig) {
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

    // Add context as system message if provided
    let systemPrompt = '';
    if (context) {
      systemPrompt = this.formatContext(context);
    }

    // Add the main prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    // Make API call
    const requestBody: any = {
      model: this.modelName,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json() as {
      content?: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    if (!data.content || data.content.length === 0) {
      throw new Error('No response from Anthropic API');
    }

    const text = data.content[0].text;
    const tokens = data.usage?.input_tokens && data.usage?.output_tokens 
      ? data.usage.input_tokens + data.usage.output_tokens 
      : this.estimateTokens(text);

    return {
      text,
      tokens,
    };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'anthropic',
      modelName: this.modelName,
      capabilities: ['chat', 'completion', 'reasoning', 'long-context'],
    };
  }

  /**
   * Format context for inclusion in the system prompt
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
