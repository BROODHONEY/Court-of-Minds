/**
 * Tests for circuit breaker pattern implementation
 */

import { CircuitBreaker, CircuitState } from '../circuitBreaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start in CLOSED state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute function successfully in CLOSED state', async () => {
    const breaker = new CircuitBreaker();
    const fn = jest.fn().mockResolvedValue('success');
    
    const result = await breaker.execute(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open circuit after failure threshold', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
    });
    
    const fn = jest.fn().mockRejectedValue(new Error('Service unavailable'));
    
    // First 3 failures should open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('Service unavailable');
    }
    
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.getFailureCount()).toBe(3);
  });

  it('should fail fast when circuit is OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 10000,
    });
    
    const fn = jest.fn().mockRejectedValue(new Error('Service unavailable'));
    
    // Trigger failures to open circuit
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    
    // Next call should fail fast without calling the function
    const callCount = fn.mock.calls.length;
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker');
    expect(fn).toHaveBeenCalledTimes(callCount); // No additional call
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 100,
    });
    
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce('success');
    
    // Open the circuit
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Next call should transition to HALF_OPEN and succeed
    const result = await breaker.execute(fn);
    expect(result).toBe('success');
  });

  it('should close circuit after success threshold in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 100,
      successThreshold: 2,
    });
    
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success');
    
    // Open the circuit
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Two successful calls should close the circuit
    await breaker.execute(fn);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    
    await breaker.execute(fn);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should reopen circuit on failure in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 100,
    });
    
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockRejectedValueOnce(new Error('Fail'))
      .mockRejectedValueOnce(new Error('Fail again'));
    
    // Open the circuit
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Failure in HALF_OPEN should reopen circuit
    await expect(breaker.execute(fn)).rejects.toThrow('Fail again');
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should reset circuit manually', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
    });
    
    const fn = jest.fn().mockRejectedValue(new Error('Fail'));
    
    // Open the circuit
    await expect(breaker.execute(fn)).rejects.toThrow();
    await expect(breaker.execute(fn)).rejects.toThrow();
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    
    // Manual reset
    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('should timeout long-running operations', async () => {
    const breaker = new CircuitBreaker({
      requestTimeout: 100,
    });
    
    const fn = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('too slow'), 200))
    );
    
    await expect(breaker.execute(fn)).rejects.toThrow('timeout');
  });
});
