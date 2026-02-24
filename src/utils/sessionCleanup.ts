/**
 * Session Cleanup Utility
 * 
 * Provides automatic cleanup of sessions older than 30 days.
 * This utility can be run as a scheduled job or manually triggered.
 */

import type { SessionStore } from '../components/SessionStore.js';

/**
 * Configuration for session cleanup
 */
export interface CleanupConfig {
  /** Number of days after which sessions should be deleted */
  retentionDays: number;
  /** Interval in milliseconds for automatic cleanup (0 to disable) */
  cleanupIntervalMs: number;
}

/**
 * Default cleanup configuration
 * - Retains sessions for 30 days (as per requirement 6.5)
 * - Runs cleanup daily (24 hours)
 */
export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  retentionDays: 30,
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Session cleanup scheduler
 * 
 * Automatically deletes sessions older than the configured retention period.
 */
export class SessionCleanupScheduler {
  private store: SessionStore;
  private config: CleanupConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(store: SessionStore, config: CleanupConfig = DEFAULT_CLEANUP_CONFIG) {
    this.store = store;
    this.config = config;
  }

  /**
   * Starts the automatic cleanup scheduler
   */
  start(): void {
    if (this.intervalId) {
      throw new Error('Cleanup scheduler is already running');
    }

    if (this.config.cleanupIntervalMs <= 0) {
      throw new Error('Cleanup interval must be greater than 0');
    }

    // Run cleanup immediately on start
    this.runCleanup().catch(err => {
      console.error('Error during initial cleanup:', err);
    });

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup().catch(err => {
        console.error('Error during scheduled cleanup:', err);
      });
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stops the automatic cleanup scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Manually triggers a cleanup operation
   * 
   * @returns Number of sessions deleted
   */
  async runCleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const deletedCount = await this.store.deleteOldSessions(cutoffDate);
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} sessions older than ${this.config.retentionDays} days`);
    }

    return deletedCount;
  }

  /**
   * Checks if the scheduler is currently running
   */
  isRunning(): boolean {
    return this.intervalId !== undefined;
  }
}
