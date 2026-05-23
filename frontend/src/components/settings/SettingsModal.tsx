import { useState, useEffect } from 'react';
import './SettingsModal.css';
import type { GenParameters, User, Language, GalleryItem } from '../../types';
import { RefreshIcon } from '../ui/Icons';
import { MarkdownLoader } from '../ui/MarkdownLoader';
import devLogsUrl from '../../assets/DEVELOPMENT_LOGS.md?url';
import { formatBytes, getFullImageUrl, API_BASE } from '../../services/api';
import { APP_CONFIG } from '../../config';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  activeTab: 'profile' | 'images' | 'comfy' | 'llm' | 'archives' | 'logs' | 'update' | 'admin';
  setActiveTab: (tab: 'profile' | 'images' | 'comfy' | 'llm' | 'archives' | 'logs' | 'update' | 'admin') => void;
  params: GenParameters;
  setParams: (params: GenParameters) => void;
  lang: Language;
  t: Record<string, string>;
  currentUser: User | null;
  comfyModels: string[];
  isFetchingComfyModels: boolean;
  fetchComfyModels: () => void;
  comfyStatus: { type: 'success' | 'error', msg: string } | null;
  testComfyConnection: () => void;
  isCheckingComfy: boolean;
  comfyCheckStatus: { type: 'success' | 'error', msg: string } | null;
  availableWorkflows: string[];
  llmModels: string[];
  isFetchingModels: boolean;
  fetchLLMModels: () => void;
  llmStatus: { type: 'success' | 'error', msg: string } | null;
  testLLMConnection: () => void;
  isCheckingLLM: boolean;
  llmCheckStatus: { type: 'success' | 'error', msg: string } | null;
  adminUsers: User[];
  newUser: { username: string; password: string; isAdmin: boolean };
  setNewUser: (user: { username: string; password: string; isAdmin: boolean }) => void;
  handleAddUser: () => void;
  isAdminLoading: boolean;
  deleteUser: (id: string) => void;
  resetPasswordId: string | null;
  setResetPasswordId: (id: string | null) => void;
  newPasswordValue: string;
  setNewPasswordValue: (val: string) => void;
  handleResetPassword: (id: string) => void;
  archiveAllSessions: () => void;
  deleteAllActiveSessions: () => void;
  updateProfile: (params: { username?: string; password?: string; avatarUrl?: string | null }) => Promise<{ success: boolean; error?: string }>;
  galleryItems: GalleryItem[];
  fetchGallery: (initial?: boolean) => void;
}

