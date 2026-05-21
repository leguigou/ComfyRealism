import { Request, Response, NextFunction } from 'express';
import db from '../services/database';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.signedCookies.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.prepare('SELECT id, username, isAdmin, avatarUrl FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    res.clearCookie('userId');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  (req as any).user = user;
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  authenticate(req, res, () => {
    if ((req as any).user?.isAdmin) {
      return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  });
};
