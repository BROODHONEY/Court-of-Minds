# Court of Minds

A multi-model AI deliberation platform that leverages collective intelligence to solve problems through structured debate and consensus-building.

## Features

- Multi-model response generation with independent perspectives
- Single-model query mode for quick answers
- Automated response analysis identifying similarities and differences
- Structured debate orchestration between AI models
- Consensus building with hybrid solution synthesis
- Session management and history tracking
- **Web-based user interface** with real-time progress updates

## Installation

```bash
npm install
```

## Quick Start

### Using the Web UI

1. Start the server with the web UI:
```bash
npm run dev
tsx examples/webUIUsage.ts
```

2. Open your browser to `http://localhost:3000`

3. The web interface provides:
   - Query submission with mode and model selection
   - Real-time progress tracking via WebSocket
   - Session history with filtering and search
   - Complete deliberation record viewing

See `public/README.md` for detailed UI documentation.

### Using the API

See `examples/apiServerUsage.ts` for programmatic API usage.

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Build

```bash
npm run build
```

## Architecture

The system follows a pipeline pattern with four main phases:
1. Response Collection
2. Analysis
3. Debate
4. Consensus

See `.kiro/specs/ai-court-system/design.md` for detailed architecture documentation.

## Project Structure

```
├── src/
│   ├── adapters/        # AI model provider adapters
│   ├── api/             # REST API and WebSocket server
│   ├── components/      # Core deliberation components
│   ├── models/          # TypeScript type definitions
│   └── utils/           # Utility functions
├── public/              # Web UI files (HTML, CSS, JS)
├── examples/            # Usage examples
└── docs/                # Additional documentation
```
