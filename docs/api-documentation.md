# Court of Minds API Documentation

## Overview

The Court of Minds API provides REST endpoints for submitting queries, managing sessions, and configuring AI models. It also includes WebSocket support for real-time progress updates during deliberation sessions.

## Base URL

```
http://localhost:3000
```

## Authentication

The API supports optional Bearer token authentication. When `enableAuth` is set to `true` in the server configuration:

- All endpoints require an `Authorization` header with a Bearer token
- Admin endpoints require a specific admin API key

```
Authorization: Bearer <your-token>
```

## REST API Endpoints

### Health Check

#### GET /health

Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Query Submission

#### POST /api/query

Submit a new query for processing in either single-model or multi-model mode.

**Request Body:**
```json
{
  "text": "What is the capital of France?",
  "mode": "single",
  "selectedModels": ["gpt-4"],
  "userId": "user123"
}
```

**Parameters:**
- `text` (string, required): The query text
- `mode` (string, required): Either "single" or "multi"
- `selectedModels` (array, optional): Array of model IDs to use. If omitted in multi-model mode, all enabled models are used
- `userId` (string, optional): User identifier. Defaults to "anonymous" if not provided

**Response (Success):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "result": "The capital of France is Paris.",
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user123",
    "query": {
      "id": "query-id",
      "text": "What is the capital of France?",
      "userId": "user123",
      "selectedModels": ["gpt-4"],
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "mode": "single",
    "status": "completed",
    "responses": [...],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:05.000Z",
    "completedAt": "2024-01-15T10:30:05.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Query execution failed

---

### Session Management

#### GET /api/session/:id

Retrieve details of a specific session.

**Parameters:**
- `id` (path parameter): Session ID

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123",
  "query": {...},
  "mode": "multi",
  "status": "completed",
  "responses": [...],
  "analysis": {...},
  "debate": {...},
  "consensus": {...},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z",
  "completedAt": "2024-01-15T10:35:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Session does not exist

---

#### GET /api/sessions

List sessions for a specific user with optional filtering.

**Query Parameters:**
- `userId` (required): User ID to filter by
- `mode` (optional): Filter by mode ("single" or "multi")
- `status` (optional): Filter by status
- `startDate` (optional): Filter sessions created after this date
- `endDate` (optional): Filter sessions created before this date

**Example:**
```
GET /api/sessions?userId=user123&mode=multi&status=completed
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-1",
      "userId": "user123",
      "query": {...},
      "mode": "multi",
      "status": "completed",
      ...
    },
    {
      "id": "session-2",
      "userId": "user123",
      "query": {...},
      "mode": "single",
      "status": "completed",
      ...
    }
  ],
  "count": 2
}
```

**Error Responses:**
- `400 Bad Request`: Missing userId parameter

---

### Model Management

#### GET /api/models

Get list of available AI models.

**Response:**
```json
{
  "models": [
    {
      "id": "gpt-4",
      "name": "gpt-4",
      "provider": "openai",
      "enabled": true
    },
    {
      "id": "claude-3",
      "name": "claude-3-opus-20240229",
      "provider": "anthropic",
      "enabled": true
    }
  ],
  "count": 2
}
```

---

#### POST /api/models

Register a new AI model (admin only).

**Request Body:**
```json
{
  "id": "gemini-pro",
  "provider": "google",
  "apiKey": "your-api-key",
  "modelName": "gemini-pro",
  "enabled": true,
  "maxTokens": 2000,
  "temperature": 0.7,
  "timeout": 30
}
```

**Parameters:**
- `id` (string, required): Unique model identifier
- `provider` (string, required): Provider name ("openai", "anthropic", "google", "custom")
- `apiKey` (string, required): API key for authentication
- `modelName` (string, required): Specific model name
- `enabled` (boolean, optional): Whether model is enabled (default: true)
- `maxTokens` (number, optional): Maximum tokens for responses (default: 2000)
- `temperature` (number, optional): Temperature setting (default: 0.7)
- `timeout` (number, optional): Timeout in seconds (default: 30)

**Response:**
```json
{
  "message": "Model registered successfully",
  "modelId": "gemini-pro"
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `403 Forbidden`: Admin access required

---

#### PATCH /api/models/:id

Enable or disable a model (admin only).

**Parameters:**
- `id` (path parameter): Model ID

**Request Body:**
```json
{
  "enabled": false
}
```

**Response:**
```json
{
  "message": "Model disabled successfully",
  "modelId": "gpt-4"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid enabled value
- `403 Forbidden`: Admin access required
- `500 Internal Server Error`: Model not found

---

## WebSocket API

### Connection

Connect to the WebSocket server at:

```
ws://localhost:3000/ws
```

### Client Messages

#### Subscribe to Session

Subscribe to receive progress updates for a specific session.

```json
{
  "type": "subscribe",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123"
}
```

**Response:**
```json
{
  "type": "subscribed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Unsubscribe

Unsubscribe from session updates.

```json
{
  "type": "unsubscribe"
}
```

**Response:**
```json
{
  "type": "unsubscribed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Ping

Send a ping to check connection.

```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Server Events

The server sends progress events for subscribed sessions:

#### session_created

```json
{
  "type": "session_created",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "mode": "multi",
    "query": "Explain quantum computing"
  }
}
```

#### collecting_responses

```json
{
  "type": "collecting_responses",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:01.000Z",
  "data": {
    "modelCount": 3
  }
}
```

#### responses_collected

```json
{
  "type": "responses_collected",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:15.000Z",
  "data": {
    "responseCount": 3,
    "failureCount": 0
  }
}
```

#### analyzing

```json
{
  "type": "analyzing",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:16.000Z"
}
```

#### analysis_complete

```json
{
  "type": "analysis_complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:20.000Z",
  "data": {
    "summary": "All models agree on the fundamental principles..."
  }
}
```

#### debating

```json
{
  "type": "debating",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:21.000Z",
  "data": {
    "roundNumber": 1
  }
}
```

#### debate_round_complete

```json
{
  "type": "debate_round_complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:45.000Z",
  "data": {
    "roundNumber": 1,
    "disagreementLevel": 0.3
  }
}
```

#### debate_complete

```json
{
  "type": "debate_complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:31:30.000Z",
  "data": {
    "totalRounds": 2,
    "convergenceScore": 0.85
  }
}
```

#### building_consensus

```json
{
  "type": "building_consensus",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:31:31.000Z"
}
```

#### consensus_complete

```json
{
  "type": "consensus_complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:32:00.000Z",
  "data": {
    "agreementLevel": 0.9
  }
}
```

#### session_complete

```json
{
  "type": "session_complete",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:32:01.000Z",
  "data": {
    "result": "Quantum computing leverages quantum mechanical phenomena..."
  }
}
```

#### session_failed

```json
{
  "type": "session_failed",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:30.000Z",
  "data": {
    "error": "Insufficient responses: only 1 model responded"
  }
}
```

---

## Example Usage

### JavaScript/Node.js

```javascript
// Submit a query
const response = await fetch('http://localhost:3000/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Explain quantum computing',
    mode: 'multi',
    userId: 'user123',
  }),
});

