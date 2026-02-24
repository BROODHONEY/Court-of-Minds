/**
 * Database Migrations - PostgreSQL schema setup
 * 
 * This module provides database migration functionality for Court of Minds.
 * It creates the necessary tables and indexes for session storage.
 * 
 * Validates Requirements: 6.1, 6.2, 6.5
 */

import pg from 'pg';

const { Pool } = pg;

/**
 * Database migration manager
 */
export class DatabaseMigrations {
  private pool: pg.Pool;

  constructor(connectionConfig?: pg.PoolConfig) {
    this.pool = new Pool(connectionConfig || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'court_of_minds',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Run all migrations
   * Creates tables and indexes if they don't exist
   */
  async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      console.log('Running database migrations...');

      // Create sessions table
      await this.createSessionsTable(client);

      // Create indexes
      await this.createIndexes(client);

      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create sessions table
   * Validates Requirements: 6.1 (unique session ID), 6.2 (persist all data)
   */
  private async createSessionsTable(client: pg.PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        query JSONB NOT NULL,
        mode VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        responses JSONB,
        analysis JSONB,
        debate JSONB,
        consensus JSONB,
        errors JSONB,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP
      );
    `);

    console.log('✓ Sessions table created/verified');
  }

  /**
   * Create indexes for efficient querying
   * Validates Requirement: 6.3 (retrieve session history)
   */
  private async createIndexes(client: pg.PoolClient): Promise<void> {
    // Index for user session queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
      ON sessions(user_id);
    `);

    // Index for date range queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
      ON sessions(created_at DESC);
    `);

    // Index for status filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status 
      ON sessions(status);
    `);

    // Index for mode filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_mode 
      ON sessions(mode);
    `);

    // Composite index for user + created_at (most common query pattern)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_created 
      ON sessions(user_id, created_at DESC);
    `);

    console.log('✓ Database indexes created/verified');
  }

  /**
   * Check database connection
   */
  async checkConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  /**
   * Drop all tables (for testing/reset)
   * WARNING: This will delete all data!
   */
  async dropTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('DROP TABLE IF EXISTS sessions CASCADE;');
      console.log('✓ All tables dropped');
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Get the connection pool (for use by SessionStore)
   */
  getPool(): pg.Pool {
    return this.pool;
  }
}

/**
 * Run migrations from command line
 * Usage: node dist/db/migrations.js
 */
async function runMigrationsFromCLI() {
  const migrations = new DatabaseMigrations();
  
  try {
    await migrations.runMigrations();
    console.log('Migrations completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Check if this module is being run directly
// Only run migrations if executed as main module
if (typeof require !== 'undefined' && require.main === module) {
  runMigrationsFromCLI();
}
