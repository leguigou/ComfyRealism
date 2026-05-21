import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../services/database';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.post('/login', (req, res) => {
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

router.get('/me', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json({ username: user.username, isAdmin: user.isAdmin === 1 });
});

router.get('/check', (req, res) => {
  const userId = req.signedCookies.userId;
  if (!userId) return res.json({ authenticated: false });
  const user = db.prepare('SELECT username, isAdmin FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { username: user.username, isAdmin: user.isAdmin === 1 } });
});

router.post('/logout', (req, res) => { 
  res.clearCookie('userId'); 
  res.json({ success: true }); 
});

export default router;
