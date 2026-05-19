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
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  const pathname = url.split('?')[0];

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
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    isAdmin INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    title TEXT NOT NULL,
    updatedAt INTEGER NOT NULL,
    isArchived INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
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
const columnsToCheck = ['model', 'width', 'height', 'steps', 'cfg', 'workflow', 'status', 'thumbnailUrl', 'seed', 'duration', 'isFavorite'];
columnsToCheck.forEach(col => {
  try {
    db.prepare(`SELECT ${col} FROM messages LIMIT 1`).get();
  } catch (e) {
    let type = 'TEXT';
    if (col === 'cfg') type = 'REAL';
    else if (['width', 'height', 'steps', 'seed', 'duration', 'isFavorite'].includes(col)) type = 'INTEGER';
    db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
    console.log(`[Migration] Added column ${col} to messages table`);
  }
});

// Session migration: add userId column if missing
try {
  db.prepare('SELECT userId FROM sessions LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE sessions ADD COLUMN userId TEXT');
  console.log('[Migration] Added userId column to sessions table');
}

// Default Admin User Migration
const APP_PASSWORD = process.env.APP_PASSWORD || 'comfy';
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;

if (userCount.count === 0) {
  console.log('[Migration] Creating default admin user...');
  const adminId = uuidv4();
  const passwordHash = bcrypt.hashSync(APP_PASSWORD.trim(), 10);
  db.prepare('INSERT INTO users (id, username, password, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, 'admin', passwordHash, 1, Date.now());
  
  // Assign all existing sessions to the new admin
  db.prepare('UPDATE sessions SET userId = ? WHERE userId IS NULL').run(adminId);
  console.log('[Migration] Default admin user created and existing sessions migrated.');
}

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
// APP_PASSWORD is declared above during migration

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser(AUTH_SECRET));

const apiRouter = express.Router();

const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.signedCookies.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.prepare('SELECT id, username, isAdmin FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    res.clearCookie('userId');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  (req as any).user = user;
  next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  authenticate(req, res, () => {
    if ((req as any).user?.isAdmin) {
      return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  });
};

const clients = new Map<string, WebSocket>();

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  ws.send(JSON.stringify({ type: 'connected', clientId }));
  const currentCfg = getEffectiveComfyUrl();
  const currentComfyWsUrl = getComfyWsUrl(currentCfg.url);
  const comfyWs = new WebSocket(`${currentComfyWsUrl}?clientId=${clientId}`);
  comfyWs.on('open', () => { console.log(`[WS] Relay connected to ComfyUI at ${currentComfyWsUrl}`); });
  comfyWs.on('message', (data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data.toString()); });
  comfyWs.on('error', (err) => { console.error(`[WS] ComfyUI Error (${currentComfyWsUrl}):`, err.message); ws.close(); });
  ws.on('close', () => {
    clients.delete(clientId);
    if (comfyWs.readyState === WebSocket.OPEN || comfyWs.readyState === WebSocket.CONNECTING) comfyWs.close();
  });
});

const broadcastToSession = (sessionId: string, data: any) => {
  const payload = JSON.stringify({ type: 'queue_update', sessionId, ...data });
  wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(payload); });
};

app.get('/', (req, res) => res.json({ status: 'online', service: 'ComfyRealism Backend' }));

apiRouter.get('/image-files/thumbnails/:userId/:filename', async (req, res, next) => {
  const { userId, filename } = req.params;
  const thumbPath = path.join(thumbnailsDir, userId, filename);
  if (fs.existsSync(thumbPath)) return next();
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.join(imagesDir, userId, originalName);
    if (fs.existsSync(originalPath)) {
      const userThumbDir = path.join(thumbnailsDir, userId);
      if (!fs.existsSync(userThumbDir)) fs.mkdirSync(userThumbDir, { recursive: true });
      await sharp(originalPath).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toFile(thumbPath);
      return res.sendFile(thumbPath);
    }
  } catch (err) { console.error('[Thumbnails] On-the-fly generation failed:', err); }
  res.status(404).send('Not found');
});

