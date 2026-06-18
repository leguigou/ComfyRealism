import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Restore default workflows if obscured by empty volume mount
const workflowsDir = path.join(__dirname, 'workflows');
const defaultWorkflowsDir = path.join(__dirname, 'default_workflows');

if (fs.existsSync(defaultWorkflowsDir) && fs.existsSync(workflowsDir)) {
  const defaultFiles = fs.readdirSync(defaultWorkflowsDir);
  for (const file of defaultFiles) {
    const targetPath = path.join(workflowsDir, file);
    if (!fs.existsSync(targetPath)) {
      try {
        fs.copyFileSync(path.join(defaultWorkflowsDir, file), targetPath);
        console.log(`[Init] Restored default workflow file: ${file}`);
      } catch (err) {
        console.error(`[Init] Failed to restore default workflow file: ${file}`, err);
      }
    }
  }
}

import { initDatabase } from './src/services/database';
import { initQueue } from './src/services/queue';
import { getEffectiveComfyUrl, getComfyWsUrl } from './src/services/comfy';

// Routes
import authRoutes from './src/routes/auth';
import historyRoutes from './src/routes/history';
import generationRoutes from './src/routes/generation';
import settingsRoutes from './src/routes/settings';
import userRoutes from './src/routes/users';
import comfyRoutes from './src/routes/comfy';
import llmRoutes from './src/routes/llm';
import galleryRoutes from './src/routes/gallery';
import miscRoutes from './src/routes/misc';
import updateRoutes from './src/routes/updates';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = Number(process.env.PORT) || 3001;
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  console.error('[Fatal] AUTH_SECRET is not set. Use a strong random string in your .env');
  process.exit(1);
}

// Initialize Services
initDatabase();
initQueue(wss);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser(AUTH_SECRET));

// WebSocket Upgrade
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

// WebSocket Connection Relay
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  ws.send(JSON.stringify({ type: 'connected', clientId }));
  
  const currentCfg = getEffectiveComfyUrl();
  const currentComfyWsUrl = getComfyWsUrl(currentCfg.url);
  
  const comfyWs = new WebSocket(`${currentComfyWsUrl}?clientId=${clientId}`);
  
  comfyWs.on('open', () => { 
    console.log(`[WS] Relay connected to ComfyUI at ${currentComfyWsUrl}`); 
  });
  
  comfyWs.on('message', (data) => { 
    if (ws.readyState === WebSocket.OPEN) ws.send(data.toString()); 
  });
  
  comfyWs.on('error', (err) => { 
    console.error(`[WS] ComfyUI Error (${currentComfyWsUrl}):`, err.message); 
    ws.close(); 
  });
  
  ws.on('close', () => {
    if (comfyWs.readyState === WebSocket.OPEN || comfyWs.readyState === WebSocket.CONNECTING) {
      comfyWs.close();
    }
  });
});

// API Routes - Mounted at both /api and / for proxy compatibility
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/history', historyRoutes);
apiRouter.use('/generate', generationRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/comfy', comfyRoutes);
apiRouter.use('/llm', llmRoutes);
apiRouter.use('/gallery', galleryRoutes);
apiRouter.use('/updates', updateRoutes);
apiRouter.use('/image-files', miscRoutes);
apiRouter.use('/', miscRoutes); // For thumbnails and root health checks

app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
