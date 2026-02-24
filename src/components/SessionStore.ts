/**
 * SessionStore - Manages session persistence and retrieval
 * 
 * This component is responsible for creating sessions with unique identifiers,
 * persisting session data, and providing query interfaces for session history.
 */

import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import type {
  Session,
  Query,
  QueryMode,
  SessionUpdate,
  SessionFilters,
} from '../models/types.js';

const { Pool } = pg;

/**
 * Interface for session storage operations
 */
export interface SessionStore {
  createSession(query: Query, mode: QueryMode): Promise<Session>;
  updateSession(sessionId: string, update: SessionUpdate): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  listSessions(userId: string, filters?: SessionFilters): Promise<Session[]>;
  deleteOldSessions(olderThan: Date): Promise<number>;
}

/**
 * In-memory implementation of SessionStore
 * 
 * This is a simple implementation for testing and development.
 * In production, this would be backed by a database like PostgreSQL.
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();

  /**
   * Creates a new session with a unique identifier
   * 
   * @param query The query that initiated the session
   * @param mode The execution mode (single or multi-model)
   * @returns The newly created session
   */
  async createSession(query: Query, mode: QueryMode): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: uuidv4(),
      userId: query.userId,
      query,
      mode,
      status: 'collecting',
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Updates an existing session with new data
   * 
   * @param sessionId The ID of the session to update
   * @param update The update data
   */
  async updateSession(sessionId: string, update: SessionUpdate): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Apply updates
    if (update.status !== undefined) {
      session.status = update.status;
    }
    if (update.responses !== undefined) {
      session.responses = update.responses;
    }
    if (update.analysis !== undefined) {
      session.analysis = update.analysis;
    }
    if (update.debate !== undefined) {
      session.debate = update.debate;
    }
    if (update.consensus !== undefined) {
      session.consensus = update.consensus;
    }
    if (update.errors !== undefined) {
      session.errors = update.errors;
    }
    if (update.completedAt !== undefined) {
      session.completedAt = update.completedAt;
    }

    session.updatedAt = new Date();
    this.sessions.set(sessionId, session);
  }

  /**
   * Retrieves a session by its ID
   * 
   * @param sessionId The ID of the session to retrieve
   * @returns The session if found, null otherwise
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Lists sessions for a user with optional filtering
   * 
   * @param userId The user ID to filter by
   * @param filters Optional filters for date range, mode, and status
   * @returns Array of matching sessions
   */
  async listSessions(
    userId: string,
    filters?: SessionFilters
  ): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );

    if (filters) {
      if (filters.startDate) {
        sessions = sessions.filter((s) => s.createdAt >= filters.startDate!);
      }
      if (filters.endDate) {
        sessions = sessions.filter((s) => s.createdAt <= filters.endDate!);
      }
      if (filters.mode) {
        sessions = sessions.filter((s) => s.mode === filters.mode);
      }
      if (filters.status) {
        sessions = sessions.filter((s) => s.status === filters.status);
      }
    }

    return sessions;
  }

  /**
   * Deletes sessions older than the specified date
   * 
   * @param olderThan Delete sessions created before this date
   * @returns Number of sessions deleted
   */
  async deleteOldSessions(olderThan: Date): Promise<number> {
    let deletedCount = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.createdAt < olderThan) {
        this.sessions.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Clears all sessions (for testing purposes)
   */
  clear(): void {
    this.sessions.clear();
  }
}

/**
 * PostgreSQL implementation of SessionStore
 * 
 * This implementation uses PostgreSQL for persistent session storage.
 * It includes automatic cleanup of sessions older than 30 days.
 */
export class PostgresSessionStore implements SessionStore {
  private pool: pg.Pool;

