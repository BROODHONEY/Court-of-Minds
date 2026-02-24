/**
 * Example: Starting Court of Minds with Web UI
 * 
 * This example demonstrates how to start the Court of Minds API server
 * with the web-based user interface.
 */

import { CourtOfMindsServer } from '../src/api/server.js';
import { SessionStore } from '../src/components/SessionStore.js';
import { ModelRegistry } from '../src/components/ModelRegistry.js';
import type { ModelConfig } from '../src/models/types.js';

async function main() {
  console.log('Starting Court of Minds with Web UI...\n');

  // Initialize session store (in-memory for this example)
  const sessionStore = new SessionStore();

  // Initialize model registry
  const modelRegistry = new ModelRegistry();

  // Register some example models
  // Note: Replace with your actual API keys
  const models: ModelConfig[] = [
    {
      id: 'gpt-4',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
      modelName: 'gpt-4',
      enabled: true,
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30,
    },
    {
      id: 'claude-3',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key',
      modelName: 'claude-3-opus-20240229',
      enabled: true,
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30,
    },
    {
      id: 'gemini-pro',
      provider: 'google',
      apiKey: process.env.GOOGLE_API_KEY || 'your-google-api-key',
      modelName: 'gemini-pro',
      enabled: true,
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30,
    },
  ];

  // Register models
  for (const modelConfig of models) {
    try {
      modelRegistry.registerModel(modelConfig);
      console.log(`✓ Registered model: ${modelConfig.id}`);
    } catch (error) {
      console.error(`✗ Failed to register model ${modelConfig.id}:`, error);
    }
  }

  console.log(`\nTotal models registered: ${modelRegistry.getModelCount()}`);
  console.log(`Enabled models: ${modelRegistry.getEnabledModelCount()}\n`);

  // Create and start the server
  const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
    port: 3000,
    enableAuth: false, // Disable auth for demo
  });

  await server.start();

  console.log('\n=================================================');
  console.log('Court of Minds is running!');
  console.log('=================================================');
  console.log('\nWeb UI: http://localhost:3000');
  console.log('API: http://localhost:3000/api');
  console.log('WebSocket: ws://localhost:3000/ws');
  console.log('\nPress Ctrl+C to stop the server\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

// Run the example
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
