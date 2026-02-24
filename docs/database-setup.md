# Database Setup Guide

This guide explains how to set up PostgreSQL for the Court of Minds application.

## Prerequisites

- PostgreSQL 12 or higher installed
- Access to create databases and users

## Development Setup

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create Database and User

Connect to PostgreSQL:
```bash
psql -U postgres
```

Create the database and user:
```sql
-- Create database for development
CREATE DATABASE court_of_minds;

-- Create database for testing
CREATE DATABASE court_of_minds_test;

-- Create user (optional, if not using default postgres user)
CREATE USER court_user WITH PASSWORD 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE court_of_minds TO court_user;
GRANT ALL PRIVILEGES ON DATABASE court_of_minds_test TO court_user;
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=court_of_minds
DB_USER=postgres
DB_PASSWORD=postgres

# Test Database Configuration
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=court_of_minds_test
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres
```

### 4. Initialize Database Schema

The database schema is automatically created when you first use the `PostgresSessionStore`:

```typescript
import { PostgresSessionStore } from './components/SessionStore.js';

const store = new PostgresSessionStore();
await store.initialize();
```

## Database Schema

The application uses a single `sessions` table:

```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  query JSONB NOT NULL,
  mode VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  responses JSONB,
  analysis JSONB,
  debate JSONB,
  consensus JSONB,
  errors JSONB,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_mode ON sessions(mode);
```

## Usage

### Using PostgreSQL SessionStore

```typescript
import { PostgresSessionStore } from './components/SessionStore.js';

// Create store with default configuration (uses environment variables)
const store = new PostgresSessionStore();

// Or provide custom configuration
const store = new PostgresSessionStore({
  host: 'localhost',
  port: 5432,
  database: 'court_of_minds',
  user: 'postgres',
  password: 'postgres',
  max: 20, // Maximum number of connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize schema
await store.initialize();

// Use the store
const session = await store.createSession(query, 'multi');
```

### Automatic Cleanup

Set up automatic cleanup of old sessions:

```typescript
import { SessionCleanupScheduler } from './utils/sessionCleanup.js';

const scheduler = new SessionCleanupScheduler(store, {
  retentionDays: 30, // Delete sessions older than 30 days
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // Run daily
});

scheduler.start();

// Stop when shutting down
scheduler.stop();
```

## Production Deployment

### Recommended Configuration

For production, use a managed PostgreSQL service:
- AWS RDS for PostgreSQL
- Google Cloud SQL for PostgreSQL
- Azure Database for PostgreSQL
- DigitalOcean Managed Databases

### Connection Pooling

The `PostgresSessionStore` uses connection pooling by default. Recommended settings:

```typescript
const store = new PostgresSessionStore({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout for acquiring connection
  ssl: {
    rejectUnauthorized: true, // Enable SSL for production
  },
});
```

### Backup and Recovery

1. **Regular Backups:**
   ```bash
   pg_dump -U postgres court_of_minds > backup.sql
   ```

2. **Restore from Backup:**
   ```bash
   psql -U postgres court_of_minds < backup.sql
   ```

3. **Automated Backups:**
   Use your cloud provider's automated backup features or set up a cron job.

### Monitoring

Monitor these metrics:
- Connection pool usage
- Query performance
- Database size
- Session cleanup execution

## Testing

Run tests with PostgreSQL:

```bash
# Ensure test database is set up
npm test
```

The tests will automatically use the test database configuration from environment variables.

## Troubleshooting

### Connection Issues

**Error: "ECONNREFUSED"**
- Ensure PostgreSQL is running: `pg_isready`
- Check host and port in configuration

**Error: "password authentication failed"**
- Verify username and password
- Check `pg_hba.conf` for authentication settings

**Error: "database does not exist"**
- Create the database: `createdb court_of_minds`

### Performance Issues

**Slow queries:**
- Check indexes are created: `\d sessions` in psql
- Analyze query performance: `EXPLAIN ANALYZE SELECT ...`

**Connection pool exhausted:**
- Increase `max` pool size
- Check for connection leaks (ensure `client.release()` is called)

## Migration from In-Memory Store

To migrate from `InMemorySessionStore` to `PostgresSessionStore`:

1. Set up PostgreSQL database
2. Update your code to use `PostgresSessionStore`
3. Initialize the schema
4. No data migration needed (in-memory data is not persisted)

```typescript
// Before
const store = new InMemorySessionStore();

// After
const store = new PostgresSessionStore();
await store.initialize();
```
