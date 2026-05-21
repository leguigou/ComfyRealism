export interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  prompt?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  model?: string;
  workflow?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  timestamp: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  isEnhancing?: boolean;
  duration?: number;
  isFavorite?: number;
}

export interface GalleryItem {
  sessionId: string;
  messageId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  text?: string;
  timestamp: number;
  model?: string;
  workflow?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  duration?: number;
  isFavorite?: number;
}

export interface NodeMapping {
  checkpoint: string;
  positive: string;
  negative: string;
  ksampler: string;
  latent: string;
  save: string;
}

export interface GenParameters {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  comfyUrl: string;
  comfyModel: string;
  llmUrl: string;
  llmModel: string;
  llmSystemMessage: string;
  negativePrompt: string;
  llmEnabled: boolean;
  workflowFile: string;
  nodeMapping: NodeMapping;
}

export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  isArchived?: number;
}

export type Theme = 'light' | 'dark';
export type Language = 'fr' | 'en';

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  imageCount?: number;
  diskUsage?: number;
}
