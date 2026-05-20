import { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import devLogsUrl from '../../DEVELOPMENT_LOGS.md?url';
import './App.css';
import { translations } from './i18n';
import type { Language } from './i18n';

interface Message {
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

interface GalleryItem {
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

interface NodeMapping {
  checkpoint: string;
  positive: string;
  negative: string;
  ksampler: string;
  latent: string;
  save: string;
}

interface GenParameters {
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

interface Session {
  id: string;
  title: string;
  updatedAt: number;
  isArchived?: number;
}

type Theme = 'light' | 'dark';

const getApiBase = () => {
  // 1. Priority: Environment variable
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const { protocol, hostname, port } = window.location;

  // 2. Production Path Routing (Solution B)
  // If we are not on localhost or a known dev port, we use the root domain
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && (!port || port === '80' || port === '443')) {
    return `${protocol}//${hostname}`;
  }

  // 3. Fallback for local development
  if (port === '5173' || port === '5174' || !port) {
    return `${protocol}//${hostname}:3001`;
  }
  
  // 4. Smart mapping for external access (e.g. 55200 -> 55201, 55300 -> 55301)
  if (port.endsWith('00') && port.length >= 5) {
    const apiPort = (parseInt(port) + 1).toString();
    return `${protocol}//${hostname}:${apiPort}`;
  }

  return `${protocol}//${hostname}:3001`;
};

const formatDuration = (seconds: number | undefined) => {
  if (seconds === undefined || seconds === null) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s.toString().padStart(2, '0')}s`;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const API_BASE = getApiBase();
console.log(`[App] API Base URL: ${API_BASE}`);

const MessageText = memo(({ text, lang }: { text: string, lang: Language }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = translations[lang];
  const threshold = 150;
  const isLong = text.length > threshold;

  if (!isLong) return <p className="message-text">{text}</p>;

  return (
    <div className="message-text-container">
      <p className={`message-text ${!isExpanded ? 'truncated' : ''}`}>
        {isExpanded ? text : `${text.substring(0, threshold)}...`}
      </p>
      <button className="read-more-btn" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? t.readLess : t.readMore}
      </button>
    </div>
  );
});

const MarkdownLoader = ({ url }: { url: string }) => {
  const [content, setContent] = useState('');
  useEffect(() => {
    fetch(url).then(res => res.text()).then(setContent).catch(err => console.error('Error loading markdown:', err));
  }, [url]);
  return <ReactMarkdown>{content}</ReactMarkdown>;
};

const WelcomeScreen = ({ lang }: { lang: Language }) => {
  const t = translations[lang];
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C12 0 12.6315 5.63158 15.4358 8.43579C18.24 11.24 24 12 24 12C24 12 18.24 12.76 15.4358 15.5642C12.6315 18.3684 12 24 12 24C12 24 11.3684 18.3684 8.56421 15.5642C5.76 12.76 0 12 0 12C0 12 5.76 11.24 8.56421 8.43579C11.3684 5.63158 12 0 12 0Z" fill="url(#gemini-gradient)"/>
          <defs>
            <linearGradient id="gemini-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4285F4"/>
              <stop offset="0.33" stopColor="#EA4335"/>
              <stop offset="0.66" stopColor="#FBBC05"/>
              <stop offset="1" stopColor="#34A853"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1>{t.welcomeText}</h1>
    </div>
  );
};

function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'fr';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });
  const t = translations[lang];

  const getFullImageUrl = useCallback((url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<{username: string, isAdmin: boolean} | null>(null);
  const [loginError, setLoginError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'comfy' | 'llm' | 'archives' | 'logs' | 'admin'>('images');
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const enhancingCount = useRef(0);

  // Derived state for isGenerating: true if any bot message is pending or processing, or if enhancing
  const isGenerating = isEnhancing || messages.some(m => m.role === 'bot' && (m.status === 'pending' || m.status === 'processing'));
  const [activeLightbox, setActiveLightbox] = useState<{
    url: string;
    sessionId: string;
    messageId: string;
    source: 'chat' | 'gallery';
  } | null>(null);

  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', isAdmin: false });
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  
  const [view, setView] = useState<'chat' | 'gallery' | 'archives'>('chat');

  const fetchAdminUsers = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/api/users`, { credentials: 'include' });
      const data = await res.json();
      setAdminUsers(data);
    } catch (err) { console.error('Error fetching users:', err); }
  }, [currentUser]);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    setIsAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
        credentials: 'include'
      });
      if (res.ok) {
        setNewUser({ username: '', password: '', isAdmin: false });
        fetchAdminUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add user');
      }
    } catch (err) { console.error('Error adding user:', err); }
    finally { setIsAdminLoading(false); }
  };

  const deleteUser = async (id: string) => {
    if (!confirm(t.confirmDeleteUser)) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) fetchAdminUsers();
    } catch (err) { console.error('Error deleting user:', err); }
  };

  const handleResetPassword = async (id: string) => {
    if (!newPasswordValue.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPasswordValue.trim() }),
        credentials: 'include'
      });
      if (res.ok) {
        alert(lang === 'fr' ? 'Mot de passe mis à jour !' : 'Password updated successfully!');
        setResetPasswordId(null);
        setNewPasswordValue('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update password');
      }
    } catch (err) { console.error('Error resetting password:', err); }
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAdminUsers();
    }
  }, [activeTab, fetchAdminUsers]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryOffset, setGalleryOffset] = useState(0);
  const [hasMoreGallery, setHasMoreGallery] = useState(true);
  const [isFetchingGallery, setIsFetchingGallery] = useState(false);
  const [showArchivedInGallery, setShowArchivedInGallery] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [favoritedId, setFavoritedId] = useState<string | null>(null);
  const clickTimeoutRef = useRef<any>(null);

  const handleImageClick = (item: { url: string, sessionId: string, messageId: string, isFavorite?: number, source: 'chat' | 'gallery' }) => {
    if (clickTimeoutRef.current) {
      // Double click detected
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      
      // Toggle favorite behavior for double tap
      toggleFavorite(item.sessionId, item.messageId, item.isFavorite);
    } else {
      // Potential single click
      clickTimeoutRef.current = setTimeout(() => {
        setActiveLightbox({ url: item.url, sessionId: item.sessionId, messageId: item.messageId, source: item.source });
        clickTimeoutRef.current = null;
      }, 350);
    }
  };

  const handleLightboxImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLightbox) return;

    if (clickTimeoutRef.current) {
      // Double click detected in lightbox
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      
      const currentItem = activeLightbox.source === 'chat' 
        ? messages.find(m => m.id === activeLightbox.messageId)
        : galleryItems.find(m => m.messageId === activeLightbox.messageId);
        
      toggleFavorite(activeLightbox.sessionId, activeLightbox.messageId, currentItem?.isFavorite);
    } else {
      // Potential single click (do nothing but wait for potential double click)
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
      }, 350);
    }
  };

  const toggleFavorite = async (sessionId: string, messageId: string, currentStatus: number | undefined) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    
    // Trigger animation if becoming favorite
    if (newStatus === 1) {
      setFavoritedId(messageId);
      setTimeout(() => setFavoritedId(null), 800);
    }

    try {
      const res = await fetch(`${API_BASE}/api/history/${sessionId}/message/${messageId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        // Update messages state if we are in chat view
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isFavorite: newStatus } : m));
        // Update galleryItems state
        setGalleryItems(prev => prev.map(m => m.messageId === messageId ? { ...m, isFavorite: newStatus } : m));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };
  
  const [params, setParams] = useState<GenParameters>(() => {
    return { 
      width: 896, 
      height: 1152, 
      steps: 8, 
      cfg: 1.1,
      comfyUrl: 'http://127.0.0.1:8188',
      comfyModel: 'dirtyRealism_DMDSAT.safetensors',
      llmUrl: '',
      llmModel: 'llama3:latest',      llmSystemMessage: "You are a professional stable diffusion prompt engineer. Transform the user's brief idea into a highly detailed, descriptive, and artistic prompt in ENGLISH. Also generate a negative prompt of things to avoid. Output your response as a JSON object with two keys: 'positive' and 'negative'. No other text.",
      negativePrompt: "low quality, bad anatomy, malformed, extra limbs, extra fingers, fused fingers, bad hands, poorly drawn hands, missing fingers, fused face, poorly drawn face, asymmetrical, cartoon, anime, 3d, render, watermark, text, logo, swept hair, portrait",
      llmEnabled: false,
      workflowFile: 'workflow_lcm.json',
      nodeMapping: { checkpoint: "1", positive: "3", negative: "4", ksampler: "10", latent: "6", save: "99" }
    };
  });

  const [comfyModels, setComfyModels] = useState<string[]>([]);
  const [isFetchingComfyModels, setIsFetchingComfyModels] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [comfyCheckStatus, setComfyCheckStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isCheckingComfy, setIsCheckingComfy] = useState(false);
  const [llmCheckStatus, setLlmCheckStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isCheckingLLM, setIsCheckingLLM] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<string[]>([]);

  const testLLMConnection = async () => {
    setIsCheckingLLM(true);
    setLlmCheckStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/llm-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmUrl: params.llmUrl }),
        credentials: 'include'
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (data.success) {
          setLlmCheckStatus({ type: 'success', msg: t.connectionSuccess });
        } else {
          setLlmCheckStatus({ type: 'error', msg: data.error || t.connectionFailed });
        }
      } else {
        setLlmCheckStatus({ type: 'error', msg: `${t.connectionFailed} (Server error: ${res.status})` });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLlmCheckStatus({ type: 'error', msg: t.connectionFailed + ': ' + message });
    } finally {
      setIsCheckingLLM(false);
    }
  };

  const testComfyConnection = async () => {
    setIsCheckingComfy(true);
    setComfyCheckStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/comfy-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comfyUrl: params.comfyUrl }),
        credentials: 'include'
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await res.json();
        if (data.success) {
          setComfyCheckStatus({ type: 'success', msg: t.connectionSuccess });
        } else {
          setComfyCheckStatus({ type: 'error', msg: data.error || t.connectionFailed });
        }
      } else {
        const text = await res.text();
        console.error('Server returned non-JSON response:', text);
        setComfyCheckStatus({ type: 'error', msg: `${t.connectionFailed} (Server error: ${res.status})` });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setComfyCheckStatus({ type: 'error', msg: t.connectionFailed + ': ' + message });
    } finally {
      setIsCheckingComfy(false);
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [backendError, setBackendError] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollTop = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const url = view === 'archives' ? `${API_BASE}/api/history/archives` : `${API_BASE}/api/history`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setSessions(data);
      setBackendError(false);
      if (data.length > 0 && view !== 'archives') {
        setCurrentSessionId(prev => prev || data[0].id);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setBackendError(true);
    }
  }, [view]);

  const fetchComfyModels = useCallback(async () => {
    setIsFetchingComfyModels(true);
    setComfyStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/comfy-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comfyUrl: params.comfyUrl }),
        credentials: 'include'
      });      const data = await res.json();
      if (data.models) {
        setComfyModels(data.models);
        setComfyStatus({ type: 'success', msg: `${data.models.length} ${t.modelsFound}` });
        setParams(p => {
          if (data.models.length > 0 && !data.models.includes(p.comfyModel)) {
            return { ...p, comfyModel: data.models[0] };
          }
          return p;
        });
      } else {
        setComfyStatus({ type: 'error', msg: data.error || 'Erreur inconnue' });
      }
    } catch (err: unknown) { 
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setComfyStatus({ type: 'error', msg: 'Scan échoué : ' + message });
    } finally {
      setIsFetchingComfyModels(false);
    }
  }, [params.comfyUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows`, { credentials: 'include' });
      const data = await res.json();
      setAvailableWorkflows(data);
    } catch (err) { console.error('Error fetching workflows:', err); }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const st = containerRef.current.scrollTop;
    if (st > lastScrollTop.current && st > 50) {
      setShowHeader(false);
    } else {
      setShowHeader(true);
    }
    lastScrollTop.current = st <= 0 ? 0 : st;
  }, []);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [massActionType, setMassActionType] = useState<'archiveAll' | 'deleteAll' | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clientId = useRef<string>('');

  const smoothScrollTo = useCallback((elementId: string) => {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (!el || !containerRef.current) return;
      
      const container = containerRef.current;
      // Calculate target position with some padding to ensure the whole message is visible
      const targetScroll = el.offsetTop - container.offsetTop - 40;
      const startScroll = container.scrollTop;
      const distance = targetScroll - startScroll;
      
      // If we are already very close, just use native smooth to avoid weird jumps
      if (Math.abs(distance) < 50) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const duration = 1200; // 1.2 seconds for a very soft, luxurious scroll
      let start: number | null = null;

      // Quartic easing in/out for a very smooth start and end
      const easeInOutQuart = (t: number, b: number, c: number, d: number) => {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t * t * t + b;
        t -= 2;
        return -c / 2 * (t * t * t * t - 2) + b;
      };

      const animation = (currentTime: number) => {
        if (start === null) start = currentTime;
        const timeElapsed = currentTime - start;
        const nextScroll = easeInOutQuart(timeElapsed, startScroll, distance, duration);
        
        container.scrollTop = nextScroll;
        
        if (timeElapsed < duration) {
          requestAnimationFrame(animation);
        } else {
          container.scrollTop = targetScroll;
        }
      };

      requestAnimationFrame(animation);
    }, 100);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLightbox(null);
      }
      
      if (activeLightbox && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (activeLightbox.source === 'chat') {
          const imageMessages = messages.filter(m => m.imageUrl);
          const currentIndex = imageMessages.findIndex(m => m.id === activeLightbox.messageId);
          
          if (currentIndex !== -1) {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
              const prev = imageMessages[currentIndex - 1];
              setActiveLightbox({ url: prev.imageUrl!, sessionId: currentSessionId!, messageId: prev.id, source: 'chat' });
            } else if (e.key === 'ArrowRight' && currentIndex < imageMessages.length - 1) {
              const next = imageMessages[currentIndex + 1];
              setActiveLightbox({ url: next.imageUrl!, sessionId: currentSessionId!, messageId: next.id, source: 'chat' });
            }
          }
        } else {
          const currentIndex = galleryItems.findIndex(m => m.messageId === activeLightbox.messageId);
          if (currentIndex !== -1) {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
              const prev = galleryItems[currentIndex - 1];
              setActiveLightbox({ url: prev.imageUrl, sessionId: prev.sessionId, messageId: prev.messageId, source: 'gallery' });
            } else if (e.key === 'ArrowRight' && currentIndex < galleryItems.length - 1) {
              const next = galleryItems[currentIndex + 1];
              setActiveLightbox({ url: next.imageUrl, sessionId: next.sessionId, messageId: next.messageId, source: 'gallery' });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightbox, messages, galleryItems, currentSessionId]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, { credentials: 'include' });
      const data = await res.json();
      if (data && data.width) {
        setParams(prev => ({ ...prev, ...data }));
      }
    } catch (err) { 
      console.error('Error fetching settings:', err);
    } finally {
      setIsSettingsLoaded(true);
    }
  }, []);

  const saveSettings = useCallback(async (newParams: GenParameters) => {
    if (!isSettingsLoaded) return;
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParams),
        credentials: 'include'
      });
    } catch (err) { console.error('Error saving settings:', err); }
  }, [isSettingsLoaded]);

  const createNewSession = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/history`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    setSessions(prev => [data, ...prev]);
    setCurrentSessionId(data.id);
    setMessages([]);
    setView('chat');
  }, []);

  const fetchSessionDetails = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/history/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch session details');
      const data = await res.json();
      if (data.messages) {
        setMessages(prev => {
          const newMessages = data.messages.map((newMsg: Message) => {
            const existingMsg = prev.find(m => m.id === newMsg.id);
            // Persistent duration: if local state has a duration and new data doesn't, keep local one
            if (existingMsg && existingMsg.duration !== undefined && (newMsg.duration === undefined || newMsg.duration === null)) {
              return { ...newMsg, duration: existingMsg.duration };
            }
            return newMsg;
          });
          return newMessages;
        });
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
    }
  }, []);

  // Auth Check
  useEffect(() => {
    if (isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSessions();
    }
  }, [view, isAuthenticated, fetchSessions]);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[Auth] Checking current authentication status...');
      try {
        const res = await fetch(`${API_BASE}/api/auth/check`, { credentials: 'include' });
        console.log(`[Auth] Check response status: ${res.status}`);
        const data = await res.json();
        console.log('[Auth] Check response data:', data);
        setIsAuthenticated(data.authenticated);
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.error('[Auth] Check failed:', err);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const currentSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // WebSocket Connection with Auto-reconnect
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const connectWebSocketRef = useRef<() => void>(() => {});

  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated) return;
    
    // Nettoyage avant nouvelle tentative
    if (wsRef.current) wsRef.current.close();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If API_BASE is just a domain (production), we need to add /api/ws
    // If it's a domain with a port (dev), we need to add /api/ws
    const wsBase = API_BASE.startsWith('http') ? API_BASE.replace(/^http/, 'ws') : `${wsProtocol}//${window.location.host}`;
    const wsUrl = `${wsBase}/api/ws`;

    console.log(`[WS] Connecting to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Synchroniser la session actuelle pour récupérer les mises à jour manquées pendant la déconnexion
      if (currentSessionIdRef.current) {
        fetchSessionDetails(currentSessionIdRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          console.log('Backend acknowledged connection:', data.clientId);
          clientId.current = data.clientId;
        } else if (data.type === 'queue_update') {
          console.log('Queue update received:', data);
          if (data.sessionId === currentSessionIdRef.current) {
            setMessages(prev => {
              return prev.map(m => {
                if (m.id === data.messageId) {
                  return { 
                    ...m, 
                    status: data.status, 
                    imageUrl: data.imageUrl ? `${API_BASE}${data.imageUrl}` : m.imageUrl,
                    thumbnailUrl: data.thumbnailUrl ? `${API_BASE}${data.thumbnailUrl}` : m.thumbnailUrl,
                    model: data.model || m.model,
                    width: data.width || m.width,
                    height: data.height || m.height,
                    steps: data.steps || m.steps,
                    cfg: data.cfg || m.cfg,
                    seed: data.seed || m.seed,
                    workflow: data.workflow || m.workflow,
                    duration: (data.duration !== undefined && data.duration !== null) ? data.duration : m.duration
                    };
                }
                return m;
              });
            });
          }
          if (data.status === 'completed') {
            fetchSessions();
          }
        }
      } catch (e) { console.error('WS parse error:', e); }
    };

    ws.onclose = (e) => {
      console.log('WebSocket closed, reconnecting in 3s...', e.reason);
      wsRef.current = null;
      // Reconnexion automatique après 3 secondes via le ref pour éviter l'erreur de déclaration
      reconnectTimeoutRef.current = window.setTimeout(() => connectWebSocketRef.current(), 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, [isAuthenticated, fetchSessions, fetchSessionDetails]);

  // Maintenir le ref à jour
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    if (isAuthenticated) {
      connectWebSocket();

      // Gestion de la visibilité pour mobile (réveil du téléphone)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.log('Tab visible, reconnecting WebSocket...');
            connectWebSocket();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [isAuthenticated, connectWebSocket]);

  useEffect(() => {
    if (isAuthenticated) {
      return () => {
        if (wsRef.current) wsRef.current.close();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      };
    }
  }, [isAuthenticated]);

  // Initial Data Fetching
  useEffect(() => {
    if (isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSessions();
      fetchComfyModels();
      fetchSettings();
      fetchWorkflows();
    }
    // Only run on auth change or when fetchers are redefined (which is now rare)
  }, [isAuthenticated, fetchSessions, fetchComfyModels, fetchSettings, fetchWorkflows]);

  // Auto-save settings
  useEffect(() => {
    if (isAuthenticated && isSettingsLoaded) {
      saveSettings(params);
    }
  }, [params, isAuthenticated, isSettingsLoaded, saveSettings]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  // Polling de secours (Hybrid safety for Mobile)
  useEffect(() => {
    let interval: number | undefined;
    
    if (isGenerating && currentSessionId) {
      // Si on est en train de générer, on vérifie toutes les 3s 
      // au cas où le WebSocket aurait manqué l'événement "completed" (fréquent sur mobile)
      interval = window.setInterval(() => {
        // Le polling est désactivé si on est en phase d'interprétation IA pour éviter les conflits d'ID
        if (!isEnhancing) {
          console.log('Safety poll check...');
          fetchSessionDetails(currentSessionId);
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, currentSessionId, fetchSessionDetails, isEnhancing]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoginError(false);
    const trimmedUsername = loginUsername.trim();
    const trimmedPassword = loginPassword.trim();
    const loginUrl = `${API_BASE}/api/auth/login`;

    if (!trimmedUsername || !trimmedPassword) return;

    console.log(`[Auth] Attempting login for ${trimmedUsername} at: ${loginUrl}`);

    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
        credentials: 'include'
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        console.log('[Auth] Login successful');
        setCurrentUser(data.user);
        setIsAuthenticated(true);
      } else {
        setLoginError(true);
        console.error(`[Auth] Login rejected. Status: ${res.status}`, data);
        alert(data.error || `Échec de connexion (Code: ${res.status}).\nIdentifiants incorrects.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Auth] Network error during login:', err);
      alert(`Erreur Réseau : Impossible de joindre l'API.\n\nURL tentée : ${loginUrl}\n\nDétails : ${message}\n\nAssurez-vous que le domaine de l'API est correct et que le certificat HTTPS est valide.`);
    }
  };
  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([]);
    setGalleryItems([]);
    setAdminUsers([]);
    setView('chat');
  };

  const renameSession = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return setRenamingId(null);
    try {
      const res = await fetch(`${API_BASE}/api/history/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
        credentials: 'include'
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
      }
    } catch (err) {
      console.error('Error renaming session:', err);
    } finally {
      setRenamingId(null);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessionToDelete(id);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      await fetch(`${API_BASE}/api/history/${sessionToDelete}`, { 
        method: 'DELETE', 
        credentials: 'include' 
      });
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      if (currentSessionId === sessionToDelete) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    } finally {
      setSessionToDelete(null);
    }
  };

  const toggleArchive = async (id: string, isArchived: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/history/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived }),
        credentials: 'include'
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        setSessionToDelete(null);
      }
    } catch (err) {
      console.error('Error archiving session:', err);
    }
  };

  const archiveAllSessions = async () => {
    await fetch(`${API_BASE}/api/history/archive-all`, { method: 'POST', credentials: 'include' });
    setMassActionType(null);
    fetchSessions();
  };

  const deleteAllActiveSessions = async () => {
    await fetch(`${API_BASE}/api/history/all/active`, { method: 'DELETE', credentials: 'include' });
    setMassActionType(null);
    fetchSessions();
  };

  const fetchGallery = useCallback(async (isInitial = false) => {
    if (isFetchingGallery || (!hasMoreGallery && !isInitial)) return;
    
    setIsFetchingGallery(true);
    const currentOffset = isInitial ? 0 : galleryOffset;
    
    try {
      // Use parameter explicitly to ensure fresh state access or handle via useEffect safely
      const res = await fetch(`${API_BASE}/api/gallery?limit=25&offset=${currentOffset}&includeArchived=${showArchivedInGallery}&favoritesOnly=${favoritesOnly}`, { credentials: 'include' });
      const data: GalleryItem[] = await res.json();
      
      if (isInitial) {
        setGalleryItems(data);
        setGalleryOffset(data.length);
      } else {
        setGalleryItems(prev => [...prev, ...data]);
        setGalleryOffset(prev => prev + data.length);
      }
      
      setHasMoreGallery(data.length === 25);
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setIsFetchingGallery(false);
    }
  }, [galleryOffset, hasMoreGallery, isFetchingGallery, showArchivedInGallery, favoritesOnly, getFullImageUrl]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastImageElementRef = useCallback((node: HTMLDivElement) => {
    if (isFetchingGallery) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreGallery) {
        fetchGallery();
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetchingGallery, hasMoreGallery, fetchGallery]);

  useEffect(() => {
    if (view === 'gallery') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchGallery(true);
    }
  }, [view, showArchivedInGallery, favoritesOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLLMModels = async () => {
    if (!params.llmUrl) return;
    setIsFetchingModels(true);
    setLlmStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/llm-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmUrl: params.llmUrl }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.models) {
        setLlmModels(data.models);
        setLlmStatus({ type: 'success', msg: `${data.models.length} ${t.modelsFound}` });
        if (data.models.length > 0 && !data.models.includes(params.llmModel)) {
          setParams(p => ({ ...p, llmModel: data.models[0] }));
        }
      } else {
        setLlmStatus({ type: 'error', msg: data.error || 'Erreur inconnue' });
      }
    } catch (err: unknown) { 
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setLlmStatus({ type: 'error', msg: 'Connexion échouée : ' + message });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const goToImage = (sessionId: string, messageId: string) => {
    setCurrentSessionId(sessionId);
    setView('chat');
    setTimeout(() => {
      const element = document.getElementById(`msg-${messageId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.classList.add('highlight-message');
      setTimeout(() => element?.classList.remove('highlight-message'), 2000);
    }, 500);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      if (input === '') {
        textarea.style.height = ''; // Réinitialise à la hauteur par défaut CSS (rows=1)
      } else {
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }
  }, [input]);

  const handleSend = useCallback(async (overrideInput?: string, isRegeneration = false) => {
    const promptToSend = overrideInput !== undefined ? overrideInput : input;
    if (!promptToSend.trim() || !currentSessionId) return;

    if (!isRegeneration) {
      const userMsg: Message = { id: Math.random().toString(36).substring(7), role: 'user', text: promptToSend, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
    }
    
    if (overrideInput === undefined) setInput('');
    
    try {
      let finalPrompt = promptToSend;
      let finalNegativePrompt = params.negativePrompt;
      const botMsgId = Math.random().toString(36).substring(7);

      // 1. Ajouter systématiquement une nouvelle bulle bot en état de chargement
      const initialBotMsg: Message = { 
        id: botMsgId, 
        role: 'bot', 
        text: promptToSend, // On commence avec le texte source
        prompt: promptToSend, 
        status: 'pending',
        isEnhancing: params.llmEnabled && !!params.llmUrl && !!params.llmModel && !isRegeneration,
        timestamp: Date.now(),
        model: params.comfyModel,
        workflow: params.workflowFile,
        width: params.width,
        height: params.height,
        steps: params.steps,
        cfg: params.cfg
      };
      setMessages(prev => [...prev, initialBotMsg]);
      setTimeout(() => smoothScrollTo(`msg-${botMsgId}`), 50);
      
      // 2. Interprétation IA si activée (uniquement si ce n'est PAS une régénération directe)
      if (params.llmEnabled && params.llmUrl && params.llmModel && !isRegeneration) {
        enhancingCount.current++;
        setIsEnhancing(true);
        try {
          const enhanceRes = await fetch(`${API_BASE}/api/enhance-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: promptToSend, 
              llmUrl: params.llmUrl, 
              llmModel: params.llmModel,
              systemMessage: params.llmSystemMessage
            }),
            credentials: 'include'
          });
          const enhanceData = await enhanceRes.json();
          if (enhanceData.enhancedPrompt) {
            finalPrompt = enhanceData.enhancedPrompt;
            if (enhanceData.negativePrompt) finalNegativePrompt = enhanceData.negativePrompt;
            // Mettre à jour la bulle bot avec le texte final optimisé
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: finalPrompt, isEnhancing: false } : m));
          } else {
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isEnhancing: false } : m));
          }
        } catch (err) { 
          console.error('Enhancement failed:', err); 
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isEnhancing: false } : m));
        }
        finally { 
          enhancingCount.current--;
          if (enhancingCount.current <= 0) setIsEnhancing(false);
        }
      }

      // 3. Lancer la génération réelle
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: finalPrompt, 
          originalPrompt: promptToSend,
          sessionId: currentSessionId,
          clientId: clientId.current,
          isRegeneration: isRegeneration,
          params: { 
            ...params, 
            negativePrompt: finalNegativePrompt,
            workflowFile: params.workflowFile,
            nodeMapping: params.nodeMapping
          }
        }),
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        // Synchroniser avec l'ID réel du backend
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, id: data.messageId } : m));
        fetchSessions(); 
      } else throw new Error(data.error || 'Unknown error');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, { id: Math.random().toString(36).substring(7), role: 'bot', text: `Error: ${message}`, timestamp: Date.now() }]);
    }
  }, [input, currentSessionId, fetchSessions, params]);

  const handleEdit = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, []);

  const interruptGeneration = async () => {
    try {
      await fetch(`${API_BASE}/api/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
        credentials: 'include'
      });
    } catch (err) { console.error('Failed to interrupt:', err); }
  };

  useEffect(() => {
    if (currentSessionId && isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSessionDetails(currentSessionId);
    }
  }, [currentSessionId, fetchSessionDetails, isAuthenticated]);

  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  const deleteMessage = async (messageId: string) => {
    if (!currentSessionId) return;
    await fetch(`${API_BASE}/api/history/${currentSessionId}/message/${messageId}`, { method: 'DELETE', credentials: 'include' });
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setMessageToDelete(null);
  };

  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (activeLightbox && (isLeftSwipe || isRightSwipe)) {
      if (activeLightbox.source === 'chat') {
        const imageMessages = messages.filter(m => m.imageUrl);
        const currentIndex = imageMessages.findIndex(m => m.id === activeLightbox.messageId);
        
        if (currentIndex !== -1) {
          if (isLeftSwipe && currentIndex < imageMessages.length - 1) {
            const next = imageMessages[currentIndex + 1];
            setActiveLightbox({ url: next.imageUrl!, sessionId: currentSessionId!, messageId: next.id, source: 'chat' });
          } else if (isRightSwipe && currentIndex > 0) {
            const prev = imageMessages[currentIndex - 1];
            setActiveLightbox({ url: prev.imageUrl!, sessionId: currentSessionId!, messageId: prev.id, source: 'chat' });
          }
        }
      } else {
        const currentIndex = galleryItems.findIndex(m => m.messageId === activeLightbox.messageId);
        if (currentIndex !== -1) {
          if (isLeftSwipe && currentIndex < galleryItems.length - 1) {
            const next = galleryItems[currentIndex + 1];
            setActiveLightbox({ url: next.imageUrl, sessionId: next.sessionId, messageId: next.messageId, source: 'gallery' });
          } else if (isRightSwipe && currentIndex > 0) {
            const prev = galleryItems[currentIndex - 1];
            setActiveLightbox({ url: prev.imageUrl, sessionId: prev.sessionId, messageId: prev.messageId, source: 'gallery' });
          }
        }
      }
    }
    touchStart.current = null;
    touchEnd.current = null;
  };

  const downloadImage = async (url: string, filename: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#0b0e11', 
        color: '#10a37f',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="bounced-loader">
          <div className="bounce1"></div>
          <div className="bounce2"></div>
          <div className="bounce3"></div>
        </div>
        <div>Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={`login-screen ${theme}`}>
        <div className="theme-toggle-corner">
          <button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-header">
            <div className="login-icon">✨</div>
            <h1>{t.title}</h1>
            <p className="login-subtitle">Connectez-vous pour commencer à créer</p>
          </div>
          <div className="input-group">
            <label>{t.username}</label>
            <input type="text" autoFocus value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className={loginError ? 'error' : ''} placeholder="admin" />
          </div>
          <div className="input-group">
            <label>{t.password}</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={loginError ? 'error' : ''} placeholder="••••••••" />
            {loginError && <p className="error-msg">{t.incorrectLogin}</p>}
          </div>
          <button type="submit">{t.login}</button>
        </form>
      </div>
    );
  }

  const currentLightboxItem = activeLightbox ? (
    activeLightbox.source === 'chat' 
      ? messages.find(m => m.id === activeLightbox.messageId)
      : galleryItems.find(m => m.messageId === activeLightbox.messageId)
  ) : null;

  return (
    <div className={`app-layout ${theme}`}>
      {activeLightbox && (
        <div 
          className="lightbox" 
          onClick={() => setActiveLightbox(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="lightbox-content" onClick={handleLightboxImageClick}>
            <img src={getFullImageUrl(activeLightbox.url)} alt="Fullscreen" />
            {favoritedId === activeLightbox.messageId && <div className="image-overlay-heart" style={{ fontSize: '8rem' }}>❤️</div>}
          </div>
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-btn go-to-chat" onClick={() => { goToImage(activeLightbox.sessionId, activeLightbox.messageId); setActiveLightbox(null); }} title={t.viewInChat}>
              💬
            </button>
            <button 
              className={`lightbox-btn favorite ${currentLightboxItem?.isFavorite ? 'active' : ''}`} 
              onClick={(e) => { e.stopPropagation(); toggleFavorite(activeLightbox.sessionId, activeLightbox.messageId, currentLightboxItem?.isFavorite); }}
              title={t.favorites}
            >
              {currentLightboxItem?.isFavorite ? '❤️' : '🤍'}
            </button>
            <button className="lightbox-btn edit" onClick={() => { 
              if (currentLightboxItem) {
                handleEdit(currentLightboxItem.text || currentLightboxItem.prompt || '');
                setActiveLightbox(null);
              }
            }} title={t.edit}>
              ✎
            </button>
            <button className="lightbox-btn download" onClick={() => downloadImage(getFullImageUrl(activeLightbox.url), `img-${activeLightbox.messageId}.png`)} title="Télécharger">
              💾
            </button>
            <button className="lightbox-btn close" onClick={() => setActiveLightbox(null)}>×</button>
          </div>
        </div>
      )}

      {messageToDelete && (
        <div className="settings-modal-overlay" onClick={() => setMessageToDelete(null)}>
          <div className="settings-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t.confirmDelete}</h3>
            <div className="confirm-buttons">
              <button className="confirm-btn delete" onClick={() => deleteMessage(messageToDelete)}>{t.confirm}</button>
              <button className="confirm-btn cancel" onClick={() => setMessageToDelete(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <button className="settings-close-btn" onClick={() => setShowSettings(false)}>×</button>
            <h3>{t.settings}</h3>            
            <div className="settings-tabs">
              <button className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>{t.tabImages}</button>
              <button className={`tab-btn ${activeTab === 'comfy' ? 'active' : ''}`} onClick={() => setActiveTab('comfy')}>{t.tabComfy}</button>
              <button className={`tab-btn ${activeTab === 'llm' ? 'active' : ''}`} onClick={() => setActiveTab('llm')}>{t.tabLLM}</button>
              <button className={`tab-btn ${activeTab === 'archives' ? 'active' : ''}`} onClick={() => setActiveTab('archives')}>{t.tabArchives}</button>
              <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>{t.tabLogs}</button>
              {currentUser?.isAdmin && (
                <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>{t.tabAdmin}</button>
              )}

            </div>

            <div className="tab-content">
              {activeTab === 'logs' && (
               <div className="settings-grid">
                 <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                   <label>{t.currentVersion}</label>
                   <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '1rem' }}>v.1.2.65</div>                   <label>{t.devLogs}</label>
                   <div className="logs-container" style={{
                     background: 'rgba(0,0,0,0.2)',
                     padding: '1rem',
                     borderRadius: '8px',
                     maxHeight: '400px',
                     overflowY: 'auto',
                     fontSize: '0.85rem',
                     lineHeight: '1.4',
                     fontFamily: 'inherit'
                   }}>
                     <div className="markdown-logs">
                       <MarkdownLoader url={devLogsUrl} />
                     </div>
                   </div>
                 </div>
               </div>
              )}
              {activeTab === 'images' && (
                <>
                  <div className="settings-grid">
                    <div className="setting-item">
                      <label>{t.width}</label>
                      <input type="number" value={params.width} onChange={(e) => setParams({ ...params, width: Number(e.target.value) })} step={64} />
                    </div>
                    <div className="setting-item">
                      <label>{t.height}</label>
                      <input type="number" value={params.height} onChange={(e) => setParams({ ...params, height: Number(e.target.value) })} step={64} />
                    </div>
                  </div>
                  <div className="format-presets">
                    <button className={`preset-btn ${params.width === 1024 && params.height === 1024 ? 'active' : ''}`} onClick={() => setParams({ ...params, width: 1024, height: 1024 })}>1:1 {t.square}</button>
                    <button className={`preset-btn ${params.width === 1216 && params.height === 832 ? 'active' : ''}`} onClick={() => setParams({ ...params, width: 1216, height: 832 })}>3:2 {t.landscape}</button>
                    <button className={`preset-btn ${params.width === 896 && params.height === 1152 ? 'active' : ''}`} onClick={() => setParams({ ...params, width: 896, height: 1152 })}>2:3 {t.portrait}</button>
                  </div>
                  <div className="settings-grid" style={{ marginTop: '1.5rem' }}>
                    <div className="setting-item">
                      <label>{t.steps}</label>
                      <input type="number" value={params.steps} onChange={(e) => setParams({ ...params, steps: Number(e.target.value) })} min={1} max={50} />
                    </div>
                    <div className="setting-item">
                      <label>{t.cfg}</label>
                      <input type="number" value={params.cfg} onChange={(e) => setParams({ ...params, cfg: Number(e.target.value) })} step={0.1} min={1} max={20} />
                    </div>
                    <div className="setting-item" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                      <label>{t.negativePrompt}</label>
                      <textarea className="system-message-textarea" value={params.negativePrompt} onChange={(e) => setParams({ ...params, negativePrompt: e.target.value })} rows={3} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'comfy' && (
                <div className="settings-grid">
                  <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                    <label>{t.comfyUrl}</label>
                    <div className="model-select-group">
                      <input 
                        type="text" 
                        value={params.comfyUrl} 
                        onChange={(e) => setParams({ ...params, comfyUrl: e.target.value })} 
                        placeholder="http://127.0.0.1:8188" 
                        style={{ flex: 1 }}
                      />
                      <button
                        className="refresh-models-btn test-conn-btn"
                        onClick={testComfyConnection}
                        disabled={isCheckingComfy || !params.comfyUrl}
                        title={t.testConnection}
                      >
                        {isCheckingComfy ? '...' : t.testConnection}
                      </button>                    </div>
                    {comfyCheckStatus && <p className={`llm-status-msg ${comfyCheckStatus.type}`}>{comfyCheckStatus.msg}</p>}
                  </div>                  <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                    <label>{t.checkpointModel}</label>
                    <div className="model-select-group">
                      <select
                        value={params.comfyModel}
                        onChange={(e) => setParams({ ...params, comfyModel: e.target.value })}
                        className="model-select"
                      >
                        {comfyModels.length > 0 ? (
                          comfyModels.map(m => <option key={m} value={m}>{m}</option>)
                        ) : (
                          <option value={params.comfyModel}>{params.comfyModel}</option>
                        )}
                      </select>
                      <button
                        className="refresh-models-btn"
                        onClick={fetchComfyModels}
                        disabled={isFetchingComfyModels || !params.comfyUrl}
                        title={t.refreshModels}
                      >
                        {isFetchingComfyModels ? '...' : '🔄'}
                      </button>
                      </div>
                      {comfyStatus && <p className={`llm-status-msg ${comfyStatus.type}`}>{comfyStatus.msg}</p>}
                      </div>
                      <div className="setting-item" style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <label>{t.workflowFile}</label>
                      <select
                      value={params.workflowFile}
                      onChange={(e) => setParams({ ...params, workflowFile: e.target.value })}
                      className="model-select"
                      >
                      {availableWorkflows.length > 0 ? (
                        availableWorkflows.map(wf => <option key={wf} value={wf}>{wf}</option>)
                      ) : (
                        <option value={params.workflowFile}>{params.workflowFile}</option>
                      )}
                      </select>
                      </div>
                      </div>
                      )}

                      {activeTab === 'llm' && (
                      <div className="settings-grid">
                      <div className="setting-item">
                      <label>{t.llmEnabled}</label>
                      <div className="toggle-container" onClick={() => setParams({ ...params, llmEnabled: !params.llmEnabled })}>
                      <div className={`toggle-switch ${params.llmEnabled ? 'on' : ''}`}></div>
                      </div>
                      </div>
                      <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                        <label>{t.llmUrl}</label>
                        <div className="model-select-group">
                          <input 
                            type="text" 
                            value={params.llmUrl} 
                            onChange={(e) => setParams({ ...params, llmUrl: e.target.value })} 
                            placeholder="http://localhost:11434" 
                            style={{ flex: 1 }}
                          />
                          <button
                            className="refresh-models-btn test-conn-btn"
                            onClick={testLLMConnection}
                            disabled={isCheckingLLM || !params.llmUrl}
                            title={t.testConnection}
                          >
                            {isCheckingLLM ? '...' : t.testConnection}
                          </button>
                        </div>
                        {llmCheckStatus && <p className={`llm-status-msg ${llmCheckStatus.type}`}>{llmCheckStatus.msg}</p>}
                      </div>                      <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                      <label>{t.llmModel}</label>
                      <div className="model-select-group">
                      {llmModels.length > 0 ? (
                        <select value={params.llmModel} onChange={(e) => setParams({ ...params, llmModel: e.target.value })} className="model-select">
                          {llmModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={params.llmModel} onChange={(e) => setParams({ ...params, llmModel: e.target.value })} placeholder="llama3:latest" />
                      )}
                      <button className="refresh-models-btn" onClick={fetchLLMModels} disabled={isFetchingModels || !params.llmUrl} title={t.refreshModels}>{isFetchingModels ? '...' : '🔄'}</button>
                      </div>
                      {llmStatus && <p className={`llm-status-msg ${llmStatus.type}`}>{llmStatus.msg}</p>}
                      </div>
                      <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                      <label>{t.llmSystemMessage}</label>
                      <textarea className="system-message-textarea" value={params.llmSystemMessage} onChange={(e) => setParams({ ...params, llmSystemMessage: e.target.value })} rows={5} />
                      </div>
                      </div>
                      )}

                      {activeTab === 'admin' && (
                        <div className="settings-grid admin-panel">
                          <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                            <h3>{t.addUser}</h3>
                            <div className="add-user-form">
                              <input type="text" placeholder={t.username} value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                              <input type="password" placeholder={t.password} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                              <div className="admin-checkbox-wrapper">
                                <label className="admin-toggle-label">
                                  <span>{t.admin}</span>
                                  <div 
                                    className={`toggle-container ${newUser.isAdmin ? 'active' : ''}`} 
                                    onClick={() => setNewUser({ ...newUser, isAdmin: !newUser.isAdmin })}
                                  >
                                    <div className={`toggle-switch ${newUser.isAdmin ? 'on' : ''}`}></div>
                                  </div>
                                </label>
                              </div>
                              <button className="add-user-submit-btn" onClick={handleAddUser} disabled={isAdminLoading || !newUser.username || !newUser.password}>
                                {isAdminLoading ? '...' : t.addUser}
                              </button>
                            </div>
                          </div>
                          
                          <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                            <h3>{t.userList}</h3>
                            <div className="user-table-wrapper">
                              <table className="user-table">
                                <thead>
                                  <tr>
                                    <th>{t.username}</th>
                                    <th>{t.role}</th>
                                    <th>{t.images}</th>
                                    <th>{t.diskUsage}</th>
                                    <th>{t.actions}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {adminUsers.map(u => (
                                    <tr key={u.id}>
                                      <td>{u.username}</td>
                                      <td>{u.isAdmin ? t.admin : t.user}</td>
                                      <td>{u.imageCount || 0}</td>
                                      <td>{formatBytes(u.diskUsage || 0)}</td>
                                      <td className="user-actions-cell">
                                        {resetPasswordId === u.id ? (
                                          <div className="reset-password-inline">
                                            <input 
                                              type="password" 
                                              placeholder="Nouveau mdp" 
                                              value={newPasswordValue} 
                                              onChange={(e) => setNewPasswordValue(e.target.value)} 
                                              autoFocus
                                            />
                                            <button className="confirm-reset-btn" onClick={() => handleResetPassword(u.id)}>✅</button>
                                            <button className="cancel-reset-btn" onClick={() => setResetPasswordId(null)}>❌</button>
                                          </div>
                                        ) : (
                                          <div className="action-buttons-wrapper">
                                            <button 
                                              className="reset-user-btn" 
                                              onClick={() => setResetPasswordId(u.id)}
                                              title="Modifier le mot de passe"
                                            >
                                              🔑
                                            </button>
                                            <button 
                                              className="delete-user-btn" 
                                              onClick={() => deleteUser(u.id)}
                                              disabled={u.username === currentUser?.username}
                                              title="Supprimer l'utilisateur"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'archives' && (
                      <div className="settings-grid">
                      <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                      <p style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.8 }}>{t.bulkActions}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <button className="action-btn-large" onClick={archiveAllSessions}>📦 {t.archiveAll}</button>
                      <button className="action-btn-large delete" onClick={deleteAllActiveSessions}>🗑️ {t.deleteAll}</button>
                      </div>
                      </div>
                      </div>
                      )}            </div>

            <button className="save-settings-btn" onClick={() => setShowSettings(false)}>{t.save}</button>
          </div>
        </div>
      )}

      {sessionToDelete && (
        <div className="settings-modal-overlay" onClick={() => setSessionToDelete(null)}>
          <div className="settings-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t.confirmDelete}</h3>
            <div className="confirm-buttons">
              <button className="confirm-btn delete" onClick={confirmDeleteSession}>{t.confirm}</button>
              <button className="confirm-btn archive" onClick={() => toggleArchive(sessionToDelete, true)}>{t.archive}</button>
              <button className="confirm-btn cancel" onClick={() => setSessionToDelete(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {massActionType && (
        <div className="settings-modal-overlay" onClick={() => setMassActionType(null)}>
          <div className="settings-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{massActionType === 'archiveAll' ? t.archiveAll : t.confirmDeleteAll}</h3>
            <div className="confirm-buttons">
              <button className={`confirm-btn ${massActionType === 'deleteAll' ? 'delete' : 'archive'}`} onClick={massActionType === 'archiveAll' ? archiveAllSessions : deleteAllActiveSessions}>{t.confirm}</button>
              <button className="confirm-btn cancel" onClick={() => setMassActionType(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h1>{t.title}</h1>
          <button className="close-sidebar-mobile" onClick={() => setSidebarOpen(false)}>×</button>
          {backendError && <div className="backend-warning" title={t.backendOffline}>⚠️</div>}
        </div>
        <button className="new-chat-btn" onClick={() => { createNewSession(); if (window.innerWidth <= 768) setSidebarOpen(false); }}>
          <span>+</span> {t.newChat}
        </button>
        <button className={`new-chat-btn gallery-btn ${view === 'gallery' ? 'active' : ''}`} onClick={() => { setView('gallery'); fetchGallery(true); if (window.innerWidth <= 768) setSidebarOpen(false); }}>
          <span>🖼️</span> {t.myContent}
        </button>
        <button className="new-chat-btn" onClick={() => { setView(view === 'archives' ? 'chat' : 'archives'); }}>
          <span>{view === 'archives' ? '💬' : '📦'}</span> {view === 'archives' ? t.viewActive : t.viewArchives}
        </button>
        
        <div className="sessions-list">
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={`session-item ${currentSessionId === s.id && (view === 'chat' || view === 'archives') ? 'active' : ''}`} 
              onClick={() => { 
                if (currentSessionId === s.id && view === 'chat') {
                  if (window.innerWidth <= 768) setSidebarOpen(false);
                  return;
                }
                setCurrentSessionId(s.id); 
                setView('chat'); 
                if (window.innerWidth <= 768) setSidebarOpen(false); 
              }}            >
              {renamingId === s.id ? (
                <input autoFocus className="rename-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => renameSession(s.id, renameValue)} onKeyDown={(e) => { if (e.key === 'Enter') renameSession(s.id, renameValue); if (e.key === 'Escape') setRenamingId(null); }} onClick={(e) => e.stopPropagation()} />
              ) : (
                <>
                  <span className="session-title">{s.title}</span>
                  <div className="session-actions">
                    {s.isArchived ? (
                      <button className="edit-session" onClick={(e) => { e.stopPropagation(); toggleArchive(s.id, false); }} title={t.unarchive}>📤</button>
                    ) : (
                      <button className="edit-session" onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.title); }} title={t.edit}>✎</button>
                    )}
                    <button className="delete-session" onClick={(e) => deleteSession(e, s.id)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {view === 'archives' && sessions.length === 0 && <p className="empty-archives-msg">{t.noArchives}</p>}
        </div>
        <div className="sidebar-footer">
          <button className="settings-btn" onClick={() => { setShowSettings(true); if (window.innerWidth <= 768) setSidebarOpen(false); }}>
            <span>⚙️</span> <span className="btn-label">{t.settings}</span>
          </button>
          <button className="settings-btn logout" onClick={handleLogout}>
            <span>🚪</span> <span className="btn-label">{t.logout}</span>
          </button>
        </div>      </aside>

      <main className="main-content">
        <header className={`chat-header ${!showHeader ? 'hidden' : ''}`}>
          <div className="header-left">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <div className={`hamburger-icon ${sidebarOpen ? 'open' : ''}`}><span></span><span></span><span></span></div>
            </button>
            {currentSessionId && (
              <button className="header-delete-btn" onClick={(e) => deleteSession(e, currentSessionId)} title={t.delete}>🗑️</button>
            )}
          </div>
          <div className="header-controls">
            <div className={`header-ai-toggle ${params.llmEnabled ? 'active' : ''}`} onClick={() => setParams({ ...params, llmEnabled: !params.llmEnabled })} title={t.llmEnabled}>
              <span className="ai-text">AI</span>
              <div className={`mini-toggle ${params.llmEnabled ? 'on' : ''}`}>
                <div className="mini-toggle-thumb"></div>
              </div>
            </div>
            <div className="control-group">
              <button className={`control-pill ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button>
              <button className={`control-pill ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            </div>
            <button className="icon-btn theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}>{theme === 'light' ? '🌙' : '☀️'}</button>
          </div>
        </header>

        <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
          {view === 'chat' || view === 'archives' ? (
            <>
              {messages.length === 0 && (
                view === 'chat' ? <WelcomeScreen lang={lang} /> : <div className="empty-state"><p>{t.noArchives}</p></div>
              )}
              {messages.map((msg, index) => {
                const messageText = msg.text || msg.prompt;
                const isRedundant = index > 0 && messageText === (messages[index - 1].text || messages[index - 1].prompt);
                
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`message-row ${msg.role}`}>
                    <div className="avatar">{msg.role === 'user' ? 'U' : 'C'}</div>
                    <div className="message-content">
                      {messageText && !isRedundant && (
                        <div className="message-text-wrapper">
                          {msg.text && msg.text !== msg.prompt && msg.role === 'bot' && <span className="ai-badge" title="Optimisé par l'IA">✨</span>}
                          <MessageText text={messageText} lang={lang} />
                        </div>
                      )}
                    {msg.role === 'bot' && !msg.imageUrl && msg.status !== 'failed' && (
                      <div className="generation-placeholder">
                        {(msg.isEnhancing || msg.status === 'processing') && (
                          <div className="bounced-loader">
                            <div className="bounce1"></div>
                            <div className="bounce2"></div>
                            <div className="bounce3"></div>
                          </div>
                        )}
                        <p>
                          <span className={msg.isEnhancing || msg.status === 'processing' ? 'ai-text-shimmer' : ''}>
                            {msg.isEnhancing ? t.enhancing : (msg.status === 'processing' ? t.generating : t.waiting)}
                          </span>
                          {msg.status === 'processing' && msg.duration !== undefined && (
                            <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
                              {formatDuration(msg.duration)}
                            </span>
                          )}
                        </p>

                        <button className="cancel-gen-btn" onClick={interruptGeneration} title="Annuler la génération">
                          <div className="stop-icon-small"></div>
                          <span>{t.cancel}</span>
                        </button>
                      </div>
                    )}

                    {msg.role === 'bot' && msg.status === 'failed' && (
                      <div className="generation-error-container">
                        <div className="error-icon">⚠️</div>
                        <div className="error-content">
                          <p className="error-title">{t.genFailed}</p>
                          <p className="error-details">{msg.text}</p>
                          <button className="retry-btn" onClick={() => handleSend(msg.prompt || '', true)}>
                            <span>{t.retry}</span>
                          </button>
                        </div>
                      </div>
                    )}                    {msg.imageUrl && (
                      <div className="image-wrapper" onClick={() => handleImageClick({ url: msg.imageUrl!, sessionId: currentSessionId!, messageId: msg.id, isFavorite: msg.isFavorite, source: 'chat' })}>
                        <img 
                          src={getFullImageUrl(msg.thumbnailUrl || msg.imageUrl)} 
                          alt="Generated" 
                          className="clickable-image" 
                          onLoad={() => smoothScrollTo(`msg-${msg.id}`)}
                        />
                        <button 
                          className={`image-fav-btn ${msg.isFavorite ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(currentSessionId!, msg.id, msg.isFavorite); }}
                          title={t.favorites}
                        >
                          {msg.isFavorite ? '❤️' : '🤍'}
                        </button>
                        {favoritedId === msg.id && <div className="image-overlay-heart">❤️</div>}
                      </div>
                    )}
                    <div className="message-actions">
                      <button className="action-btn-icon edit" onClick={() => { 
                        const textToEdit = msg.role === 'user' ? (msg.text || '') : (msg.text || msg.prompt || '');
                        handleEdit(textToEdit); 
                      }} title={t.edit}>✎</button>
                      {msg.imageUrl && (
                        <>
                          <button className="action-btn-icon info" onClick={(e) => { e.stopPropagation(); setActiveInfoId(activeInfoId === msg.id ? null : msg.id); }} title="Info">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                          </button>
                          <button className="action-btn-icon download" onClick={(e) => { e.stopPropagation(); downloadImage(getFullImageUrl(msg.imageUrl!), `img-${msg.id}.png`); }} title={t.download}>💾</button>
                          <button className="action-btn-icon regenerate" onClick={(e) => { e.stopPropagation(); handleSend(msg.text || msg.prompt || '', true); }} title={t.regenerate}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 12c0-4.4 3.6-8 8-8 3.3 0 6.2 2 7.4 5M22 12c0 4.4-3.6 8-8 8-3.3 0-6.2-2-7.4-5"/>
                            </svg>
                          </button>
                        </>
                      )}
                      <button className="action-btn-icon delete" onClick={(e) => { e.stopPropagation(); setMessageToDelete(msg.id); }} title={t.delete}>🗑️</button>
                    </div>
                    {activeInfoId === msg.id && msg.role === 'bot' && (
                      <div className="generation-info-panel">
                        <p><strong>{t.date}:</strong> {new Date(msg.timestamp).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
                        <p><strong>{t.model}:</strong> {msg.model || t.unknown}</p>
                        <p><strong>{t.workflow}:</strong> {msg.workflow || t.unknown}</p>
                        <p><strong>{t.dimensions}:</strong> {msg.width}x{msg.height}</p>
                        <p><strong>{t.steps}:</strong> {msg.steps} | <strong>CFG:</strong> {msg.cfg} | <strong>{t.seed}:</strong> {msg.seed || t.unknown}</p>
                        {msg.duration !== undefined && (
                          <p><strong>{lang === 'fr' ? 'Durée' : 'Duration'}:</strong> {formatDuration(msg.duration)}</p>
                        )}

                      </div>
                    )}
                  </div>
                </div>
                );
              })}
              {isGenerating && messages.length > 0 && !messages[messages.length - 1].role.includes('bot') && (
                <div className="message-row bot">
                  <div className="avatar">C</div>
                  <div className="message-content loading">
                    <div className="generation-placeholder">
                      <div className="bounced-loader">
                        <div className="bounced-ball"></div>
                        <div className="bounced-ball"></div>
                        <div className="bounced-ball"></div>
                      </div>
                      <p>{isEnhancing ? t.enhancing : t.generating}</p>
                      <button className="cancel-gen-btn" onClick={interruptGeneration} title="Annuler la génération">
                        <div className="stop-icon-small"></div>
                        <span>{t.cancel}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="gallery-view">
              <div className="gallery-header">
                <h2>{t.myContent}</h2>
                <div className="gallery-filters">
                  <button className={`gallery-filter-fav ${favoritesOnly ? 'active' : ''}`} onClick={() => { setFavoritesOnly(!favoritesOnly); setGalleryOffset(0); setHasMoreGallery(true); }}>
                    {favoritesOnly ? '❤️' : '🤍'} {t.favorites}
                  </button>
                  <div className="control-group">
                    <button className={`control-pill ${!showArchivedInGallery ? 'active' : ''}`} onClick={() => { setShowArchivedInGallery(false); setFavoritesOnly(false); setGalleryOffset(0); setHasMoreGallery(true); }}>
                      {t.active}
                    </button>
                    <button className={`control-pill ${showArchivedInGallery ? 'active' : ''}`} onClick={() => { setShowArchivedInGallery(true); setFavoritesOnly(false); setGalleryOffset(0); setHasMoreGallery(true); }}>
                      {t.archived}
                    </button>
                  </div>
                </div>
              </div>
              <div className="gallery-grid">
                {galleryItems.map((item, index) => (
                  <div 
                  ref={galleryItems.length === index + 1 ? lastImageElementRef : undefined}
                  key={item.messageId} 
                  className="gallery-item" 
                  onClick={() => handleImageClick({ url: item.imageUrl, sessionId: item.sessionId, messageId: item.messageId, isFavorite: item.isFavorite, source: 'gallery' })}
                  >
                    <img src={getFullImageUrl(item.thumbnailUrl || item.imageUrl)} alt={item.prompt} loading="lazy" />
                    {item.isFavorite === 1 && <div className="gallery-item-favorite">❤️</div>}
                  </div>
                ))}
              </div>
              {galleryItems.length === 0 && !isFetchingGallery && <p className="empty-gallery">Aucun contenu généré pour le moment.</p>}
              {isFetchingGallery && <div className="gallery-loader-container"><div className="typing-indicator"><span></span><span></span><span></span></div></div>}
            </div>
          )}
        </div>

        {view === 'chat' && (
          <div className="input-container">
            <div className={`input-box ${params.llmEnabled ? 'ai-active' : ''}`}>
              <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder={params.llmEnabled ? t.aiPlaceholder : t.placeholder} rows={1} />
              {input && <button className="clear-input-btn" onClick={() => setInput('')} title="Effacer le texte">×</button>}
              <button className={`send-btn ${isGenerating && !input.trim() ? 'stop-btn' : ''}`} onClick={() => isGenerating && !input.trim() ? interruptGeneration() : handleSend()} disabled={!input.trim() && !isGenerating}>
                {isGenerating && !input.trim() ? (
                  <div className="stop-icon"></div>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
