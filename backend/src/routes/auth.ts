import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../services/database';
import { authenticate } from '../middleware/auth';
import { CookieOptions, User } from '../types';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim()) as User | undefined;
  if (!user || !bcrypt.compareSync(password.trim(), user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions: CookieOptions = { 
    httpOnly: true,
    signed: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  };

  if (isProd) {
    cookieOptions.sameSite = 'none';
    cookieOptions.secure = true;
    const host: string = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const parts = host.split('.');
    if (parts.length >= 2) {
      cookieOptions.domain = `.${parts.slice(-2).join('.')}`;
    }
  }

  res.cookie('userId', user.id, cookieOptions as any);
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
  const userId = req.signedCookies.userId;
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

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('userId');
  res.json({ success: true });
});

export default router;
