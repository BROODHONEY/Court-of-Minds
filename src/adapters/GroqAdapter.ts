/**
 * GroqAdapter - Adapter for Groq models (Llama, Mixtral, etc.)
 * Groq provides ultra-fast inference for open-source models
 */

import { BaseModelAdapter } from './BaseModelAdapter.js';
import type { ModelResponse, Context, ModelInfo } from '../models/types.js';

export interface GroqConfig {
  modelId: string;
  apiKey: string;
  modelName: string; // e.g., 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class GroqAdapter extends BaseModelAdapter {
  private apiKey: string;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: GroqConfig) {
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
    // Build messages array (Groq uses OpenAI-compatible API)
    const messages: Array<{ role: string; content: string }> = [];

    // Add context if provided
    if (context) {
      const contextText = this.formatContext(context);
      if (contextText) {
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

    // Make API call to Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      const errorMessage = `Groq API error: ${response.status} - ${JSON.stringify(error)}`;
      
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json() as {
      choices?: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Groq API');
    }

    const text = data.choices[0].message.content;
    const tokens = data.usage?.total_tokens || this.estimateTokens(text);

    return { text, tokens };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'groq',
      modelName: this.modelName,
      capabilities: ['chat', 'completion', 'ultra-fast-inference'],
    };
  }

  private formatContext(context: Context): string {
    let contextText = '';

    if (context.previousResponses && context.previousResponses.length > 0) {
      contextText += 'Previous responses from other models:\n\n';
      context.previousResponses.forEach((resp) => {
        contextText += `Model ${resp.modelId}:\n${resp.text}\n\n`;
      });
    }

    if (context.analysisReport) {
      contextText += `Analysis: ${context.analysisReport.summary}\n\n`;
    }

    if (context.debateHistory && context.debateHistory.length > 0) {
      contextText += 'Debate History:\n';
      context.debateHistory.forEach((round) => {
        contextText += `Round ${round.roundNumber}: `;
        round.exchanges.forEach((ex) => {
          contextText += `${ex.modelId} - ${ex.critique.substring(0, 100)}... `;
        });
        contextText += '\n';
      });
    }

    return contextText;
  }
}
