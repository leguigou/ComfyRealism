import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { imagesDir, thumbnailsDir, generateThumbnail } from '../services/image';

const router = express.Router();

const getRouteParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const canAccessUserFiles = (req: express.Request, userId: string) => {
  const user = (req as any).user;
  return user?.id === userId || user?.isAdmin === 1;
};

const sendFileIfInside = (res: express.Response, baseDir: string, filePath: string) => {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
    return res.status(400).send('Invalid path');
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).send('Not found');
  }

  return res.sendFile(resolvedPath);
};

// Robust thumbnail serving with on-the-fly generation
router.get('/thumbnails/:userId/:filename', authenticate, async (req, res) => {
  const userId = getRouteParam(req.params.userId);
  const filename = getRouteParam(req.params.filename);
  if (!canAccessUserFiles(req, userId)) return res.status(403).send('Forbidden');

  const userThumbsDir = path.join(thumbnailsDir, userId);
  const thumbPath = path.join(userThumbsDir, filename);
  
  if (fs.existsSync(thumbPath)) {
    return sendFileIfInside(res, userThumbsDir, thumbPath);
  }
  
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const userImagesDir = path.join(imagesDir, userId);
    const originalPath = path.join(userImagesDir, originalName);
    
    if (fs.existsSync(originalPath)) {
      console.log(`[Thumbnails] Generating on-the-fly: ${filename} for user ${userId}`);
      await generateThumbnail(originalPath, thumbPath);
      return sendFileIfInside(res, userThumbsDir, thumbPath);
    }
  } catch (err: any) { 
    console.error('[Thumbnails] On-the-fly generation failed:', err.message); 
  }
  res.status(404).send('Not found');
});

// Legacy non-user-specific thumbnail route
router.get('/thumbnails/:filename', authenticate, async (req, res) => {
  const filename = getRouteParam(req.params.filename);
  const legacyThumbsDir = path.join(imagesDir, 'thumbnails');
  const thumbPath = path.join(legacyThumbsDir, filename);

  if (fs.existsSync(thumbPath)) {
    return sendFileIfInside(res, legacyThumbsDir, thumbPath);
  }
  
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.join(imagesDir, originalName);
    if (fs.existsSync(originalPath)) {
      await generateThumbnail(originalPath, thumbPath);
      return sendFileIfInside(res, legacyThumbsDir, thumbPath);
    }
  } catch (err: any) { 
    console.error('[Thumbnails Legacy] On-the-fly generation failed:', err.message); 
  }
  res.status(404).send('Not found');
});

router.get('/workflows', authenticate, (req, res) => {
  const backendDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const workflowsDir = path.join(backendDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) return res.json([]);
  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json') && !f.endsWith('.config.json'));
  res.json(files);
});

router.get('/:userId/:filename', authenticate, (req, res) => {
  const userId = getRouteParam(req.params.userId);
  const filename = getRouteParam(req.params.filename);
  if (!canAccessUserFiles(req, userId)) return res.status(403).send('Forbidden');

  const userImagesDir = path.join(imagesDir, userId);
  return sendFileIfInside(res, userImagesDir, path.join(userImagesDir, filename));
});

// Legacy non-user-specific image route, kept for old database rows.
router.get('/:filename', authenticate, (req, res) => {
  return sendFileIfInside(res, imagesDir, path.join(imagesDir, getRouteParam(req.params.filename)));
});

export default router;
