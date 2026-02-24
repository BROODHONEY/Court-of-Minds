# Court of Minds - User Interface

This directory contains the web-based user interface for the Court of Minds AI deliberation platform.

## Features

### Query Submission Interface (Requirements 10.1, 10.2)
- **Mode Selection**: Choose between single-model or multi-model deliberation
- **Model Selection**: 
  - Multi-model mode: Select 2-10 models via checkboxes
  - Single-model mode: Select one model from dropdown
- **Query Input**: Text area for entering questions with validation

### Session Progress Display (Requirements 10.3, 10.4, 10.5)
- **Real-time Phase Indicators**: Visual indicators for each deliberation phase
  - Collecting Responses
  - Analyzing
  - Debating
  - Building Consensus
- **Intermediate Results**: View results from each completed phase
- **Model Attribution**: Each contribution clearly shows its source model
- **WebSocket Updates**: Real-time progress updates via WebSocket connection

### Session History Interface (Requirements 6.3, 6.4)
- **Session List**: View all past sessions with timestamps and queries
- **Filtering**: Filter by mode (single/multi) and status (completed/failed)
- **Search**: Search sessions by query text
- **Session Details**: Click any session to view complete deliberation record
  - All responses with model attributions
  - Analysis report
  - Debate exchanges
  - Final consensus

## Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `app.js` - Client-side JavaScript application
- `README.md` - This file

## Usage

1. Start the Court of Minds API server (which serves these static files)
2. Open a web browser and navigate to `http://localhost:3000`
3. The UI will automatically:
   - Load available models from the API
   - Connect to the WebSocket for real-time updates
   - Load your session history

### Submitting a Query

1. Select mode (single or multi-model)
2. Select model(s):
   - Multi-model: Check 2-10 models
   - Single-model: Choose one from dropdown
3. Enter your question in the text area
4. Click "Submit Query"
5. Watch real-time progress in the Progress section
6. View intermediate results as each phase completes

### Viewing Session History

1. Scroll to the "Session History" section
2. Use filters to narrow down sessions:
   - Search by query text
   - Filter by mode
   - Filter by status
3. Click any session to view full details in a modal

## Technical Details

### API Integration

The UI communicates with the backend via:
- REST API endpoints:
  - `GET /api/models` - Get available models
  - `POST /api/query` - Submit new query
  - `GET /api/session/:id` - Get session details
  - `GET /api/sessions` - List user sessions
- WebSocket connection:
  - Path: `/ws`
  - Provides real-time progress updates
  - Auto-reconnects on disconnect

### State Management

- User ID is generated on page load and persists in memory
- Current session is tracked for progress display
- WebSocket subscription is managed automatically
- Session history is refreshed after each query submission

### Responsive Design

The UI is responsive and works on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablet devices
- Mobile devices (with adapted layout)

## Browser Compatibility

- Modern browsers with ES6+ support
- WebSocket support required for real-time updates
- Tested on:
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+

## Customization

### Styling

Edit `styles.css` to customize:
- Colors (CSS variables in `:root`)
- Layout and spacing
- Component styles

### Functionality

Edit `app.js` to customize:
- API endpoints (change `API_BASE_URL`)
- WebSocket URL (change `WS_URL`)
- Polling intervals
- Display formats

## Accessibility

The UI includes:
- Semantic HTML structure
- Keyboard navigation support
- Clear visual indicators
- Readable color contrast
- Screen reader friendly labels

## Future Enhancements

Potential improvements:
- User authentication
- Session export/download
- Advanced filtering options
- Visualization of debate convergence
- Model performance metrics
- Dark mode support