export const SettingsModal = ({
  showSettings,
  setShowSettings,
  activeTab,
  setActiveTab,
  params,
  setParams,
  t,
  currentUser,
  comfyModels,
  isFetchingComfyModels,
  fetchComfyModels,
  comfyStatus,
  testComfyConnection,
  isCheckingComfy,
  comfyCheckStatus,
  availableWorkflows,
  llmModels,
  isFetchingModels,
  fetchLLMModels,
  llmStatus,
  testLLMConnection,
  isCheckingLLM,
  llmCheckStatus,
  adminUsers,
  newUser,
  setNewUser,
  handleAddUser,
  isAdminLoading,
  deleteUser,
  resetPasswordId,
  setResetPasswordId,
  newPasswordValue,
  setNewPasswordValue,
  handleResetPassword,
  archiveAllSessions,
  deleteAllActiveSessions,
  updateProfile,
  galleryItems,
  fetchGallery
}: SettingsModalProps) => {
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Local states for textareas to allow manual save
  const [localNegativePrompt, setLocalNegativePrompt] = useState(params.negativePrompt);
  const [localLLMSystemMessage, setLocalLLMSystemMessage] = useState(params.llmSystemMessage);

  useEffect(() => {
    if (showSettings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditUsername(currentUser?.username || '');
      setNewPassword('');
      setConfirmPassword('');
      setLocalNegativePrompt(params.negativePrompt);
      setLocalLLMSystemMessage(params.llmSystemMessage);
    }
  }, [showSettings, currentUser, params.negativePrompt, params.llmSystemMessage]);

  if (!showSettings) return null;

  const handleUpdateProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error(t.passwordsDoNotMatch);
      return;
    }

    setIsUpdating(true);
    const result = await updateProfile({
      username: editUsername !== currentUser?.username ? editUsername : undefined,
      password: newPassword || undefined
    });

    if (result.success) {
      toast.success(t.profileUpdated);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error(result.error || t.profileUpdateFailed);
    }
    setIsUpdating(false);
  };

  const handleSaveTextarea = (field: 'negativePrompt' | 'llmSystemMessage') => {
    if (field === 'negativePrompt') {
      setParams({ ...params, negativePrompt: localNegativePrompt });
    } else {
      setParams({ ...params, llmSystemMessage: localLLMSystemMessage });
    }
    // The App.tsx saveSettings will pick up the change and show a toast
  };

  const handleSelectAvatar = async (url: string) => {
    const result = await updateProfile({ avatarUrl: url });
    if (result.success) {
      toast.success(t.profileUpdated);
      setShowImagePicker(false);
    } else {
      toast.error(result.error || t.profileUpdateFailed);
    }
  };

  const handleRemoveAvatar = async () => {
    const result = await updateProfile({ avatarUrl: null });
    if (result.success) {
      toast.success(t.profileUpdated);
    } else {
      toast.error(result.error || t.profileUpdateFailed);
    }
  };

  const userInitial = currentUser?.username?.charAt(0).toUpperCase() || '?';

  // Sort gallery: favorites first
  const sortedGallery = [...galleryItems].sort((a, b) => (b.isFavorite || 0) - (a.isFavorite || 0));

  return (
    <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close-btn" onClick={() => setShowSettings(false)}>×</button>
        <h3>{t.settings}</h3>            
        <div className="settings-tabs">
          <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>{t.tabProfile}</button>
          <button className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>{t.tabImages}</button>
          <button className={`tab-btn ${activeTab === 'comfy' ? 'active' : ''}`} onClick={() => setActiveTab('comfy')}>{t.tabComfy}</button>
          <button className={`tab-btn ${activeTab === 'llm' ? 'active' : ''}`} onClick={() => setActiveTab('llm')}>{t.tabLLM}</button>
          <button className={`tab-btn ${activeTab === 'archives' ? 'active' : ''}`} onClick={() => setActiveTab('archives')}>{t.tabArchives}</button>
          <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>{t.tabLogs}</button>
          <button className={`tab-btn ${activeTab === 'update' ? 'active' : ''}`} onClick={() => setActiveTab('update')}>{t.tabUpdate}</button>
          {currentUser?.isAdmin && (
            <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>{t.tabAdmin}</button>
          )}
        </div>

        <div className="tab-content">
          {activeTab === 'profile' && (
            <div className="profile-edit-section">
              <div className="avatar-edit-container">
                <div className="avatar-preview-wrapper" onClick={() => { setShowImagePicker(true); fetchGallery(true); }}>
                  {currentUser?.avatarUrl ? (
                    <img src={getFullImageUrl(currentUser.avatarUrl)} alt="Avatar" className="avatar-preview-img" />
                  ) : (
                    <div className="avatar-preview-initial">{userInitial}</div>
                  )}
                  <div className="avatar-edit-overlay">
                    <span>{t.changeAvatar}</span>
                  </div>
                </div>
                {currentUser?.avatarUrl && (
                  <button className="remove-avatar-btn" onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }} title={t.deleteAvatar}>🗑️</button>
                )}
              </div>

              <div className="settings-grid">
                <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                  <label>{t.username}</label>
                  <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
                </div>
                <div className="setting-item">
                  <label>{t.newPassword}</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="setting-item">
                  <label>{t.confirmPassword}</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="setting-item" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                  <button className="action-btn-large" onClick={handleUpdateProfile} disabled={isUpdating}>
                    {isUpdating ? '...' : t.save}
                  </button>
                </div>
              </div>

              {showImagePicker && (
                <div className="image-picker-overlay" onClick={() => setShowImagePicker(false)}>
                  <div className="image-picker-container" onClick={(e) => e.stopPropagation()}>
                    <div className="image-picker-header">
                      <h4>{t.selectFromLibrary}</h4>
                      <button className="picker-close" onClick={() => setShowImagePicker(false)}>×</button>
                    </div>
                    <div className="picker-grid">
                      {sortedGallery.length > 0 ? (
                        sortedGallery.map((item) => (
                          <div 
                            key={item.messageId} 
                            className={`picker-item ${item.isFavorite ? 'favorite' : ''}`}
                            onClick={() => handleSelectAvatar(item.imageUrl)}
                          >
                            <img src={getFullImageUrl(item.thumbnailUrl || item.imageUrl)} alt="Option" />
                            {item.isFavorite === 1 && <span className="picker-favorite-badge">❤️</span>}
                          </div>
                        ))
                      ) : (
                        <p className="empty-picker">{t.noArchives}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
           <div className="settings-grid">
             <div className="setting-item" style={{ gridColumn: 'span 2' }}>
               <label>{t.currentVersion}</label>
               <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)', marginBottom: '1rem' }}>v.{APP_CONFIG.VERSION}</div>
               <label>{t.devLogs}</label>
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
              <div className="settings-row-2">
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
              <div className="settings-row-2" style={{ marginTop: '1.5rem' }}>
                <div className="setting-item">
                  <label>{t.steps}</label>
                  <input type="number" value={params.steps} onChange={(e) => setParams({ ...params, steps: Number(e.target.value) })} min={1} max={50} />
                </div>
                <div className="setting-item">
                  <label>{t.cfg}</label>
                  <input type="number" value={params.cfg} onChange={(e) => setParams({ ...params, cfg: Number(e.target.value) })} step={0.1} min={1} max={20} />
                </div>
              </div>
              <div className="settings-grid" style={{ marginTop: '1.5rem' }}>
                <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                  <label>{t.negativePrompt}</label>
                  <textarea 
                    className="system-message-textarea" 
                    value={localNegativePrompt} 
                    onChange={(e) => setLocalNegativePrompt(e.target.value)} 
                    rows={3} 
                  />
                  <button 
                    className="action-btn-small" 
                    onClick={() => handleSaveTextarea('negativePrompt')}
                    disabled={localNegativePrompt === params.negativePrompt}
                    style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                  >
                    {t.save}
                  </button>
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
                  </button>
                </div>
                {comfyCheckStatus && <p className={`llm-status-msg ${comfyCheckStatus.type}`}>{comfyCheckStatus.msg}</p>}
              </div>
              <div className="setting-item" style={{ gridColumn: 'span 2' }}>
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
                    {isFetchingComfyModels ? '...' : <RefreshIcon size={16} />}
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
              </div>
              <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                <label>{t.llmModel}</label>
                <div className="model-select-group">
                  {llmModels.length > 0 ? (
                    <select value={params.llmModel} onChange={(e) => setParams({ ...params, llmModel: e.target.value })} className="model-select">
                      {llmModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={params.llmModel} onChange={(e) => setParams({ ...params, llmModel: e.target.value })} placeholder="llama3:latest" />
                  )}
                  <button className="refresh-models-btn" onClick={fetchLLMModels} disabled={isFetchingModels || !params.llmUrl} title={t.refreshModels}>{isFetchingModels ? '...' : <RefreshIcon size={16} />}</button>
                </div>
                {llmStatus && <p className={`llm-status-msg ${llmStatus.type}`}>{llmStatus.msg}</p>}
              </div>
              <div className="setting-item" style={{ gridColumn: 'span 2' }}>
                <label>{t.llmSystemMessage}</label>
                <textarea 
                  className="system-message-textarea" 
                  value={localLLMSystemMessage} 
                  onChange={(e) => setLocalLLMSystemMessage(e.target.value)} 
                  rows={5} 
                />
                <button 
                  className="action-btn-small" 
                  onClick={() => handleSaveTextarea('llmSystemMessage')}
                  disabled={localLLMSystemMessage === params.llmSystemMessage}
                  style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                >
                  {t.save}
                </button>
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
          )}

          {activeTab === 'update' && <UpdateTab t={t} />}
        </div>
      </div>
    </div>
  );
};

interface UpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  error?: string;
}

