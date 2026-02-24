# Court of Minds - Architecture Documentation

This document describes how all components are wired together in the Court of Minds system.

## System Overview

Court of Minds is a multi-model AI deliberation platform that orchestrates structured debates between multiple AI models to reach consensus on complex questions.

## Component Wiring Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Entry                         │
│                         (src/index.ts)                          │
│                                                                  │
│  • Loads environment configuration (.env)                       │
│  • Initializes database and runs migrations                     │
│  • Creates Model Registry with configured models                │
│  • Creates Session Store (PostgreSQL or in-memory)              │
│  • Wires all components together                                │
│  • Starts API server                                            │
│  • Schedules automatic session cleanup                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Server Layer                            │
│                    (src/api/server.ts)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Express    │  │  WebSocket   │  │    Static    │         │
│  │   REST API   │  │   Manager    │  │    Files     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘         │
│         │                  │                                     │
│         │                  │ Real-time progress updates         │
│         │                  │                                     │
└─────────┼──────────────────┼─────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestration Layer                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Query Router                           │  │
│  │              (src/components/QueryRouter.ts)             │  │
│  │                                                           │  │
│  │  • Validates queries                                     │  │
│  │  • Routes to appropriate handler based on mode           │  │
│  │  • Validates model selection and count                   │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│         ┌─────────┴─────────┐                                  │
│         ▼                   ▼                                   │
│  ┌──────────────┐    ┌──────────────────────┐                 │
│  │    Direct    │    │    Deliberation      │                 │
│  │    Query     │    │    Orchestrator      │                 │
│  │   Handler    │    │                      │                 │
│  │              │    │  • Response Collector│                 │
│  │  Single      │    │  • Analysis Engine   │                 │
│  │  Model       │    │  • Debate Orchestr.  │                 │
│  │  Mode        │    │  • Consensus Builder │                 │
│  └──────┬───────┘    └──────────┬───────────┘                 │
│         │                       │                              │
└─────────┼───────────────────────┼──────────────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Layer                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Model Registry                          │  │
│  │            (src/components/ModelRegistry.ts)             │  │
│  │                                                           │  │
│  │  • Manages available models                              │  │
│  │  • Handles enable/disable operations                     │  │
│  │  • Provides model instances to handlers                  │  │
│  │  • Performs health checks                                │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│                   ▼                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Model Adapters                           │  │
│  │                (src/adapters/*.ts)                       │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  OpenAI  │  │Anthropic │  │  Google  │              │  │
│  │  │ Adapter  │  │ Adapter  │  │ Adapter  │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  │                                                           │  │
│  │  • Abstract provider-specific APIs                       │  │
│  │  • Implement common ModelAdapter interface               │  │
│  │  • Handle timeouts and retries                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Persistence Layer                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Session Store                           │  │
│  │            (src/components/SessionStore.ts)              │  │
│  │                                                           │  │
│  │  • PostgresSessionStore (production)                     │  │
│  │  • InMemorySessionStore (development/test)               │  │
│  │                                                           │  │
│  │  • Creates sessions with unique IDs                      │  │
│  │  • Persists all phase data                               │  │
│  │  • Provides query interface for history                  │  │
│  │  • Automatic cleanup of old sessions                     │  │
│  └────────────────┬─────────────────────────────────────────┘  │
│                   │                                             │
│                   ▼                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                          │  │
│  │            (src/db/migrations.ts)                        │  │
│  │                                                           │  │
│  │  • Sessions table with JSONB columns                     │  │
│  │  • Indexes for efficient querying                        │  │
│  │  • Automatic schema migrations                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Initialization Flow

### 1. Application Startup (src/index.ts)

```typescript
main()
  ├─ loadConfig()                    // Load .env configuration
  ├─ initializeDatabase()            // Setup PostgreSQL or in-memory
  │   ├─ DatabaseMigrations.runMigrations()
  │   └─ PostgresSessionStore.initialize()
  ├─ initializeModelRegistry()       // Register AI models
  │   ├─ Register OpenAI models (if API key present)
  │   ├─ Register Anthropic models (if API key present)
  │   └─ Register Google models (if API key present)
  ├─ new CourtOfMindsServer()        // Wire all components
  │   ├─ new DirectQueryHandler(sessionStore)
  │   ├─ new DeliberationOrchestrator(sessionStore)
  │   └─ new QueryRouter(sessionStore, modelRegistry, handlers)
  ├─ server.start()                  // Start HTTP and WebSocket
  └─ scheduleSessionCleanup()        // Schedule automatic cleanup
```

### 2. API Server Initialization (src/api/server.ts)

```typescript
new CourtOfMindsServer(sessionStore, modelRegistry, config)
  ├─ Create Express app
  ├─ Create HTTP server
  ├─ Initialize WebSocket manager
  ├─ Setup middleware
  │   ├─ Static file serving (public/)
  │   ├─ JSON body parsing
  │   ├─ CORS headers
  │   └─ Request logging
  ├─ Setup routes
  │   ├─ POST /api/query → handleSubmitQuery()
  │   ├─ GET /api/session/:id → handleGetSession()
  │   ├─ GET /api/sessions → handleListSessions()
  │   ├─ GET /api/models → handleGetModels()
  │   ├─ POST /api/models → handleRegisterModel()
  │   └─ PATCH /api/models/:id → handleUpdateModel()
  └─ Setup error handler
```

### 3. Query Processing Flow

#### Single-Model Mode:
```
User submits query
  ↓
API: POST /api/query
  ↓
QueryRouter.route(query, 'single')
  ↓
DirectQueryHandler.handle(query, [model])
  ↓
Model.adapter.generateResponse(query)
  ↓
SessionStore.updateSession(sessionId, { responses, status: 'completed' })
  ↓
Return response to user
```

#### Multi-Model Mode:
```
User submits query
  ↓
API: POST /api/query
  ↓
QueryRouter.route(query, 'multi')
  ↓
DeliberationOrchestrator.handle(query, models)
  ├─ Phase 1: ResponseCollector.collectResponses()
  │   ├─ Parallel requests to all models
  │   ├─ 30-second timeout per model
  │   └─ SessionStore.updateSession({ responses, status: 'analyzing' })
  ├─ Phase 2: AnalysisEngine.analyze()
  │   ├─ Identify common themes
  │   ├─ Identify unique approaches
  │   ├─ Categorize differences
  │   └─ SessionStore.updateSession({ analysis, status: 'debating' })
  ├─ Phase 3: DebateOrchestrator.conductDebate()
  │   ├─ 1-5 debate rounds
  │   ├─ Models critique and defend
  │   ├─ Calculate disagreement levels
  │   └─ SessionStore.updateSession({ debate, status: 'consensus' })
  └─ Phase 4: ConsensusBuilder.buildConsensus()
      ├─ Collect final proposals
      ├─ Identify majority or synthesize hybrid
      ├─ SessionStore.updateSession({ consensus, status: 'completed' })
      └─ Return final solution to user
```

### 4. Real-Time Updates (WebSocket)

```
Client connects to ws://localhost:3000/ws
  ↓
WebSocketManager.handleConnection()
  ↓
Client sends: { type: 'subscribe', sessionId: '...' }
  ↓
WebSocketManager stores connection with sessionId
  ↓
During deliberation, components emit progress events:
  ├─ emitCollectingResponses()
  ├─ emitResponsesCollected()
  ├─ emitAnalyzing()
  ├─ emitAnalysisComplete()
  ├─ emitDebating()
  ├─ emitDebateRoundComplete()
  ├─ emitBuildingConsensus()
  └─ emitSessionComplete()
  ↓
WebSocketManager.broadcastProgress()
  ↓
All subscribed clients receive updates
```

## Database Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,           -- Unique session identifier
  user_id VARCHAR(255) NOT NULL,         -- User who created session
  query JSONB NOT NULL,                  -- Original query object
  mode VARCHAR(50) NOT NULL,             -- 'single' or 'multi'
  status VARCHAR(50) NOT NULL,           -- Current phase status
  responses JSONB,                       -- Array of model responses
  analysis JSONB,                        -- Analysis report
  debate JSONB,                          -- Debate rounds and exchanges
  consensus JSONB,                       -- Final consensus result
  errors JSONB,                          -- Any errors that occurred
  created_at TIMESTAMP NOT NULL,         -- Session creation time
  updated_at TIMESTAMP NOT NULL,         -- Last update time
  completed_at TIMESTAMP                 -- Completion time
);

-- Indexes for efficient querying
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_mode ON sessions(mode);
CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);
```

## Environment Configuration

All configuration is managed through environment variables (`.env` file):

### Required Configuration
- At least one AI provider API key (OpenAI, Anthropic, or Google)

### Optional Configuration
- Database connection (falls back to in-memory if not available)
- Server port (default: 3000)
- Authentication settings
- Model parameters (timeout, max tokens, temperature)
- Session retention period

See `.env.example` for complete configuration options.

## Component Dependencies

### Direct Dependencies
```
CourtOfMindsServer
  ├─ SessionStore (PostgresSessionStore or InMemorySessionStore)
  ├─ ModelRegistry
  ├─ QueryRouter
  │   ├─ SessionStore
  │   ├─ ModelRegistry
  │   ├─ DirectQueryHandler
  │   │   └─ SessionStore
  │   └─ DeliberationOrchestrator
  │       ├─ SessionStore
  │       ├─ ResponseCollector
  │       ├─ AnalysisEngine
  │       ├─ DebateOrchestrator
  │       └─ ConsensusBuilder
  └─ WebSocketManager
```

### Model Registry Dependencies
```
ModelRegistry
  └─ ModelAdapters
      ├─ OpenAIAdapter
      ├─ AnthropicAdapter
      ├─ GoogleAdapter
      └─ CustomAdapter (extensible)
```

## Error Handling

### Graceful Degradation
1. **Database unavailable:** Falls back to in-memory storage
2. **Model failures:** Continues with remaining models (if ≥2 succeed)
3. **Timeout handling:** 30-second timeout per model, overall 5-minute session timeout
4. **Retry logic:** Exponential backoff for rate limits (up to 3 attempts)

### Error Propagation
```
Component Error
  ↓
Logged to console
  ↓
Stored in session.errors[]
  ↓
Returned to user in API response
  ↓
Displayed in UI
```

## Security Considerations

### API Key Storage
- API keys stored in environment variables
- Never exposed in API responses
- Encrypted at rest in production

### Authentication
- Optional authentication via Bearer tokens
- Admin endpoints require admin API key
- User isolation via userId

### Input Validation
- Query text validation
- Model selection validation
- Request rate limiting (recommended for production)

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers (session state in database)
- Load balancer distributes requests
- WebSocket sticky sessions required

### Database Scaling
- Connection pooling (max 20 connections per instance)
- Indexed queries for performance
- Automatic cleanup of old sessions

### Caching
- Model registry cached in memory
- Session data cached during active deliberation
- Static files served with caching headers

## Monitoring and Observability

### Logging
- Request logging (all API calls)
- Error logging (with stack traces)
- Progress logging (phase transitions)
- Cleanup logging (session deletions)

### Metrics (Recommended)
- Request count and latency
- Model response times
- Session completion rates
- Error rates by type
- WebSocket connection count

## Testing Strategy

### Unit Tests
- Individual component functionality
- Mock external dependencies
- Test error conditions

### Integration Tests
- Component wiring verification
- API endpoint testing
- Database operations
- WebSocket communication

### End-to-End Tests
- Complete deliberation flows
- UI interaction testing
- Real API integration (with test keys)

## Deployment

### Development
```bash
npm run dev
```
- Uses in-memory storage
- Hot reload enabled
- Detailed logging

### Production
```bash
npm run build
npm run migrate:prod
npm start
```
- Uses PostgreSQL
- Optimized builds
- Production logging

See [SETUP.md](SETUP.md) for detailed deployment instructions.
