import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { imagesDir, thumbnailsDir, generateThumbnail } from '../services/image';

const router = express.Router();

// Robust thumbnail serving with on-the-fly generation
router.get('/thumbnails/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const thumbPath = path.resolve(thumbnailsDir, userId, filename);
  
  if (fs.existsSync(thumbPath)) {
    return res.sendFile(thumbPath);
  }
  
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.resolve(imagesDir, userId, originalName);
    
    if (fs.existsSync(originalPath)) {
      console.log(`[Thumbnails] Generating on-the-fly: ${filename} for user ${userId}`);
      await generateThumbnail(originalPath, thumbPath);
      return res.sendFile(thumbPath);
    }
  } catch (err: any) { 
    console.error('[Thumbnails] On-the-fly generation failed:', err.message); 
  }
  res.status(404).send('Not found');
});

// Legacy non-user-specific thumbnail route
router.get('/thumbnails/:filename', async (req, res) => {
  const { filename } = req.params;
  const thumbPath = path.resolve(imagesDir, 'thumbnails', filename);

  if (fs.existsSync(thumbPath)) {
    return res.sendFile(thumbPath);
  }
  
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const originalPath = path.resolve(imagesDir, originalName);
    if (fs.existsSync(originalPath)) {
      await generateThumbnail(originalPath, thumbPath);
      return res.sendFile(thumbPath);
    }
  } catch (err: any) { 
    console.error('[Thumbnails Legacy] On-the-fly generation failed:', err.message); 
  }
  res.status(404).send('Not found');
});

// Static serving for all images (handles both full images and thumbnails if they already exist)
router.use('/', express.static(imagesDir, { 
  maxAge: '365d', 
  immutable: true, 
  index: false,
  fallthrough: true // Let it continue to next routes if file not found
}));

router.get('/workflows', authenticate, (req, res) => {
  const backendDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const workflowsDir = path.join(backendDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) return res.json([]);
  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json') && !f.endsWith('.config.json'));
  res.json(files);
});

export default router;
