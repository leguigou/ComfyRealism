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
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/api/ws' || pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = Number(process.env.PORT) || 3001;

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

// Migration to add missing columns
const columns = ['model', 'width', 'height', 'steps', 'cfg', 'workflow', 'status', 'thumbnailUrl', 'seed'];
columns.forEach(col => {
  try {
    db.prepare(`SELECT ${col} FROM messages LIMIT 1`).get();
  } catch (e) {
    const type = (col === 'cfg') ? 'REAL' : (col === 'model' || col === 'workflow' || col === 'status' || col === 'thumbnailUrl' ? 'TEXT' : 'INTEGER');
    db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
  }
});

// Helper to get WS URL from HTTP URL
const getComfyWsUrl = (httpUrl: string) => {
  return httpUrl.replace(/^http/, 'ws') + '/ws';
};

// Helper to get effective ComfyUI URL (Priority: Env > DB > Default)
const getEffectiveComfyUrl = () => {
  if (process.env.COMFY_URL) {
    return { url: process.env.COMFY_URL, source: 'Environment' };
  }
  try {
    const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
    if (settings) {
      const data = JSON.parse(settings.data);
      if (data.comfyUrl) return { url: data.comfyUrl, source: 'Database' };
    }
  } catch (e) {}
  return { url: 'http://127.0.0.1:8188', source: 'Default' };
};

const startupCfg = getEffectiveComfyUrl();
const COMFY_URL = startupCfg.url;
const COMFY_WS_URL = getComfyWsUrl(COMFY_URL);

console.log(`[Config] Startup ComfyUI Source: ${startupCfg.source}`);
console.log(`[Config] Startup ComfyUI URL: ${COMFY_URL}`);
console.log(`[Config] Startup ComfyUI WS: ${COMFY_WS_URL}`);

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback_secret';
const APP_PASSWORD = process.env.APP_PASSWORD || 'comfy';

