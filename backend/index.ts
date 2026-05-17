import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import sharp from 'sharp';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3001;
const COMFY_URL = 'http://127.0.0.1:8188';
const COMFY_WS_URL = 'ws://127.0.0.1:8188/ws';

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback_secret';
const APP_PASSWORD = process.env.APP_PASSWORD || 'comfy';

app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser(AUTH_SECRET));

// Setup directories
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const imagesDir = path.join(rootDir, 'images');
const thumbnailsDir = path.join(imagesDir, 'thumbnails');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

// Initialize SQLite
const db = new Database(path.join(dataDir, 'history.db'));
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    updatedAt INTEGER NOT NULL,
    isArchived INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT,
    prompt TEXT,
    imageUrl TEXT,
    thumbnailUrl TEXT,
    timestamp INTEGER NOT NULL,
    model TEXT,
    width INTEGER,
    height INTEGER,
    steps INTEGER,
    cfg REAL,
    workflow TEXT,
    status TEXT DEFAULT 'completed',
    FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT NOT NULL,
    prompt TEXT NOT NULL,
    originalPrompt TEXT,
    sessionId TEXT NOT NULL,
    params TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );
`);

// Migration to add missing columns if they don't exist
const columns = ['model', 'width', 'height', 'steps', 'cfg', 'workflow', 'status', 'thumbnailUrl', 'seed'];
columns.forEach(col => {
  try {
    db.prepare(`SELECT ${col} FROM messages LIMIT 1`).get();
  } catch (e) {
    const type = (col === 'cfg') ? 'REAL' : (col === 'model' || col === 'workflow' || col === 'status' || col === 'thumbnailUrl' ? 'TEXT' : 'INTEGER');
    db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
  }
});

// Migration for queue table just in case
db.exec(`CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId TEXT NOT NULL,
    prompt TEXT NOT NULL,
    originalPrompt TEXT,
    sessionId TEXT NOT NULL,
    params TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
)`);

// Auth Middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.signedCookies.authenticated === 'true') {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

// WebSocket logic
const clients = new Map<string, WebSocket>();

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  // Send the assigned clientId to the frontend
  ws.send(JSON.stringify({ type: 'connected', clientId }));

  const comfyWs = new WebSocket(`${COMFY_WS_URL}?clientId=${clientId}`);
  
  comfyWs.on('message', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data.toString());
    }
  });

  comfyWs.on('error', (err) => { 
    console.error('ComfyUI WS Error:', err); 
    ws.close(); 
  });

  ws.on('close', () => {
    clients.delete(clientId);
    if (comfyWs.readyState === WebSocket.OPEN || comfyWs.readyState === WebSocket.CONNECTING) {
      comfyWs.close();
    }
  });
});

const broadcastToSession = (sessionId: string, data: any) => {
  const payload = JSON.stringify({ type: 'queue_update', sessionId, ...data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

// Serving images with aggressive caching
// Custom handler for thumbnails to allow on-the-fly generation
app.get('/api/image-files/thumbnails/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const thumbPath = path.join(thumbnailsDir, filename);
  
  if (fs.existsSync(thumbPath)) {
    return next(); // Let express.static handle it
  }

  try {
    // Attempt to generate on the fly
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.join(imagesDir, originalName);

    if (fs.existsSync(originalPath)) {
      await sharp(originalPath)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(thumbPath);
      
      return res.sendFile(thumbPath);
    }
  } catch (err) {
    console.error('[Thumbnails] On-the-fly generation failed:', err);
  }
  
  res.status(404).send('Not found');
});

app.use('/api/image-files', express.static(imagesDir, {
  maxAge: '365d',
  immutable: true,
  index: false
}));

// Health check
app.get('/', (req, res) => res.json({ status: 'online', service: 'ComfyRealism Backend' }));

// Workflows Management
app.get('/api/workflows', authenticate, (req, res) => {
  const workflowsDir = path.join(__dirname, 'workflows');
  if (!fs.existsSync(workflowsDir)) return res.json([]);
  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json') && !f.endsWith('.config.json'));
  res.json(files);
});

const getWorkflow = (prompt: string, params?: any) => {
  const workflowFile = params?.workflowFile || 'workflow_lcm.json';
  const fullPath = path.join(__dirname, 'workflows', workflowFile);
  const configPath = fullPath.replace('.json', '.config.json');
  
  if (!fs.existsSync(fullPath)) throw new Error(`Fichier workflow introuvable : ${workflowFile}`);
  
  const workflow = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  let nodes = { checkpoint: "1", positive: "3", negative: "4", ksampler: "10", latent: "6", save: "99" };

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.nodeMapping) nodes = { ...nodes, ...config.nodeMapping };
    } catch (e) { console.warn(`[Workflow] Failed to parse config for ${workflowFile}`); }
  }

  if (workflow[nodes.checkpoint]?.inputs && params?.comfyModel) workflow[nodes.checkpoint].inputs.ckpt_name = params.comfyModel;
  if (workflow[nodes.positive]?.inputs) workflow[nodes.positive].inputs.text = prompt;
  if (workflow[nodes.negative]?.inputs && params?.negativePrompt) workflow[nodes.negative].inputs.text = params.negativePrompt;
  
  if (workflow[nodes.ksampler]?.inputs) {
    workflow[nodes.ksampler].inputs.seed = params?.seed || Math.floor(Math.random() * 1000000000000000);
    if (params) {
      if (params.steps) workflow[nodes.ksampler].inputs.steps = params.steps;
      if (params.cfg) workflow[nodes.ksampler].inputs.cfg = params.cfg;
    }
  }

  if (workflow[nodes.latent]?.inputs && params) {
    if (workflow[nodes.latent].class_type !== 'SDXLEmptyLatentSizePicker+') {
      if (params.width) workflow[nodes.latent].inputs.width = params.width;
      if (params.height) workflow[nodes.latent].inputs.height = params.height;
    }
  }

  if (workflow[nodes.save]?.inputs) workflow[nodes.save].inputs.filename_prefix = "ComfyRealism";
  return workflow;
};

const parseComfyError = (error: any) => {
  if (error.response?.data?.error?.message) {
    let msg = error.response.data.error.message;
    if (error.response.data.error.details) msg += ` (${error.response.data.error.details})`;
    return msg;
  }
  if (error.response?.data?.node_errors) {
    const nodes = Object.keys(error.response.data.node_errors);
    const node = nodes[0];
    const err = error.response.data.node_errors[node].errors[0];
    return `Node ${node} (${error.response.data.node_errors[node].class_type}): ${err.message}${err.details ? ' - ' + err.details : ''}`;
  }
  if (error.message?.includes('ECONNREFUSED')) return 'ComfyUI is unreachable. Please check if it is running on http://127.0.0.1:8188';
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) return 'ComfyUI request timed out (possible GPU overload or hang).';
  return error.message || 'Unknown server error';
};

// Queue Processor
let isProcessingQueue = false;
const processQueue = async () => {
  if (isProcessingQueue) return;
  
  let task: any = null;
  try {
    task = db.prepare('SELECT * FROM queue WHERE status = ? ORDER BY createdAt ASC LIMIT 1').get('pending');
    if (!task) return;

    isProcessingQueue = true;
    db.prepare('UPDATE queue SET status = ? WHERE id = ?').run('processing', task.id);
    db.prepare('UPDATE messages SET status = ? WHERE id = ?').run('processing', task.messageId);
    
    broadcastToSession(task.sessionId, { messageId: task.messageId, status: 'processing' });

    const params = JSON.parse(task.params);
    const workflow = getWorkflow(task.prompt, params);
    const targetComfyUrl = params?.comfyUrl || COMFY_URL;

    const configPath = path.join(__dirname, 'workflows', (params?.workflowFile || 'workflow_lcm.json').replace('.json', '.config.json'));
    let saveNodeId = "99";
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.nodeMapping?.save) saveNodeId = config.nodeMapping.save;
      } catch (e) { }
    }

    // Submit Prompt
    let promptId = '';
    try {
      const response = await axios.post(`${targetComfyUrl}/prompt`, { prompt: workflow, client_id: uuidv4() }, { timeout: 10000 });
      promptId = response.data.prompt_id;
    } catch (err: any) {
      throw new Error(`Submission failed: ${parseComfyError(err)}`);
    }

    // Polling with Timeout (5 minutes)
    let finished = false, filename = '';
    const startTime = Date.now();
    const POLLING_TIMEOUT = 5 * 60 * 1000; 

    while (!finished) {
      if (Date.now() - startTime > POLLING_TIMEOUT) {
        throw new Error('Generation timed out after 5 minutes.');
      }

      let hResp;
      try {
        hResp = await axios.get(`${targetComfyUrl}/history/${promptId}`, { timeout: 5000 });
      } catch (err: any) {
        // If it's a network error during polling, we might want to retry a few times before failing
        console.warn(`[Queue] Polling attempt failed: ${err.message}`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const history = hResp.data[promptId];

      if (history) {
        if (history.status?.status_str === 'error' || (history.status?.completed && !history.outputs)) {
          const errMsg = history.status?.messages?.[0]?.[1]?.message || 'ComfyUI execution error';
          throw new Error(`Execution failed: ${errMsg}`);
        }

        if (history.outputs?.[saveNodeId]?.images?.[0]) {
          filename = history.outputs[saveNodeId].images[0].filename;
          finished = true;
        }
      }

      if (!finished) {
        await new Promise(r => setTimeout(r, 1000));
        // Check if task was cancelled by user
        const stillExists = db.prepare('SELECT id FROM queue WHERE id = ?').get(task.id);
        if (!stillExists) {
          isProcessingQueue = false;
          setTimeout(processQueue, 100);
          return;
        }
      }
    }

    // Download Image
    let imgResp;
    try {
      imgResp = await axios.get(`${targetComfyUrl}/view`, { 
        params: { filename }, 
        responseType: 'arraybuffer',
        timeout: 15000
      });
    } catch (err: any) {
      throw new Error(`Failed to retrieve image: ${parseComfyError(err)}`);
    }
    
    // IMAGE PROCESSING WITH SHARP
    const baseName = `${Date.now()}-${filename.replace(/\.[^/.]+$/, "")}`;
    const fullWebpName = `${baseName}.webp`;
    const thumbWebpName = `${baseName}_thumb.webp`;
    
    // Save Full HD WebP
    await sharp(imgResp.data)
      .webp({ quality: 85 })
      .toFile(path.join(imagesDir, fullWebpName));
      
    // Save Thumbnail WebP
    await sharp(imgResp.data)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(path.join(thumbnailsDir, thumbWebpName));

    const imageUrl = `/api/image-files/${fullWebpName}`;
    const thumbnailUrl = `/api/image-files/thumbnails/${thumbWebpName}`;

    db.prepare('UPDATE messages SET imageUrl = ?, thumbnailUrl = ?, status = ?, timestamp = ? WHERE id = ?')
      .run(imageUrl, thumbnailUrl, 'completed', Date.now(), task.messageId);
    
    db.prepare('DELETE FROM queue WHERE id = ?').run(task.id);

    broadcastToSession(task.sessionId, { 
      messageId: task.messageId, 
      status: 'completed', 
      imageUrl,
      thumbnailUrl,
      model: params.comfyModel,
      width: params.width,
      height: params.height,
      steps: params.steps,
      cfg: params.cfg,
      workflow: params.workflowFile,
      seed: params.seed
    });

  } catch (error: any) {
    const errorMsg = error.message || 'Unexpected error';
    console.error(`[Queue] Fatal error for task ${task?.messageId}:`, errorMsg);
    
    if (task) {
      db.prepare('UPDATE messages SET status = ?, text = ? WHERE id = ?').run('failed', errorMsg, task.messageId);
      db.prepare('DELETE FROM queue WHERE id = ?').run(task.id);
      broadcastToSession(task.sessionId, { 
        messageId: task.messageId, 
        status: 'failed', 
        error: errorMsg 
      });
    }
  } finally {
    isProcessingQueue = false;
    setTimeout(processQueue, 500);
  }
};

// Start queue processor
setInterval(processQueue, 2000);

// Auth Endpoints
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password && password.trim() === APP_PASSWORD.trim()) {
    res.cookie('authenticated', 'true', { httpOnly: true, signed: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Incorrect password' });
});

app.get('/api/auth/check', (req, res) => res.json({ authenticated: req.signedCookies.authenticated === 'true' }));
app.post('/api/auth/logout', (req, res) => { res.clearCookie('authenticated'); res.json({ success: true }); });

// API Settings Endpoints
app.get('/api/settings', authenticate, (req, res) => {
  const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
  res.json(settings ? JSON.parse(settings.data) : {});
});

app.post('/api/settings', authenticate, (req, res) => {
  const data = JSON.stringify(req.body);
  db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(data);
  res.json({ success: true });
});

// API History Endpoints (SQLite)
app.get('/api/history', authenticate, (req, res) => {
  const sessions = db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 0 ORDER BY updatedAt DESC').all();
  res.json(sessions);
});

app.get('/api/history/archives', authenticate, (req, res) => {
  const sessions = db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 1 ORDER BY updatedAt DESC').all();
  res.json(sessions);
});

app.get('/api/gallery', authenticate, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 25;
  const offset = parseInt(req.query.offset as string) || 0;
  const onlyArchived = req.query.includeArchived === 'true';
  
  const query = `
    SELECT m.sessionId, m.id as messageId, m.imageUrl, m.thumbnailUrl, m.prompt, m.text, m.timestamp, m.model, m.width, m.height, m.steps, m.cfg, m.workflow, m.seed 
    FROM messages m
    JOIN sessions s ON m.sessionId = s.id
    WHERE m.imageUrl IS NOT NULL AND s.isArchived = ?
    ORDER BY m.timestamp DESC
    LIMIT ? OFFSET ?
  `;
  
  const gallery = db.prepare(query).all(onlyArchived ? 1 : 0, limit, offset);
  res.json(gallery);
});

app.get('/api/history/:id', authenticate, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
  if (!session) return res.json({ error: 'Not found' });
  const messages = db.prepare('SELECT id, role, text, prompt, imageUrl, thumbnailUrl, model, width, height, steps, cfg, workflow, status, timestamp, seed FROM messages WHERE sessionId = ? ORDER BY timestamp ASC').all(req.params.id);
  res.json({ ...session, messages });
});

app.post('/api/history', authenticate, (req, res) => {
  const newSession = { id: uuidv4(), title: 'New Chat', updatedAt: Date.now(), isArchived: 0 };
  db.prepare('INSERT INTO sessions (id, title, updatedAt, isArchived) VALUES (?, ?, ?, ?)').run(newSession.id, newSession.title, newSession.updatedAt, 0);
  res.json(newSession);
});

app.delete('/api/history/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/history/all/active', authenticate, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE isArchived = 0').run();
  res.json({ success: true });
});

app.post('/api/history/archive-all', authenticate, (req, res) => {
  db.prepare('UPDATE sessions SET isArchived = 1 WHERE isArchived = 0').run();
  res.json({ success: true });
});

app.patch('/api/history/:id', authenticate, (req, res) => {
  db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(req.body.title, req.params.id);
  res.json({ success: true, title: req.body.title });
});

app.patch('/api/history/:id/archive', authenticate, (req, res) => {
  const { isArchived } = req.body;
  db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ?').run(isArchived ? 1 : 0, req.params.id);
  res.json({ success: true, isArchived });
});

app.delete('/api/history/:sessionId/message/:messageId', authenticate, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ? AND sessionId = ?').run(req.params.messageId, req.params.sessionId);
  db.prepare('DELETE FROM queue WHERE messageId = ?').run(req.params.messageId);
  res.json({ success: true });
});

app.post('/api/enhance-prompt', authenticate, async (req, res) => {
  try {
    const { prompt, llmUrl, llmModel, systemMessage } = req.body;
    if (!llmUrl || !llmModel) return res.status(400).json({ error: 'LLM configuration missing' });
    const response = await axios.post(`${llmUrl}/v1/chat/completions`, {
      model: llmModel,
      messages: [{ role: "system", content: systemMessage || "You are a professional stable diffusion prompt engineer. Transform user's ideas into highly detailed English prompts. Output JSON with 'positive' and 'negative' keys." }, { role: "user", content: prompt }],
      temperature: 0.7
    }, { timeout: 25000 });

    let content = response.data.choices[0].message.content;
    let result = { positive: content, negative: "" };
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { 
        const parsed = JSON.parse(jsonMatch[0]);
        // Handle common variations in key names
        const pos = parsed.positive || parsed.prompt || parsed.positive_prompt || parsed.text;
        const neg = parsed.negative || parsed.negative_prompt || parsed.neg || "";
        if (pos) {
          result.positive = pos;
          result.negative = neg;
        }
      } catch (e) {}
    }

    res.json({ enhancedPrompt: result.positive, negativePrompt: result.negative });
  } catch (error: any) { 
    res.status(500).json({ error: 'LLM Error: ' + (error.response?.data?.error?.message || error.message) }); 
  }
});

app.post('/api/llm-models', authenticate, async (req, res) => {
  try {
    const { llmUrl } = req.body;
    const response = await axios.get(`${llmUrl}/v1/models`, { timeout: 5000 });
    res.json({ models: response.data.data.map((m: any) => m.id) });
  } catch (error: any) { res.status(500).json({ error: 'Failed to fetch models' }); }
});

app.post('/api/llm-check', authenticate, async (req, res) => {
  try {
    const { llmUrl } = req.body;
    if (!llmUrl) return res.status(400).json({ success: false, error: 'LLM URL is required' });
    const response = await axios.get(`${llmUrl}/v1/models`, { timeout: 3000 });
    res.json({ success: true, count: response.data.data?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'LLM connection failed: ' + (error.response?.data?.error?.message || error.message) });
  }
});

app.post('/api/comfy-check', authenticate, async (req, res) => {
  try {
    const { comfyUrl } = req.body;
    const targetUrl = comfyUrl || COMFY_URL;
    const response = await axios.get(`${targetUrl}/system_stats`, { timeout: 3000 });
    res.json({ success: true, stats: response.data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'ComfyUI connection failed: ' + parseComfyError(error) });
  }
});

app.post('/api/comfy-models', authenticate, async (req, res) => {
  try {
    const { comfyUrl } = req.body;
    const targetUrl = comfyUrl || COMFY_URL;
    
    // Fetch models directly from ComfyUI API
    const response = await axios.get(`${targetUrl}/models/checkpoints`, { timeout: 5000 });
    
    if (Array.isArray(response.data)) {
      res.json({ models: response.data.sort() });
    } else {
      // Fallback to object_info if /models/checkpoints is not supported by the ComfyUI version
      const infoResp = await axios.get(`${targetUrl}/object_info`, { timeout: 5000 });
      const checkpoints = infoResp.data["CheckpointLoaderSimple"]?.input?.required?.ckpt_name?.[0] || [];
      res.json({ models: checkpoints.sort() });
    }
  } catch (error: any) { 
    res.status(500).json({ error: 'Failed to fetch models from ComfyUI: ' + error.message }); 
  }
});

app.post('/api/interrupt', authenticate, async (req, res) => {
  try {
    await axios.post(`${req.body.params?.comfyUrl || COMFY_URL}/interrupt`);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: 'Failed to interrupt' }); }
});

app.post('/api/generate', authenticate, async (req, res) => {
  try {
    const { prompt, originalPrompt, sessionId, params } = req.body;
    const timestamp = Date.now();
    const messageId = uuidv4();
    const userMessageId = uuidv4();

    const displayPrompt = originalPrompt || prompt;
    const isEnhanced = prompt && prompt !== originalPrompt;
    const enhancedText = (isEnhanced || req.body.isRegeneration) ? prompt : '';

    const model = params?.comfyModel || 'dirtyRealism_DMDSAT.safetensors';
    const workflowFile = params?.workflowFile || 'workflow_lcm.json';
    const seed = params?.seed || Math.floor(Math.random() * 1000000000000000);

    const insertMsg = db.prepare('INSERT INTO messages (id, sessionId, role, text, prompt, imageUrl, timestamp, model, width, height, steps, cfg, workflow, status, seed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    if (!req.body.isRegeneration) {
      insertMsg.run(userMessageId, sessionId, 'user', displayPrompt, '', null, timestamp - 1, null, null, null, null, null, null, 'completed', null);
    }

    insertMsg.run(
      messageId, 
      sessionId, 
      'bot', 
      enhancedText, 
      displayPrompt, 
      null, 
      timestamp,
      model,
      params?.width || 896,
      params?.height || 1152,
      params?.steps || 8,
      params?.cfg || 1.1,
      workflowFile,
      'pending',
      seed
    );
    
    const taskParams = { ...params, seed };
    db.prepare('INSERT INTO queue (messageId, prompt, originalPrompt, sessionId, params, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(messageId, prompt, originalPrompt, sessionId, JSON.stringify(taskParams), 'pending', timestamp);

    db.prepare('UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ? AND title = \'New Chat\'').run(displayPrompt.substring(0, 30), timestamp, sessionId);
    db.prepare('UPDATE sessions SET updatedAt = ? WHERE id = ?').run(timestamp, sessionId);

    res.json({ success: true, messageId, status: 'pending' });
    processQueue();

  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
