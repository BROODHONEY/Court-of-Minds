/**
 * API Server - REST API and WebSocket server for Court of Minds
 * 
 * This module provides:
 * - REST API endpoints for query submission and session management
 * - WebSocket support for real-time progress updates
 * - Request validation and authentication middleware
 * 
 * Validates Requirements: 10.1, 10.2, 10.3, 10.4, 8.1, 8.3
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { QueryRouter } from '../components/QueryRouter.js';
import { ModelRegistry } from '../components/ModelRegistry.js';
import { SessionStore } from '../components/SessionStore.js';
import { DirectQueryHandler } from '../components/DirectQueryHandler.js';
import { DeliberationOrchestrator } from '../components/DeliberationOrchestrator.js';
import { WebSocketManager } from './websocket.js';
import type { Query, QueryMode, ModelConfig } from '../models/types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Server configuration
 */
export interface ServerConfig {
  port: number;
  enableAuth: boolean;
  adminApiKey?: string;
}

/**
 * Default server configuration
 */
const DEFAULT_CONFIG: ServerConfig = {
  port: 3000,
  enableAuth: false,
};

/**
 * Court of Minds API Server
 */
export class CourtOfMindsServer {
  private app: Express;
  private httpServer: HTTPServer;
  private queryRouter: QueryRouter;
  private modelRegistry: ModelRegistry;
  private sessionStore: SessionStore;
  private wsManager: WebSocketManager;
  private config: ServerConfig;

  constructor(
    sessionStore: SessionStore,
    modelRegistry: ModelRegistry,
    config: Partial<ServerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionStore = sessionStore;
    this.modelRegistry = modelRegistry;

    // Initialize components
    const directHandler = new DirectQueryHandler(sessionStore);
    const deliberationHandler = new DeliberationOrchestrator(sessionStore);
    this.queryRouter = new QueryRouter(
      sessionStore,
      modelRegistry,
      directHandler,
      deliberationHandler
    );

    // Create Express app and HTTP server
    this.app = express();
    this.httpServer = createServer(this.app);

    // Initialize WebSocket manager
    this.wsManager = new WebSocketManager(this.httpServer);

    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Query endpoints
    this.app.post('/api/query', this.validateRequest, this.handleSubmitQuery.bind(this));
    
    // Session endpoints
    this.app.get('/api/session/:id', this.validateRequest, this.handleGetSession.bind(this));
    this.app.get('/api/sessions', this.validateRequest, this.handleListSessions.bind(this));
    
    // Model endpoints
    this.app.get('/api/models', this.validateRequest, this.handleGetModels.bind(this));
    this.app.post('/api/models', this.validateRequest, this.requireAdmin, this.handleRegisterModel.bind(this));
    this.app.patch('/api/models/:id', this.validateRequest, this.requireAdmin, this.handleUpdateModel.bind(this));

    // Error handler
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Validation middleware
   */
  private validateRequest = (req: Request, res: Response, next: NextFunction): void => {
    // Basic authentication check (if enabled)
    if (this.config.enableAuth) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    next();
  }

  /**
   * Admin authorization middleware
   */
  private requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (this.config.enableAuth && this.config.adminApiKey) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      if (token !== this.config.adminApiKey) {
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Admin access required',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    next();
  }

  /**
   * POST /api/query - Submit new query
   * Validates Requirements: 10.1, 10.2
   */
  private async handleSubmitQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, mode, selectedModels, userId } = req.body;

      // Validate required fields
      if (!text || typeof text !== 'string' || text.trim() === '') {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'Query text is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!mode || (mode !== 'single' && mode !== 'multi')) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'Mode must be "single" or "multi"',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Create query object
      const query: Query = {
        id: uuidv4(),
        text: text.trim(),
        userId: userId || 'anonymous',
        selectedModels: selectedModels || undefined,
        timestamp: new Date(),
      };

      // Route query
      const result = await this.queryRouter.route(query, mode as QueryMode);

      res.status(200).json({
        sessionId: result.sessionId,
        result: result.result,
        session: result.session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/session/:id - Get session details
   * Validates Requirement: 10.4
   */
  private async handleGetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const session = await this.sessionStore.getSession(id);

      if (!session) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Session not found: ${id}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json(session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/sessions - List user sessions
   * Validates Requirement: 10.4
   */
  private async handleListSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, mode, status, startDate, endDate } = req.query;

      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'userId query parameter is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const filters: any = {};
      if (mode) filters.mode = mode;
      if (status) filters.status = status;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const sessions = await this.sessionStore.listSessions(userId, filters);

      res.status(200).json({
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/models - Get available models
   * Validates Requirements: 10.1, 10.2
   */
  private async handleGetModels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = this.modelRegistry.getAvailableModels();

      // Return model info without sensitive data (API keys)
      const modelInfo = models.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        enabled: model.enabled,
      }));

      res.status(200).json({
        models: modelInfo,
        count: modelInfo.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/models - Register new model (admin)
   * Validates Requirement: 8.1
   */
  private async handleRegisterModel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config: ModelConfig = req.body;

      // Validate required fields
      if (!config.id || !config.provider || !config.apiKey || !config.modelName) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: id, provider, apiKey, modelName',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Set defaults
      config.enabled = config.enabled !== false;
      config.maxTokens = config.maxTokens || 2000;
      config.temperature = config.temperature || 0.7;
      config.timeout = config.timeout || 30;

      // Register model
      this.modelRegistry.registerModel(config);

      res.status(201).json({
        message: 'Model registered successfully',
        modelId: config.id,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/models/:id - Enable/disable model (admin)
   * Validates Requirement: 8.3
   */
  private async handleUpdateModel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'enabled field must be a boolean',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Update model
      if (enabled) {
        this.modelRegistry.enableModel(id);
      } else {
        this.modelRegistry.disableModel(id);
      }

      res.status(200).json({
        message: `Model ${enabled ? 'enabled' : 'disabled'} successfully`,
        modelId: id,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Error handler middleware
   */
  private errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
    console.error('API Error:', err);

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, () => {
        console.log(`Court of Minds API server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Close WebSocket connections
    this.wsManager.close();

    return new Promise((resolve, reject) => {
      this.httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get the Express app instance (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get the HTTP server instance (for WebSocket integration)
   */
  getHttpServer(): HTTPServer {
    return this.httpServer;
  }

  /**
   * Get the WebSocket manager instance
   */
  getWebSocketManager(): WebSocketManager {
    return this.wsManager;
  }
}
