/**
 * Court of Minds - Client Application
 * Validates Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 6.3, 6.4
 */

// Configuration
const API_BASE_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws`;

// State
let availableModels = [];
let currentSession = null;
let ws = null;
let userId = 'user_' + Math.random().toString(36).substr(2, 9);

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Load available models
    await loadModels();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load session history
    await loadSessionHistory();
    
    // Connect WebSocket
    connectWebSocket();
}

// ============================================================================
// Model Management
// ============================================================================

async function loadModels() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/models`);
        const data = await response.json();
        
        availableModels = data.models.filter(m => m.enabled);
        renderModelSelection();
    } catch (error) {
        console.error('Failed to load models:', error);
        showError('Failed to load available models');
    }
}

function renderModelSelection() {
    const modelList = document.getElementById('model-list');
    const singleModelSelect = document.getElementById('single-model-select');
    
    if (availableModels.length === 0) {
        modelList.innerHTML = '<p class="error-message">No models available</p>';
        singleModelSelect.innerHTML = '<option value="">No models available</option>';
        return;
    }
    
    // Render multi-model checkboxes
    modelList.innerHTML = availableModels.map(model => `
        <label class="model-checkbox">
            <input type="checkbox" value="${model.id}" class="model-checkbox-input">
            <span>${model.name}</span>
        </label>
    `).join('');
    
    // Render single model dropdown
    singleModelSelect.innerHTML = `
        <option value="">Select a model...</option>
        ${availableModels.map(model => `
            <option value="${model.id}">${model.name}</option>
        `).join('')}
    `;
    
    // Add checkbox change listeners
    document.querySelectorAll('.model-checkbox-input').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.target.closest('.model-checkbox').classList.toggle('checked', e.target.checked);
        });
    });
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
    // Mode selection
    document.getElementById('mode-single').addEventListener('change', handleModeChange);
    document.getElementById('mode-multi').addEventListener('change', handleModeChange);
    
    // Submit button
    document.getElementById('submit-btn').addEventListener('click', handleSubmitQuery);
    
    // History filters
    document.getElementById('history-search').addEventListener('input', filterSessionHistory);
    document.getElementById('history-mode-filter').addEventListener('change', filterSessionHistory);
    document.getElementById('history-status-filter').addEventListener('change', filterSessionHistory);
    
    // Modal close
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('session-modal').addEventListener('click', (e) => {
        if (e.target.id === 'session-modal') {
            closeModal();
        }
    });
}

function handleModeChange() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const multiModelGroup = document.getElementById('model-selection-group');
    const singleModelGroup = document.getElementById('single-model-group');
    
    if (mode === 'single') {
        multiModelGroup.style.display = 'none';
        singleModelGroup.style.display = 'block';
    } else {
        multiModelGroup.style.display = 'block';
        singleModelGroup.style.display = 'none';
    }
}

// ============================================================================
// Query Submission (Validates Requirements 10.1, 10.2)
// ============================================================================

async function handleSubmitQuery() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const queryText = document.getElementById('query-input').value.trim();
    const submitBtn = document.getElementById('submit-btn');
    
    // Validate query text
    if (!queryText) {
        showError('Please enter a question');
        return;
    }
    
    // Get selected models
    let selectedModels;
    if (mode === 'single') {
        const singleModel = document.getElementById('single-model-select').value;
        if (!singleModel) {
            showError('Please select a model');
            return;
        }
        selectedModels = [singleModel];
    } else {
        selectedModels = Array.from(document.querySelectorAll('.model-checkbox-input:checked'))
            .map(cb => cb.value);
        
        if (selectedModels.length < 2) {
            showError('Please select at least 2 models for multi-model mode');
            return;
        }
        
        if (selectedModels.length > 10) {
            showError('Please select no more than 10 models');
            return;
        }
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    hideError();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: queryText,
                mode: mode,
                selectedModels: selectedModels,
                userId: userId,
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to submit query');
        }
        
        const data = await response.json();
        currentSession = data.session;
        
        // Show progress section
        showProgressSection();
        
        // Subscribe to WebSocket updates
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'subscribe',
                sessionId: data.sessionId,
                userId: userId,
            }));
        }
        
        // Clear query input
        document.getElementById('query-input').value = '';
        
        // Reload history
        await loadSessionHistory();
        
    } catch (error) {
        console.error('Failed to submit query:', error);
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Query';
    }
}

// ============================================================================
// Progress Display (Validates Requirements 10.3, 10.4, 10.5)
// ============================================================================

function showProgressSection() {
    const progressSection = document.getElementById('progress-section');
    progressSection.style.display = 'block';
    progressSection.scrollIntoView({ behavior: 'smooth' });
    
    renderProgress();
}