apiRouter.get('/image-files/thumbnails/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const thumbPath = path.join(imagesDir, 'thumbnails', filename);
  if (fs.existsSync(thumbPath)) return next();
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.join(imagesDir, originalName);
    if (fs.existsSync(originalPath)) {
      const legacyThumbDir = path.join(imagesDir, 'thumbnails');
      if (!fs.existsSync(legacyThumbDir)) fs.mkdirSync(legacyThumbDir, { recursive: true });
      await sharp(originalPath).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toFile(thumbPath);
      return res.sendFile(thumbPath);
    }
  } catch (err) { console.error('[Thumbnails] On-the-fly generation failed:', err); }
  res.status(404).send('Not found');
});

apiRouter.use('/image-files', express.static(imagesDir, { maxAge: '365d', immutable: true, index: false }));

apiRouter.get('/workflows', authenticate, (req, res) => {
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
  if (error.message?.includes('ECONNREFUSED')) return 'ComfyUI is unreachable. Please check settings.';
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) return 'ComfyUI request timed out (possible GPU overload or hang).';
  return error.message || 'Unknown server error';
};

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
    const dynamicCfg = getEffectiveComfyUrl();
    const targetComfyUrl = params?.comfyUrl || dynamicCfg.url;
    const configPath = path.join(__dirname, 'workflows', (params?.workflowFile || 'workflow_lcm.json').replace('.json', '.config.json'));
    let saveNodeId = "99";
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.nodeMapping?.save) saveNodeId = config.nodeMapping.save;
      } catch (e) { }
    }
    let promptId = '';
    try {
      const response = await axios.post(`${targetComfyUrl}/prompt`, { prompt: workflow, client_id: uuidv4() }, { timeout: 10000 });
      promptId = response.data.prompt_id;
    } catch (err: any) { throw new Error(`Submission failed: ${parseComfyError(err)}`); }
    // Polling with Timeout (5 minutes)
    let finished = false, filename = '';
    const startTime = Date.now();
    const POLLING_TIMEOUT = 5 * 60 * 1000; 

    while (!finished) {
      if (Date.now() - startTime > POLLING_TIMEOUT) throw new Error('Generation timed out after 5 minutes.');
      
      // Update duration in DB periodically (optional) or just send in broadcast
      const currentDuration = Math.floor((Date.now() - startTime) / 1000);
      broadcastToSession(task.sessionId, { messageId: task.messageId, status: 'processing', duration: currentDuration });

      let hResp;
      try { hResp = await axios.get(`${targetComfyUrl}/history/${promptId}`, { timeout: 5000 }); }
      catch (err: any) { console.warn(`[Queue] Polling attempt failed: ${err.message}`); await new Promise(r => setTimeout(r, 2000)); continue; }
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
        const stillExists = db.prepare('SELECT id FROM queue WHERE id = ?').get(task.id);
        if (!stillExists) { isProcessingQueue = false; setTimeout(processQueue, 100); return; }
      }
    }
    
    const finalDuration = Math.floor((Date.now() - startTime) / 1000);

    let imgResp;
    try {
      imgResp = await axios.get(`${targetComfyUrl}/view`, { params: { filename }, responseType: 'arraybuffer', timeout: 15000 });
    } catch (err: any) { throw new Error(`Failed to retrieve image: ${parseComfyError(err)}`); }
    
    const sessionRecord = db.prepare('SELECT userId FROM sessions WHERE id = ?').get(task.sessionId) as any;
    const userId = sessionRecord?.userId || 'unknown';
    const userImagesDir = path.join(imagesDir, userId);
    const userThumbnailsDir = path.join(thumbnailsDir, userId);
    
    if (!fs.existsSync(userImagesDir)) fs.mkdirSync(userImagesDir, { recursive: true });
    if (!fs.existsSync(userThumbnailsDir)) fs.mkdirSync(userThumbnailsDir, { recursive: true });

    const baseName = `${Date.now()}-${filename.replace(/\.[^/.]+$/, "")}`;
    const fullWebpName = `${baseName}.webp`;
    const thumbWebpName = `${baseName}_thumb.webp`;
    
    await sharp(imgResp.data).webp({ quality: 85 }).toFile(path.join(userImagesDir, fullWebpName));
    await sharp(imgResp.data).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toFile(path.join(userThumbnailsDir, thumbWebpName));
    
    const imageUrl = `/api/image-files/${userId}/${fullWebpName}`;
    const thumbnailUrl = `/api/image-files/thumbnails/${userId}/${thumbWebpName}`;
    db.prepare('UPDATE messages SET imageUrl = ?, thumbnailUrl = ?, status = ?, duration = ? WHERE id = ?').run(imageUrl, thumbnailUrl, 'completed', finalDuration, task.messageId);
    db.prepare('DELETE FROM queue WHERE id = ?').run(task.id);
    broadcastToSession(task.sessionId, { 
      messageId: task.messageId, status: 'completed', imageUrl, thumbnailUrl, duration: finalDuration,
      model: params.comfyModel, width: params.width, height: params.height, steps: params.steps, cfg: params.cfg, workflow: params.workflowFile, seed: params.seed 
    });
  } catch (error: any) {
    const errorMsg = error.message || 'Unexpected error';
    console.error(`[Queue] Fatal error for task ${task?.messageId}:`, errorMsg);
    if (task) {
      db.prepare('UPDATE messages SET status = ?, text = ? WHERE id = ?').run('failed', errorMsg, task.messageId);
      db.prepare('DELETE FROM queue WHERE id = ?').run(task.id);
      broadcastToSession(task.sessionId, { messageId: task.messageId, status: 'failed', error: errorMsg });
    }
  } finally { isProcessingQueue = false; setTimeout(processQueue, 500); }
};