app.use(cors({
  origin: true, // Reflect any incoming origin to allow cross-subdomain credentials
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser(AUTH_SECRET));

// Create a router for all API endpoints
const apiRouter = express.Router();

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

  // Get dynamic URL for this specific connection
  const currentCfg = getEffectiveComfyUrl();
  const currentComfyWsUrl = getComfyWsUrl(currentCfg.url);
  
  const comfyWs = new WebSocket(`${currentComfyWsUrl}?clientId=${clientId}`);
  
  comfyWs.on('open', () => {
    console.log(`[WS] Relay connected to ComfyUI at ${currentComfyWsUrl}`);
  });

  comfyWs.on('message', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data.toString());
    }
  });

  comfyWs.on('error', (err) => { 
    console.error(`[WS] ComfyUI Error (${currentComfyWsUrl}):`, err.message); 
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

// Custom handler for thumbnails to allow on-the-fly generation
// Health check (keep at root of app)
app.get('/', (req, res) => res.json({ status: 'online', service: 'ComfyRealism Backend' }));

// Custom handler for thumbnails to allow on-the-fly generation
apiRouter.get('/image-files/thumbnails/:filename', async (req, res, next) => {
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

apiRouter.use('/image-files', express.static(imagesDir, {
  maxAge: '365d',
  immutable: true,
  index: false
}));

// Workflows Management
apiRouter.get('/workflows', authenticate, (req, res) => {
  const workflowsDir = path.join(__dirname, 'workflows');
  if (!fs.existsSync(workflowsDir)) return res.json([]);
  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json') && !f.endsWith('.config.json'));
  res.json(files);
});

// ... (getWorkflow and parseComfyError stay outside or as helpers)

// ... (processQueue and setInterval stay as they are)

// Auth Endpoints
apiRouter.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const submitted = (password || '').trim();
  const expected = APP_PASSWORD.trim();
  
  if (submitted === expected) {
    const isProd = process.env.NODE_ENV === 'production';
    console.log(`[Auth] Successful login. Production mode: ${isProd}`);
    
    const cookieOptions: any = { 
      httpOnly: true, 
      signed: true, 
      maxAge: 30 * 24 * 60 * 60 * 1000 
    };

    if (isProd) {
      cookieOptions.sameSite = 'none';
      cookieOptions.secure = true;
      
      // Support for cross-subdomain cookies (even behind proxies)
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
      console.log(`[Auth] Detected host for cookie: ${host}`);
      
      // Dynamic parent domain detection (allows cookies to work across subdomains)
      const parts = host.split('.');
      if (parts.length >= 2) {
        const domain = `.${parts.slice(-2).join('.')}`;
        cookieOptions.domain = domain;
        console.log(`[Auth] Applying dynamic domain ${domain} to cookie`);
      }
    } else {
      cookieOptions.sameSite = 'lax';
    }

    res.cookie('authenticated', 'true', cookieOptions);
    return res.json({ success: true });
  }
  
  console.warn(`[Auth] Failed login attempt. Received length: ${submitted.length}, Expected length: ${expected.length}`);
  res.status(401).json({ error: 'Incorrect password' });
});

apiRouter.get('/auth/check', (req, res) => res.json({ authenticated: req.signedCookies.authenticated === 'true' }));
apiRouter.post('/auth/logout', (req, res) => { res.clearCookie('authenticated'); res.json({ success: true }); });

// API Settings Endpoints
apiRouter.get('/settings', authenticate, (req, res) => {
  const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
  res.json(settings ? JSON.parse(settings.data) : {});
});

apiRouter.post('/settings', authenticate, (req, res) => {
  const data = JSON.stringify(req.body);
  db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(data);
  res.json({ success: true });
});

// API History Endpoints (SQLite)
apiRouter.get('/history', authenticate, (req, res) => {
  const sessions = db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 0 ORDER BY updatedAt DESC').all();
  res.json(sessions);
});

apiRouter.get('/history/archives', authenticate, (req, res) => {
  const sessions = db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 1 ORDER BY updatedAt DESC').all();
  res.json(sessions);
});

apiRouter.get('/gallery', authenticate, (req, res) => {
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

apiRouter.get('/history/:id', authenticate, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
  if (!session) return res.json({ error: 'Not found' });
  const messages = db.prepare('SELECT id, role, text, prompt, imageUrl, thumbnailUrl, model, width, height, steps, cfg, workflow, status, timestamp, seed FROM messages WHERE sessionId = ? ORDER BY timestamp ASC').all(req.params.id);
  res.json({ ...session, messages });
});

apiRouter.post('/history', authenticate, (req, res) => {
  const newSession = { id: uuidv4(), title: 'New Chat', updatedAt: Date.now(), isArchived: 0 };
  db.prepare('INSERT INTO sessions (id, title, updatedAt, isArchived) VALUES (?, ?, ?, ?)').run(newSession.id, newSession.title, newSession.updatedAt, 0);
  res.json(newSession);
});

apiRouter.delete('/history/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

apiRouter.delete('/history/all/active', authenticate, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE isArchived = 0').run();
  res.json({ success: true });
});

apiRouter.post('/history/archive-all', authenticate, (req, res) => {
  db.prepare('UPDATE sessions SET isArchived = 1 WHERE isArchived = 0').run();
  res.json({ success: true });
});

apiRouter.patch('/history/:id', authenticate, (req, res) => {
  db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(req.body.title, req.params.id);
  res.json({ success: true, title: req.body.title });
});

apiRouter.patch('/history/:id/archive', authenticate, (req, res) => {
  const { isArchived } = req.body;
  db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ?').run(isArchived ? 1 : 0, req.params.id);
  res.json({ success: true, isArchived });
});

apiRouter.delete('/history/:sessionId/message/:messageId', authenticate, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ? AND sessionId = ?').run(req.params.messageId, req.params.sessionId);
  db.prepare('DELETE FROM queue WHERE messageId = ?').run(req.params.messageId);
  res.json({ success: true });
});

apiRouter.post('/enhance-prompt', authenticate, async (req, res) => {
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
        const pos = parsed.positive || parsed.prompt || parsed.positive_prompt || parsed.text;
        const neg = parsed.negative || parsed.negative_prompt || parsed.neg || "";
        if (pos) { result.positive = pos; result.negative = neg; }
      } catch (e) {}
    }
    res.json({ enhancedPrompt: result.positive, negativePrompt: result.negative });
  } catch (error: any) { 
    res.status(500).json({ error: 'LLM Error: ' + (error.response?.data?.error?.message || error.message) }); 
  }
});