const UpdateTab = ({ t }: { t: Record<string, string> }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkUpdate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/updates/check`, { credentials: 'include' });
      const data = await res.json();
      setUpdateInfo(data);
    } catch (err) {
      console.error('Update check failed:', err);
      setUpdateInfo({ currentVersion: '?', error: 'Impossible de contacter le serveur' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkUpdate();
  }, []);

  return (
    <div className="settings-grid">
      <div className="setting-item" style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <label style={{ margin: 0 }}>{t.currentVersion}</label>
          <button className="refresh-models-btn" onClick={checkUpdate} disabled={isLoading}>
            {isLoading ? '...' : <RefreshIcon size={16} />}
          </button>
        </div>

        {updateInfo && (
          <div className="update-status-card" style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: `1px solid ${updateInfo.updateAvailable ? 'var(--accent)' : 'var(--border)'}`,
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.2rem' }}>Locale</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>v{updateInfo.currentVersion}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.2rem' }}>GitHub</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: updateInfo.updateAvailable ? 'var(--accent)' : 'inherit' }}>
                  {updateInfo.latestVersion ? `v${updateInfo.latestVersion}` : '---'}
                </div>
              </div>
            </div>

            {updateInfo.updateAvailable ? (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <p style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '1rem' }}>✨ Une mise à jour est disponible !</p>
                <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="action-btn-large" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  Voir sur GitHub
                </a>
              </div>
            ) : updateInfo.latestVersion ? (
              <p style={{ textAlign: 'center', opacity: 0.7, margin: '1rem 0 0' }}>✅ Vous utilisez la dernière version.</p>
            ) : updateInfo.error ? (
              <p style={{ textAlign: 'center', color: '#ff4b4b', margin: '1rem 0 0' }}>⚠️ {updateInfo.error}</p>
            ) : null}
          </div>
        )}

        {updateInfo?.releaseNotes && (
          <>
            <label>{t.devLogs} (Latest)</label>
            <div className="logs-container" style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '1rem',
              borderRadius: '8px',
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '0.85rem',
              lineHeight: '1.4'
            }}>
              <div className="markdown-logs">
                <MarkdownLoader content={updateInfo.releaseNotes} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
