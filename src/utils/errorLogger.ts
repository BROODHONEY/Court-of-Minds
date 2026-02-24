/**
 * Error logging utility
 * 
 * Provides detailed error logging with timestamps and context.
 * Centralizes error logging for consistency across the application.
 * 
 * Validates Requirement 9.5: Log detailed error information for debugging
 */

export interface ErrorLogEntry {
  /** Timestamp when the error occurred */
  timestamp: Date;
  /** Component or module where the error occurred */
  component: string;
  /** Error message */
  message: string;
  /** Error stack trace (if available) */
  stack?: string;
  /** Additional context about the error */
  context?: Record<string, any>;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Session ID (if applicable) */
  sessionId?: string;
  /** Model ID (if applicable) */
  modelId?: string;
}

/**
 * Error logger class
 */
class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs: number = 1000;
  
  /**
   * Log an error with detailed information
   */
  logError(
    component: string,
    error: Error | string,
    context?: Record<string, any>,
    sessionId?: string,
    modelId?: string
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      component,
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      severity: 'error',
      sessionId,
      modelId,
    };
    
    this.addLog(entry);
    this.printLog(entry);
  }
  
  /**
   * Log a warning
   */
  logWarning(
    component: string,
    message: string,
    context?: Record<string, any>,
    sessionId?: string,
    modelId?: string
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      component,
      message,
      context,
      severity: 'warning',
      sessionId,
      modelId,
    };
    
    this.addLog(entry);
    this.printLog(entry);
  }
  
  /**
   * Log an info message
   */
  logInfo(
    component: string,
    message: string,
    context?: Record<string, any>,
    sessionId?: string,
    modelId?: string
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      component,
      message,
      context,
      severity: 'info',
      sessionId,
      modelId,
    };
    
    this.addLog(entry);
    this.printLog(entry);
  }
  
  /**
   * Add log entry to internal storage
   */
  private addLog(entry: ErrorLogEntry): void {
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
  
  /**
   * Print log entry to console
   */
  private printLog(entry: ErrorLogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.severity.toUpperCase()}] [${entry.component}]`;
    
    let message = `${prefix} ${entry.message}`;
    
    if (entry.sessionId) {
      message += ` (session: ${entry.sessionId})`;
    }
    
    if (entry.modelId) {
      message += ` (model: ${entry.modelId})`;
    }
    
    // Print to console based on severity
    switch (entry.severity) {
      case 'error':
        console.error(message);
        if (entry.stack) {
          console.error('Stack trace:', entry.stack);
        }
        if (entry.context) {
          console.error('Context:', JSON.stringify(entry.context, null, 2));
        }
        break;
      case 'warning':
        console.warn(message);
        if (entry.context) {
          console.warn('Context:', JSON.stringify(entry.context, null, 2));
        }
        break;
      case 'info':
        console.info(message);
        if (entry.context) {
          console.info('Context:', JSON.stringify(entry.context, null, 2));
        }
        break;
    }
  }
  
  /**
   * Get all logs
   */
  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }
  
  /**
   * Get logs for a specific session
   */
  getSessionLogs(sessionId: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.sessionId === sessionId);
  }
  
  /**
   * Get logs for a specific component
   */
  getComponentLogs(component: string): ErrorLogEntry[] {
    return this.logs.filter(log => log.component === component);
  }
  
  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Helper function to create a formatted error message
 */
export function formatErrorMessage(
  component: string,
  operation: string,
  error: Error | string
): string {
  const errorMsg = error instanceof Error ? error.message : error;
  return `${component} failed during ${operation}: ${errorMsg}`;
}

/**
 * Helper function to extract error details
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  }
  
  return {
    message: String(error),
  };
}