setInterval(processQueue, 2000);

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const submittedUsername = (username || '').trim().toLowerCase();
  const submittedPassword = (password || '').trim();
  
  if (!submittedUsername || !submittedPassword) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(submittedUsername) as any;
  if (!user || !bcrypt.compareSync(submittedPassword, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions: any = { 
    httpOnly: true, 
    signed: true, 
    maxAge: 30 * 24 * 60 * 60 * 1000 
  };

  if (isProd) {
    cookieOptions.sameSite = 'none';
    cookieOptions.secure = true;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const parts = host.split('.');
    if (parts.length >= 2) {
      const domain = `.${parts.slice(-2).join('.')}`;
      cookieOptions.domain = domain;
    }
  } else {
    cookieOptions.sameSite = 'lax';
  }

  res.cookie('userId', user.id, cookieOptions);
  return res.json({ success: true, user: { username: user.username, isAdmin: user.isAdmin === 1 } });
});

apiRouter.get('/auth/me', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json({ username: user.username, isAdmin: user.isAdmin === 1 });
});

apiRouter.get('/auth/check', (req, res) => {
  const userId = req.signedCookies.userId;
  if (!userId) return res.json({ authenticated: false });
  const user = db.prepare('SELECT username, isAdmin FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { username: user.username, isAdmin: user.isAdmin === 1 } });
});

apiRouter.post('/auth/logout', (req, res) => { res.clearCookie('userId'); res.json({ success: true }); });

// Admin User Management Endpoints
apiRouter.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, isAdmin, createdAt FROM users ORDER BY createdAt DESC').all() as any[];
  
  const usersWithStats = users.map(user => {
    // Get all image and thumbnail URLs for this user
    const userImages = db.prepare(`
      SELECT m.imageUrl, m.thumbnailUrl 
      FROM messages m 
      JOIN sessions s ON m.sessionId = s.id 
      WHERE s.userId = ? AND m.imageUrl IS NOT NULL
    `).all(user.id) as any[];

    let totalBytes = 0;
    const imageCount = userImages.length;

    userImages.forEach(img => {
      try {
        if (img.imageUrl && img.imageUrl.startsWith('/api/image-files/')) {
          const relativePath = decodeURIComponent(img.imageUrl.replace('/api/image-files/', '').split('?')[0]);
          const imgPath = path.join(imagesDir, relativePath);
          if (fs.existsSync(imgPath)) totalBytes += fs.statSync(imgPath).size;
        }
        if (img.thumbnailUrl && img.thumbnailUrl.startsWith('/api/image-files/')) {
          const relativePath = decodeURIComponent(img.thumbnailUrl.replace('/api/image-files/', '').split('?')[0]);
          const thumbPath = path.join(imagesDir, relativePath);
          if (fs.existsSync(thumbPath)) totalBytes += fs.statSync(thumbPath).size;
        }
      } catch (err) {
        // Ignore file access errors
      }
    });

    return {
      ...user,
      imageCount,
      diskUsage: totalBytes
    };
  });

  res.json(usersWithStats);
});

