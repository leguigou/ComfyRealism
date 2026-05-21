import fs from 'fs';
import path from 'path';
import db from './database';

export const getComfyWsUrl = (httpUrl: string) => {
  return httpUrl.replace(/^http/, 'ws') + '/ws';
};

export const getEffectiveComfyUrl = () => {
  if (process.env.COMFY_URL) {
    return { url: process.env.COMFY_URL, source: 'Environment' };
  }
  try {
    const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
    if (settings) {
      const data = JSON.parse(settings.data);
      if (data.comfyUrl) return { url: data.comfyUrl, source: 'Database' };
    }
  } catch (e) {}
  return { url: 'http://127.0.0.1:8188', source: 'Default' };
};

export const getWorkflow = (prompt: string, params?: any) => {
  const workflowFile = params?.workflowFile || 'workflow_lcm.json';
  const fullPath = path.join(__dirname, '..', '..', 'workflows', workflowFile);
  const configPath = fullPath.replace('.json', '.config.json');
  
  if (!fs.existsSync(fullPath)) throw new Error(`Fichier workflow introuvable : ${workflowFile}`);
  
  const workflow = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  let nodes = { checkpoint: "1", positive: "3", negative: "4", ksampler: "10", latent: "6", save: "99" };
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.nodeMapping) nodes = { ...nodes, ...config.nodeMapping };
    } catch (e) { console.warn(`[Workflow] Failed to parse config for ${workflowFile}`); }
  }

  if (workflow[nodes.checkpoint]?.inputs && params?.comfyModel) workflow[nodes.checkpoint].inputs.ckpt_name = params.comfyModel;
  if (workflow[nodes.positive]?.inputs) workflow[nodes.positive].inputs.text = prompt;
  if (workflow[nodes.negative]?.inputs && params?.negativePrompt) workflow[nodes.negative].inputs.text = params.negativePrompt;
  
  if (workflow[nodes.ksampler]?.inputs) {
    workflow[nodes.ksampler].inputs.seed = params?.seed || Math.floor(Math.random() * 1000000000000000);
    if (params) {
      if (params.steps) workflow[nodes.ksampler].inputs.steps = params.steps;
      if (params.cfg) workflow[nodes.ksampler].inputs.cfg = params.cfg;
    }
  }

  if (workflow[nodes.latent]?.inputs && params) {
    if (workflow[nodes.latent].class_type !== 'SDXLEmptyLatentSizePicker+') {
      if (params.width) workflow[nodes.latent].inputs.width = params.width;
      if (params.height) workflow[nodes.latent].inputs.height = params.height;
    }
  }

  if (workflow[nodes.save]?.inputs) workflow[nodes.save].inputs.filename_prefix = "ComfyRealism";
  return workflow;
};

export const parseComfyError = (error: any) => {
  if (error.response?.data?.error?.message) {
    let msg = error.response.data.error.message;
    if (error.response.data.error.details) msg += ` (${error.response.data.error.details})`;
    return msg;
  }
  if (error.response?.data?.node_errors) {
    const nodes = Object.keys(error.response.data.node_errors);
    const node = nodes[0];
    const err = error.response.data.node_errors[node].errors[0];
    return `Node ${node} (${error.response.data.node_errors[node].class_type}): ${err.message}${err.details ? ' - ' + err.details : ''}`;
  }
  if (error.message?.includes('ECONNREFUSED')) return 'ComfyUI is unreachable. Please check settings.';
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) return 'ComfyUI request timed out (possible GPU overload or hang).';
  return error.message || 'Unknown server error';
};