function renderProgress() {
    if (!currentSession) return;
    
    const progressContent = document.getElementById('progress-content');
    
    let html = `
        <div class="session-info">
            <p><strong>Session ID:</strong> ${currentSession.id}</p>
            <p><strong>Query:</strong> ${currentSession.query.text}</p>
            <p><strong>Mode:</strong> ${currentSession.mode}</p>
            <p><strong>Status:</strong> <span class="session-status ${currentSession.status}">${currentSession.status}</span></p>
        </div>
        <div class="phases">
    `;
    
    // Phase indicators
    const phases = [
        { name: 'Collecting Responses', status: 'collecting', data: currentSession.responses },
        { name: 'Analyzing', status: 'analyzing', data: currentSession.analysis },
        { name: 'Debating', status: 'debating', data: currentSession.debate },
        { name: 'Building Consensus', status: 'consensus', data: currentSession.consensus },
    ];
    
    phases.forEach(phase => {
        const isActive = currentSession.status === phase.status;
        const isCompleted = phase.data !== undefined && phase.data !== null;
        const phaseClass = isCompleted ? 'completed' : (isActive ? 'active' : '');
        
        html += `
            <div class="phase-indicator ${phaseClass}">
                <span class="phase-name">${phase.name}</span>
                <span class="phase-status">
                    ${isCompleted ? '✓ Complete' : (isActive ? 'In Progress...' : 'Pending')}
                </span>
            </div>
        `;
        
        // Show intermediate results
        if (isCompleted) {
            html += renderIntermediateResult(phase.name, phase.data);
        }
    });
    
    html += '</div>';
    
    // Final result
    if (currentSession.status === 'completed' && currentSession.consensus) {
        html += `
            <div class="final-result">
                <h3>Final Consensus</h3>
                <div class="intermediate-result">
                    <div class="result-content">${currentSession.consensus.finalSolution.text}</div>
                    <div class="result-header" style="margin-top: 12px;">
                        <span>Agreement Level: ${(currentSession.consensus.agreementLevel * 100).toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    progressContent.innerHTML = html;
}

function renderIntermediateResult(phaseName, data) {
    if (!data) return '';
    
    let html = '<div class="intermediate-results">';
    
    if (phaseName === 'Collecting Responses' && Array.isArray(data)) {
        data.forEach(response => {
            html += `
                <div class="intermediate-result">
                    <div class="result-header">
                        <span>Response</span>
                        <span class="model-attribution">Model: ${response.modelId}</span>
                    </div>
                    <div class="result-content">${response.text}</div>
                </div>
            `;
        });
    } else if (phaseName === 'Analyzing' && data.summary) {
        html += `
            <div class="intermediate-result">
                <div class="result-header">
                    <span>Analysis Summary</span>
                </div>
                <div class="result-content">${data.summary}</div>
            </div>
        `;
    } else if (phaseName === 'Debating' && data.rounds) {
        data.rounds.forEach((round, idx) => {
            html += `
                <div class="intermediate-result">
                    <div class="result-header">
                        <span>Round ${idx + 1}</span>
                        <span>Disagreement: ${(round.disagreementLevel * 100).toFixed(0)}%</span>
                    </div>
            `;
            round.exchanges.forEach(exchange => {
                html += `
                    <div style="margin-top: 12px; padding-left: 12px; border-left: 2px solid #e5e7eb;">
                        <div class="model-attribution">Model: ${exchange.modelId}</div>
                        ${exchange.critique ? `<p><strong>Critique:</strong> ${exchange.critique}</p>` : ''}
                        ${exchange.defense ? `<p><strong>Defense:</strong> ${exchange.defense}</p>` : ''}
                        ${exchange.revisedPosition ? `<p><strong>Revised Position:</strong> ${exchange.revisedPosition}</p>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        });
    }
    
    html += '</div>';
    return html;
}

// ============================================================================
// WebSocket Connection (Validates Requirements 10.3, 10.4)
// ============================================================================

function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWebSocketMessage(message) {
    console.log('WebSocket message:', message);
    
    // Update current session if this is a progress event
    if (message.sessionId && currentSession && message.sessionId === currentSession.id) {
        // Reload session data
        loadSession(message.sessionId);
    }
}

async function loadSession(sessionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`);
        if (response.ok) {
            currentSession = await response.json();
            renderProgress();
        }
    } catch (error) {
        console.error('Failed to load session:', error);
    }
}

// ============================================================================
// Session History (Validates Requirements 6.3, 6.4)
// ============================================================================

