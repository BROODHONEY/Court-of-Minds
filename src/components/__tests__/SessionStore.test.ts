/**
 * Property-Based Tests for SessionStore
 * 
 * These tests verify correctness properties for session management,
 * particularly focusing on session identifier uniqueness.
 */

import * as fc from 'fast-check';
import { InMemorySessionStore } from '../SessionStore.js';
import type { Query } from '../../models/types.js';

describe('SessionStore Property Tests', () => {
  // Feature: ai-court-system, Property 24: Session identifier uniqueness
  // **Validates: Requirements 6.1**
  test('session identifier uniqueness - all created sessions have unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of sessions to create (2-100)
        fc.integer({ min: 2, max: 100 }),
        // Generate random query texts
        fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 100, maxLength: 100 }),
        // Generate random user IDs
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 100, maxLength: 100 }),
        async (numSessions, queryTexts, userIds) => {
          const store = new InMemorySessionStore();
          const sessionIds = new Set<string>();

          // Create multiple sessions
          for (let i = 0; i < numSessions; i++) {
            const query: Query = {
              id: `query-${i}`,
              text: queryTexts[i],
              userId: userIds[i],
              timestamp: new Date(),
            };

            const session = await store.createSession(query, 'multi');
            
            // Verify the session ID is unique (not seen before)
            expect(sessionIds.has(session.id)).toBe(false);
            
            // Add to set for future uniqueness checks
            sessionIds.add(session.id);
          }

          // Verify we created exactly the expected number of unique IDs
          expect(sessionIds.size).toBe(numSessions);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Verify uniqueness across different query modes
  test('session identifier uniqueness across different modes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (numSessions, queryText, userId) => {
          const store = new InMemorySessionStore();
          const sessionIds = new Set<string>();

          // Create sessions alternating between single and multi mode
          for (let i = 0; i < numSessions; i++) {
            const query: Query = {
              id: `query-${i}`,
              text: queryText,
              userId: userId,
              timestamp: new Date(),
            };

            const mode = i % 2 === 0 ? 'single' : 'multi';
            const session = await store.createSession(query, mode);
            
            // Verify uniqueness regardless of mode
            expect(sessionIds.has(session.id)).toBe(false);
            sessionIds.add(session.id);
          }

          expect(sessionIds.size).toBe(numSessions);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Verify uniqueness with concurrent session creation
  test('session identifier uniqueness with concurrent creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 30 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (numSessions, queryText) => {
          const store = new InMemorySessionStore();

          // Create multiple sessions concurrently
          const promises = Array.from({ length: numSessions }, (_, i) => {
            const query: Query = {
              id: `query-${i}`,
              text: queryText,
              userId: `user-${i}`,
              timestamp: new Date(),
            };
            return store.createSession(query, 'multi');
          });

          const sessions = await Promise.all(promises);
          const sessionIds = sessions.map(s => s.id);

          // Verify all IDs are unique
          const uniqueIds = new Set(sessionIds);
          expect(uniqueIds.size).toBe(numSessions);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Verify uniqueness across multiple store instances
  test('session identifier uniqueness across multiple store instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 5, max: 20 }),
        async (numStores, sessionsPerStore) => {
          const allSessionIds = new Set<string>();

          // Create multiple store instances
          for (let storeIdx = 0; storeIdx < numStores; storeIdx++) {
            const store = new InMemorySessionStore();

            // Create sessions in each store
            for (let i = 0; i < sessionsPerStore; i++) {
              const query: Query = {
                id: `query-${storeIdx}-${i}`,
                text: `Query from store ${storeIdx}`,
                userId: `user-${i}`,
                timestamp: new Date(),
              };

              const session = await store.createSession(query, 'multi');
              
              // Verify global uniqueness across all stores
              expect(allSessionIds.has(session.id)).toBe(false);
              allSessionIds.add(session.id);
            }
          }

          // Verify total unique IDs equals total sessions created
          expect(allSessionIds.size).toBe(numStores * sessionsPerStore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
