import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import db from '../services/database';
import { authenticate } from '../middleware/auth';
import { getEffectiveComfyUrl, parseComfyError } from '../services/comfy';
import { broadcastToSession, processQueue } from '../services/queue';

const router = express.Router();

router.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, originalPrompt, sessionId, params } = req.body;
    const timestamp = Date.now();
    const messageId = uuidv4();
    const userMessageId = uuidv4();
    
    // Si prompt est différent d'originalPrompt, c'est que l'IA a bossé
    const isEnhanced = prompt && originalPrompt && prompt !== originalPrompt;
    const displayPrompt = originalPrompt || prompt;
    const enhancedText = isEnhanced ? prompt : '';
    const model = params?.comfyModel || 'dirtyRealism_DMDSAT.safetensors';
    const workflowFile = params?.workflowFile || 'workflow_lcm.json';
    const seed = params?.seed || Math.floor(Math.random() * 1000000000000000);
    
    const insertMsg = db.prepare('INSERT INTO messages (id, sessionId, role, text, prompt, imageUrl, timestamp, model, width, height, steps, cfg, workflow, status, seed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    if (!req.body.isRegeneration) {
      insertMsg.run(userMessageId, sessionId, 'user', displayPrompt, '', null, timestamp - 1, null, null, null, null, null, null, 'completed', null);
    }
    
    insertMsg.run(messageId, sessionId, 'bot', enhancedText, displayPrompt, null, timestamp, model, params?.width || 896, params?.height || 1152, params?.steps || 8, params?.cfg || 1.1, workflowFile, 'pending', seed);
    
    db.prepare('INSERT INTO queue (messageId, prompt, originalPrompt, sessionId, params, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(messageId, prompt, originalPrompt, sessionId, JSON.stringify({ ...params, seed }), 'pending', timestamp);
    
    db.prepare('UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ? AND title = \'New Chat\'').run(displayPrompt.substring(0, 30), timestamp, sessionId);
    db.prepare('UPDATE sessions SET updatedAt = ? WHERE id = ?').run(timestamp, sessionId);
    
    res.json({ success: true, messageId, status: 'pending' });
    
    // Start processing immediately
    processQueue();
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/interrupt', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const currentCfg = getEffectiveComfyUrl();
    
    // 1. Send interrupt to ComfyUI
    try {
      await axios.post(`${req.body.params?.comfyUrl || currentCfg.url}/interrupt`);
    } catch (e) {
      console.warn('[Interrupt] ComfyUI interrupt call failed (might be already idle)');
    }
    
    // 2. Identify messages to be cancelled
    const affectedMessages = db.prepare(`
      SELECT m.id, m.sessionId 
      FROM messages m 
      JOIN sessions s ON m.sessionId = s.id 
      WHERE m.status IN ('pending', 'processing') 
      AND s.userId = ?
    `).all(user.id) as any[];

    // 3. Clear user's queue in database
    db.prepare(`
      DELETE FROM queue 
      WHERE sessionId IN (SELECT id FROM sessions WHERE userId = ?)
    `).run(user.id);
    
    // 4. Mark all pending/processing messages as failed and notify via WS
    db.prepare(`
      UPDATE messages 
      SET status = 'failed', text = 'Interrompu par l''utilisateur' 
      WHERE status IN ('pending', 'processing') 
      AND sessionId IN (SELECT id FROM sessions WHERE userId = ?)
    `).run(user.id);

    affectedMessages.forEach(msg => {
      broadcastToSession(msg.sessionId, { 
        messageId: msg.id, 
        status: 'failed', 
        error: 'Interrompu par l\'utilisateur' 
      });
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Interrupt] Error:', error);
    res.status(500).json({ error: 'Failed to interrupt' });
  }
});

export default router;