const { sessionId, result } = await response.json();
console.log('Session ID:', sessionId);
console.log('Result:', result);

// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  // Subscribe to session updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    sessionId: sessionId,
    userId: 'user123',
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Progress event:', event.type, event.data);
});
```

### Python

```python
import requests
import websocket
import json

# Submit a query
response = requests.post('http://localhost:3000/api/query', json={
    'text': 'Explain quantum computing',
    'mode': 'multi',
    'userId': 'user123'
})

data = response.json()
session_id = data['sessionId']
print(f'Session ID: {session_id}')
print(f'Result: {data["result"]}')

# Connect to WebSocket
def on_message(ws, message):
    event = json.loads(message)
    print(f'Progress event: {event["type"]}', event.get('data'))

def on_open(ws):
    # Subscribe to session updates
    ws.send(json.dumps({
        'type': 'subscribe',
        'sessionId': session_id,
        'userId': 'user123'
    }))

ws = websocket.WebSocketApp('ws://localhost:3000/ws',
                            on_message=on_message,
                            on_open=on_open)
ws.run_forever()
```

### cURL

```bash
# Submit a query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What is the capital of France?",
    "mode": "single",
    "selectedModels": ["gpt-4"],
    "userId": "user123"
  }'

# Get session details
curl http://localhost:3000/api/session/550e8400-e29b-41d4-a716-446655440000

# List user sessions
curl "http://localhost:3000/api/sessions?userId=user123&mode=multi"

# Get available models
curl http://localhost:3000/api/models

# Register a new model (admin)
curl -X POST http://localhost:3000/api/models \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-api-key" \
  -d '{
    "id": "gemini-pro",
    "provider": "google",
    "apiKey": "your-api-key",
    "modelName": "gemini-pro"
  }'

# Disable a model (admin)
curl -X PATCH http://localhost:3000/api/models/gpt-4 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-api-key" \
  -d '{"enabled": false}'
```

---

## Error Handling

All error responses follow this format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Common Error Codes

- `INVALID_REQUEST`: Request validation failed
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Server error during processing

---

## Rate Limiting

The API implements automatic retry with exponential backoff for rate limit errors from AI model providers. The system will make up to 3 retry attempts before failing.

---

## CORS

The API includes CORS headers allowing cross-origin requests from any domain. In production, you should configure specific allowed origins.

---

## Server Configuration

```typescript
import { CourtOfMindsServer } from './src/api/index.js';
import { InMemorySessionStore } from './src/components/SessionStore.js';
import { ModelRegistry } from './src/components/ModelRegistry.js';

const sessionStore = new InMemorySessionStore();
const modelRegistry = new ModelRegistry();

// Register models
modelRegistry.registerModel({
  id: 'gpt-4',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4',
  enabled: true,
  maxTokens: 2000,
  temperature: 0.7,
  timeout: 30,
});

// Create and start server
const server = new CourtOfMindsServer(sessionStore, modelRegistry, {
  port: 3000,
  enableAuth: true,
  adminApiKey: process.env.ADMIN_API_KEY,
});

await server.start();
```

---

## Requirements Validation

This API implementation validates the following requirements:

- **Requirement 10.1**: Display options for single-model or multi-model mode ✓
- **Requirement 10.2**: Allow users to select which models participate ✓
- **Requirement 10.3**: Display real-time progress indicators for each phase ✓
- **Requirement 10.4**: Allow users to view intermediate results ✓
- **Requirement 8.1**: Support configuration of model providers ✓
- **Requirement 8.3**: Allow enabling or disabling individual models ✓
