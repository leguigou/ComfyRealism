import express from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { getEffectiveComfyUrl, parseComfyError } from '../services/comfy';

const router = express.Router();

router.post('/check', authenticate, async (req, res) => {
  try {
    const currentCfg = getEffectiveComfyUrl();
    const response = await axios.get(`${req.body.comfyUrl || currentCfg.url}/system_stats`, { timeout: 3000 });
    res.json({ success: true, stats: response.data });
  } catch (error: any) { 
    res.status(500).json({ success: false, error: 'ComfyUI connection failed: ' + parseComfyError(error) }); 
  }
});

router.post('/models', authenticate, async (req, res) => {
  try {
    const currentCfg = getEffectiveComfyUrl();
    const targetUrl = req.body.comfyUrl || currentCfg.url;
    const response = await axios.get(`${targetUrl}/models/checkpoints`, { timeout: 5000 });
    if (Array.isArray(response.data)) { 
      res.json({ models: response.data.sort() }); 
    } else {
      const infoResp = await axios.get(`${targetUrl}/object_info`, { timeout: 5000 });
      const checkpoints = infoResp.data["CheckpointLoaderSimple"]?.input?.required?.ckpt_name?.[0] || [];
      res.json({ models: checkpoints.sort() });
    }
  } catch (error: any) { 
    res.status(500).json({ error: 'Failed to fetch models from ComfyUI: ' + error.message }); 
  }
});

export default router;
