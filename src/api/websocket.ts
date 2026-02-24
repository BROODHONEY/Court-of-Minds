/**
 * WebSocket Manager - Real-time progress updates for deliberation sessions
 * 
 * This module provides:
 * - WebSocket connection handling
 * - Progress event emission for phase transitions
 * - Intermediate results streaming
 * 
 * Validates Requirements: 10.3, 10.4
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import type { Session, SessionStatus } from '../models/types.js';

/**
 * Progress event types
 */
export type ProgressEventType = 
  | 'session_created'
  | 'collecting_responses'
  | 'responses_collected'
  | 'analyzing'
  | 'analysis_complete'
  | 'debating'
  | 'debate_round_complete'
  | 'debate_complete'
  | 'building_consensus'
  | 'consensus_complete'
  | 'session_complete'
  | 'session_failed';

/**
 * Progress event data
 */
export interface ProgressEvent {
  type: ProgressEventType;
  sessionId: string;
  timestamp: Date;
  data?: any;
}

/**
 * WebSocket connection with metadata
 */
interface WebSocketConnection {
  ws: WebSocket;
  sessionId?: string;
  userId?: string;
}

/**
 * WebSocket Manager for real-time progress updates
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocketConnection> = new Map();

  constructor(httpServer: HTTPServer) {
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: httpServer,
      path: '/ws'
    });

    // Setup connection handler
    this.wss.on('connection', this.handleConnection.bind(this));

    console.log('WebSocket server initialized on /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const connectionId = this.generateConnectionId();
    const connection: WebSocketConnection = { ws };
    
    this.connections.set(connectionId, connection);
    console.log(`WebSocket connection established: ${connectionId}`);

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connected',
      connectionId,
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        this.sendError(connectionId, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', () => {
      console.log(`WebSocket connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error on connection ${connectionId}:`, error);
      this.connections.delete(connectionId);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Handle subscribe to session
    if (message.type === 'subscribe' && message.sessionId) {
      connection.sessionId = message.sessionId;
      connection.userId = message.userId;
      
      this.sendToConnection(connectionId, {
        type: 'subscribed',
        sessionId: message.sessionId,
        timestamp: new Date().toISOString(),
      });
      
      console.log(`Connection ${connectionId} subscribed to session ${message.sessionId}`);
    }

    // Handle unsubscribe
    if (message.type === 'unsubscribe') {
      connection.sessionId = undefined;
      
      this.sendToConnection(connectionId, {
        type: 'unsubscribed',
        timestamp: new Date().toISOString(),
      });
    }

    // Handle ping
    if (message.type === 'ping') {
      this.sendToConnection(connectionId, {
        type: 'pong',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(connectionId: string, data: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to send message to connection ${connectionId}:`, error);
    }
  }

  /**
   * Send error message to connection
   */
  private sendError(connectionId: string, message: string): void {
    this.sendToConnection(connectionId, {
      type: 'error',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast progress event to all subscribers of a session
   * Validates Requirements: 10.3, 10.4
   */
  broadcastProgress(event: ProgressEvent): void {
    const message = {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };

    let sentCount = 0;

    // Send to all connections subscribed to this session
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.sessionId === event.sessionId && 
          connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to broadcast to connection ${connectionId}:`, error);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`Broadcasted ${event.type} for session ${event.sessionId} to ${sentCount} connections`);
    }
  }

  /**
   * Emit session created event
   */
  emitSessionCreated(sessionId: string, session: Session): void {
    this.broadcastProgress({
      type: 'session_created',
      sessionId,
      timestamp: new Date(),
      data: {
        mode: session.mode,
        query: session.query.text,
      },
    });
  }

  /**
   * Emit collecting responses event
   */
  emitCollectingResponses(sessionId: string, modelCount: number): void {
    this.broadcastProgress({
      type: 'collecting_responses',
      sessionId,
      timestamp: new Date(),
      data: {
        modelCount,
      },
    });
  }

  /**
   * Emit responses collected event
   */
  emitResponsesCollected(sessionId: string, responseCount: number, failureCount: number): void {
    this.broadcastProgress({
      type: 'responses_collected',
      sessionId,
      timestamp: new Date(),
      data: {
        responseCount,
        failureCount,
      },
    });
  }

  /**
   * Emit analyzing event
   */
  emitAnalyzing(sessionId: string): void {
    this.broadcastProgress({
      type: 'analyzing',
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit analysis complete event
   */
  emitAnalysisComplete(sessionId: string, summary: string): void {
    this.broadcastProgress({
      type: 'analysis_complete',
      sessionId,
      timestamp: new Date(),
      data: {
        summary,
      },
    });
  }

  /**
   * Emit debating event
   */
  emitDebating(sessionId: string, roundNumber: number): void {
    this.broadcastProgress({
      type: 'debating',
      sessionId,
      timestamp: new Date(),
      data: {
        roundNumber,
      },
    });
  }

  /**
   * Emit debate round complete event
   */
  emitDebateRoundComplete(sessionId: string, roundNumber: number, disagreementLevel: number): void {
    this.broadcastProgress({
      type: 'debate_round_complete',
      sessionId,
      timestamp: new Date(),
      data: {
        roundNumber,
        disagreementLevel,
      },
    });
  }

  /**
   * Emit debate complete event
   */
  emitDebateComplete(sessionId: string, totalRounds: number, convergenceScore: number): void {
    this.broadcastProgress({
      type: 'debate_complete',
      sessionId,
      timestamp: new Date(),
      data: {
        totalRounds,
        convergenceScore,
      },
    });
  }

  /**
   * Emit building consensus event
   */
  emitBuildingConsensus(sessionId: string): void {
    this.broadcastProgress({
      type: 'building_consensus',
      sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit consensus complete event
   */
  emitConsensusComplete(sessionId: string, agreementLevel: number): void {
    this.broadcastProgress({
      type: 'consensus_complete',
      sessionId,
      timestamp: new Date(),
      data: {
        agreementLevel,
      },
    });
  }

  /**
   * Emit session complete event
   */
  emitSessionComplete(sessionId: string, result: string): void {
    this.broadcastProgress({
      type: 'session_complete',
      sessionId,
      timestamp: new Date(),
      data: {
        result,
      },
    });
  }

  /**
   * Emit session failed event
   */
  emitSessionFailed(sessionId: string, error: string): void {
    this.broadcastProgress({
      type: 'session_failed',
      sessionId,
      timestamp: new Date(),
      data: {
        error,
      },
    });
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get active session subscriptions
   */
  getActiveSubscriptions(): Map<string, number> {
    const subscriptions = new Map<string, number>();
    
    for (const connection of this.connections.values()) {
      if (connection.sessionId) {
        const count = subscriptions.get(connection.sessionId) || 0;
        subscriptions.set(connection.sessionId, count + 1);
      }
    }
    
    return subscriptions;
  }

  /**
   * Close all connections and shutdown
   */
  close(): void {
    for (const connection of this.connections.values()) {
      connection.ws.close();
    }
    this.connections.clear();
    this.wss.close();
    console.log('WebSocket server closed');
  }
}
