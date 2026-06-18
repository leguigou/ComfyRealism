import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../services/database';
import { authenticate } from '../middleware/auth';
import { CookieOptions, User } from '../types';
import net from 'net';

const router = Router();

const getCookieOptions = (req: Request, includeMaxAge = true) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    signed: true,
    path: '/',
    sameSite: 'lax',
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

const getLegacyAuthCookieOptions = (req: Request) => ({
  ...getCookieOptions(req, false),
  path: '/api/auth',
});

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim()) as User | undefined;
  if (!user || !bcrypt.compareSync(password.trim(), user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.clearCookie('userId', getLegacyAuthCookieOptions(req) as any);
  res.cookie('userId', user.id, getCookieOptions(req) as any);
  return res.json({
    success: true,
    user: { username: user.username, isAdmin: user.isAdmin === 1, avatarUrl: user.avatarUrl },
  });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  res.json({ username: user.username, isAdmin: user.isAdmin === 1, avatarUrl: user.avatarUrl });
});

router.get('/check', (req: Request, res: Response) => {
  const userId = req.signedCookies.userId || req.cookies?.userId;
  if (!userId) {
    return res.json({ authenticated: false });
  }
  const user = db.prepare('SELECT username, isAdmin, avatarUrl FROM users WHERE id = ?').get(userId) as Pick<User, 'username' | 'isAdmin' | 'avatarUrl'> | undefined;
  if (!user) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: { username: user.username, isAdmin: user.isAdmin === 1, avatarUrl: user.avatarUrl },
  });
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('userId', getLegacyAuthCookieOptions(req) as any);
  res.clearCookie('userId', getCookieOptions(req, false) as any);
  res.json({ success: true });
});

export default router;
