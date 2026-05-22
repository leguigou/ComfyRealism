import React, { useEffect } from 'react';
import './ChatInterface.css';
import type { Message, Language, GalleryItem, GenParameters } from '../../types';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageText } from './MessageText';
import { InfoIcon, RefreshIcon, SendIcon, ChatIcon } from '../ui/Icons';
import { getFullImageUrl, formatDuration } from '../../services/api';

interface ChatInterfaceProps {
  view: 'chat' | 'gallery' | 'archives';
  messages: Message[];
  lang: Language;
  t: Record<string, string>;
  isGenerating: boolean;
  isEnhancing: boolean;
  currentSessionId: string | null;
  input: string;
  setInput: (val: string) => void;
  handleSend: (overrideInput?: string, isRegeneration?: boolean) => void;
  interruptGeneration: () => void;
  handleEdit: (text: string) => void;
  goToImage: (sessionId: string, messageId: string) => void;
  setActiveInfoId: (id: string | null) => void;
  activeInfoId: string | null;
  setMessageToDelete: (id: string | null) => void;
  toggleFavorite: (sessionId: string, messageId: string, currentStatus: number | undefined) => void;
  handleImageClick: (item: { url: string, thumbnailUrl?: string, sessionId: string, messageId: string, isFavorite?: number, source: 'chat' | 'gallery' }) => void;
  favoritedId: string | null;
  galleryItems: GalleryItem[];
  isFetchingGallery: boolean;
  favoritesOnly: boolean;
  setFavoritesOnly: (val: boolean) => void;
  showArchivedInGallery: boolean;
  setShowArchivedInGallery: (val: boolean) => void;
  setGalleryOffset: (val: number) => void;
  setHasMoreGallery: (val: boolean) => void;
  lastImageElementRef: (node: HTMLDivElement) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  params: GenParameters;
  smoothScrollTo: (id: string) => void;
  handleScroll: () => void;
  downloadImage: (url: string, filename: string) => void;
}

export const ChatInterface = ({
  view,
  messages,
  lang,
  t,
  isGenerating,
  isEnhancing,
  currentSessionId,
  input,
  setInput,
  handleSend,
  interruptGeneration,
  handleEdit,
  goToImage,
  setActiveInfoId,
  activeInfoId,
  setMessageToDelete,
  toggleFavorite,
  handleImageClick,
  favoritedId,
  galleryItems,
  isFetchingGallery,
  favoritesOnly,
  setFavoritesOnly,
  showArchivedInGallery,
  setShowArchivedInGallery,
  setGalleryOffset,
  setHasMoreGallery,
  lastImageElementRef,
  containerRef,
  textareaRef,
  messagesEndRef,
  params,
  smoothScrollTo,
  handleScroll,
  downloadImage
}: ChatInterfaceProps) => {
  
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      if (input === '') {
        textarea.style.height = ''; 
      } else {
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }
  }, [input, textareaRef]);

  return (
    <>
      <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
        {view === 'chat' || view === 'archives' ? (
          <>
            {messages.length === 0 && (
              view === 'chat' ? <WelcomeScreen lang={lang} /> : <div className="empty-state"><p>{t.noArchives}</p></div>
            )}
            {messages.map((msg, index) => {
              const messageText = msg.text || msg.prompt;
              // On ne masque le texte que s'il est redondant ET que le message n'est pas en cours de traitement/IA
              const isRedundant = index > 0 && messageText === (messages[index - 1].text || messages[index - 1].prompt);
              const shouldShowText = messageText && (!isRedundant || (msg.role === 'bot' && (msg.isEnhancing || msg.status === 'pending' || msg.status === 'processing')));
              
              return (
                <div key={msg.id} id={`msg-${msg.id}`} className={`message-row ${msg.role}`}>
                  <div className="avatar">{msg.role === 'user' ? 'U' : 'C'}</div>
                  <div className="message-content">
                    {shouldShowText && (
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
                  )}
                  {msg.imageUrl && (
                    <div className="image-wrapper" onClick={() => handleImageClick({ 
                      url: msg.imageUrl!, 
                      thumbnailUrl: msg.thumbnailUrl,
                      sessionId: currentSessionId!, 
                      messageId: msg.id, 
                      isFavorite: msg.isFavorite, 
                      source: 'chat' 
                    })}>
                      <img 
                        src={getFullImageUrl(msg.thumbnailUrl || msg.imageUrl!)} 
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
                  <div className={`message-actions ${msg.imageUrl ? 'has-image' : ''}`}>
                    <button className="action-btn-icon edit" onClick={() => { 
                      const textToEdit = msg.role === 'user' ? (msg.text || '') : (msg.text || msg.prompt || '');
                      handleEdit(textToEdit); 
                    }} title={t.edit}>✎</button>
                    {msg.imageUrl && (
                      <>
                        <button className="action-btn-icon info" onClick={(e) => { e.stopPropagation(); setActiveInfoId(activeInfoId === msg.id ? null : msg.id); }} title="Info">
                          <InfoIcon />
                        </button>
                        <button className="action-btn-icon download" onClick={(e) => { e.stopPropagation(); downloadImage(getFullImageUrl(msg.imageUrl!), `img-${msg.id}.png`); }} title={t.download}>💾</button>
                        <button className="action-btn-icon regenerate" onClick={(e) => { e.stopPropagation(); handleSend(msg.text || msg.prompt || '', true); }} title={t.regenerate}>
                          <RefreshIcon />
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
            )}
            <div ref={messagesEndRef} />
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
                  <button className={`control-pill ${!showArchivedInGallery ? 'active' : ''}`} onClick={() => { setShowArchivedInGallery(false); setGalleryOffset(0); setHasMoreGallery(true); }}>
                    {t.active}
                  </button>
                  <button className={`control-pill ${showArchivedInGallery ? 'active' : ''}`} onClick={() => { setShowArchivedInGallery(true); setGalleryOffset(0); setHasMoreGallery(true); }}>
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
                onClick={() => handleImageClick({ 
                  url: item.imageUrl, 
                  thumbnailUrl: item.thumbnailUrl,
                  sessionId: item.sessionId, 
                  messageId: item.messageId, 
                  isFavorite: item.isFavorite, 
                  source: 'gallery' 
                })}
                >
                  <img src={getFullImageUrl(item.thumbnailUrl || item.imageUrl)} alt={item.prompt} loading="lazy" />
                  <div className="gallery-item-actions">
                    <button 
                      className="gallery-action-btn"
                      onClick={(e) => { e.stopPropagation(); goToImage(item.sessionId, item.messageId); }}
                      title={t.viewInChat}
                    >
                      <ChatIcon size={18} />
                    </button>
                  </div>
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
            <textarea 
              ref={textareaRef} 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
              placeholder={params.llmEnabled ? t.aiPlaceholder : t.placeholder} 
              rows={1} 
            />
            {input && <button className="clear-input-btn" onClick={() => setInput('')} title="Effacer le texte">×</button>}
            <button className={`send-btn ${isGenerating && !input.trim() ? 'stop-btn' : ''}`} onClick={() => isGenerating && !input.trim() ? interruptGeneration() : handleSend()} disabled={!input.trim() && !isGenerating}>
              {isGenerating && !input.trim() ? (
                <div className="stop-icon"></div>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
