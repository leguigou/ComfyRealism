import fs from 'fs';
import path from 'path';
import db from './database';
import { GenerationParams, WorkflowNodeMapping } from '../types';

export const getComfyWsUrl = (httpUrl: string) => {
  return httpUrl.replace(/^http/, 'ws') + '/ws';
};

interface ComfyUrlResult {
  url: string;
  source: 'Environment' | 'Database' | 'Default';
}

export const getEffectiveComfyUrl = (): ComfyUrlResult => {
  if (process.env.COMFY_URL) {
    return { url: process.env.COMFY_URL, source: 'Environment' };
  }
  try {
    const settings = db.prepare('SELECT data FROM settings WHERE id = 1').get() as { data: string } | undefined;
    if (settings) {
      const data: { comfyUrl?: string } = JSON.parse(settings.data);
      if (data.comfyUrl) return { url: data.comfyUrl, source: 'Database' };
    }
  } catch {
    // settings table might not exist yet
  }
  return { url: 'http://127.0.0.1:8188', source: 'Default' };
};

export const getWorkflow = (prompt: string, params?: Partial<GenerationParams>) => {
  const workflowFile = params?.workflowFile || 'workflow_lcm.json';
  const backendDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const fullPath = path.join(backendDir, 'workflows', workflowFile);
  const configPath = fullPath.replace('.json', '.config.json');
  
  if (!fs.existsSync(fullPath)) throw new Error(`Fichier workflow introuvable : ${workflowFile}`);
  
  const workflow: Record<string, any> = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const nodes: WorkflowNodeMapping = { checkpoint: "1", positive: "3", negative: "4", ksampler: "10", latent: "6", save: "99" };
  
  if (fs.existsSync(configPath)) {
    try {
      const config: { nodeMapping?: WorkflowNodeMapping } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.nodeMapping) Object.assign(nodes, config.nodeMapping);
    } catch {
      console.warn(`[Workflow] Failed to parse config for ${workflowFile}`);
    }
  }

  if (workflow[nodes.checkpoint!]?.inputs && params?.comfyModel) {
    workflow[nodes.checkpoint!].inputs.ckpt_name = params.comfyModel;
  }
  if (workflow[nodes.positive!]?.inputs) {
    workflow[nodes.positive!].inputs.text = prompt;
  }
  if (workflow[nodes.negative!]?.inputs && params?.negativePrompt) {
    workflow[nodes.negative!].inputs.text = params.negativePrompt;
  }
  
  if (workflow[nodes.ksampler!]?.inputs) {
    workflow[nodes.ksampler!].inputs.seed = params?.seed ?? Math.floor(Math.random() * 1000000000000000);
    if (params) {
      if (params.steps) workflow[nodes.ksampler!].inputs.steps = params.steps;
      if (params.cfg) workflow[nodes.ksampler!].inputs.cfg = params.cfg;
      if (params.sampler) workflow[nodes.ksampler!].inputs.sampler_name = params.sampler;
      if (params.scheduler) workflow[nodes.ksampler!].inputs.scheduler = params.scheduler;
    }
  }

  if (workflow[nodes.latent!]?.inputs && params) {
    if (workflow[nodes.latent!].class_type !== 'SDXLEmptyLatentSizePicker+') {
      if (params.width) workflow[nodes.latent!].inputs.width = params.width;
      if (params.height) workflow[nodes.latent!].inputs.height = params.height;
    }
  }

  if (workflow[nodes.save!]?.inputs) {
    workflow[nodes.save!].inputs.filename_prefix = "ComfyRealism";
  }
  return workflow;
};

export const parseComfyError = (error: unknown): string => {
  const err = error as Record<string, any>;
  if (err?.response?.data?.error?.message) {
    let msg = err.response.data.error.message;
    if (err.response.data.error.details) msg += ` (${err.response.data.error.details})`;
    return msg;
  }
  if (err?.response?.data?.node_errors) {
    const nodes = Object.keys(err.response.data.node_errors);
    const node = nodes[0];
    const nodeErr = err.response.data.node_errors[node].errors[0];
    return `Node ${node} (${err.response.data.node_errors[node].class_type}): ${nodeErr.message}${nodeErr.details ? ' - ' + nodeErr.details : ''}`;
  }
  if ((err?.message as string | undefined)?.includes('ECONNREFUSED')) return 'ComfyUI is unreachable. Please check settings.';
  if (err?.code === 'ETIMEDOUT' || (err?.message as string | undefined)?.includes('timeout')) return 'ComfyUI request timed out (possible GPU overload or hang).';
  return (err?.message as string) || 'Unknown server error';
};
