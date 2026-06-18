import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getComfyWsUrl } from './comfy';

describe('getComfyWsUrl', () => {
  it('converts http to ws', () => {
    expect(getComfyWsUrl('http://127.0.0.1:8188')).toBe('ws://127.0.0.1:8188/ws');
  });

  it('converts https to wss', () => {
    expect(getComfyWsUrl('https://comfy.example.com').startsWith('wss://')).toBe(true);
  });

  it('appends /ws path', () => {
    expect(getComfyWsUrl('http://localhost:3000')).toBe('ws://localhost:3000/ws');
  });
});

describe('Workflow config file structure', () => {
  const workflowsDir = path.join(__dirname, '..', '..', 'workflows');
  let workflowFiles: string[];

  beforeAll(() => {
    if (fs.existsSync(workflowsDir)) {
      workflowFiles = fs.readdirSync(workflowsDir)
        .filter(f => f.endsWith('.json') && !f.includes('.config.'));
    }
  });

  it('has at least one workflow file', () => {
    expect(workflowFiles?.length).toBeGreaterThanOrEqual(1);
  });

  it('each workflow file is valid JSON', () => {
    for (const file of workflowFiles || []) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  it('each workflow file has an optional .config.json with valid JSON', () => {
    for (const file of workflowFiles || []) {
      const configPath = path.join(workflowsDir, file.replace('.json', '.config.json'));
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
      }
    }
  });
});
