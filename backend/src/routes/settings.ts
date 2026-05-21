import express from 'express';
import db from '../services/database';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
  res.json(settings ? JSON.parse(settings.data) : {});
});

router.post('/', authenticate, (req, res) => {
  db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(req.body));
  res.json({ success: true });
});

export default router;
