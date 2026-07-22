import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/database';
import { authenticate } from '../middleware/auth';
import { deleteFiles } from '../services/image';
import { withParsedRandomSelections } from '../services/message-metadata';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json(db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 0 AND userId = ? ORDER BY updatedAt DESC').all(user.id));
});

router.get('/archives', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json(db.prepare('SELECT id, title, updatedAt, isArchived FROM sessions WHERE isArchived = 1 AND userId = ? ORDER BY updatedAt DESC').all(user.id));
});

router.post('/', authenticate, (req, res) => {
  const user = (req as any).user;
  const newSession = { id: uuidv4(), userId: user.id, title: 'New Chat', updatedAt: Date.now(), isArchived: 0 };
  db.prepare('INSERT INTO sessions (id, userId, title, updatedAt, isArchived) VALUES (?, ?, ?, ?, ?)')
    .run(newSession.id, newSession.userId, newSession.title, newSession.updatedAt, 0);
  res.json(newSession);
});

router.get('/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND userId = ?').get(req.params.id, user.id) as any;
  if (!session) return res.json({ error: 'Not found' });
  const messages = db.prepare('SELECT id, role, text, prompt, imageUrl, thumbnailUrl, model, width, height, steps, cfg, workflow, status, timestamp, seed, isFavorite, duration, sampler, scheduler, randomSelections FROM messages WHERE sessionId = ? ORDER BY timestamp ASC').all(req.params.id) as Record<string, unknown>[];
  res.json({ ...session, messages: messages.map(withParsedRandomSelections) });
});

router.patch('/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  db.prepare('UPDATE sessions SET title = ? WHERE id = ? AND userId = ?').run(req.body.title, req.params.id, user.id);
  res.json({ success: true, title: req.body.title });
});

router.delete('/:id', authenticate, (req, res) => {
  const user = (req as any).user;
  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND userId = ?').get(req.params.id, user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const messages = db.prepare('SELECT imageUrl, thumbnailUrl FROM messages WHERE sessionId = ? AND imageUrl IS NOT NULL').all(req.params.id) as any[];
  deleteFiles(messages);
  
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.patch('/:id/archive', authenticate, (req, res) => {
  const user = (req as any).user;
  db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ? AND userId = ?').run(req.body.isArchived ? 1 : 0, req.params.id, user.id);
  res.json({ success: true, isArchived: req.body.isArchived });
});

router.post('/archive-all', authenticate, (req, res) => {
  const user = (req as any).user;
  db.prepare('UPDATE sessions SET isArchived = 1 WHERE isArchived = 0 AND userId = ?').run(user.id);
  res.json({ success: true });
});

router.delete('/all/active', authenticate, (req, res) => {
  const user = (req as any).user;
  const messages = db.prepare(`
    SELECT m.imageUrl, m.thumbnailUrl 
    FROM messages m 
    JOIN sessions s ON m.sessionId = s.id 
    WHERE s.isArchived = 0 AND s.userId = ? AND m.imageUrl IS NOT NULL
  `).all(user.id) as any[];
  deleteFiles(messages);

  db.prepare('DELETE FROM sessions WHERE isArchived = 0 AND userId = ?').run(user.id);
  res.json({ success: true });
});

router.patch('/:sessionId/message/:messageId/favorite', authenticate, (req, res) => {
  const user = (req as any).user;
  const { sessionId, messageId } = req.params;
  const { isFavorite } = req.body;

  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND userId = ?').get(sessionId, user.id);
  if (!session) return res.status(403).json({ error: 'Unauthorized' });

  db.prepare('UPDATE messages SET isFavorite = ? WHERE id = ? AND sessionId = ?').run(isFavorite ? 1 : 0, messageId, sessionId);
  res.json({ success: true, isFavorite });
});

router.delete('/:sessionId/message/:messageId', authenticate, (req, res) => {
  const user = (req as any).user;
  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND userId = ?').get(req.params.sessionId, user.id);
  if (!session) return res.status(403).json({ error: 'Unauthorized' });

  const message = db.prepare('SELECT imageUrl, thumbnailUrl FROM messages WHERE id = ? AND sessionId = ?').get(req.params.messageId, req.params.sessionId) as any;
  if (message) deleteFiles([message]);

  db.prepare('DELETE FROM messages WHERE id = ? AND sessionId = ?').run(req.params.messageId, req.params.sessionId);
  db.prepare('DELETE FROM queue WHERE messageId = ?').run(req.params.messageId);
  res.json({ success: true });
});

export default router;
