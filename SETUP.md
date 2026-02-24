# Court of Minds - Setup Guide

This guide will help you set up and run the Court of Minds multi-model AI deliberation platform.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (optional, can use in-memory storage for development)
- API keys for at least one AI provider (OpenAI, Anthropic, or Google)

## Installation

1. **Clone the repository and install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Copy the example environment file and edit it with your configuration:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys and database configuration:

```env
# Required: At least one AI provider API key
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# Database (optional for development)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=court_of_minds
DB_USER=postgres
DB_PASSWORD=your_password
```

## Database Setup (Optional)

For production or persistent storage, set up PostgreSQL:

1. **Create the database:**

```bash
createdb court_of_minds
```

Or using psql:

```sql
CREATE DATABASE court_of_minds;
```

2. **Run migrations:**

```bash
npm run migrate
```

This will create the necessary tables and indexes.

**Note:** If PostgreSQL is not available, the application will automatically fall back to in-memory storage.

## Running the Application

### Development Mode

Start the server with hot-reload:

```bash
npm run dev
```

### Production Mode

1. Build the application:

```bash
npm run build
```

2. Run migrations (if using PostgreSQL):

```bash
npm run migrate:prod
```

3. Start the server:

```bash
npm start
```

## Accessing the Application

Once started, the application is available at:

- **Web UI:** http://localhost:3000
- **API:** http://localhost:3000/api
- **WebSocket:** ws://localhost:3000/ws

## API Endpoints

### Query Endpoints

- `POST /api/query` - Submit a new query
  ```json
  {
    "text": "Your question here",
    "mode": "single" | "multi",
    "selectedModels": ["model-id-1", "model-id-2"],
    "userId": "user-id"
  }
  ```

- `GET /api/session/:id` - Get session details
- `GET /api/sessions?userId=<userId>` - List user sessions

### Model Management Endpoints

- `GET /api/models` - List available models
- `POST /api/models` - Register a new model (admin only)
- `PATCH /api/models/:id` - Enable/disable a model (admin only)

### Health Check

- `GET /health` - Server health status

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production/test) | development |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | court_of_minds |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `ENABLE_AUTH` | Enable API authentication | false |
| `ADMIN_API_KEY` | Admin API key for model management | - |
| `MODEL_TIMEOUT` | Model response timeout (seconds) | 30 |
| `MODEL_MAX_TOKENS` | Maximum tokens per response | 2000 |
| `MODEL_TEMPERATURE` | Model temperature (0.0-1.0) | 0.7 |
| `SESSION_RETENTION_DAYS` | Days to retain sessions | 30 |

### Model Configuration

The application automatically registers models based on available API keys:

- **OpenAI:** GPT-4, GPT-3.5 Turbo
- **Anthropic:** Claude 3 Opus, Claude 3 Sonnet
- **Google:** Gemini Pro

You can add more models via the API or by modifying `src/index.ts`.

## Usage Examples

### Single-Model Query

1. Select "Single Model" mode in the UI
2. Choose a model from the dropdown
3. Enter your question
4. Click "Submit Query"

The response will be returned directly without deliberation.

### Multi-Model Deliberation

1. Select "Multi-Model Deliberation" mode in the UI
2. Select 2-10 models to participate
3. Enter your question
4. Click "Submit Query"

The system will:
1. Collect responses from all selected models
2. Analyze similarities and differences
3. Conduct structured debate between models
4. Build consensus on a final solution

You can watch the progress in real-time and view intermediate results.

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Verify PostgreSQL is running: `pg_isready`
2. Check your database credentials in `.env`
3. Ensure the database exists: `psql -l | grep court_of_minds`

The application will fall back to in-memory storage if PostgreSQL is unavailable.

### No Models Available

If no models are registered:

1. Check that you've added at least one API key to `.env`
2. Verify the API key is valid
3. Check the server logs for registration errors

### WebSocket Connection Issues

If real-time updates aren't working:

1. Check browser console for WebSocket errors
2. Verify the WebSocket URL matches your server configuration
3. Check for firewall or proxy issues blocking WebSocket connections

## Security Considerations

### Production Deployment

For production deployments:

1. **Enable authentication:**
   ```env
   ENABLE_AUTH=true
   ADMIN_API_KEY=<secure-random-string>
   ```

2. **Use strong database credentials:**
   - Generate a strong password for the database user
   - Restrict database access to the application server only

3. **Secure API keys:**
   - Never commit `.env` to version control
   - Use environment variables or secrets management
   - Rotate API keys regularly

4. **Use HTTPS:**
   - Deploy behind a reverse proxy (nginx, Apache)
   - Configure SSL/TLS certificates
   - Use WSS for WebSocket connections

5. **Rate limiting:**
   - Implement rate limiting on API endpoints
   - Monitor API usage and costs

## Architecture Overview

```
User Interface (public/)
    ↓
API Server (src/api/server.ts)
    ↓
Query Router (src/components/QueryRouter.ts)
    ↓
┌─────────────────────┬──────────────────────────┐
│ Single Model        │ Multi-Model              │
│ DirectQueryHandler  │ DeliberationOrchestrator │
└─────────────────────┴──────────────────────────┘
    ↓                           ↓
Model Registry          Response Collector
    ↓                           ↓
Model Adapters          Analysis Engine
    ↓                           ↓
AI Providers            Debate Orchestrator
                               ↓
                        Consensus Builder
                               ↓
                        Session Store (PostgreSQL)
```

## Support

For issues, questions, or contributions, please refer to the project documentation or open an issue on the repository.
