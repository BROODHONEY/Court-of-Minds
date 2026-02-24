/**
 * Tests for retry with exponential backoff utility
 */

import { retryWithBackoff, isRateLimitError, isTimeoutError, isNetworkError } from '../retryWithBackoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    
    const result = await retryWithBackoff(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on rate limit error', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce('success');
    
    const result = await retryWithBackoff(fn, {
      initialDelayMs: 10,
      maxAttempts: 3,
    });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry up to max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));
    
    await expect(
      retryWithBackoff(fn, {
        initialDelayMs: 10,
        maxAttempts: 3,
      })
    ).rejects.toThrow('Rate limit exceeded');
    
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Invalid API key'));
    
    await expect(
      retryWithBackoff(fn, {
        initialDelayMs: 10,
        maxAttempts: 3,
      })
    ).rejects.toThrow('Invalid API key');
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce('success');
    
    const onRetry = jest.fn();
    
    await retryWithBackoff(fn, {
      initialDelayMs: 100,
      backoffMultiplier: 2,
      maxAttempts: 3,
      onRetry,
    });
    
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 100);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 200);
  });

  it('should respect max delay', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce('success');
    
    const onRetry = jest.fn();
    
    await retryWithBackoff(fn, {
      initialDelayMs: 1000,
      backoffMultiplier: 10,
      maxDelayMs: 1500,
      maxAttempts: 3,
      onRetry,
    });
    
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 1000);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 1500); // Capped at maxDelayMs
  });
});

describe('Error detection utilities', () => {
  describe('isRateLimitError', () => {
    it('should detect rate limit errors', () => {
      expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
      expect(isRateLimitError(new Error('Quota exceeded'))).toBe(true);
      expect(isRateLimitError(new Error('Invalid API key'))).toBe(false);
    });
  });

  describe('isTimeoutError', () => {
    it('should detect timeout errors', () => {
      expect(isTimeoutError(new Error('Request timeout'))).toBe(true);
      expect(isTimeoutError(new Error('Operation timed out'))).toBe(true);
      expect(isTimeoutError(new Error('Deadline exceeded'))).toBe(true);
      expect(isTimeoutError(new Error('Invalid API key'))).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      expect(isNetworkError(new Error('Network error'))).toBe(true);
      expect(isNetworkError(new Error('Connection refused'))).toBe(true);
      expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('Invalid API key'))).toBe(false);
    });
  });
});
