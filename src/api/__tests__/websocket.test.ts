/**
 * Tests for WebSocket Manager
 * 
 * These tests verify:
 * - WebSocket connection handling
 * - Progress event broadcasting
 * - Session subscription management
 */

import { WebSocketManager, ProgressEvent } from '../websocket.js';
import { createServer, Server as HTTPServer } from 'http';
import WebSocket from 'ws';

describe('WebSocketManager', () => {
  let httpServer: HTTPServer;
  let wsManager: WebSocketManager;
  let serverPort: number;

  beforeEach((done) => {
    // Create HTTP server
    httpServer = createServer();
    
    // Find available port
    httpServer.listen(0, () => {
      const address = httpServer.address();
      serverPort = typeof address === 'object' && address ? address.port : 0;
      
      // Create WebSocket manager
      wsManager = new WebSocketManager(httpServer);
      
      done();
    });
  });

  afterEach((done) => {
    wsManager.close();
    httpServer.close(() => done());
  });

  describe('Connection handling', () => {
    it('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);

      ws.on('open', () => {
        expect(wsManager.getConnectionCount()).toBe(1);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should send welcome message on connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connected') {
          expect(message).toHaveProperty('connectionId');
          expect(message).toHaveProperty('timestamp');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle connection close', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);

      ws.on('open', () => {
        expect(wsManager.getConnectionCount()).toBe(1);
        ws.close();
      });

      ws.on('close', () => {
        // Give it a moment to process
        setTimeout(() => {
          expect(wsManager.getConnectionCount()).toBe(0);
          done();
        }, 100);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle multiple connections', (done) => {
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws`);

      let openCount = 0;

      const checkBothOpen = () => {
        openCount++;
        if (openCount === 2) {
          expect(wsManager.getConnectionCount()).toBe(2);
          ws1.close();
          ws2.close();
          done();
        }
      };

      ws1.on('open', checkBothOpen);
      ws2.on('open', checkBothOpen);

      ws1.on('error', (error) => done(error));
      ws2.on('error', (error) => done(error));
    });
  });

  describe('Session subscription', () => {
    it('should handle subscribe message', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let receivedWelcome = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connected') {
          receivedWelcome = true;
          // Subscribe to a session
          ws.send(JSON.stringify({
            type: 'subscribe',
            sessionId: 'test-session-123',
            userId: 'test-user',
          }));
        } else if (message.type === 'subscribed' && receivedWelcome) {
          expect(message).toHaveProperty('sessionId', 'test-session-123');
          
          const subscriptions = wsManager.getActiveSubscriptions();
          expect(subscriptions.get('test-session-123')).toBe(1);
          
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle unsubscribe message', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let receivedWelcome = false;
      let receivedSubscribed = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connected') {
          receivedWelcome = true;
          ws.send(JSON.stringify({
            type: 'subscribe',
            sessionId: 'test-session-123',
            userId: 'test-user',
          }));
        } else if (message.type === 'subscribed' && receivedWelcome) {
          receivedSubscribed = true;
          ws.send(JSON.stringify({
            type: 'unsubscribe',
          }));
        } else if (message.type === 'unsubscribed' && receivedSubscribed) {
          const subscriptions = wsManager.getActiveSubscriptions();
          expect(subscriptions.has('test-session-123')).toBe(false);
          
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle ping/pong', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let receivedWelcome = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connected') {
          receivedWelcome = true;
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (message.type === 'pong' && receivedWelcome) {
          expect(message).toHaveProperty('timestamp');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Progress broadcasting', () => {
    it('should broadcast progress to subscribed clients', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let receivedWelcome = false;
      let receivedSubscribed = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connected') {
          receivedWelcome = true;
          ws.send(JSON.stringify({
            type: 'subscribe',
            sessionId: 'test-session-123',
            userId: 'test-user',
          }));
        } else if (message.type === 'subscribed' && receivedWelcome) {
          receivedSubscribed = true;
          
          // Broadcast a progress event
          wsManager.broadcastProgress({
            type: 'collecting_responses',
            sessionId: 'test-session-123',
            timestamp: new Date(),
            data: { modelCount: 3 },
          });
        } else if (message.type === 'collecting_responses' && receivedSubscribed) {
          expect(message).toHaveProperty('sessionId', 'test-session-123');
          expect(message).toHaveProperty('data');
          expect(message.data).toHaveProperty('modelCount', 3);
          
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should not broadcast to unsubscribed clients', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let receivedWelcome = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connected') {
          receivedWelcome = true;
          
          // Broadcast without subscribing
          wsManager.broadcastProgress({
            type: 'collecting_responses',
            sessionId: 'test-session-123',
            timestamp: new Date(),
            data: { modelCount: 3 },
          });

          // Wait a bit to ensure no message is received
          setTimeout(() => {
            ws.close();
            done();
          }, 200);
        } else if (message.type === 'collecting_responses') {
          done(new Error('Should not receive progress event without subscription'));
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should broadcast to multiple subscribed clients', (done) => {
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      let ws1Ready = false;
      let ws2Ready = false;
      let receivedCount = 0;

      const checkReady = () => {
        if (ws1Ready && ws2Ready) {
          // Both subscribed, broadcast event
          wsManager.broadcastProgress({
            type: 'analyzing',
            sessionId: 'test-session-123',
            timestamp: new Date(),
          });
        }
      };

      const handleMessage = (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribed') {
          if (!ws1Ready) {
            ws1Ready = true;
          } else if (!ws2Ready) {
            ws2Ready = true;
          }
          checkReady();
        } else if (message.type === 'analyzing') {
          receivedCount++;
          
          if (receivedCount === 2) {
            ws1.close();
            ws2.close();
            done();
          }
        }
      };

      ws1.on('message', handleMessage);
      ws2.on('message', handleMessage);

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'subscribe',
          sessionId: 'test-session-123',
          userId: 'user1',
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'subscribe',
          sessionId: 'test-session-123',
          userId: 'user2',
        }));
      });

      ws1.on('error', (error) => done(error));
      ws2.on('error', (error) => done(error));
    });
  });

  describe('Progress event helpers', () => {
    it('should emit session created event', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let subscribed = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribed') {
          subscribed = true;
          wsManager.emitSessionCreated('test-session', {
            id: 'test-session',
            userId: 'user1',
            query: { id: 'q1', text: 'Test', userId: 'user1', timestamp: new Date() },
            mode: 'multi',
            status: 'collecting',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else if (message.type === 'session_created' && subscribed) {
          expect(message.data).toHaveProperty('mode', 'multi');
          expect(message.data).toHaveProperty('query', 'Test');
          ws.close();
          done();
        }
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          sessionId: 'test-session',
          userId: 'user1',
        }));
      });

      ws.on('error', (error) => done(error));
    });

    it('should emit responses collected event', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      let subscribed = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribed') {
          subscribed = true;
          wsManager.emitResponsesCollected('test-session', 3, 1);
        } else if (message.type === 'responses_collected' && subscribed) {
          expect(message.data).toHaveProperty('responseCount', 3);
          expect(message.data).toHaveProperty('failureCount', 1);
          ws.close();
          done();
        }
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          sessionId: 'test-session',
          userId: 'user1',
        }));
      });

      ws.on('error', (error) => done(error));
    });
  });

  describe('Connection management', () => {
    it('should track active subscriptions', (done) => {
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      let subscribeCount = 0;

      const handleMessage = (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribed') {
          subscribeCount++;
          
          if (subscribeCount === 2) {
            const subscriptions = wsManager.getActiveSubscriptions();
            expect(subscriptions.get('session-1')).toBe(1);
            expect(subscriptions.get('session-2')).toBe(1);
            
            ws1.close();
            ws2.close();
            done();
          }
        }
      };

      ws1.on('message', handleMessage);
      ws2.on('message', handleMessage);

      ws1.on('open', () => {
        ws1.send(JSON.stringify({
          type: 'subscribe',
          sessionId: 'session-1',
          userId: 'user1',
        }));
      });

      ws2.on('open', () => {
        ws2.send(JSON.stringify({
          type: 'subscribe',
          sessionId: 'session-2',
          userId: 'user2',
        }));
      });

      ws1.on('error', (error) => done(error));
      ws2.on('error', (error) => done(error));
    });
  });
});
