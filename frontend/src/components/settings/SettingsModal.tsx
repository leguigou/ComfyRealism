import { useEffect, useMemo, useState } from 'react';
import './SettingsModal.css';
import './WorkflowImport.css';
import type { GenParameters, User, Language, GalleryItem, NodeMapping } from '../../types';
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
  comfyStatus: { type: 'success' | 'error'; msg: string } | null;
  testComfyConnection: () => void;
  isCheckingComfy: boolean;
  comfyCheckStatus: { type: 'success' | 'error'; msg: string } | null;
  availableWorkflows: string[];
  llmModels: string[];
  isFetchingModels: boolean;
  fetchLLMModels: () => void;
  llmStatus: { type: 'success' | 'error'; msg: string } | null;
  testLLMConnection: () => void;
  isCheckingLLM: boolean;
  llmCheckStatus: { type: 'success' | 'error'; msg: string } | null;
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

type WorkflowAnalysis = {
  nodeMapping: Partial<NodeMapping>;
  detected: Record<string, Array<{ id: string; classType: string; title?: string }>>;
  warnings: string[];
};

const EMPTY_MAPPING: NodeMapping = {
  checkpoint: '',
  positive: '',
  negative: '',
  ksampler: '',
  latent: '',
  save: '',
};

export const SettingsModal = ({
  showSettings, setShowSettings, activeTab, setActiveTab, params, setParams, t, currentUser,
  comfyModels, isFetchingComfyModels, fetchComfyModels, comfyStatus, testComfyConnection,
  isCheckingComfy, comfyCheckStatus, availableWorkflows, llmModels, isFetchingModels,
  fetchLLMModels, llmStatus, testLLMConnection, isCheckingLLM, llmCheckStatus, adminUsers,
  newUser, setNewUser, handleAddUser, isAdminLoading, deleteUser, resetPasswordId,
  setResetPasswordId, newPasswordValue, setNewPasswordValue, handleResetPassword,
  archiveAllSessions, deleteAllActiveSessions, updateProfile, galleryItems, fetchGallery,
}: SettingsModalProps) => {
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [localNegativePrompt, setLocalNegativePrompt] = useState(params.negativePrompt);
  const [localLLMSystemMessage, setLocalLLMSystemMessage] = useState(params.llmSystemMessage);
  const [modelSearch, setModelSearch] = useState('');

  const [workflowFile, setWorkflowFile] = useState<File | null>(null);
  const [workflowJson, setWorkflowJson] = useState<Record<string, unknown> | null>(null);
  const [workflowAnalysis, setWorkflowAnalysis] = useState<WorkflowAnalysis | null>(null);
  const [workflowMapping, setWorkflowMapping] = useState<NodeMapping>(EMPTY_MAPPING);
  const [workflowStatus, setWorkflowStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTestingWorkflow, setIsTestingWorkflow] = useState(false);
  const [overwriteWorkflow, setOverwriteWorkflow] = useState(false);

  useEffect(() => {
    if (!showSettings) return;
    setEditUsername(currentUser?.username || '');
    setNewPassword('');
    setConfirmPassword('');
    setLocalNegativePrompt(params.negativePrompt);
    setLocalLLMSystemMessage(params.llmSystemMessage);
    setModelSearch('');
  }, [showSettings, currentUser, params.negativePrompt, params.llmSystemMessage]);

  const detectedNodes = useMemo(() => {
    if (!workflowAnalysis) return [];
    return Object.values(workflowAnalysis.detected).flat().sort((a, b) => Number(a.id) - Number(b.id));
  }, [workflowAnalysis]);

  if (!showSettings) return null;

  const filteredModels = comfyModels.filter(model => model.toLowerCase().includes(modelSearch.toLowerCase()));
  const sortedGallery = [...galleryItems].sort((a, b) => (b.isFavorite || 0) - (a.isFavorite || 0));
  const userInitial = currentUser?.username?.charAt(0).toUpperCase() || '?';

  const handleUpdateProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) return toast.error(t.passwordsDoNotMatch || 'Les mots de passe ne correspondent pas');
    setIsUpdating(true);
    const result = await updateProfile({
      username: editUsername !== currentUser?.username ? editUsername : undefined,
      password: newPassword || undefined,
    });
    result.success ? toast.success(t.profileUpdated || 'Profil mis à jour') : toast.error(result.error || t.profileUpdateFailed || 'Échec de la mise à jour');
    if (result.success) { setNewPassword(''); setConfirmPassword(''); }
    setIsUpdating(false);
  };

  const handleWorkflowFile = async (file: File | null) => {
    setWorkflowFile(file);
    setWorkflowJson(null);
    setWorkflowAnalysis(null);
    setWorkflowMapping(EMPTY_MAPPING);
    setWorkflowStatus(null);
    if (!file) return;
    setIsAnalyzing(true);
    try {
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Le fichier doit être un JSON.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Le workflow dépasse 10 Mo.');
      const parsed = JSON.parse(await file.text());
      const response = await fetch(`${API_BASE}/api/workflows/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ workflow: parsed }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Analyse impossible');
      const mapping = { ...EMPTY_MAPPING, ...(data.analysis.nodeMapping || {}) } as NodeMapping;
      setWorkflowJson(parsed);
      setWorkflowAnalysis(data.analysis);
      setWorkflowMapping(mapping);
      setWorkflowStatus({ type: 'success', msg: 'Workflow analysé. Vérifie le mapping puis enregistre-le.' });
    } catch (error) {
      setWorkflowStatus({ type: 'error', msg: error instanceof Error ? error.message : 'Fichier invalide' });
    } finally { setIsAnalyzing(false); }
  };

  const saveWorkflow = async () => {
    if (!workflowFile || !workflowJson) return;
    setIsImporting(true);
    setWorkflowStatus(null);
    try {
      const response = await fetch(`${API_BASE}/api/workflows`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ filename: workflowFile.name, workflow: workflowJson, nodeMapping: workflowMapping, overwrite: overwriteWorkflow }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Import impossible');
      setParams({ ...params, workflowFile: data.filename, nodeMapping: workflowMapping });
      setWorkflowStatus({ type: 'success', msg: `${data.filename} a été importé et sélectionné.` });
      toast.success('Workflow importé');
    } catch (error) {
      setWorkflowStatus({ type: 'error', msg: error instanceof Error ? error.message : 'Import impossible' });
    } finally { setIsImporting(false); }
  };

  const testWorkflow = async (filename = params.workflowFile) => {
    if (!filename) return;
    setIsTestingWorkflow(true);
    setWorkflowStatus(null);
    try {
      const response = await fetch(`${API_BASE}/api/workflows/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          filename, comfyUrl: params.comfyUrl, comfyModel: params.comfyModel,
          prompt: 'professional studio photo of a red apple on a neutral background',
          negativePrompt: params.negativePrompt, width: Math.min(params.width, 512), height: Math.min(params.height, 512),
          steps: Math.min(params.steps, 4), cfg: params.cfg, sampler: params.sampler, scheduler: params.scheduler, seed: 1,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Test refusé par ComfyUI');
      setWorkflowStatus({ type: 'success', msg: `Workflow accepté par ComfyUI. Tâche ${data.promptId || ''} ajoutée à la file.` });
      toast.success('Workflow valide');
    } catch (error) {
      setWorkflowStatus({ type: 'error', msg: error instanceof Error ? error.message : 'Test impossible' });
    } finally { setIsTestingWorkflow(false); }
  };

  const renderMappingSelect = (key: keyof NodeMapping, label: string) => (
    <div className="workflow-map-item" key={key}>
      <label>{label}</label>
      <select value={workflowMapping[key]} onChange={e => setWorkflowMapping({ ...workflowMapping, [key]: e.target.value })}>
        <option value="">Non utilisé</option>
        {detectedNodes.map(node => <option key={`${key}-${node.id}`} value={node.id}>#{node.id} — {node.title || node.classType}</option>)}
      </select>
    </div>
  );

  return (
    <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <button className="settings-close-btn" onClick={() => setShowSettings(false)}>×</button>
        <h3>{t.settings || 'Paramètres'}</h3>
        <div className="settings-tabs">
          {(['profile','images','comfy','llm','archives','logs','update'] as const).map(tab => <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{t[`tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`] || tab}</button>)}
          {currentUser?.isAdmin && <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>{t.tabAdmin || 'Admin'}</button>}
        </div>

        <div className="tab-content">
          {activeTab === 'profile' && <div className="profile-edit-section">
            <div className="avatar-edit-container">
              <div className="avatar-preview-wrapper" onClick={() => { setShowImagePicker(true); fetchGallery(true); }}>
                {currentUser?.avatarUrl ? <img src={getFullImageUrl(currentUser.avatarUrl)} className="avatar-preview-img" alt="Avatar" /> : <div className="avatar-preview-initial">{userInitial}</div>}
              </div>
            </div>
            <div className="settings-grid">
              <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.username || 'Nom'}</label><input value={editUsername} onChange={e => setEditUsername(e.target.value)} /></div>
              <div className="setting-item"><label>{t.newPassword || 'Nouveau mot de passe'}</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
              <div className="setting-item"><label>{t.confirmPassword || 'Confirmation'}</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
              <button className="action-btn-large" onClick={handleUpdateProfile} disabled={isUpdating}>{isUpdating ? '...' : t.save || 'Enregistrer'}</button>
            </div>
            {showImagePicker && <div className="image-picker-overlay" onClick={() => setShowImagePicker(false)}><div className="image-picker-container" onClick={e => e.stopPropagation()}><div className="picker-grid">{sortedGallery.map(item => <div className="picker-item" key={item.messageId} onClick={async () => { await updateProfile({avatarUrl:item.imageUrl}); setShowImagePicker(false); }}><img src={getFullImageUrl(item.thumbnailUrl || item.imageUrl)} alt="" /></div>)}</div></div></div>}
          </div>}

          {activeTab === 'images' && <div className="settings-grid">
            <div className="setting-item"><label>{t.width || 'Largeur'}</label><input type="number" value={params.width} step={64} onChange={e => setParams({...params,width:Number(e.target.value)})} /></div>
            <div className="setting-item"><label>{t.height || 'Hauteur'}</label><input type="number" value={params.height} step={64} onChange={e => setParams({...params,height:Number(e.target.value)})} /></div>
            <div className="setting-item"><label>Steps</label><input type="number" value={params.steps} onChange={e => setParams({...params,steps:Number(e.target.value)})} /></div>
            <div className="setting-item"><label>CFG</label><input type="number" step="0.1" value={params.cfg} onChange={e => setParams({...params,cfg:Number(e.target.value)})} /></div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.negativePrompt || 'Prompt négatif'}</label><textarea rows={4} value={localNegativePrompt} onChange={e => setLocalNegativePrompt(e.target.value)} /><button className="action-btn-small" onClick={() => setParams({...params,negativePrompt:localNegativePrompt})}>{t.save || 'Enregistrer'}</button></div>
          </div>}

          {activeTab === 'comfy' && <div className="settings-grid">
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.comfyUrl || 'URL ComfyUI'}</label><div className="model-select-group"><input value={params.comfyUrl} onChange={e => setParams({...params,comfyUrl:e.target.value})} /><button className="refresh-models-btn test-conn-btn" onClick={testComfyConnection} disabled={isCheckingComfy}>{isCheckingComfy ? '...' : t.testConnection || 'Tester'}</button></div>{comfyCheckStatus && <p className={`llm-status-msg ${comfyCheckStatus.type}`}>{comfyCheckStatus.msg}</p>}</div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.checkpointModel || 'Checkpoint'}</label><input placeholder={t.searchModel || 'Rechercher'} value={modelSearch} onChange={e => setModelSearch(e.target.value)} /><div className="model-select-group"><select className="model-select" value={params.comfyModel} onChange={e => setParams({...params,comfyModel:e.target.value})}>{filteredModels.length ? filteredModels.map(m => <option key={m}>{m}</option>) : <option>{params.comfyModel}</option>}</select><button className="refresh-models-btn" onClick={fetchComfyModels} disabled={isFetchingComfyModels}>{isFetchingComfyModels ? '...' : <RefreshIcon size={16}/>}</button></div>{comfyStatus && <p className={`llm-status-msg ${comfyStatus.type}`}>{comfyStatus.msg}</p>}</div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.workflowFile || 'Workflow actif'}</label><select className="model-select" value={params.workflowFile} onChange={e => setParams({...params,workflowFile:e.target.value})}>{availableWorkflows.map(wf => <option key={wf}>{wf}</option>)}</select><div className="workflow-current-actions"><button className="action-btn-small" onClick={() => testWorkflow()} disabled={isTestingWorkflow}>{isTestingWorkflow ? 'Test...' : 'Tester le workflow actif'}</button></div></div>

            <div className="setting-item workflow-import-card" style={{gridColumn:'span 2'}}>
              <h4>Importer un workflow ComfyUI</h4>
              <p className="workflow-import-help">Exporte-le depuis ComfyUI avec <strong>Save (API Format)</strong>. Les nœuds sont détectés automatiquement, puis tu peux corriger leur correspondance avant l’enregistrement.</p>
              <div className="workflow-upload-row"><label className="workflow-upload-label"><input className="workflow-file-input" type="file" accept="application/json,.json" onChange={e => handleWorkflowFile(e.target.files?.[0] || null)} />{isAnalyzing ? 'Analyse...' : 'Choisir un JSON'}</label>{workflowFile && <span className="workflow-filename">{workflowFile.name}</span>}</div>
              {workflowAnalysis && <div className="workflow-analysis">
                {workflowAnalysis.warnings.map((warning,index) => <div className="workflow-warning" key={index}>{warning}</div>)}
                <div className="workflow-map-grid">
                  {renderMappingSelect('positive','Prompt positif')}{renderMappingSelect('negative','Prompt négatif')}{renderMappingSelect('ksampler','KSampler / seed')}{renderMappingSelect('latent','Résolution')}{renderMappingSelect('checkpoint','Checkpoint')}{renderMappingSelect('save','Image de sortie')}
                </div>
                <label className="workflow-overwrite"><input type="checkbox" checked={overwriteWorkflow} onChange={e => setOverwriteWorkflow(e.target.checked)} />Remplacer le workflow s’il existe déjà</label>
                <div className="workflow-actions"><button className="action-btn-large" onClick={saveWorkflow} disabled={isImporting}>{isImporting ? 'Import...' : 'Enregistrer et sélectionner'}</button>{workflowFile && availableWorkflows.includes(workflowFile.name) && <button className="action-btn-small" onClick={() => testWorkflow(workflowFile.name)} disabled={isTestingWorkflow}>{isTestingWorkflow ? 'Test...' : 'Tester dans ComfyUI'}</button>}</div>
              </div>}
              {workflowStatus && <div className={`workflow-status ${workflowStatus.type}`}>{workflowStatus.msg}</div>}
            </div>
          </div>}

          {activeTab === 'llm' && <div className="settings-grid">
            <div className="setting-item"><label>{t.llmEnabled || 'Activer le LLM'}</label><div className="toggle-container" onClick={() => setParams({...params,llmEnabled:!params.llmEnabled})}><div className={`toggle-switch ${params.llmEnabled ? 'on':''}`}/></div></div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.llmUrl || 'URL LLM'}</label><div className="model-select-group"><input value={params.llmUrl} onChange={e => setParams({...params,llmUrl:e.target.value})}/><button onClick={testLLMConnection} disabled={isCheckingLLM}>{isCheckingLLM?'...':t.testConnection || 'Tester'}</button></div>{llmCheckStatus && <p className={`llm-status-msg ${llmCheckStatus.type}`}>{llmCheckStatus.msg}</p>}</div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.llmModel || 'Modèle LLM'}</label><div className="model-select-group"><select value={params.llmModel} onChange={e => setParams({...params,llmModel:e.target.value})}>{llmModels.length ? llmModels.map(m => <option key={m}>{m}</option>) : <option>{params.llmModel}</option>}</select><button onClick={fetchLLMModels} disabled={isFetchingModels}>{isFetchingModels?'...':<RefreshIcon size={16}/>}</button></div>{llmStatus && <p className={`llm-status-msg ${llmStatus.type}`}>{llmStatus.msg}</p>}</div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.llmSystemMessage || 'Message système'}</label><textarea rows={6} value={localLLMSystemMessage} onChange={e => setLocalLLMSystemMessage(e.target.value)}/><button className="action-btn-small" onClick={() => setParams({...params,llmSystemMessage:localLLMSystemMessage})}>{t.save || 'Enregistrer'}</button></div>
          </div>}

          {activeTab === 'archives' && <div className="settings-grid"><button className="action-btn-large" onClick={archiveAllSessions}>{t.archiveAll || 'Archiver toutes les sessions'}</button><button className="confirm-btn delete" onClick={deleteAllActiveSessions}>{t.deleteAll || 'Supprimer les sessions actives'}</button></div>}
          {activeTab === 'logs' && <div className="settings-grid"><div className="setting-item" style={{gridColumn:'span 2'}}><label>{t.currentVersion || 'Version'}</label><strong>v.{APP_CONFIG.VERSION}</strong><div className="logs-container"><MarkdownLoader url={devLogsUrl}/></div></div></div>}
          {activeTab === 'update' && <div className="settings-grid"><div className="setting-item" style={{gridColumn:'span 2'}}><p>Version actuelle : <strong>v.{APP_CONFIG.VERSION}</strong></p></div></div>}

          {activeTab === 'admin' && currentUser?.isAdmin && <div className="settings-grid admin-panel">
            <div className="setting-item" style={{gridColumn:'span 2'}}><h3>{t.addUser || 'Ajouter un utilisateur'}</h3><div className="add-user-form"><input placeholder={t.username || 'Nom'} value={newUser.username} onChange={e => setNewUser({...newUser,username:e.target.value})}/><input type="password" placeholder={t.password || 'Mot de passe'} value={newUser.password} onChange={e => setNewUser({...newUser,password:e.target.value})}/><button onClick={handleAddUser} disabled={isAdminLoading}>{isAdminLoading?'...':t.addUser || 'Ajouter'}</button></div></div>
            <div className="setting-item" style={{gridColumn:'span 2'}}><table className="user-table"><thead><tr><th>{t.username || 'Utilisateur'}</th><th>{t.role || 'Rôle'}</th><th>{t.images || 'Images'}</th><th>{t.diskUsage || 'Disque'}</th><th>{t.actions || 'Actions'}</th></tr></thead><tbody>{adminUsers.map(user => <tr key={user.id}><td>{user.username}</td><td>{user.isAdmin?'Admin':'Utilisateur'}</td><td>{user.imageCount || 0}</td><td>{formatBytes(user.diskUsage || 0)}</td><td>{resetPasswordId === user.id ? <><input value={newPasswordValue} onChange={e => setNewPasswordValue(e.target.value)}/><button onClick={() => handleResetPassword(user.id)}>OK</button></> : <><button onClick={() => setResetPasswordId(user.id)}>Mot de passe</button><button className="delete" onClick={() => deleteUser(user.id)}>Supprimer</button></>}</td></tr>)}</tbody></table></div>
          </div>}
        </div>
      </div>
    </div>
  );
};
