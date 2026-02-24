/**
 * Example: Using PostgreSQL SessionStore
 * 
 * This example demonstrates how to use the PostgreSQL-backed SessionStore
 * for persisting session data and implementing automatic cleanup.
 */

import { PostgresSessionStore } from '../src/components/SessionStore.js';
import { SessionCleanupScheduler } from '../src/utils/sessionCleanup.js';
import type { Query, SessionUpdate } from '../src/models/types.js';

async function main() {
  // 1. Create a PostgreSQL SessionStore
  console.log('Creating PostgreSQL SessionStore...');
  const store = new PostgresSessionStore({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'court_of_minds',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  // 2. Initialize the database schema
  console.log('Initializing database schema...');
  await store.initialize();

  // 3. Create a new session
  console.log('\nCreating a new session...');
  const query: Query = {
    id: 'query-123',
    text: 'What is the best approach to implement authentication?',
    userId: 'user-456',
    timestamp: new Date(),
  };

  const session = await store.createSession(query, 'multi');
  console.log('Session created:', {
    id: session.id,
    userId: session.userId,
    mode: session.mode,
    status: session.status,
  });

  // 4. Update session with responses
  console.log('\nUpdating session with responses...');
  const update: SessionUpdate = {
    status: 'analyzing',
    responses: [
      {
        modelId: 'gpt-4',
        text: 'Use JWT tokens with refresh token rotation...',
        tokens: 150,
        latency: 1200,
        timestamp: new Date(),
      },
      {
        modelId: 'claude-3',
        text: 'Implement OAuth 2.0 with PKCE flow...',
        tokens: 180,
        latency: 1500,
        timestamp: new Date(),
      },
    ],
  };

  await store.updateSession(session.id, update);
  console.log('Session updated with responses');

  // 5. Retrieve the session
  console.log('\nRetrieving session...');
  const retrieved = await store.getSession(session.id);
  console.log('Retrieved session:', {
    id: retrieved?.id,
    status: retrieved?.status,
    responseCount: retrieved?.responses?.length,
  });

  // 6. List sessions for a user
  console.log('\nListing sessions for user...');
  const sessions = await store.listSessions('user-456');
  console.log(`Found ${sessions.length} session(s) for user-456`);

  // 7. List sessions with filters
  console.log('\nListing sessions with filters...');
  const multiModeSessions = await store.listSessions('user-456', {
    mode: 'multi',
    status: 'analyzing',
  });
  console.log(`Found ${multiModeSessions.length} multi-mode analyzing session(s)`);

  // 8. Set up automatic cleanup
  console.log('\nSetting up automatic cleanup...');
  const scheduler = new SessionCleanupScheduler(store, {
    retentionDays: 30,
    cleanupIntervalMs: 24 * 60 * 60 * 1000, // Daily
  });

  scheduler.start();
  console.log('Cleanup scheduler started (runs daily)');

  // 9. Manually trigger cleanup
  console.log('\nManually triggering cleanup...');
  const deletedCount = await scheduler.runCleanup();
  console.log(`Deleted ${deletedCount} old session(s)`);

  // 10. Stop the scheduler
  scheduler.stop();
  console.log('Cleanup scheduler stopped');

  // 11. Clean up
  await store.close();
  console.log('\nDatabase connection closed');
}

// Run the example
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
