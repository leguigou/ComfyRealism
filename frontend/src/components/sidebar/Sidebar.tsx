import './Sidebar.css';
import type { Session } from '../../types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  backendError: boolean;
  t: Record<string, string>;
  createNewSession: () => void;
  view: 'chat' | 'gallery' | 'archives';
  setView: (view: 'chat' | 'gallery' | 'archives') => void;
  fetchGallery: (initial?: boolean) => void;
  sessions: Session[];
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
  renameSession: (id: string, title: string) => void;
  toggleArchive: (id: string, archived: boolean) => void;
  deleteSession: (e: React.MouseEvent, id: string) => void;
  setShowSettings: (show: boolean) => void;
  handleLogout: () => void;
}

export const Sidebar = ({
  sidebarOpen,
  setSidebarOpen,
  backendError,
  t,
  createNewSession,
  view,
  setView,
  fetchGallery,
  sessions,
  currentSessionId,
  setCurrentSessionId,
  renamingId,
  setRenamingId,
  renameValue,
  setRenameValue,
  renameSession,
  toggleArchive,
  deleteSession,
  setShowSettings,
  handleLogout
}: SidebarProps) => {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-app-identity">
          <div className="app-logo">✨</div>
          <h1>{t.title}</h1>
        </div>
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
            }}
          >
            {renamingId === s.id ? (
              <input 
                autoFocus 
                className="rename-input" 
                value={renameValue} 
                onChange={(e) => setRenameValue(e.target.value)} 
                onBlur={() => renameSession(s.id, renameValue)} 
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') renameSession(s.id, renameValue); 
                  if (e.key === 'Escape') setRenamingId(null); 
                }} 
                onClick={(e) => e.stopPropagation()} 
              />
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
      </div>
    </aside>
  );
};
