import express from 'express';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth';
import { imagesDir, thumbnailsDir, generateThumbnail } from '../services/image';
import { analyzeWorkflow, sanitizeWorkflowFilename } from '../services/workflow-import';
import { getTargetComfyUrl, getWorkflow, parseComfyError } from '../services/comfy';
import { ServiceUrlError } from '../security/service-url';

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
  if (!resolvedPath.startsWith(resolvedBase + path.sep)) return res.status(400).send('Invalid path');
  if (!fs.existsSync(resolvedPath)) return res.status(404).send('Not found');
  return res.sendFile(resolvedPath);
};

const getWorkflowsDir = () => {
  const backendDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const workflowsDir = path.resolve(backendDir, 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  return workflowsDir;
};

router.get('/thumbnails/:userId/:filename', authenticate, async (req, res) => {
  const userId = getRouteParam(req.params.userId);
  const filename = getRouteParam(req.params.filename);
  if (!canAccessUserFiles(req, userId)) return res.status(403).send('Forbidden');
  const userThumbsDir = path.join(thumbnailsDir, userId);
  const thumbPath = path.join(userThumbsDir, filename);
  if (fs.existsSync(thumbPath)) return sendFileIfInside(res, userThumbsDir, thumbPath);
  try {
    const originalName = filename.replace('_thumb.webp', '.webp');
    const userImagesDir = path.join(imagesDir, userId);
    const originalPath = path.join(userImagesDir, originalName);
    if (fs.existsSync(originalPath)) {
      await generateThumbnail(originalPath, thumbPath);
      return sendFileIfInside(res, userThumbsDir, thumbPath);
    }
  } catch (err: any) {
    console.error('[Thumbnails] On-the-fly generation failed:', err.message);
  }
  res.status(404).send('Not found');
});

router.get('/thumbnails/:filename', authenticate, async (req, res) => {
  const filename = getRouteParam(req.params.filename);
  const legacyThumbsDir = path.join(imagesDir, 'thumbnails');
  const thumbPath = path.join(legacyThumbsDir, filename);
  if (fs.existsSync(thumbPath)) return sendFileIfInside(res, legacyThumbsDir, thumbPath);
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

router.get('/workflows', authenticate, (_req, res) => {
  const files = fs.readdirSync(getWorkflowsDir()).filter(f => f.endsWith('.json') && !f.endsWith('.config.json'));
  res.json(files.sort());
});

router.post('/workflows/analyze', authenticate, (req, res) => {
  try {
    const analysis = analyzeWorkflow(req.body?.workflow);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Workflow invalide' });
  }
});

router.post('/workflows', authenticate, (req, res) => {
  try {
    const filename = sanitizeWorkflowFilename(String(req.body?.filename || ''));
    const workflow = req.body?.workflow;
    const overwrite = req.body?.overwrite === true;
    const analysis = analyzeWorkflow(workflow);
    const nodeMapping = { ...analysis.nodeMapping, ...(req.body?.nodeMapping || {}) };
    const workflowsDir = getWorkflowsDir();
    const workflowPath = path.join(workflowsDir, filename);
    const configPath = workflowPath.replace(/\.json$/, '.config.json');

    if (!overwrite && fs.existsSync(workflowPath)) {
      return res.status(409).json({ success: false, error: 'Un workflow portant ce nom existe déjà.' });
    }

    fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
    fs.writeFileSync(configPath, JSON.stringify({ nodeMapping }, null, 2), 'utf8');
    res.status(201).json({ success: true, filename, analysis: { ...analysis, nodeMapping } });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Import impossible' });
  }
});

router.post('/workflows/test', authenticate, async (req, res) => {
  try {
    const filename = sanitizeWorkflowFilename(String(req.body?.filename || ''));
    const targetUrl = getTargetComfyUrl(req.body?.comfyUrl);
    const prompt = String(req.body?.prompt || 'A simple test image');
    const workflow = getWorkflow(prompt, {
      workflowFile: filename,
      comfyModel: req.body?.comfyModel,
      negativePrompt: req.body?.negativePrompt || '',
      width: Number(req.body?.width) || 512,
      height: Number(req.body?.height) || 512,
      steps: Number(req.body?.steps) || 4,
      cfg: Number(req.body?.cfg) || 1,
      seed: Number.isFinite(Number(req.body?.seed)) ? Number(req.body.seed) : 1,
      sampler: req.body?.sampler,
      scheduler: req.body?.scheduler,
    });
    const response = await axios.post(`${targetUrl}/prompt`, {
      prompt: workflow,
      client_id: randomUUID(),
    }, { timeout: 10000 });
    res.json({ success: true, promptId: response.data?.prompt_id, number: response.data?.number });
  } catch (error: any) {
    if (error instanceof ServiceUrlError) return res.status(error.statusCode).json({ success: false, error: error.message });
    res.status(400).json({ success: false, error: parseComfyError(error) });
  }
});

router.get('/:userId/:filename', authenticate, (req, res) => {
  const userId = getRouteParam(req.params.userId);
  const filename = getRouteParam(req.params.filename);
  if (!canAccessUserFiles(req, userId)) return res.status(403).send('Forbidden');
  const userImagesDir = path.join(imagesDir, userId);
  return sendFileIfInside(res, userImagesDir, path.join(userImagesDir, filename));
});

router.get('/:filename', authenticate, (req, res) => {
  return sendFileIfInside(res, imagesDir, path.join(imagesDir, getRouteParam(req.params.filename)));
});

export default router;