apiRouter.post('/llm-models', authenticate, async (req, res) => {
  try {
    const { llmUrl } = req.body;
    const response = await axios.get(`${llmUrl}/v1/models`, { timeout: 5000 });
    res.json({ models: response.data.data.map((m: any) => m.id) });
  } catch (error: any) { res.status(500).json({ error: 'Failed to fetch models' }); }
});

apiRouter.post('/llm-check', authenticate, async (req, res) => {
  try {
    const { llmUrl } = req.body;
    if (!llmUrl) return res.status(400).json({ success: false, error: 'LLM URL is required' });
    const response = await axios.get(`${llmUrl}/v1/models`, { timeout: 3000 });
    res.json({ success: true, count: response.data.data?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'LLM connection failed: ' + (error.response?.data?.error?.message || error.message) });
  }
});

apiRouter.post('/comfy-check', authenticate, async (req, res) => {
  try {
    const { comfyUrl } = req.body;
    const currentCfg = getEffectiveComfyUrl();
    const targetUrl = comfyUrl || currentCfg.url;
    const response = await axios.get(`${targetUrl}/system_stats`, { timeout: 3000 });
    res.json({ success: true, stats: response.data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'ComfyUI connection failed: ' + parseComfyError(error) });
  }
});

apiRouter.post('/comfy-models', authenticate, async (req, res) => {
  try {
    const { comfyUrl } = req.body;
    const currentCfg = getEffectiveComfyUrl();
    const targetUrl = comfyUrl || currentCfg.url;
    const response = await axios.get(`${targetUrl}/models/checkpoints`, { timeout: 5000 });
    if (Array.isArray(response.data)) { res.json({ models: response.data.sort() }); } else {
      const infoResp = await axios.get(`${targetUrl}/object_info`, { timeout: 5000 });
      const checkpoints = infoResp.data["CheckpointLoaderSimple"]?.input?.required?.ckpt_name?.[0] || [];
      res.json({ models: checkpoints.sort() });
    }
  } catch (error: any) { res.status(500).json({ error: 'Failed to fetch models from ComfyUI: ' + error.message }); }
});

apiRouter.post('/interrupt', authenticate, async (req, res) => {
  try {
    const currentCfg = getEffectiveComfyUrl();
    await axios.post(`${req.body.params?.comfyUrl || currentCfg.url}/interrupt`);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: 'Failed to interrupt' }); }
});

apiRouter.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, originalPrompt, sessionId, params } = req.body;
    const timestamp = Date.now();
    const messageId = uuidv4();
    const userMessageId = uuidv4();
    const displayPrompt = originalPrompt || prompt;
    const enhancedText = (prompt && prompt !== originalPrompt || req.body.isRegeneration) ? prompt : '';
    const model = params?.comfyModel || 'dirtyRealism_DMDSAT.safetensors';
    const workflowFile = params?.workflowFile || 'workflow_lcm.json';
    const seed = params?.seed || Math.floor(Math.random() * 1000000000000000);
    const insertMsg = db.prepare('INSERT INTO messages (id, sessionId, role, text, prompt, imageUrl, timestamp, model, width, height, steps, cfg, workflow, status, seed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    if (!req.body.isRegeneration) { insertMsg.run(userMessageId, sessionId, 'user', displayPrompt, '', null, timestamp - 1, null, null, null, null, null, null, 'completed', null); }
    insertMsg.run(messageId, sessionId, 'bot', enhancedText, displayPrompt, null, timestamp, model, params?.width || 896, params?.height || 1152, params?.steps || 8, params?.cfg || 1.1, workflowFile, 'pending', seed);
    db.prepare('INSERT INTO queue (messageId, prompt, originalPrompt, sessionId, params, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(messageId, prompt, originalPrompt, sessionId, JSON.stringify({ ...params, seed }), 'pending', timestamp);
    db.prepare('UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ? AND title = \'New Chat\'').run(displayPrompt.substring(0, 30), timestamp, sessionId);
    db.prepare('UPDATE sessions SET updatedAt = ? WHERE id = ?').run(timestamp, sessionId);
    res.json({ success: true, messageId, status: 'pending' });
    processQueue();
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

// Mount the router at both root and /api for maximum proxy compatibility
app.use('/api', apiRouter);
app.use('/', apiRouter);

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
