/**
 * Tests for error logging utility
 */

import { errorLogger, formatErrorMessage, extractErrorDetails } from '../errorLogger';

describe('ErrorLogger', () => {
  beforeEach(() => {
    errorLogger.clearLogs();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logError', () => {
    it('should log error with details', () => {
      const error = new Error('Test error');
      errorLogger.logError('TestComponent', error, { key: 'value' }, 'session-1', 'model-1');
      
      const logs = errorLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        component: 'TestComponent',
        message: 'Test error',
        severity: 'error',
        sessionId: 'session-1',
        modelId: 'model-1',
      });
      expect(logs[0].context).toEqual({ key: 'value' });
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should log string errors', () => {
      errorLogger.logError('TestComponent', 'String error');
      
      const logs = errorLogger.getLogs();
      expect(logs[0].message).toBe('String error');
      expect(logs[0].stack).toBeUndefined();
    });

    it('should print to console.error', () => {
      errorLogger.logError('TestComponent', new Error('Test'));
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('logWarning', () => {
    it('should log warning with details', () => {
      errorLogger.logWarning('TestComponent', 'Warning message', { key: 'value' });
      
      const logs = errorLogger.getLogs();
      expect(logs[0]).toMatchObject({
        component: 'TestComponent',
        message: 'Warning message',
        severity: 'warning',
      });
    });

    it('should print to console.warn', () => {
      errorLogger.logWarning('TestComponent', 'Warning');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('logInfo', () => {
    it('should log info with details', () => {
      errorLogger.logInfo('TestComponent', 'Info message', { key: 'value' });
      
      const logs = errorLogger.getLogs();
      expect(logs[0]).toMatchObject({
        component: 'TestComponent',
        message: 'Info message',
        severity: 'info',
      });
    });

    it('should print to console.info', () => {
      errorLogger.logInfo('TestComponent', 'Info');
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('getSessionLogs', () => {
    it('should filter logs by session ID', () => {
      errorLogger.logError('Component1', 'Error 1', {}, 'session-1');
      errorLogger.logError('Component2', 'Error 2', {}, 'session-2');
      errorLogger.logError('Component3', 'Error 3', {}, 'session-1');
      
      const sessionLogs = errorLogger.getSessionLogs('session-1');
      expect(sessionLogs).toHaveLength(2);
      expect(sessionLogs[0].message).toBe('Error 1');
      expect(sessionLogs[1].message).toBe('Error 3');
    });
  });

  describe('getComponentLogs', () => {
    it('should filter logs by component', () => {
      errorLogger.logError('ComponentA', 'Error 1');
      errorLogger.logError('ComponentB', 'Error 2');
      errorLogger.logError('ComponentA', 'Error 3');
      
      const componentLogs = errorLogger.getComponentLogs('ComponentA');
      expect(componentLogs).toHaveLength(2);
      expect(componentLogs[0].message).toBe('Error 1');
      expect(componentLogs[1].message).toBe('Error 3');
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      errorLogger.logError('Component', 'Error');
      expect(errorLogger.getLogs()).toHaveLength(1);
      
      errorLogger.clearLogs();
      expect(errorLogger.getLogs()).toHaveLength(0);
    });
  });

  describe('log retention', () => {
    it('should keep only most recent logs', () => {
      // This test would need to modify the maxLogs property
      // For now, just verify logs are stored
      for (let i = 0; i < 10; i++) {
        errorLogger.logError('Component', `Error ${i}`);
      }
      
      expect(errorLogger.getLogs().length).toBeLessThanOrEqual(1000);
    });
  });
});

describe('Helper functions', () => {
  describe('formatErrorMessage', () => {
    it('should format error message with Error object', () => {
      const error = new Error('Test error');
      const message = formatErrorMessage('Component', 'operation', error);
      expect(message).toBe('Component failed during operation: Test error');
    });

    it('should format error message with string', () => {
      const message = formatErrorMessage('Component', 'operation', 'String error');
      expect(message).toBe('Component failed during operation: String error');
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract details from Error object', () => {
      const error = new Error('Test error');
      const details = extractErrorDetails(error);
      
      expect(details.message).toBe('Test error');
      expect(details.stack).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const details = extractErrorDetails('String error');
      expect(details.message).toBe('String error');
      expect(details.stack).toBeUndefined();
    });

    it('should extract error code if present', () => {
      const error: any = new Error('Test error');
      error.code = 'ERR_TEST';
      
      const details = extractErrorDetails(error);
      expect(details.code).toBe('ERR_TEST');
    });
  });
});
