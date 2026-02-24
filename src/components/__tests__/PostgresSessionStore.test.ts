/**
 * Tests for PostgreSQL SessionStore Implementation
 * 
 * These tests verify the PostgreSQL-backed session store functionality.
 * Note: These tests require a PostgreSQL database to be available.
 * Set SKIP_PG_TESTS=true to skip these tests.
 */

import { PostgresSessionStore } from '../SessionStore.js';
import type { Query, SessionUpdate } from '../../models/types.js';

const shouldSkip = process.env.SKIP_PG_TESTS === 'true' || !process.env.TEST_DB_HOST;

(shouldSkip ? describe.skip : describe)('PostgresSessionStore', () => {
  let store: PostgresSessionStore;

  beforeAll(async () => {
    // Use test database configuration
    store = new PostgresSessionStore({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'court_of_minds_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
    });

    // Initialize the database schema
    await store.initialize();
  });

  afterAll(async () => {
    // Clean up and close connection
    await store.close();
  });

  beforeEach(async () => {
    // Clear all sessions before each test
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() + 1); // Delete all sessions
    await store.deleteOldSessions(oldDate);
  });

  describe('createSession', () => {
    test('creates a new session with unique ID', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'What is the best approach?',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const session = await store.createSession(query, 'multi');

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-1');
      expect(session.query).toEqual(query);
      expect(session.mode).toBe('multi');
      expect(session.status).toBe('collecting');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    test('creates sessions with unique IDs', async () => {
      const query1: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const query2: Query = {
        id: 'query-2',
        text: 'Query 2',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const session1 = await store.createSession(query1, 'multi');
      const session2 = await store.createSession(query2, 'single');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('getSession', () => {
    test('retrieves an existing session', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const created = await store.createSession(query, 'multi');
      const retrieved = await store.getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.query.text).toBe(query.text);
    });

    test('returns null for non-existent session', async () => {
      const result = await store.getSession('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateSession', () => {
    test('updates session status', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const session = await store.createSession(query, 'multi');
      
      const update: SessionUpdate = {
        status: 'analyzing',
      };

      await store.updateSession(session.id, update);
      const updated = await store.getSession(session.id);

      expect(updated?.status).toBe('analyzing');
    });

    test('updates session with responses', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Test query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const session = await store.createSession(query, 'multi');
      
      const update: SessionUpdate = {
        status: 'analyzing',
        responses: [
          {
            modelId: 'model-1',
            text: 'Response 1',
            tokens: 100,
            latency: 500,
            timestamp: new Date(),
          },
        ],
      };

      await store.updateSession(session.id, update);
      const updated = await store.getSession(session.id);

      expect(updated?.responses).toHaveLength(1);
      expect(updated?.responses?.[0].modelId).toBe('model-1');
    });

    test('throws error for non-existent session', async () => {
      const update: SessionUpdate = {
        status: 'analyzing',
      };

      await expect(
        store.updateSession('non-existent-id', update)
      ).rejects.toThrow('Session not found');
    });
  });

  describe('listSessions', () => {
    test('lists all sessions for a user', async () => {
      const query1: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const query2: Query = {
        id: 'query-2',
        text: 'Query 2',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const query3: Query = {
        id: 'query-3',
        text: 'Query 3',
        userId: 'user-2',
        timestamp: new Date(),
      };

      await store.createSession(query1, 'multi');
      await store.createSession(query2, 'single');
      await store.createSession(query3, 'multi');

      const user1Sessions = await store.listSessions('user-1');
      const user2Sessions = await store.listSessions('user-2');

      expect(user1Sessions).toHaveLength(2);
      expect(user2Sessions).toHaveLength(1);
    });

    test('filters sessions by mode', async () => {
      const query1: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const query2: Query = {
        id: 'query-2',
        text: 'Query 2',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query1, 'multi');
      await store.createSession(query2, 'single');

      const multiSessions = await store.listSessions('user-1', { mode: 'multi' });
      const singleSessions = await store.listSessions('user-1', { mode: 'single' });

      expect(multiSessions).toHaveLength(1);
      expect(singleSessions).toHaveLength(1);
    });

    test('filters sessions by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const query: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: now,
      };

      await store.createSession(query, 'multi');

      const sessionsInRange = await store.listSessions('user-1', {
        startDate: yesterday,
        endDate: tomorrow,
      });

      const sessionsOutOfRange = await store.listSessions('user-1', {
        startDate: tomorrow,
      });

      expect(sessionsInRange).toHaveLength(1);
      expect(sessionsOutOfRange).toHaveLength(0);
    });

    test('filters sessions by status', async () => {
      const query1: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const query2: Query = {
        id: 'query-2',
        text: 'Query 2',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const session1 = await store.createSession(query1, 'multi');
      const session2 = await store.createSession(query2, 'multi');

      await store.updateSession(session2.id, { status: 'completed' });

      const collectingSessions = await store.listSessions('user-1', {
        status: 'collecting',
      });
      const completedSessions = await store.listSessions('user-1', {
        status: 'completed',
      });

      expect(collectingSessions).toHaveLength(1);
      expect(completedSessions).toHaveLength(1);
    });
  });

  describe('deleteOldSessions', () => {
    test('deletes sessions older than specified date', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Old query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query, 'multi');

      // Delete sessions older than tomorrow (should delete the session we just created)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const deletedCount = await store.deleteOldSessions(tomorrow);
      expect(deletedCount).toBe(1);

      const sessions = await store.listSessions('user-1');
      expect(sessions).toHaveLength(0);
    });

    test('does not delete recent sessions', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Recent query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query, 'multi');

      // Delete sessions older than yesterday (should not delete today's session)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const deletedCount = await store.deleteOldSessions(yesterday);
      expect(deletedCount).toBe(0);

      const sessions = await store.listSessions('user-1');
      expect(sessions).toHaveLength(1);
    });

    test('deletes multiple old sessions', async () => {
      const query1: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const query2: Query = {
        id: 'query-2',
        text: 'Query 2',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query1, 'multi');
      await store.createSession(query2, 'multi');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const deletedCount = await store.deleteOldSessions(tomorrow);
      expect(deletedCount).toBe(2);
    });
  });

  describe('data persistence', () => {
    test('persists all session phases', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Complete session test',
        userId: 'user-1',
        timestamp: new Date(),
      };

      const session = await store.createSession(query, 'multi');

      // Update with responses
      await store.updateSession(session.id, {
        status: 'analyzing',
        responses: [
          {
            modelId: 'model-1',
            text: 'Response 1',
            tokens: 100,
            latency: 500,
            timestamp: new Date(),
          },
        ],
      });

      // Update with analysis
      await store.updateSession(session.id, {
        status: 'debating',
        analysis: {
          commonThemes: [
            {
              description: 'Theme 1',
              supportingModels: ['model-1'],
              confidence: 0.9,
            },
          ],
          uniqueApproaches: [],
          differences: [],
          summary: 'Analysis summary',
          timestamp: new Date(),
        },
      });

      // Update with debate
      await store.updateSession(session.id, {
        status: 'consensus',
        debate: {
          rounds: [
            {
              roundNumber: 1,
              exchanges: [
                {
                  modelId: 'model-1',
                  critique: 'Critique',
                  defense: 'Defense',
                  timestamp: new Date(),
                },
              ],
              disagreementLevel: 0.5,
            },
          ],
          convergenceScore: 0.8,
          duration: 1000,
        },
      });

      // Update with consensus
      await store.updateSession(session.id, {
        status: 'completed',
        consensus: {
          finalSolution: {
            text: 'Final solution',
            supportingModels: ['model-1'],
            incorporatedInsights: [],
            confidence: 0.9,
          },
          agreementLevel: 0.9,
          rationale: 'Consensus rationale',
          duration: 500,
        },
        completedAt: new Date(),
      });

      // Retrieve and verify all data is persisted
      const retrieved = await store.getSession(session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.responses).toHaveLength(1);
      expect(retrieved?.analysis).toBeDefined();
      expect(retrieved?.debate).toBeDefined();
      expect(retrieved?.consensus).toBeDefined();
      expect(retrieved?.completedAt).toBeInstanceOf(Date);
    });
  });
});
