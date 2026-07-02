import express from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { getTargetComfyUrl, parseComfyError } from '../services/comfy';
import { ServiceUrlError } from '../security/service-url';

const router = express.Router();

router.post('/check', authenticate, async (req, res) => {
  try {
    const targetUrl = getTargetComfyUrl(req.body.comfyUrl);
    const response = await axios.get(`${targetUrl}/system_stats`, { timeout: 3000 });
    res.json({ success: true, stats: response.data });
  } catch (error: any) {
    if (error instanceof ServiceUrlError) return res.status(error.statusCode).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: 'ComfyUI connection failed: ' + parseComfyError(error) }); 
  }
});

router.post('/models', authenticate, async (req, res) => {
  try {
    const targetUrl = getTargetComfyUrl(req.body.comfyUrl);
    const response = await axios.get(`${targetUrl}/models/checkpoints`, { timeout: 5000 });
    if (Array.isArray(response.data)) { 
      res.json({ models: response.data.sort() }); 
    } else {
      const infoResp = await axios.get(`${targetUrl}/object_info`, { timeout: 5000 });
      const checkpoints = infoResp.data["CheckpointLoaderSimple"]?.input?.required?.ckpt_name?.[0] || [];
      res.json({ models: checkpoints.sort() });
    }
  } catch (error: any) {
    if (error instanceof ServiceUrlError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to fetch models from ComfyUI: ' + error.message }); 
  }
});

export default router;