apiRouter.post('/users', requireAdmin, (req, res) => {
  const { username, password, isAdmin } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password.trim(), 10);
  
  try {
    db.prepare('INSERT INTO users (id, username, password, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, username.trim().toLowerCase(), passwordHash, isAdmin ? 1 : 0, Date.now());
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

apiRouter.delete('/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === (req as any).user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

apiRouter.patch('/users/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'New password required' });
  const passwordHash = bcrypt.hashSync(password.trim(), 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, req.params.id);
  res.json({ success: true });
});

apiRouter.get('/settings', authenticate, (req, res) => {
  const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
  res.json(settings ? JSON.parse(settings.data) : {});
});

apiRouter.post('/settings', authenticate, (req, res) => {
  db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(req.body));
  res.json({ success: true });
});

apiRouter.get('/history', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json(db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 0 AND userId = ? ORDER BY updatedAt DESC').all(user.id));
});

apiRouter.get('/history/archives', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json(db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 1 AND userId = ? ORDER BY updatedAt DESC').all(user.id));
});

apiRouter.get('/gallery', authenticate, (req, res) => {
  const user = (req as any).user;
  const limit = parseInt(req.query.limit as string) || 25;
  const offset = parseInt(req.query.offset as string) || 0;
  const onlyArchived = req.query.includeArchived === 'true';
  const favoritesOnly = req.query.favoritesOnly === 'true';
  
  let query = `
    SELECT m.sessionId, m.id as messageId, m.imageUrl, m.thumbnailUrl, m.prompt, m.text, m.timestamp, m.model, m.width, m.height, m.steps, m.cfg, m.workflow, m.seed, m.isFavorite
    FROM messages m JOIN sessions s ON m.sessionId = s.id
    WHERE m.imageUrl IS NOT NULL AND s.userId = ?
  `;
  
  const params: any[] = [user.id];
  
  if (favoritesOnly) {
    query += ` AND m.isFavorite = 1`;
  } else {
    query += ` AND s.isArchived = ?`;
    params.push(onlyArchived ? 1 : 0);
  }
  
  query += ` ORDER BY m.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  res.json(db.prepare(query).all(...params));
});

apiRouter.get('/history/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND userId = ?').get(req.params.id, user.id) as any;
  if (!session) return res.json({ error: 'Not found' });
  const messages = db.prepare('SELECT id, role, text, prompt, imageUrl, thumbnailUrl, model, width, height, steps, cfg, workflow, status, timestamp, seed, isFavorite FROM messages WHERE sessionId = ? ORDER BY timestamp ASC').all(req.params.id);
  res.json({ ...session, messages });
});

apiRouter.patch('/history/:sessionId/message/:messageId/favorite', authenticate, (req, res) => {
  const user = (req as any).user;
  const { sessionId, messageId } = req.params;
  const { isFavorite } = req.body;

  // Verify ownership
  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND userId = ?').get(sessionId, user.id);
  if (!session) return res.status(403).json({ error: 'Unauthorized' });

  db.prepare('UPDATE messages SET isFavorite = ? WHERE id = ? AND sessionId = ?').run(isFavorite ? 1 : 0, messageId, sessionId);
  res.json({ success: true, isFavorite });
});

apiRouter.post('/history', authenticate, (req, res) => {
  const user = (req as any).user;
  const newSession = { id: uuidv4(), userId: user.id, title: 'New Chat', updatedAt: Date.now(), isArchived: 0 };
  db.prepare('INSERT INTO sessions (id, userId, title, updatedAt, isArchived) VALUES (?, ?, ?, ?, ?)')
    .run(newSession.id, newSession.userId, newSession.title, newSession.updatedAt, 0);
  res.json(newSession);
});

const deleteMessageFiles = (messages: any[]) => {
  messages.forEach(msg => {
    try {
      if (msg.imageUrl && msg.imageUrl.startsWith('/api/image-files/')) {
        const relativePath = decodeURIComponent(msg.imageUrl.replace('/api/image-files/', '').split('?')[0]);
        const imgPath = path.join(imagesDir, relativePath);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
      if (msg.thumbnailUrl && msg.thumbnailUrl.startsWith('/api/image-files/')) {
        const relativePath = decodeURIComponent(msg.thumbnailUrl.replace('/api/image-files/', '').split('?')[0]);
        const thumbPath = path.join(imagesDir, relativePath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      }
    } catch (err) {
      console.error(`Failed to delete files for message ${msg.id}:`, err);
    }
  });
};

apiRouter.delete('/history/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const messages = db.prepare('SELECT imageUrl, thumbnailUrl FROM messages WHERE sessionId = ? AND imageUrl IS NOT NULL').all(req.params.id);
  deleteMessageFiles(messages);
  
  db.prepare('DELETE FROM sessions WHERE id = ? AND userId = ?').run(req.params.id, user.id);
  res.json({ success: true });
});

apiRouter.delete('/history/all/active', authenticate, (req, res) => {
  const user = (req as any).user;
  const messages = db.prepare(`
    SELECT m.imageUrl, m.thumbnailUrl 
    FROM messages m 
    JOIN sessions s ON m.sessionId = s.id 
    WHERE s.isArchived = 0 AND s.userId = ? AND m.imageUrl IS NOT NULL
  `).all(user.id);
  deleteMessageFiles(messages);

  db.prepare('DELETE FROM sessions WHERE isArchived = 0 AND userId = ?').run(user.id);
  res.json({ success: true });
});

apiRouter.post('/history/archive-all', authenticate, (req, res) => {
  const user = (req as any).user;
  db.prepare('UPDATE sessions SET isArchived = 1 WHERE isArchived = 0 AND userId = ?').run(user.id);
  res.json({ success: true });
});

apiRouter.patch('/history/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  db.prepare('UPDATE sessions SET title = ? WHERE id = ? AND userId = ?').run(req.body.title, req.params.id, user.id);
  res.json({ success: true, title: req.body.title });
});

apiRouter.patch('/history/:id/archive', authenticate, (req, res) => {
  const user = (req as any).user;
  db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ? AND userId = ?').run(req.body.isArchived ? 1 : 0, req.params.id, user.id);
  res.json({ success: true, isArchived: req.body.isArchived });
});

apiRouter.delete('/history/:sessionId/message/:messageId', authenticate, (req, res) => {
  const user = (req as any).user;
  // Verify session belongs to user first
  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND userId = ?').get(req.params.sessionId, user.id);
  if (!session) return res.status(403).json({ error: 'Unauthorized' });

  const message = db.prepare('SELECT imageUrl, thumbnailUrl FROM messages WHERE id = ? AND sessionId = ?').get(req.params.messageId, req.params.sessionId);
  if (message) deleteMessageFiles([message]);

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
  } catch (error: any) { res.status(500).json({ error: 'LLM Error: ' + (error.response?.data?.error?.message || error.message) }); }
});

apiRouter.post('/llm-models', authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${req.body.llmUrl}/v1/models`, { timeout: 5000 });
    res.json({ models: response.data.data.map((m: any) => m.id) });
  } catch (error: any) { res.status(500).json({ error: 'Failed to fetch models' }); }
});

apiRouter.post('/llm-check', authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${req.body.llmUrl}/v1/models`, { timeout: 3000 });
    res.json({ success: true, count: response.data.data?.length || 0 });
  } catch (error: any) { res.status(500).json({ success: false, error: 'LLM connection failed: ' + (error.response?.data?.error?.message || error.message) }); }
});

apiRouter.post('/comfy-check', authenticate, async (req, res) => {
  try {
    const currentCfg = getEffectiveComfyUrl();
    const response = await axios.get(`${req.body.comfyUrl || currentCfg.url}/system_stats`, { timeout: 3000 });
    res.json({ success: true, stats: response.data });
  } catch (error: any) { res.status(500).json({ success: false, error: 'ComfyUI connection failed: ' + parseComfyError(error) }); }
});

apiRouter.post('/comfy-models', authenticate, async (req, res) => {
  try {
    const currentCfg = getEffectiveComfyUrl();
    const targetUrl = req.body.comfyUrl || currentCfg.url;
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

app.use('/api', apiRouter);
app.use('/', apiRouter);

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
