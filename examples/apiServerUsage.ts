/**
 * Example: Court of Minds API Server Usage
 * 
 * This example demonstrates how to:
 * - Initialize and start the API server
 * - Register AI models
 * - Submit queries via REST API
 * - Connect to WebSocket for real-time progress
 */

import { CourtOfMindsServer } from '../src/api/index.js';
import { InMemorySessionStore } from '../src/components/SessionStore.js';
import { ModelRegistry } from '../src/components/ModelRegistry.js';

/**
 * Initialize and start the API server
 */
async function startServer() {
  // Create session store and model registry
  const sessionStore = new InMemorySessionStore();
  const modelRegistry = new ModelRegistry();

  // Register some mock models for demonstration
  // In production, use real API keys
  modelRegistry.registerModel({
    id: 'gpt-4',
    provider: 'openai',
    apiKey: 'your-openai-api-key',
    modelName: 'gpt-4',
    enabled: true,
    maxTokens: 2000,
    temperature: 0.7,
    timeout: 30,
  });

  modelRegistry.registerModel({
    id: 'claude-3',
    provider: 'anthropic',
    apiKey: 'your-anthropic-api-key',
    modelName: 'claude-3-opus-20240229',
    enabled: true,
    maxTokens: 2000,
    temperature: 0.7,
    timeout: 30,
  });

  // Create and start server
  const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
    port: 3000,
    enableAuth: false, // Set to true in production
  });

  await server.start();

  console.log('\n=== Court of Minds API Server Started ===');
  console.log('REST API: http://localhost:3000');
  console.log('WebSocket: ws://localhost:3000/ws');
  console.log('\nAvailable endpoints:');
  console.log('  POST   /api/query          - Submit new query');
  console.log('  GET    /api/session/:id    - Get session details');
  console.log('  GET    /api/sessions       - List user sessions');
  console.log('  GET    /api/models         - Get available models');
  console.log('  POST   /api/models         - Register new model (admin)');
  console.log('  PATCH  /api/models/:id     - Enable/disable model (admin)');
  console.log('\nWebSocket events:');
  console.log('  - session_created');
  console.log('  - collecting_responses');
  console.log('  - responses_collected');
  console.log('  - analyzing');
  console.log('  - analysis_complete');
  console.log('  - debating');
  console.log('  - debate_round_complete');
  console.log('  - debate_complete');
  console.log('  - building_consensus');
  console.log('  - consensus_complete');
  console.log('  - session_complete');
  console.log('  - session_failed');
  console.log('\n===========================================\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });

  return server;
}

/**
 * Example REST API usage with curl commands
 */
function printExampleCurlCommands() {
  console.log('\n=== Example API Usage ===\n');

  console.log('1. Get available models:');
  console.log('   curl http://localhost:3000/api/models\n');

  console.log('2. Submit a single-model query:');
  console.log('   curl -X POST http://localhost:3000/api/query \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"text": "What is the capital of France?", "mode": "single", "selectedModels": ["gpt-4"], "userId": "user123"}\'\n');

  console.log('3. Submit a multi-model query:');
  console.log('   curl -X POST http://localhost:3000/api/query \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"text": "Explain quantum computing", "mode": "multi", "userId": "user123"}\'\n');

  console.log('4. Get session details:');
  console.log('   curl http://localhost:3000/api/session/{sessionId}\n');

  console.log('5. List user sessions:');
  console.log('   curl "http://localhost:3000/api/sessions?userId=user123"\n');

  console.log('=========================\n');
}

/**
 * Example WebSocket client usage
 */
function printWebSocketExample() {
  console.log('\n=== WebSocket Client Example ===\n');
  console.log('const ws = new WebSocket("ws://localhost:3000/ws");');
  console.log('');
  console.log('ws.on("open", () => {');
  console.log('  // Subscribe to session updates');
  console.log('  ws.send(JSON.stringify({');
  console.log('    type: "subscribe",');
  console.log('    sessionId: "your-session-id",');
  console.log('    userId: "user123"');
  console.log('  }));');
  console.log('});');
  console.log('');
  console.log('ws.on("message", (data) => {');
  console.log('  const event = JSON.parse(data);');
  console.log('  console.log("Progress event:", event.type, event.data);');
  console.log('});');
  console.log('\n================================\n');
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then(() => {
      printExampleCurlCommands();
      printWebSocketExample();
    })
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}

export { startServer };
