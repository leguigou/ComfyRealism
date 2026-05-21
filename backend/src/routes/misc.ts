import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { imagesDir, thumbnailsDir, generateThumbnail } from '../services/image';

const router = express.Router();

router.get('/thumbnails/:userId/:filename', async (req, res, next) => {
  const { userId, filename } = req.params;
  const thumbPath = path.join(thumbnailsDir, userId, filename);
  if (fs.existsSync(thumbPath)) return res.sendFile(thumbPath);
  
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.join(imagesDir, userId, originalName);
    if (fs.existsSync(originalPath)) {
      await generateThumbnail(originalPath, thumbPath);
      return res.sendFile(thumbPath);
    }
  } catch (err) { console.error('[Thumbnails] On-the-fly generation failed:', err); }
  res.status(404).send('Not found');
});

// Legacy thumbnail route
router.get('/thumbnails/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  const thumbPath = path.join(imagesDir, 'thumbnails', filename);
  if (fs.existsSync(thumbPath)) return res.sendFile(thumbPath);
  
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.join(imagesDir, originalName);
    if (fs.existsSync(originalPath)) {
      await generateThumbnail(originalPath, thumbPath);
      return res.sendFile(thumbPath);
    }
  } catch (err) { console.error('[Thumbnails] On-the-fly generation failed:', err); }
  res.status(404).send('Not found');
});

router.use('/', express.static(imagesDir, { maxAge: '365d', immutable: true, index: false }));

router.get('/workflows', authenticate, (req, res) => {
  const workflowsDir = path.join(__dirname, '..', '..', 'workflows');
  if (!fs.existsSync(workflowsDir)) return res.json([]);
  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json') && !f.endsWith('.config.json'));
  res.json(files);
});

export default router;
