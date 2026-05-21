import { useState, useRef, useEffect, useCallback, memo } from 'react';
import './App.css';
import { translations } from './i18n';
import type { 
  GalleryItem, 
  GenParameters, 
  Theme, 
  Language,
  User 
} from './types';
import { API_BASE, getFullImageUrl } from './services/api';
import { Sidebar } from './components/sidebar/Sidebar';
import { SettingsModal } from './components/settings/SettingsModal';
import { ChatInterface } from './components/chat/ChatInterface';
import { useAuth } from './hooks/useAuth';
import { useSessions } from './hooks/useSessions';
import { useGeneration } from './hooks/useGeneration';
import { useWebSocket } from './hooks/useWebSocket';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { Toaster } from 'react-hot-toast';

// Memoize sub-components to avoid unnecessary re-renders
const MemoSidebar = memo(Sidebar);
const MemoSettingsModal = memo(SettingsModal);
const MemoChatInterface = memo(ChatInterface);

function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'fr';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });
  const t = translations[lang];

  const { 
    isAuthenticated, 
    currentUser, 
    loginError, 
    isLoginLoading, 
    login, 
    logout,
    updateProfile
  } = useAuth();

  const [view, setView] = useState<'chat' | 'gallery' | 'archives'>(() => {
    return (localStorage.getItem('currentView') as 'chat' | 'gallery' | 'archives') || 'chat';
  });

  useEffect(() => {
    localStorage.setItem('currentView', view);
  }, [view]);

  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    sessionToDelete,
    setSessionToDelete,
    messageToDelete,
    setMessageToDelete,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    activeInfoId,
    setActiveInfoId,
    fetchSessions,
    createNewSession,
    fetchSessionDetails,
    renameSession,
    deleteSession,
    confirmDeleteSession,
    toggleArchive,
    archiveAllSessions,
    deleteAllActiveSessions,
    deleteMessage,
    massActionType,
    setMassActionType
  } = useSessions(view, isAuthenticated);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'comfy' | 'llm' | 'archives' | 'logs' | 'admin'>('images');
  
  const [input, setInput] = useState('');
  
  const [params, setParams] = useState<GenParameters>(() => {
    return { 
      width: 896, 
      height: 1152, 
      steps: 8, 
      cfg: 1.1,
      comfyUrl: 'http://127.0.0.1:8188',
      comfyModel: 'dirtyRealism_DMDSAT.safetensors',
      llmUrl: '',
      llmModel: 'llama3:latest',
      llmSystemMessage: "You are a professional stable diffusion prompt engineer. Transform the user's brief idea into a highly detailed, descriptive, and artistic prompt in ENGLISH. Also generate a negative prompt of things to avoid. Output your response as a JSON object with two keys: 'positive' and 'negative'. No other text.",
      negativePrompt: "low quality, bad anatomy, malformed, extra limbs, extra fingers, fused fingers, bad hands, poorly drawn hands, missing fingers, fused face, poorly drawn face, asymmetrical, cartoon, anime, 3d, render, watermark, text, logo, swept hair, portrait",
      llmEnabled: false,
      workflowFile: 'workflow_lcm.json',
      nodeMapping: { checkpoint: "1", positive: "3", negative: "4", ksampler: "10", latent: "6", save: "99" }
    };
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingAnchorRef = useRef<string | null>(null);
  const isAnchoringRef = useRef<boolean>(false);

  const smoothScrollTo = useCallback((elementId: string) => {
    if (pendingAnchorRef.current || isAnchoringRef.current) return;
    
    setTimeout(() => {
      const el = document.getElementById(elementId);
      const container = containerRef.current;
      if (!el || !container) return;
      
      const targetScroll = el.offsetTop - container.offsetTop - 40;
      const startScroll = container.scrollTop;
      const distance = targetScroll - startScroll;
      
      if (Math.abs(distance) < 50) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const duration = 1200; 
      let start: number | null = null;
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
        if (timeElapsed < duration) requestAnimationFrame(animation);
        else container.scrollTop = targetScroll;
      };
      requestAnimationFrame(animation);
    }, 100);
  }, []);

  const { clientIdRef } = useWebSocket(isAuthenticated, currentSessionId, setMessages, fetchSessions, fetchSessionDetails);
  const { handleSend, interruptGeneration, isEnhancing } = useGeneration(currentSessionId, params, clientIdRef, setMessages, smoothScrollTo, fetchSessions);

  const isGenerating = isEnhancing || messages.some(m => m.role === 'bot' && (m.status === 'pending' || m.status === 'processing'));

  const [activeLightbox, setActiveLightbox] = useState<{
    url: string;
    thumbnailUrl?: string;
    sessionId: string;
    messageId: string;
    source: 'chat' | 'gallery';
  } | null>(null);

  const [hdLoaded, setHdLoaded] = useState<string | null>(null);
  const [loadedHdImages, setLoadedHdImages] = useState<Set<string>>(new Set());
  
  // Clear HD state when lightbox closes
  useEffect(() => {
    if (!activeLightbox) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHdLoaded(null);
    }
  }, [activeLightbox]);

  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', isAdmin: false });
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  const fetchAdminUsers = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/api/users`, { credentials: 'include' });
      const data = await res.json();
      setAdminUsers(data);
    } catch (err) { console.error('Error fetching users:', err); }
  }, [currentUser]);

  const handleAddUser = useCallback(async () => {
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
  }, [newUser, fetchAdminUsers]);

  const internalDeleteUser = useCallback(async (id: string) => {
    if (!confirm(t.confirmDeleteUser)) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) fetchAdminUsers();
    } catch (err) { console.error('Error deleting user:', err); }
  }, [t.confirmDeleteUser, fetchAdminUsers]);

  const handleResetPassword = useCallback(async (id: string) => {
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
  }, [newPasswordValue, lang]);

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
  const clickTimeoutRef = useRef<number | null>(null);

  const toggleFavorite = useCallback(async (sessionId: string, messageId: string, currentStatus: number | undefined) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
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
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isFavorite: newStatus } : m));
        setGalleryItems(prev => prev.map(m => m.messageId === messageId ? { ...m, isFavorite: newStatus } : m));
      }
    } catch (err) { console.error('Error toggling favorite:', err); }
  }, [setMessages]);

  const handleImageClick = useCallback((item: { url: string, thumbnailUrl?: string, sessionId: string, messageId: string, isFavorite?: number, source: 'chat' | 'gallery' }) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      toggleFavorite(item.sessionId, item.messageId, item.isFavorite);
    } else {
      setActiveLightbox({ 
        url: item.url, 
        thumbnailUrl: item.thumbnailUrl, 
        sessionId: item.sessionId, 
        messageId: item.messageId, 
        source: item.source 
      });
      clickTimeoutRef.current = window.setTimeout(() => {
        clickTimeoutRef.current = null;
      }, 350);
    }
  }, [toggleFavorite]);

  const handleLightboxImageClick = useCallback((e: React.MouseEvent) => {
    // Si on clique sur le conteneur vide autour de l'image, on ferme
    if (e.target === e.currentTarget) {
      setActiveLightbox(null);
      return;
    }

    e.stopPropagation();
    if (!activeLightbox) return;
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      const currentItem = activeLightbox.source === 'chat' 
        ? messages.find(m => m.id === activeLightbox.messageId)
        : galleryItems.find(m => m.messageId === activeLightbox.messageId);
      toggleFavorite(activeLightbox.sessionId, activeLightbox.messageId, currentItem?.isFavorite);
    } else {
      clickTimeoutRef.current = window.setTimeout(() => {
        clickTimeoutRef.current = null;
      }, 350);
    }
  }, [activeLightbox, messages, galleryItems, toggleFavorite]);

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

  const testLLMConnection = useCallback(async () => {
    setIsCheckingLLM(true);
    setLlmCheckStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/llm/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmUrl: params.llmUrl }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) setLlmCheckStatus({ type: 'success', msg: t.connectionSuccess });
      else setLlmCheckStatus({ type: 'error', msg: data.error || t.connectionFailed });
    } catch (err) { setLlmCheckStatus({ type: 'error', msg: t.connectionFailed + ': ' + (err instanceof Error ? err.message : String(err)) }); }
    finally { setIsCheckingLLM(false); }
  }, [params.llmUrl, t.connectionSuccess, t.connectionFailed]);

  const testComfyConnection = useCallback(async () => {
    setIsCheckingComfy(true);
    setComfyCheckStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/comfy/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comfyUrl: params.comfyUrl }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) setComfyCheckStatus({ type: 'success', msg: t.connectionSuccess });
      else setComfyCheckStatus({ type: 'error', msg: data.error || t.connectionFailed });
    } catch (err) { setComfyCheckStatus({ type: 'error', msg: t.connectionFailed + ': ' + (err instanceof Error ? err.message : String(err)) }); }
    finally { setIsCheckingComfy(false); }
  }, [params.comfyUrl, t.connectionSuccess, t.connectionFailed]);

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [backendError] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollTop = useRef(0);

  const fetchComfyModels = useCallback(async () => {
    setIsFetchingComfyModels(true);
    setComfyStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/comfy/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comfyUrl: params.comfyUrl }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.models) {
        setComfyModels(data.models);
        setComfyStatus({ type: 'success', msg: `${data.models.length} ${t.modelsFound}` });
        setParams(p => data.models.includes(p.comfyModel) ? p : { ...p, comfyModel: data.models[0] });
      }
    } catch (err) { setComfyStatus({ type: 'error', msg: 'Scan échoué : ' + (err instanceof Error ? err.message : String(err)) }); }
    finally { setIsFetchingComfyModels(false); }
  }, [params.comfyUrl, t.modelsFound]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows`, { credentials: 'include' });
      const data = await res.json();
      setAvailableWorkflows(data);
    } catch (err) { console.error('Error fetching workflows:', err); }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const st = container.scrollTop;
    const sh = container.scrollHeight;
    const ch = container.clientHeight;

    // Détection de la fin de page (avec une marge de 50px)
    const isNearBottom = st + ch >= sh - 50;

    // On affiche toujours le header en haut (st <= 100) ou si on est proche du bas
    if (st <= 100 || isNearBottom) {
      setShowHeader(true);
    } else {
      // Sinon on suit la direction du scroll
      setShowHeader(st <= lastScrollTop.current);
    }
    lastScrollTop.current = st <= 0 ? 0 : st;
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, { credentials: 'include' });
      const data = await res.json();
      if (data && data.width) setParams(prev => ({ ...prev, ...data }));
    } catch (err) { console.error('Error fetching settings:', err); }
    finally { setIsSettingsLoaded(true); }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchComfyModels();
      fetchSettings();
      fetchWorkflows();
    }
  }, [isAuthenticated, fetchSessions, fetchComfyModels, fetchSettings, fetchWorkflows]);

  const saveSettings = useCallback(async (newParams: GenParameters) => {
    if (!isSettingsLoaded) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParams),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(t.settingsSaved, { id: 'settings-save' });
      }
    } catch (err) { console.error('Error saving settings:', err); }
  }, [isSettingsLoaded, t.settingsSaved]);

  useEffect(() => {
    if (!isAuthenticated || !isSettingsLoaded) return;
    
    const timer = setTimeout(() => {
      saveSettings(params);
    }, 1000); // Debounce de 1s pour éviter de spammer le serveur (surtout pour le texte)

    return () => clearTimeout(timer);
  }, [params, isAuthenticated, isSettingsLoaded, saveSettings]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    let interval: number | undefined;
    if (isGenerating && currentSessionId && !isEnhancing) {
      interval = window.setInterval(() => fetchSessionDetails(currentSessionId), 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGenerating, currentSessionId, fetchSessionDetails, isEnhancing]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleLogout = useCallback(async () => {
    await logout();
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([]);
    setGalleryItems([]);
    setAdminUsers([]);
    setView('chat');
  }, [logout, setSessions, setCurrentSessionId, setMessages]);

  const fetchGallery = useCallback(async (isInitial = false) => {
    if (isFetchingGallery || (!hasMoreGallery && !isInitial)) return;
    
    setIsFetchingGallery(true);
    // On utilise l'offset local pour l'appel API
    const currentOffset = isInitial ? 0 : galleryOffset;
    
    try {
      const res = await fetch(`${API_BASE}/api/gallery?limit=25&offset=${currentOffset}&includeArchived=${showArchivedInGallery}&favoritesOnly=${favoritesOnly}`, { credentials: 'include' });
      const data: GalleryItem[] = await res.json();
      
      if (isInitial) {
        setGalleryItems(data);
        setGalleryOffset(data.length);
      } else if (data.length > 0) {
        setGalleryItems(prev => {
          // Éviter les doublons par ID de message
          const existingIds = new Set(prev.map(item => item.messageId));
          const uniqueNewData = data.filter(item => !existingIds.has(item.messageId));
          return [...prev, ...uniqueNewData];
        });
        setGalleryOffset(prev => prev + data.length);
      }
      setHasMoreGallery(data.length === 25);
    } catch (err) { 
      console.error('Error fetching gallery:', err); 
    } finally { 
      setIsFetchingGallery(false); 
    }
  }, [galleryOffset, hasMoreGallery, isFetchingGallery, showArchivedInGallery, favoritesOnly]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastImageElementRef = useCallback((node: HTMLDivElement) => {
    if (isFetchingGallery) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreGallery) {
        fetchGallery(false);
      }
    }, {
      rootMargin: '400px', // Plus de marge pour un chargement anticipé
      threshold: 0
    });
    if (node) observer.current.observe(node);
  }, [isFetchingGallery, hasMoreGallery, fetchGallery]);

  // Déclencher le chargement initial uniquement quand nécessaire
  useEffect(() => {
    if (view === 'gallery') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchGallery(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, showArchivedInGallery, favoritesOnly]); // Supprimer fetchGallery des dépendances pour casser la boucle

  const fetchLLMModels = useCallback(async () => {
    if (!params.llmUrl) return;
    setIsFetchingModels(true);
    setLlmStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/llm/models`, {
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
      }
    } catch (err) { setLlmStatus({ type: 'error', msg: 'Connexion échouée : ' + (err instanceof Error ? err.message : String(err)) }); }
    finally { setIsFetchingModels(false); }
  }, [params.llmUrl, params.llmModel, t.modelsFound]);

  const goToImage = useCallback((sessionId: string, messageId: string) => {
    setCurrentSessionId(sessionId);
    setView('chat');
    pendingAnchorRef.current = messageId;
    isAnchoringRef.current = true;
    
    // Fallback security if messages don't load or something fails
    setTimeout(() => {
      if (isAnchoringRef.current) isAnchoringRef.current = false;
    }, 5000);
  }, [setCurrentSessionId]);

  useEffect(() => {
    if (view === 'chat' && pendingAnchorRef.current && messages.length > 0) {
      const messageId = pendingAnchorRef.current;
      const element = document.getElementById(`msg-${messageId}`);
      if (element) {
        pendingAnchorRef.current = null;
        isAnchoringRef.current = true;
        
        // Wait a bit for layout to stabilize
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-message');
          
          setTimeout(() => {
            element.classList.remove('highlight-message');
            isAnchoringRef.current = false;
          }, 2500);
        }, 100);
      }
    }
  }, [view, messages]);

  const handleEdit = useCallback((text: string) => {
    setInput(text);
    setView('chat');
    // Petit délai pour laisser à React le temps de basculer la vue et de rendre le textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, []);

  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStart.current = e.targetTouches[0].clientX; }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { touchEnd.current = e.targetTouches[0].clientX; }, []);
  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (activeLightbox && Math.abs(distance) > 50) {
      const isNext = distance > 0;
      const items = activeLightbox.source === 'chat' ? messages.filter(m => m.imageUrl) : galleryItems;
      const currentIndex = items.findIndex(m => {
        if (activeLightbox.source === 'chat') return (m as Message).id === activeLightbox.messageId;
        return (m as GalleryItem).messageId === activeLightbox.messageId;
      });
      if (currentIndex !== -1) {
        const nextIdx = isNext ? currentIndex + 1 : currentIndex - 1;
        if (nextIdx >= 0 && nextIdx < items.length) {
          const next = items[nextIdx];
          setHdLoaded(null); // Reset loader state for next image
          if (activeLightbox.source === 'chat') {
            const m = next as Message;
            setActiveLightbox({ 
              url: m.imageUrl!, 
              thumbnailUrl: m.thumbnailUrl,
              sessionId: currentSessionId || '', 
              messageId: m.id, 
              source: 'chat' 
            });
          } else {
            const g = next as GalleryItem;
            setActiveLightbox({ 
              url: g.imageUrl, 
              thumbnailUrl: g.thumbnailUrl,
              sessionId: g.sessionId, 
              messageId: g.messageId, 
              source: 'gallery' 
            });
          }
        }
      }
    }
    touchStart.current = touchEnd.current = null;
  }, [activeLightbox, messages, galleryItems, currentSessionId]);

  const downloadImage = useCallback(async (url: string, filename: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, []);

  const onHandleSend = useCallback((override?: string, regen?: boolean) => {
    const text = override !== undefined ? override : input;
    if (!text.trim()) return;
    
    handleSend(text, regen);
    if (override === undefined) setInput('');
  }, [handleSend, input]);

  const onInputChange = useCallback((val: string) => {
    setInput(val);
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
              setActiveLightbox({ 
                url: prev.imageUrl!, 
                thumbnailUrl: prev.thumbnailUrl,
                sessionId: currentSessionId!, 
                messageId: prev.id, 
                source: 'chat' 
              });
            } else if (e.key === 'ArrowRight' && currentIndex < imageMessages.length - 1) {
              const next = imageMessages[currentIndex + 1];
              setActiveLightbox({ 
                url: next.imageUrl!, 
                thumbnailUrl: next.thumbnailUrl,
                sessionId: currentSessionId!, 
                messageId: next.id, 
                source: 'chat' 
              });
            }
          }
        } else {
          const currentIndex = galleryItems.findIndex(m => m.messageId === activeLightbox.messageId);
          if (currentIndex !== -1) {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
              const prev = galleryItems[currentIndex - 1];
              setActiveLightbox({ 
                url: prev.imageUrl, 
                thumbnailUrl: prev.thumbnailUrl,
                sessionId: prev.sessionId, 
                messageId: prev.messageId, 
                source: 'gallery' 
              });
            } else if (e.key === 'ArrowRight' && currentIndex < galleryItems.length - 1) {
              const next = galleryItems[currentIndex + 1];
              setActiveLightbox({ 
                url: next.imageUrl, 
                thumbnailUrl: next.thumbnailUrl,
                sessionId: next.sessionId, 
                messageId: next.messageId, 
                source: 'gallery' 
              });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightbox, messages, galleryItems, currentSessionId]);

  useEffect(() => {
    if (currentSessionId && isAuthenticated) {
      fetchSessionDetails(currentSessionId);
    }
  }, [currentSessionId, fetchSessionDetails, isAuthenticated]);

  if (isAuthenticated === null) return (
    <div className="app-loader">
      <div className="bounced-loader"><div className="bounce1"></div><div className="bounce2"></div><div className="bounce3"></div></div>
      <div>Chargement...</div>
    </div>
  );

  if (!isAuthenticated) return (
    <div className={`login-screen ${theme}`}>
      <div className="theme-toggle-corner"><button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️' : '🌙'}</button></div>
      <form className="login-form" onSubmit={(e) => { e.preventDefault(); login(loginUsername, loginPassword).then(r => !r.success && alert(r.error)); }}>
        <div className="login-header"><div className="login-icon">✨</div><h1>{t.title}</h1><p>Connectez-vous pour commencer</p></div>
        <div className="input-group"><label>{t.username}</label><input type="text" autoFocus value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className={loginError ? 'error' : ''} /></div>
        <div className="input-group"><label>{t.password}</label><input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={loginError ? 'error' : ''} />{loginError && <p className="error-msg">{t.incorrectLogin}</p>}</div>
        <button type="submit" disabled={isLoginLoading}>{isLoginLoading ? '...' : t.login}</button>
      </form>
    </div>
  );

  const currentLightboxItem = activeLightbox ? (
    activeLightbox.source === 'chat' 
      ? messages.find(m => m.id === activeLightbox.messageId)
      : galleryItems.find(m => m.messageId === activeLightbox.messageId)
  ) : null;

  const isAlreadyLoaded = activeLightbox ? loadedHdImages.has(activeLightbox.messageId) : false;

  return (
    <ErrorBoundary name="ComfyRealism App">
      <div className={`app-layout ${theme}`}>
        <Toaster position="top-right" />
        {activeLightbox && (
        <div className="lightbox" onClick={() => setActiveLightbox(null)} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="lightbox-content" key={activeLightbox.messageId} onClick={handleLightboxImageClick}>
            {/* 1. Miniature en fond (seulement si pas déjà en cache) */}
            {activeLightbox.thumbnailUrl && !isAlreadyLoaded && (
              <img 
                key={`${activeLightbox.messageId}-thumb`}
                src={getFullImageUrl(activeLightbox.thumbnailUrl)} 
                alt="Loading..." 
                className="lightbox-thumb"
                style={{ 
                  filter: 'blur(10px)', 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  opacity: hdLoaded === activeLightbox.messageId ? 0 : 1,
                  transition: 'opacity 0.3s ease-out'
                }}
              />
            )}
            {/* 2. Image HD par dessus */}
            <img 
              key={`${activeLightbox.messageId}-hd`}
              src={getFullImageUrl(activeLightbox.url)} 
              alt="Fullscreen" 
              className="lightbox-hd"
              style={{ 
                position: 'relative', 
                zIndex: 2, 
                opacity: (hdLoaded === activeLightbox.messageId || isAlreadyLoaded) ? 1 : 0, 
                transition: isAlreadyLoaded ? 'none' : 'opacity 0.4s ease-in' 
              }}
              onLoad={() => {
                setHdLoaded(activeLightbox.messageId);
                setLoadedHdImages(prev => new Set(prev).add(activeLightbox.messageId));
              }}
            />
            {favoritedId === activeLightbox.messageId && <div className="image-overlay-heart" style={{ fontSize: '8rem' }}>❤️</div>}
          </div>
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-btn" onClick={() => { goToImage(activeLightbox.sessionId, activeLightbox.messageId); setActiveLightbox(null); }} title={t.viewInChat}>💬</button>
            <button className={`lightbox-btn favorite ${currentLightboxItem?.isFavorite ? 'active' : ''}`} onClick={() => toggleFavorite(activeLightbox.sessionId, activeLightbox.messageId, currentLightboxItem?.isFavorite)} title={t.favorites}>{currentLightboxItem?.isFavorite ? '❤️' : '🤍'}</button>
            <button className="lightbox-btn" onClick={() => { if (currentLightboxItem) { handleEdit(currentLightboxItem.text || currentLightboxItem.prompt || ''); setActiveLightbox(null); } }} title={t.edit}>✎</button>
            <button className="lightbox-btn" onClick={() => downloadImage(getFullImageUrl(activeLightbox.url), `img-${activeLightbox.messageId}.png`)} title="Télécharger">💾</button>
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

      <MemoSettingsModal
        showSettings={showSettings} setShowSettings={setShowSettings} activeTab={activeTab} setActiveTab={setActiveTab}
        params={params} setParams={setParams} lang={lang} t={t} currentUser={currentUser}
        comfyModels={comfyModels} isFetchingComfyModels={isFetchingComfyModels} fetchComfyModels={fetchComfyModels}
        comfyStatus={comfyStatus} testComfyConnection={testComfyConnection} isCheckingComfy={isCheckingComfy} comfyCheckStatus={comfyCheckStatus}
        availableWorkflows={availableWorkflows} llmModels={llmModels} isFetchingModels={isFetchingModels} fetchLLMModels={fetchLLMModels}
        llmStatus={llmStatus} testLLMConnection={testLLMConnection} isCheckingLLM={isCheckingLLM} llmCheckStatus={llmCheckStatus}
        adminUsers={adminUsers} newUser={newUser} setNewUser={setNewUser} handleAddUser={handleAddUser} isAdminLoading={isAdminLoading}
        deleteUser={internalDeleteUser} resetPasswordId={resetPasswordId} setResetPasswordId={setResetPasswordId} newPasswordValue={newPasswordValue}
        setNewPasswordValue={setNewPasswordValue} handleResetPassword={handleResetPassword} archiveAllSessions={archiveAllSessions} deleteAllActiveSessions={deleteAllActiveSessions}
        updateProfile={updateProfile} galleryItems={galleryItems} fetchGallery={fetchGallery}
      />

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

      <MemoSidebar
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} backendError={backendError} t={t}
        createNewSession={createNewSession} view={view} setView={setView} fetchGallery={fetchGallery}
        sessions={sessions} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId}
        renamingId={renamingId} setRenamingId={setRenamingId} renameValue={renameValue} setRenameValue={setRenameValue}
        renameSession={renameSession} toggleArchive={toggleArchive} deleteSession={deleteSession}
        setShowSettings={(show) => { setShowSettings(show); if (show) setSidebarOpen(false); }} 
        handleLogout={handleLogout}
        currentUser={currentUser} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme}
      />

      <main className="main-content">
        <header className={`chat-header ${!showHeader ? 'hidden' : ''}`}>
          <div className="header-left">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <div className={`hamburger-icon ${sidebarOpen ? 'open' : ''}`}><span></span><span></span><span></span></div>
            </button>
            {currentSessionId && <button className="header-delete-btn" onClick={(e) => deleteSession(e, currentSessionId)} title={t.delete}>🗑️</button>}
          </div>
          <div className="header-controls">
            <div className={`header-ai-toggle ${params.llmEnabled ? 'active' : ''}`} onClick={() => setParams({ ...params, llmEnabled: !params.llmEnabled })} title={t.llmEnabled}>
              <span className="ai-text">AI</span>
              <div className={`mini-toggle ${params.llmEnabled ? 'on' : ''}`}><div className="mini-toggle-thumb"></div></div>
            </div>
          </div>
        </header>

        <MemoChatInterface
          view={view} messages={messages} lang={lang} t={t} isGenerating={isGenerating} isEnhancing={isEnhancing}
          currentSessionId={currentSessionId} input={input} setInput={onInputChange} handleSend={onHandleSend}
          interruptGeneration={interruptGeneration} handleEdit={handleEdit} goToImage={goToImage} setActiveInfoId={setActiveInfoId} activeInfoId={activeInfoId}
          setMessageToDelete={setMessageToDelete} toggleFavorite={toggleFavorite} handleImageClick={handleImageClick} favoritedId={favoritedId}
          galleryItems={galleryItems} isFetchingGallery={isFetchingGallery} favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}
          showArchivedInGallery={showArchivedInGallery} setShowArchivedInGallery={setShowArchivedInGallery} setGalleryOffset={setGalleryOffset}
          setHasMoreGallery={setHasMoreGallery} lastImageElementRef={lastImageElementRef} containerRef={containerRef} textareaRef={textareaRef}
          messagesEndRef={messagesEndRef} params={params} smoothScrollTo={smoothScrollTo} handleScroll={handleScroll} downloadImage={downloadImage}
        />
      </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
