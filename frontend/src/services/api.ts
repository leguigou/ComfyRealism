export const getApiBase = () => {
  // 1. Priority: Environment variable
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const { protocol, hostname, port } = window.location;

  // 2. Production Path Routing
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && (!port || port === '80' || port === '443')) {
    return `${protocol}//${hostname}`;
  }

  // 3. Fallback for local development
  if (port === '5173' || port === '5174' || !port) {
    return `${protocol}//${hostname}:3001`;
  }
  
  // 4. Smart mapping for external access
  if (port.endsWith('00') && port.length >= 5) {
    const apiPort = (parseInt(port) + 1).toString();
    return `${protocol}//${hostname}:${apiPort}`;
  }

  return `${protocol}//${hostname}:3001`;
};

export const API_BASE = getApiBase();

export const formatDuration = (seconds: number | undefined) => {
  if (seconds === undefined || seconds === null) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s.toString().padStart(2, '0')}s`;
};

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFullImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
};