  /**
   * Creates a new PostgreSQL session store
   * 
   * @param connectionConfig PostgreSQL connection configuration
   */
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
   * Initializes the database schema
   * Creates the sessions table if it doesn't exist
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
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

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(mode);
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Creates a new session with a unique identifier
   * 
   * @param query The query that initiated the session
   * @param mode The execution mode (single or multi-model)
   * @returns The newly created session
   */
  async createSession(query: Query, mode: QueryMode): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: uuidv4(),
      userId: query.userId,
      query,
      mode,
      status: 'collecting',
      createdAt: now,
      updatedAt: now,
    };

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO sessions (
          id, user_id, query, mode, status, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.id,
          session.userId,
          JSON.stringify(session.query),
          session.mode,
          session.status,
          session.createdAt,
          session.updatedAt,
        ]
      );
    } finally {
      client.release();
    }

    return session;
  }

  /**
   * Updates an existing session with new data
   * 
   * @param sessionId The ID of the session to update
   * @param update The update data
   */
  async updateSession(sessionId: string, update: SessionUpdate): Promise<void> {
    const client = await this.pool.connect();
    try {
      // First, get the current session
      const result = await client.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const session = this.rowToSession(result.rows[0]);

      // Apply updates
      if (update.status !== undefined) {
        session.status = update.status;
      }
      if (update.responses !== undefined) {
        session.responses = update.responses;
      }
      if (update.analysis !== undefined) {
        session.analysis = update.analysis;
      }
      if (update.debate !== undefined) {
        session.debate = update.debate;
      }
      if (update.consensus !== undefined) {
        session.consensus = update.consensus;
      }
      if (update.errors !== undefined) {
        session.errors = update.errors;
      }
      if (update.completedAt !== undefined) {
        session.completedAt = update.completedAt;
      }

      session.updatedAt = new Date();

      // Update the database
      await client.query(
        `UPDATE sessions SET
          status = $1,
          responses = $2,
          analysis = $3,
          debate = $4,
          consensus = $5,
          errors = $6,
          updated_at = $7,
          completed_at = $8
        WHERE id = $9`,
        [
          session.status,
          session.responses ? JSON.stringify(session.responses) : null,
          session.analysis ? JSON.stringify(session.analysis) : null,
          session.debate ? JSON.stringify(session.debate) : null,
          session.consensus ? JSON.stringify(session.consensus) : null,
          session.errors ? JSON.stringify(session.errors) : null,
          session.updatedAt,
          session.completedAt || null,
          sessionId,
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves a session by its ID
   * 
   * @param sessionId The ID of the session to retrieve
   * @returns The session if found, null otherwise
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToSession(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Lists sessions for a user with optional filtering
   * 
   * @param userId The user ID to filter by
   * @param filters Optional filters for date range, mode, and status
   * @returns Array of matching sessions
   */
  async listSessions(
    userId: string,
    filters?: SessionFilters
  ): Promise<Session[]> {
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM sessions WHERE user_id = $1';
      const params: any[] = [userId];
      let paramIndex = 2;

      if (filters) {
        if (filters.startDate) {
          query += ` AND created_at >= $${paramIndex}`;
          params.push(filters.startDate);
          paramIndex++;
        }
        if (filters.endDate) {
          query += ` AND created_at <= $${paramIndex}`;
          params.push(filters.endDate);
          paramIndex++;
        }
        if (filters.mode) {
          query += ` AND mode = $${paramIndex}`;
          params.push(filters.mode);
          paramIndex++;
        }
        if (filters.status) {
          query += ` AND status = $${paramIndex}`;
          params.push(filters.status);
          paramIndex++;
        }
      }

      query += ' ORDER BY created_at DESC';

      const result = await client.query(query, params);
      return result.rows.map(row => this.rowToSession(row));
    } finally {
      client.release();
    }
  }

  /**
   * Deletes sessions older than the specified date
   * 
   * @param olderThan Delete sessions created before this date
   * @returns Number of sessions deleted
   */
  async deleteOldSessions(olderThan: Date): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM sessions WHERE created_at < $1',
        [olderThan]
      );
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * Closes the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Converts a database row to a Session object
   * 
   * @param row Database row
   * @returns Session object
   */
  private rowToSession(row: any): Session {
    const session: Session = {
      id: row.id,
      userId: row.user_id,
      query: typeof row.query === 'string' ? JSON.parse(row.query) : row.query,
      mode: row.mode,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    if (row.responses) {
      session.responses = typeof row.responses === 'string' 
        ? JSON.parse(row.responses) 
        : row.responses;
    }
    if (row.analysis) {
      session.analysis = typeof row.analysis === 'string' 
        ? JSON.parse(row.analysis) 
        : row.analysis;
    }
    if (row.debate) {
      session.debate = typeof row.debate === 'string' 
        ? JSON.parse(row.debate) 
        : row.debate;
    }
    if (row.consensus) {
      session.consensus = typeof row.consensus === 'string' 
        ? JSON.parse(row.consensus) 
        : row.consensus;
    }
    if (row.errors) {
      session.errors = typeof row.errors === 'string' 
        ? JSON.parse(row.errors) 
        : row.errors;
    }
    if (row.completed_at) {
      session.completedAt = new Date(row.completed_at);
    }

    return session;
  }
}