async function loadSessionHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions?userId=${userId}`);
        const data = await response.json();
        
        renderSessionHistory(data.sessions || []);
    } catch (error) {
        console.error('Failed to load session history:', error);
        document.getElementById('session-list').innerHTML = 
            '<p class="error-message">Failed to load session history</p>';
    }
}

function renderSessionHistory(sessions) {
    const sessionList = document.getElementById('session-list');
    
    if (sessions.length === 0) {
        sessionList.innerHTML = '<p class="loading">No sessions yet</p>';
        return;
    }
    
    sessionList.innerHTML = sessions.map(session => {
        const timestamp = new Date(session.createdAt).toLocaleString();
        return `
            <div class="session-item" data-session-id="${session.id}">
                <div class="session-header">
                    <span class="session-timestamp">${timestamp}</span>
                    <span class="session-status ${session.status}">${session.status}</span>
                </div>
                <div class="session-query">${session.query.text}</div>
                <div class="session-meta">
                    Mode: ${session.mode} | 
                    ${session.responses ? session.responses.length : 0} responses
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners
    document.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => {
            const sessionId = item.dataset.sessionId;
            showSessionDetail(sessionId);
        });
    });
}

function filterSessionHistory() {
    const searchTerm = document.getElementById('history-search').value.toLowerCase();
    const modeFilter = document.getElementById('history-mode-filter').value;
    const statusFilter = document.getElementById('history-status-filter').value;
    
    document.querySelectorAll('.session-item').forEach(item => {
        const query = item.querySelector('.session-query').textContent.toLowerCase();
        const meta = item.querySelector('.session-meta').textContent.toLowerCase();
        const status = item.querySelector('.session-status').textContent.toLowerCase();
        
        const matchesSearch = query.includes(searchTerm);
        const matchesMode = !modeFilter || meta.includes(modeFilter);
        const matchesStatus = !statusFilter || status.includes(statusFilter);
        
        item.style.display = (matchesSearch && matchesMode && matchesStatus) ? 'block' : 'none';
    });
}

async function showSessionDetail(sessionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`);
        if (!response.ok) {
            throw new Error('Failed to load session');
        }
        
        const session = await response.json();
        renderSessionDetail(session);
        
        // Show modal
        document.getElementById('session-modal').style.display = 'flex';
    } catch (error) {
        console.error('Failed to load session detail:', error);
        showError('Failed to load session details');
    }
}

function renderSessionDetail(session) {
    const detailContainer = document.getElementById('session-detail');
    
    let html = `
        <h2>Session Details</h2>
        <div class="session-info">
            <p><strong>Session ID:</strong> ${session.id}</p>
            <p><strong>Created:</strong> ${new Date(session.createdAt).toLocaleString()}</p>
            <p><strong>Query:</strong> ${session.query.text}</p>
            <p><strong>Mode:</strong> ${session.mode}</p>
            <p><strong>Status:</strong> <span class="session-status ${session.status}">${session.status}</span></p>
        </div>
    `;
    
    // Responses
    if (session.responses && session.responses.length > 0) {
        html += '<h3>Responses</h3>';
        session.responses.forEach(response => {
            html += `
                <div class="intermediate-result">
                    <div class="result-header">
                        <span class="model-attribution">Model: ${response.modelId}</span>
                    </div>
                    <div class="result-content">${response.text}</div>
                </div>
            `;
        });
    }
    
    // Analysis
    if (session.analysis) {
        html += '<h3>Analysis</h3>';
        html += `
            <div class="intermediate-result">
                <div class="result-content">${session.analysis.summary}</div>
            </div>
        `;
    }
    
    // Debate
    if (session.debate && session.debate.rounds) {
        html += '<h3>Debate</h3>';
        session.debate.rounds.forEach((round, idx) => {
            html += `
                <div class="intermediate-result">
                    <div class="result-header">
                        <span>Round ${idx + 1}</span>
                        <span>Disagreement: ${(round.disagreementLevel * 100).toFixed(0)}%</span>
                    </div>
            `;
            round.exchanges.forEach(exchange => {
                html += `
                    <div style="margin-top: 12px; padding-left: 12px; border-left: 2px solid #e5e7eb;">
                        <div class="model-attribution">Model: ${exchange.modelId}</div>
                        ${exchange.critique ? `<p><strong>Critique:</strong> ${exchange.critique}</p>` : ''}
                        ${exchange.defense ? `<p><strong>Defense:</strong> ${exchange.defense}</p>` : ''}
                        ${exchange.revisedPosition ? `<p><strong>Revised Position:</strong> ${exchange.revisedPosition}</p>` : ''}
                    </div>
                `;
            });
            html += '</div>';
        });
    }
    
    // Consensus
    if (session.consensus) {
        html += '<h3>Final Consensus</h3>';
        html += `
            <div class="intermediate-result">
                <div class="result-content">${session.consensus.finalSolution.text}</div>
                <div class="result-header" style="margin-top: 12px;">
                    <span>Agreement Level: ${(session.consensus.agreementLevel * 100).toFixed(0)}%</span>
                </div>
            </div>
        `;
    }
    
    detailContainer.innerHTML = html;
}

function closeModal() {
    document.getElementById('session-modal').style.display = 'none';
}

// ============================================================================
// Utility Functions
// ============================================================================

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.style.display = 'none';
}
