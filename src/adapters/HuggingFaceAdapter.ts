/**
 * HuggingFaceAdapter - Adapter for Hugging Face Inference API
 * Supports thousands of open-source models
 */

import { BaseModelAdapter } from './BaseModelAdapter.js';
import type { ModelResponse, Context, ModelInfo } from '../models/types.js';

export interface HuggingFaceConfig {
  modelId: string;
  apiKey: string;
  modelName: string; // e.g., 'meta-llama/Llama-2-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  useInferenceEndpoint?: boolean; // Use dedicated inference endpoint
  endpointUrl?: string; // Custom endpoint URL if using dedicated endpoint
}

export class HuggingFaceAdapter extends BaseModelAdapter {
  private apiKey: string;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;
  private useInferenceEndpoint: boolean;
  private endpointUrl?: string;

  constructor(config: HuggingFaceConfig) {
    super(config.modelId, config.timeout || 60000); // HF can be slower, default 60s
    this.apiKey = config.apiKey;
    this.modelName = config.modelName;
    this.maxTokens = config.maxTokens || 2000;
    this.temperature = config.temperature || 0.7;
    this.useInferenceEndpoint = config.useInferenceEndpoint || false;
    this.endpointUrl = config.endpointUrl;
  }

  protected async generateResponseInternal(
    prompt: string,
    context?: Context
  ): Promise<Omit<ModelResponse, 'modelId' | 'latency' | 'timestamp'>> {
    // Format the full prompt with context
    let fullPrompt = prompt;
    if (context) {
      const contextText = this.formatContext(context);
      if (contextText) {
        fullPrompt = `${contextText}\n\n${prompt}`;
      }
    }

    // Determine API URL
    const apiUrl = this.useInferenceEndpoint && this.endpointUrl
      ? this.endpointUrl
      : `https://api-inference.huggingface.co/models/${this.modelName}`;

    // Make API call
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: this.maxTokens,
          temperature: this.temperature,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = `Hugging Face API error: ${response.status} - ${JSON.stringify(error)}`;
      
      // Check for rate limit or model loading
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded: ${errorMessage}`);
      }
      if (response.status === 503) {
        throw new Error(`Model is loading, please retry: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    interface HFArrayResponse {
      generated_text: string;
    }
    
    interface HFObjectResponse {
      generated_text: string;
    }
    
    const data = await response.json() as HFArrayResponse[] | HFObjectResponse;

    // Handle different response formats
    let text: string;
    if (Array.isArray(data)) {
      text = data[0]?.generated_text || '';
    } else if ('generated_text' in data) {
      text = data.generated_text;
    } else {
      throw new Error('Unexpected response format from Hugging Face API');
    }

    const tokens = this.estimateTokens(text);

    return { text, tokens };
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'huggingface',
      modelName: this.modelName,
      capabilities: ['text-generation', 'open-source'],
    };
  }

  private formatContext(context: Context): string {
    let contextText = '';

    if (context.previousResponses && context.previousResponses.length > 0) {
      contextText += 'Context - Previous responses:\n';
      context.previousResponses.forEach((resp) => {
        contextText += `${resp.modelId}: ${resp.text.substring(0, 200)}...\n`;
      });
      contextText += '\n';
    }

    if (context.analysisReport) {
      contextText += `Analysis: ${context.analysisReport.summary}\n\n`;
    }

    return contextText;
  }
}
