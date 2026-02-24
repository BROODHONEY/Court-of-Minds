/**
 * Tests for Court of Minds API Server
 * 
 * These tests verify:
 * - REST API endpoint functionality
 * - Request validation
 * - Error handling
 * - Integration with core components
 */

import request from 'supertest';
import { CourtOfMindsServer } from '../server.js';
import { InMemorySessionStore } from '../../components/SessionStore.js';
import { ModelRegistry } from '../../components/ModelRegistry.js';
import type { Express } from 'express';

describe('CourtOfMindsServer', () => {
  let server: CourtOfMindsServer;
  let app: Express;
  let sessionStore: InMemorySessionStore;
  let modelRegistry: ModelRegistry;

  beforeEach(() => {
    // Create fresh instances for each test
    sessionStore = new InMemorySessionStore();
    modelRegistry = new ModelRegistry();

    // Register test models
    modelRegistry.registerModel({
      id: 'test-model-1',
      provider: 'openai',
      apiKey: 'test-key-1',
      modelName: 'gpt-4',
      enabled: true,
      maxTokens: 100,
      temperature: 0.7,
      timeout: 30,
    });

    modelRegistry.registerModel({
      id: 'test-model-2',
      provider: 'anthropic',
      apiKey: 'test-key-2',
      modelName: 'claude-3',
      enabled: true,
      maxTokens: 100,
      temperature: 0.7,
      timeout: 30,
    });

    // Create server
    server = new CourtOfMindsServer(sessionStore, modelRegistry, {
      port: 3001,
      enableAuth: false,
    });

    app = server.getApp();
  });

  afterEach(() => {
    // Close WebSocket manager but don't try to stop HTTP server
    // since we're not actually starting it in tests
    try {
      server.getWebSocketManager().close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/models', () => {
    it('should return list of available models', async () => {
      const response = await request(app).get('/api/models');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('models');
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.models).toHaveLength(2);
      
      // Verify model structure (should not include API keys)
      const model = response.body.models[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('enabled');
      expect(model).not.toHaveProperty('apiKey');
    });

    it('should return empty list when no models registered', async () => {
      modelRegistry.clear();

      const response = await request(app).get('/api/models');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.models).toHaveLength(0);
    });
  });

  describe('POST /api/models', () => {
    it('should register a new model', async () => {
      const newModel = {
        id: 'new-model',
        provider: 'google',
        apiKey: 'test-key',
        modelName: 'gemini-pro',
        enabled: true,
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 30,
      };

      const response = await request(app)
        .post('/api/models')
        .send(newModel);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Model registered successfully');
      expect(response.body).toHaveProperty('modelId', 'new-model');

      // Verify model was registered
      const model = modelRegistry.getModel('new-model');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('new-model');
    });

    it('should reject registration with missing fields', async () => {
      const invalidModel = {
        id: 'invalid-model',
        provider: 'openai',
        // Missing apiKey and modelName
      };

      const response = await request(app)
        .post('/api/models')
        .send(invalidModel);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
    });

    it('should apply default values for optional fields', async () => {
      const minimalModel = {
        id: 'minimal-model',
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-3.5-turbo',
      };

      const response = await request(app)
        .post('/api/models')
        .send(minimalModel);

      expect(response.status).toBe(201);

      const model = modelRegistry.getModel('minimal-model');
      expect(model).not.toBeNull();
      expect(model?.enabled).toBe(true);
    });
  });

  describe('PATCH /api/models/:id', () => {
    it('should enable a model', async () => {
      // First disable the model
      modelRegistry.disableModel('test-model-1');

      const response = await request(app)
        .patch('/api/models/test-model-1')
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Model enabled successfully');

      const model = modelRegistry.getModel('test-model-1');
      expect(model?.enabled).toBe(true);
    });

    it('should disable a model', async () => {
      const response = await request(app)
        .patch('/api/models/test-model-1')
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Model disabled successfully');

      const model = modelRegistry.getModel('test-model-1');
      expect(model?.enabled).toBe(false);
    });

    it('should reject invalid enabled value', async () => {
      const response = await request(app)
        .patch('/api/models/test-model-1')
        .send({ enabled: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
    });

    it('should handle non-existent model', async () => {
      const response = await request(app)
        .patch('/api/models/non-existent')
        .send({ enabled: false });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
    });
  });

  describe('GET /api/sessions', () => {
    it('should require userId parameter', async () => {
      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
      expect(response.body.message).toContain('userId');
    });

    it('should return empty list for user with no sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .query({ userId: 'test-user' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
      expect(response.body).toHaveProperty('count', 0);
      expect(response.body.sessions).toHaveLength(0);
    });

    it('should return user sessions', async () => {
      // Create a test session
      const session = await sessionStore.createSession(
        {
          id: 'query-1',
          text: 'Test query',
          userId: 'test-user',
          timestamp: new Date(),
        },
        'single'
      );

      const response = await request(app)
        .get('/api/sessions')
        .query({ userId: 'test-user' });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0].id).toBe(session.id);
    });

    it('should filter sessions by mode', async () => {
      // Create sessions with different modes
      await sessionStore.createSession(
        {
          id: 'query-1',
          text: 'Test query 1',
          userId: 'test-user',
          timestamp: new Date(),
        },
        'single'
      );

      await sessionStore.createSession(
        {
          id: 'query-2',
          text: 'Test query 2',
          userId: 'test-user',
          timestamp: new Date(),
        },
        'multi'
      );

      const response = await request(app)
        .get('/api/sessions')
        .query({ userId: 'test-user', mode: 'single' });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.sessions[0].mode).toBe('single');
    });
  });

  describe('GET /api/session/:id', () => {
    it('should return session details', async () => {
      const session = await sessionStore.createSession(
        {
          id: 'query-1',
          text: 'Test query',
          userId: 'test-user',
          timestamp: new Date(),
        },
        'single'
      );

      const response = await request(app).get(`/api/session/${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', session.id);
      expect(response.body).toHaveProperty('userId', 'test-user');
      expect(response.body).toHaveProperty('mode', 'single');
      expect(response.body).toHaveProperty('status', 'collecting');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).get('/api/session/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  describe('POST /api/query', () => {
    it('should reject query without text', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ mode: 'single', selectedModels: ['test-model-1'] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
      expect(response.body.message).toContain('text');
    });

    it('should reject query without mode', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ text: 'Test query' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
      expect(response.body.message.toLowerCase()).toContain('mode');
    });

    it('should reject query with invalid mode', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({ text: 'Test query', mode: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'INVALID_REQUEST');
    });

    it('should use anonymous userId if not provided', async () => {
      // This test verifies validation passes without userId
      // We expect it to fail at execution (not validation) since we're using test API keys
      const response = await request(app)
        .post('/api/query')
        .send({
          text: 'Test query',
          mode: 'single',
          selectedModels: ['test-model-1'],
        });

      // Should pass validation (not 400) but fail at execution (500)
      expect(response.status).not.toBe(400);
      expect(response.status).toBe(500); // Fails due to invalid API key
    });
  });

  describe('Error handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Force an error by trying to get a session with invalid ID
      const response = await request(app).get('/api/session/');

      expect(response.status).toBe(404);
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin', '*');
    });
  });
});
