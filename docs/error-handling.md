# Error Handling Implementation

This document describes the comprehensive error handling system implemented across all components of the AI Court System.

## Overview

The error handling system implements four key features:
1. **Retry logic with exponential backoff** for rate limits (up to 3 attempts)
2. **Detailed error logging** with timestamps and context
3. **Graceful handling of partial failures** (continue if ≥2 models succeed)
4. **Circuit breaker pattern** for external services

## Components

### 1. Retry with Exponential Backoff (`src/utils/retryWithBackoff.ts`)

Implements automatic retry logic for transient failures, particularly API rate limits.

**Features:**
- Configurable maximum retry attempts (default: 3)
- Exponential backoff with configurable multiplier (default: 2x)
- Maximum delay cap to prevent excessive waiting
- Custom retry predicate to determine if errors are retryable
- Callback for logging retry attempts

**Default Behavior:**
- Retries on rate limit errors (429, "rate limit", "quota exceeded")
- Initial delay: 1000ms
- Backoff multiplier: 2x (1s → 2s → 4s)
- Maximum delay: 10000ms

**Usage Example:**
```typescript
import { retryWithBackoff } from './utils/retryWithBackoff';

const result = await retryWithBackoff(
  async () => await apiCall(),
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    onRetry: (attempt, error, delayMs) => {
      console.log(`Retry attempt ${attempt} after ${delayMs}ms`);
    }
  }
);
```

### 2. Error Logger (`src/utils/errorLogger.ts`)

Centralized error logging with detailed context and timestamps.

**Features:**
- Three severity levels: error, warning, info
- Automatic timestamp generation
- Component and session tracking
- Context object for additional details
- Log retention (keeps last 1000 entries)
- Filtering by session ID or component
- Console output with formatted messages

**Usage Example:**
```typescript
import { errorLogger } from './utils/errorLogger';

errorLogger.logError(
  'ComponentName',
  error,
  { key: 'value' },
  'session-id',
  'model-id'
);

// Retrieve logs
const sessionLogs = errorLogger.getSessionLogs('session-id');
const componentLogs = errorLogger.getComponentLogs('ComponentName');
```

**Log Entry Format:**
```typescript
{
  timestamp: Date,
  component: string,
  message: string,
  stack?: string,
  context?: Record<string, any>,
  severity: 'error' | 'warning' | 'info',
  sessionId?: string,
  modelId?: string
}
```

### 3. Circuit Breaker (`src/utils/circuitBreaker.ts`)

Implements the circuit breaker pattern to prevent cascading failures.

**States:**
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit is open, requests fail fast
- **HALF_OPEN**: Testing recovery, limited requests allowed

**Features:**
- Configurable failure threshold (default: 5 failures)
- Automatic recovery attempt after timeout (default: 60s)
- Success threshold for closing circuit (default: 2 successes)
- Request timeout protection (default: 30s)
- Centralized registry for managing multiple circuits

**Usage Example:**
```typescript
import { circuitBreakerRegistry } from './utils/circuitBreaker';

const breaker = circuitBreakerRegistry.getBreaker('model-id', {
  failureThreshold: 5,
  resetTimeout: 60000,
});

const result = await breaker.execute(async () => {
  return await externalServiceCall();
});
```

## Integration with Components

### BaseModelAdapter

All model adapters inherit error handling from `BaseModelAdapter`:

1. **Circuit Breaker**: Wraps all API calls to prevent cascading failures
2. **Retry Logic**: Automatically retries rate limit errors up to 3 times
3. **Error Logging**: Logs all failures with detailed context
4. **Timeout Protection**: Enforces 30-second timeout per request

**Error Flow:**
```
API Call → Circuit Breaker → Retry Logic → Timeout Protection → Error Logging
```

### ResponseCollector

Enhanced with comprehensive error logging:

- Logs start of collection with model count
- Logs each successful response with metrics
- Logs each failure with detailed error information
- Logs final collection summary with success/failure counts
- Continues if ≥2 models succeed (Requirement 9.1)

### AnalysisEngine

Enhanced with error logging:

- Logs start of analysis with response count
- Logs completion with metrics (themes found, differences, duration)
- Logs timeout warnings with partial results
- Returns empty report on timeout instead of failing

### DebateOrchestrator

Enhanced with error logging and failure isolation:

- Logs start of debate with model count
- Logs each round start and completion with metrics
- Logs early termination when convergence achieved
- Removes failed models from subsequent rounds (Requirement 9.2)
- Logs final debate summary with convergence score

### ConsensusBuilder

Enhanced with error logging:

- Logs start of consensus building
- Logs completion with agreement level and confidence
- Logs timeout warnings with fallback consensus
- Handles individual model failures gracefully
- Returns fallback consensus on timeout

## Error Categories

### 1. Model Errors
- **Rate Limits**: Automatically retried with exponential backoff
- **Timeouts**: Logged and model excluded from results
- **API Errors**: Logged with full context, circuit breaker may open

### 2. Validation Errors
- **Invalid Input**: Logged and thrown immediately
- **Configuration Errors**: Logged with detailed context

### 3. System Errors
- **Network Errors**: Circuit breaker protects against cascading failures
- **Database Errors**: Logged with full context

### 4. Business Logic Errors
- **Insufficient Responses**: Logged with failure details
- **Consensus Failure**: Fallback consensus generated

## Logging Format

All logs follow a consistent format:

```
[TIMESTAMP] [SEVERITY] [COMPONENT] Message (session: SESSION_ID) (model: MODEL_ID)
Context: { ... }
Stack trace: ...
```

Example:
```
[2024-02-24T15:03:16.416Z] [INFO] [ResponseCollector] Starting response collection for 3 models (session: query-1)
Context: {
  "queryId": "query-1",
  "modelCount": 3,
  "modelIds": ["model-1", "model-2", "model-3"]
}
```

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 9.1**: Continue with remaining models if at least 2 responses succeed ✓
- **Requirement 9.2**: Exclude failed models from subsequent debate rounds ✓
- **Requirement 9.4**: Retry with exponential backoff up to 3 attempts for rate limits ✓
- **Requirement 9.5**: Log detailed error information with timestamps ✓
- **Circuit Breaker**: Implement circuit breaker for external services ✓

## Testing

Comprehensive test suites are provided for all error handling utilities:

- `src/utils/__tests__/retryWithBackoff.test.ts`: Tests retry logic and backoff
- `src/utils/__tests__/circuitBreaker.test.ts`: Tests circuit breaker states and transitions
- `src/utils/__tests__/errorLogger.test.ts`: Tests logging functionality

All tests pass successfully, validating the error handling implementation.

## Best Practices

1. **Always use errorLogger** for logging instead of console.log/error
2. **Provide context** in error logs to aid debugging
3. **Include session IDs** when available for traceability
4. **Use circuit breakers** for all external service calls
5. **Let retry logic handle** transient failures automatically
6. **Don't swallow errors** - log them even if handled gracefully

## Future Enhancements

Potential improvements for future iterations:

1. **Metrics Collection**: Track error rates, retry counts, circuit breaker states
2. **Alerting**: Send alerts when error thresholds are exceeded
3. **Distributed Tracing**: Add correlation IDs for distributed system tracing
4. **Error Aggregation**: Group similar errors for better analysis
5. **Adaptive Backoff**: Adjust retry delays based on service response patterns
