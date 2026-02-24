/**
 * UI Integration Tests
 * 
 * Tests to verify the web UI files are properly set up and can be served
 */

import { describe, test, expect } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Web UI Integration', () => {
  const publicDir = join(process.cwd(), 'public');

  test('public directory exists', () => {
    expect(existsSync(publicDir)).toBe(true);
  });

  test('index.html exists and contains required elements', () => {
    const indexPath = join(publicDir, 'index.html');
    expect(existsSync(indexPath)).toBe(true);

    const content = readFileSync(indexPath, 'utf-8');
    
    // Check for essential UI elements
    expect(content).toContain('Court of Minds');
    expect(content).toContain('query-section');
    expect(content).toContain('progress-section');
    expect(content).toContain('history-section');
    expect(content).toContain('mode-single');
    expect(content).toContain('mode-multi');
    expect(content).toContain('model-list');
    expect(content).toContain('query-input');
    expect(content).toContain('submit-btn');
  });

  test('styles.css exists and contains styling', () => {
    const stylesPath = join(publicDir, 'styles.css');
    expect(existsSync(stylesPath)).toBe(true);

    const content = readFileSync(stylesPath, 'utf-8');
    
    // Check for key CSS classes
    expect(content).toContain('.card');
    expect(content).toContain('.btn-primary');
    expect(content).toContain('.phase-indicator');
    expect(content).toContain('.session-item');
    expect(content).toContain('.modal');
  });

  test('app.js exists and contains required functionality', () => {
    const appPath = join(publicDir, 'app.js');
    expect(existsSync(appPath)).toBe(true);

    const content = readFileSync(appPath, 'utf-8');
    
    // Check for key functions
    expect(content).toContain('loadModels');
    expect(content).toContain('handleSubmitQuery');
    expect(content).toContain('renderProgress');
    expect(content).toContain('loadSessionHistory');
    expect(content).toContain('connectWebSocket');
    
    // Check for API endpoints
    expect(content).toContain('/api/models');
    expect(content).toContain('/api/query');
    expect(content).toContain('/api/session');
    expect(content).toContain('/api/sessions');
    
    // Check for WebSocket handling
    expect(content).toContain('WebSocket');
    expect(content).toContain('ws.onmessage');
  });

  test('README.md exists in public directory', () => {
    const readmePath = join(publicDir, 'README.md');
    expect(existsSync(readmePath)).toBe(true);

    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('Court of Minds');
    expect(content).toContain('User Interface');
  });

  test('UI validates requirements', () => {
    const appPath = join(publicDir, 'app.js');
    const content = readFileSync(appPath, 'utf-8');

    // Requirement 10.1: Mode selection
    expect(content).toContain('mode');
    
    // Requirement 10.2: Model selection
    expect(content).toContain('selectedModels');
    
    // Requirement 10.3: Real-time progress
    expect(content).toContain('phase-indicator');
    
    // Requirement 10.4: Intermediate results
    expect(content).toContain('intermediate-result');
    
    // Requirement 10.5: Model attribution
    expect(content).toContain('model-attribution');
    
    // Requirement 6.3: Session history
    expect(content).toContain('loadSessionHistory');
    
    // Requirement 6.4: Complete deliberation record
    expect(content).toContain('showSessionDetail');
  });
});
