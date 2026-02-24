/**
 * Circuit Breaker pattern implementation
 * 
 * Prevents cascading failures by stopping requests to failing services.
 * Implements three states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery).
 * 
 * Validates: Error handling requirement for circuit breaker pattern
 */

import { errorLogger } from './errorLogger.js';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before attempting recovery (default: 60000) */
  resetTimeout?: number;
  /** Number of successful requests needed to close circuit from half-open (default: 2) */
  successThreshold?: number;
  /** Timeout for individual requests in ms (default: 30000) */
  requestTimeout?: number;
  /** Name of the circuit for logging */
  name?: string;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeout: 60000,
  successThreshold: 2,
  requestTimeout: 30000,
  name: 'default',
};

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private options: Required<CircuitBreakerOptions>;
  
  constructor(options: CircuitBreakerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if we should attempt recovery
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        errorLogger.logInfo(
          'CircuitBreaker',
          `Circuit ${this.options.name} entering HALF_OPEN state`
        );
      } else {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN`);
      }
    }
    
    try {
      // Execute the function with timeout
      const result = await this.withTimeout(fn(), this.options.requestTimeout);
      
      // Record success
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Record failure
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        errorLogger.logInfo(
          'CircuitBreaker',
          `Circuit ${this.options.name} closed after successful recovery`
        );
      }
    }
  }
  
  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery attempt, reopen circuit
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      errorLogger.logWarning(
        'CircuitBreaker',
        `Circuit ${this.options.name} reopened after failed recovery attempt`
      );
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN;
      errorLogger.logError(
        'CircuitBreaker',
        `Circuit ${this.options.name} opened after ${this.failureCount} failures`
      );
    }
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
  
  /**
   * Reset circuit to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    errorLogger.logInfo(
      'CircuitBreaker',
      `Circuit ${this.options.name} manually reset`
    );
  }
  
  /**
   * Wrap a promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Circuit breaker timeout')), timeoutMs)
      ),
    ]);
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  
  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...options, name }));
    }
    return this.breakers.get(name)!;
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
  
  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitState> {
    const states = new Map<string, CircuitState>();
    this.breakers.forEach((breaker, name) => {
      states.set(name, breaker.getState());
    });
    return states;
  }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
