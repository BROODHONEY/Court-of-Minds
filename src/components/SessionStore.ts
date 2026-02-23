/**
 * SessionStore - Manages session persistence and retrieval
 * 
 * This component is responsible for creating sessions with unique identifiers,
 * persisting session data, and providing query interfaces for session history.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Session,
  Query,
  QueryMode,
  SessionUpdate,
  SessionFilters,
} from '../models/types.js';

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
