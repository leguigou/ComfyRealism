import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../services/database';
import { authenticate } from '../middleware/auth';
import net from 'net';

const router = express.Router();

const getCookieOptions = (req: express.Request, includeMaxAge = true) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  const cookieOptions: any = {
    httpOnly: true,
    signed: true,
    path: '/'
  };

  if (includeMaxAge) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  if (isProd) {
    const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const hostname = rawHost.split(':')[0];

    if (hostname !== 'localhost' && !net.isIP(hostname)) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        cookieOptions.domain = `.${parts.slice(-2).join('.')}`;
      }
    }
  }

  if (isHttps) {
    cookieOptions.sameSite = 'none';
    cookieOptions.secure = true;
  } else {
    cookieOptions.sameSite = 'lax';
    cookieOptions.secure = false;
  }

  return cookieOptions;
};

const getLegacyAuthCookieOptions = (req: express.Request) => ({
  ...getCookieOptions(req, false),
  path: '/api/auth'
});

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

  res.clearCookie('userId', getLegacyAuthCookieOptions(req));
  res.cookie('userId', user.id, getCookieOptions(req));
  return res.json({ success: true, user: { username: user.username, isAdmin: user.isAdmin === 1, avatarUrl: user.avatarUrl } });
});

router.get('/me', authenticate, (req, res) => {
  const user = (req as any).user;
  res.json({ username: user.username, isAdmin: user.isAdmin === 1, avatarUrl: user.avatarUrl });
});

router.get('/check', (req, res) => {
  const userId = req.signedCookies.userId || req.cookies.userId;
  if (!userId) return res.json({ authenticated: false });
  const user = db.prepare('SELECT username, isAdmin, avatarUrl FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { username: user.username, isAdmin: user.isAdmin === 1, avatarUrl: user.avatarUrl } });
});

router.post('/logout', (req, res) => { 
  res.clearCookie('userId', getLegacyAuthCookieOptions(req));
  res.clearCookie('userId', getCookieOptions(req, false)); 
  res.json({ success: true }); 
});

export default router;
