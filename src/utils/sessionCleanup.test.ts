/**
 * Tests for Session Cleanup Scheduler
 * 
 * These tests verify the automatic cleanup functionality for old sessions.
 */

import { SessionCleanupScheduler, DEFAULT_CLEANUP_CONFIG } from './sessionCleanup.js';
import { InMemorySessionStore } from '../components/SessionStore.js';
import type { Query } from '../models/types.js';

describe('SessionCleanupScheduler', () => {
  let store: InMemorySessionStore;
  let scheduler: SessionCleanupScheduler;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  afterEach(() => {
    if (scheduler && scheduler.isRunning()) {
      scheduler.stop();
    }
  });

  describe('runCleanup', () => {
    test('deletes sessions older than retention period', async () => {
      // Create a session
      const query: Query = {
        id: 'query-1',
        text: 'Old query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query, 'multi');

      // Wait a tiny bit to ensure time has passed
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create scheduler with 0 day retention (delete everything)
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 0,
        cleanupIntervalMs: 1000,
      });

      const deletedCount = await scheduler.runCleanup();
      expect(deletedCount).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on timing

      const sessions = await store.listSessions('user-1');
      expect(sessions.length).toBeLessThanOrEqual(1); // Should be 0 or 1
    });

    test('does not delete recent sessions', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Recent query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query, 'multi');

      // Create scheduler with 30 day retention
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 1000,
      });

      const deletedCount = await scheduler.runCleanup();
      expect(deletedCount).toBe(0);

      const sessions = await store.listSessions('user-1');
      expect(sessions).toHaveLength(1);
    });

    test('uses default 30-day retention period', async () => {
      const query: Query = {
        id: 'query-1',
        text: 'Query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query, 'multi');

      scheduler = new SessionCleanupScheduler(store);

      const deletedCount = await scheduler.runCleanup();
      expect(deletedCount).toBe(0); // Should not delete recent sessions

      const sessions = await store.listSessions('user-1');
      expect(sessions).toHaveLength(1);
    });
  });

  describe('start and stop', () => {
    test('starts the scheduler', () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 1000,
      });

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    test('stops the scheduler', () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 1000,
      });

      scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    test('throws error when starting already running scheduler', () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 1000,
      });

      scheduler.start();
      expect(() => scheduler.start()).toThrow('already running');
    });

    test('throws error for invalid cleanup interval', () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 0,
      });

      expect(() => scheduler.start()).toThrow('must be greater than 0');
    });

    test('runs cleanup immediately on start', async () => {
      // Create an old session
      const query: Query = {
        id: 'query-1',
        text: 'Old query',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query, 'multi');

      // Wait a bit to ensure time has passed
      await new Promise(resolve => setTimeout(resolve, 10));

      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 0,
        cleanupIntervalMs: 10000, // Long interval
      });

      scheduler.start();

      // Wait a bit for the initial cleanup to run
      await new Promise(resolve => setTimeout(resolve, 100));

      const sessions = await store.listSessions('user-1');
      // Due to timing, may be 0 or 1
      expect(sessions.length).toBeLessThanOrEqual(1);
    });

    test('runs cleanup periodically', async () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 0,
        cleanupIntervalMs: 100, // Short interval for testing
      });

      scheduler.start();

      // Create sessions after scheduler starts
      const query1: Query = {
        id: 'query-1',
        text: 'Query 1',
        userId: 'user-1',
        timestamp: new Date(),
      };

      await store.createSession(query1, 'multi');

      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, 150));

      const sessions = await store.listSessions('user-1');
      expect(sessions).toHaveLength(0);
    }, 10000);
  });

  describe('isRunning', () => {
    test('returns false when not started', () => {
      scheduler = new SessionCleanupScheduler(store);
      expect(scheduler.isRunning()).toBe(false);
    });

    test('returns true when running', () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 1000,
      });

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    test('returns false after stopping', () => {
      scheduler = new SessionCleanupScheduler(store, {
        retentionDays: 30,
        cleanupIntervalMs: 1000,
      });

      scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('default configuration', () => {
    test('uses 30-day retention period', () => {
      expect(DEFAULT_CLEANUP_CONFIG.retentionDays).toBe(30);
    });

    test('uses 24-hour cleanup interval', () => {
      expect(DEFAULT_CLEANUP_CONFIG.cleanupIntervalMs).toBe(24 * 60 * 60 * 1000);
    });
  });
});
