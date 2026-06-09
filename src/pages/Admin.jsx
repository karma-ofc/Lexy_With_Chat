import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export default function Admin({ onShowNotification, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [publicDecks, setPublicDecks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  
  // Modal states
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [currentEditingDeckId, setCurrentEditingDeckId] = useState(null);
  const [currentCardsDeckId, setCurrentCardsDeckId] = useState(null);
  const [currentCardsDeckName, setCurrentCardsDeckName] = useState('');
  const [publicCards, setPublicCards] = useState([]);
  
  // Form states
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [deckLang, setDeckLang] = useState('Английский');
  const [deckCategories, setDeckCategories] = useState({ new: false, popular: false, recommended: false });
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImageString, setSelectedImageString] = useState(null);
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  
  // Ban popover states
  const [activeBanPopover, setActiveBanPopover] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('1');

  const showNotification = useCallback((message, type = 'success') => {
    if (onShowNotification) {
      onShowNotification(message, type);
    } else {
      alert(message);
    }
  }, [onShowNotification]);

  const resetAdminImagePreview = () => {
    setSelectedImageFile(null);
    setSelectedImageString(null);
  };

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getAllUsersForAdmin();
      setUsers(data.users || []);
      setFilteredUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification('Ошибка загрузки пользователей: ' + error.message, 'error');
    }
  }, [showNotification]);

  // Global refresh function for Auth component
  window.refreshAdminData = () => {
    loadUsers();
    loadPublicDecks();
    loadSubmissions();
  };

  const loadPublicDecks = useCallback(async () => {
    setLoadingDecks(true);
    try {
      const result = await api.getAdminPublicDecks();
      setPublicDecks(result.decks || []);
    } catch (error) {
      console.error('Error loading public decks:', error);
      showNotification('Ошибка загрузки колод: ' + error.message, 'error');
    } finally {
      setLoadingDecks(false);
    }
  }, [showNotification]);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    try {
      const result = await api.getAdminSubmissions();
      setSubmissions(result.submissions || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
      showNotification('Ошибка загрузки заявок: ' + error.message, 'error');
    } finally {
      setLoadingSubmissions(false);
    }
  }, [showNotification]);

  useEffect(() => {
    const userStr = localStorage.getItem('lexy_user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user || user.role !== 'admin') {
      showNotification('Доступ запрещён', 'error');
      if (onNavigate) onNavigate('home');
      return;
    }

    loadUsers();
    loadPublicDecks();
    loadSubmissions();

    // Register global init function
    window.initAdminPage = () => {
      loadUsers();
      loadPublicDecks();
      loadSubmissions();
    };
  }, [loadUsers, loadPublicDecks, loadSubmissions, onNavigate, showNotification]);

  // Filter users on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        (user.username && user.username.toLowerCase().includes(lowerQuery)) ||
        (user.email && user.email.toLowerCase().includes(lowerQuery))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleSearch = () => {
    // Search is handled by useEffect
  };

  const openBanMenu = (event, userId, username) => {
    event.stopPropagation();
    setActiveBanPopover(userId);
    setBanReason('');
    setBanDuration('1');
  };

  const closeBanMenu = () => {
    setActiveBanPopover(null);
    setBanReason('');
    setBanDuration('1');
  };

  const confirmBan = async (userId) => {
    console.log('Confirming ban for user', userId, 'with duration', banDuration, 'reason', banReason);
    let payload = {};
    if (banDuration === 'null') {
      payload = { until: null, reason: banReason };
    } else if (banDuration === 'forever') {
      payload = { until: 'forever', reason: banReason };
    } else {
      const days = Number(banDuration);
      const untilTs = Date.now() + days * 24 * 3600 * 1000;
      payload = { until: untilTs, reason: banReason };
    }

    console.log('Payload:', payload);
    try {
      await api.banUser(userId, payload);
      console.log('Ban API call successful');
      showNotification('Сохранено');
      closeBanMenu();
      loadUsers();
    } catch (err) {
      console.error('Ban error:', err);
      showNotification(err.message || 'Ошибка', 'error');
    }
  };

  const handleCreateDeck = () => {
    setCurrentEditingDeckId(null);
    setDeckName('');
    setDeckDescription('');
    setDeckLang('Английский');
    setDeckCategories({ new: false, popular: false, recommended: false });
    resetAdminImagePreview();
    setShowDeckModal(true);
  };

  const handleEditPublicDeck = (id, name, description, lang, category = '', customImage = '') => {
    setCurrentEditingDeckId(id);
    setDeckName(name);
    setDeckDescription(description || '');
    setDeckLang(lang || 'Английский');
    
    const categories = category ? category.split(',') : [];
    setDeckCategories({
      new: categories.includes('new'),
      popular: categories.includes('popular'),
      recommended: categories.includes('recommended')
    });
    
    resetAdminImagePreview();
    if (customImage) {
      setSelectedImageString(customImage);
    }
    
    setShowDeckModal(true);
  };

  const handleOpenCards = (deckId, deckName) => {
    setCurrentCardsDeckId(deckId);
    setCurrentCardsDeckName(deckName);
    setShowCardsModal(true);
    loadPublicDeckCards(deckId);
  };

  const loadPublicDeckCards = async (deckId) => {
    try {
      const result = await api.getAdminPublicDeckCards(deckId);
      setPublicCards(result.cards || []);
    } catch (error) {
      console.error('Error loading cards:', error);
      setPublicCards([]);
      showNotification('Ошибка загрузки карточек: ' + error.message, 'error');
    }
  };

  const handleAddPublicCard = async () => {
    if (!newCardFront.trim() || !newCardBack.trim()) {
      showNotification('Заполните оба поля', 'error');
      return;
    }
    
    try {
      await api.createPublicCard(currentCardsDeckId, newCardFront, newCardBack);
      setNewCardFront('');
      setNewCardBack('');
      showNotification('Карточка добавлена');
      await loadPublicDeckCards(currentCardsDeckId);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeletePublicCard = async (cardId) => {
    if (!window.confirm('Удалить карточку?')) return;
    
    try {
      await api.deletePublicCard(cardId);
      showNotification('Карточка удалена');
      await loadPublicDeckCards(currentCardsDeckId);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const getSelectedCategories = () => {
    const categories = [];
    if (deckCategories.new) categories.push('new');
    if (deckCategories.popular) categories.push('popular');
    if (deckCategories.recommended) categories.push('recommended');
    return categories.join(',');
  };

  const handleSavePublicDeck = async () => {
    if (!deckName.trim()) {
      showNotification('Введите название', 'error');
      return;
    }
    
    const category = getSelectedCategories();
    
    try {
      let deckId = currentEditingDeckId;

      if (deckId) {
        await api.updatePublicDeck(deckId, deckName, deckDescription, deckLang, category, selectedImageString);
        showNotification('Колода обновлена');
      } else {
        const createResult = await api.createPublicDeck(deckName, deckDescription, deckLang, category);
        deckId = createResult.deck.id;
        showNotification('Колода создана');
      }
      
      if (selectedImageFile) {
        try {
          await api.uploadPublicDeckImage(deckId, selectedImageFile);
        } catch (imageErr) {
          console.error('Failed to upload image:', imageErr);
          showNotification('Колода сохранена, но обложку загрузить не удалось', 'error');
        }
      }

      setShowDeckModal(false);
      loadPublicDecks();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeletePublicDeck = async (id) => {
    if (!window.confirm('Удалить эту колоду и все её карточки?')) return;
    
    try {
      await api.deletePublicDeck(id);
      showNotification('Колода удалена');
      loadPublicDecks();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleApproveSubmission = async (id) => {
    const select = document.getElementById(`submissionCategory_${id}`);
    const category = select ? select.value : '';
    try {
      await api.reviewSubmission(id, 'approve', category);
      showNotification('Заявка одобрена');
      loadSubmissions();
      loadPublicDecks();
    } catch (e) {
      showNotification(e.message || 'Ошибка при одобрении', 'error');
    }
  };

  const handleRejectSubmission = async (id) => {
    if (!window.confirm('Отклонить эту заявку?')) return;
    try {
      await api.reviewSubmission(id, 'reject');
      showNotification('Заявка отклонена');
      loadSubmissions();
    } catch (e) {
      showNotification(e.message || 'Ошибка при отклонении', 'error');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showNotification('Пожалуйста, выберите изображение', 'error');
      return;
    }
    
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImageString(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="admin-page">
      <h1>Панель администратора</h1>
      
      {/* Управление пользователями */}
      <div className="admin-section">
        <h2>Управление пользователями</h2>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, width: '100%', boxSizing: 'border-box', alignItems: 'center' }}>
          <input
            type="text"
            id="adminUserSearchInput"
            placeholder="Поиск по имени"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flexGrow: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', height: 36, boxSizing: 'border-box' }}
          />
          <button className="btn" id="adminUserSearchBtn" onClick={handleSearch} style={{ whiteSpace: 'nowrap', padding: '0 16px', fontSize: 13, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }}>
            Найти
          </button>
        </div>
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: 10 }}>ID</th>
                <th style={{ padding: 10 }}>Пользователь</th>
                <th style={{ padding: 10 }}>Email</th>
                <th style={{ padding: 10 }}>Роль</th>
                <th style={{ padding: 10 }}>Действия</th>
              </tr>
            </thead>
            <tbody id="adminUsersList">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
                    {loading ? 'Загрузка...' : 'Пользователей не найдено'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isAdmin = user.role === 'admin';
                  const isSelf = window.AppState?.user?.id === user.id;
                  const disabled = isAdmin || isSelf;
                  const title = isAdmin ? 'Нельзя блокировать администратора' : isSelf ? 'Нельзя заблокировать себя' : 'Заблокировать пользователя';
                  
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 10 }}>{user.id}</td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span>{user.username}</span>
                        </div>
                      </td>
                      <td style={{ padding: 10 }}>{user.email || '—'}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ background: isAdmin ? '#e74c3c' : 'var(--bg-tertiary)', color: isAdmin ? '#ffffff' : 'var(--text-primary)', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: 10, position: 'relative' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button 
                            className="btn-small" 
                            disabled={disabled} 
                            title={title}
                            onClick={(e) => openBanMenu(e, user.id, user.username)}
                          >
                            Заблокировать
                          </button>
                        </div>
                        {activeBanPopover === user.id && (
                          <div className="ban-popover" style={{ display: 'block', position: 'absolute', top: '40px', right: '0', minWidth: '320px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 10, zIndex: 1200 }}>
                            <div className="ban-popover-inner">
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>Заблокировать {user.username}</div>
                              <textarea 
                                rows="3" 
                                style={{ width: '100%' }}
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                              />
                              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <select 
                                  value={banDuration} 
                                  onChange={(e) => setBanDuration(e.target.value)}
                                  style={{ padding: '8px', borderRadius: 8 }}
                                >
                                  <option value="1">1 день</option>
                                  <option value="7">7 дней</option>
                                  <option value="30">30 дней</option>
                                  <option value="forever">Навсегда</option>
                                  <option value="null">Снять блок</option>
                                </select>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                  <button className="btn btn-outline" onClick={closeBanMenu}>Отмена</button>
                                  <button className="btn" onClick={() => confirmBan(user.id)}>Сохранить</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Публичные колоды */}
      <div className="admin-section">
        <h2>Публичные колоды библиотеки</h2>
        <button className="btn" id="createPublicDeckBtn" onClick={handleCreateDeck} style={{ marginBottom: 20 }}>
          + Создать колоду
        </button>
        
        <div id="adminDecksList" className="decks-grid">
          {loadingDecks ? (
            <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : publicDecks.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Публичных колод пока нет</p>
          ) : (
            publicDecks.map(deck => (
              <div key={deck.id} className="deck-card admin-deck-card" data-deck-id={deck.id}>
                <div className="deck-preview" style={deck.custom_image ? { background: 'none' } : {}}>
                  {deck.custom_image && <img src={deck.custom_image} alt={deck.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div className="deck-actions">
                    <button 
                      className="btn-icon" 
                      onClick={(e) => { e.stopPropagation(); handleEditPublicDeck(deck.id, deck.name, deck.description, deck.lang, deck.category, deck.custom_image); }}
                      title="Редактировать"
                    >
                      ✎
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={(e) => { e.stopPropagation(); handleDeletePublicDeck(deck.id); }}
                      title="Удалить"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="deck-info" onClick={() => handleOpenCards(deck.id, deck.name)}>
                  <div className="deck-name">{deck.name}</div>
                  <div className="deck-meta">{deck.lang || 'Английский'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Заявки на добавление */}
      <div className="admin-section">
        <h2>Заявки на добавление</h2>
        <div id="adminSubmissionsList">
          {loadingSubmissions ? (
            <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : submissions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Заявок пока нет</p>
          ) : (
            submissions.map(s => (
              <div key={s.id} className="public-card-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.deck_name}</div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>От: {s.user_username} — {s.created_at ? new Date(s.created_at).toLocaleString() : ''}</div>
                  <div style={{ marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: (s.message || '').replace(/\n/g, '<br>') }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220, alignItems: 'flex-end' }}>
                  <select id={`submissionCategory_${s.id}`} style={{ padding: 8, borderRadius: 8 }}>
                    <option value="">Без категории</option>
                    <option value="new">Новые</option>
                    <option value="popular">Популярные</option>
                    <option value="recommended">Рекомендуемые</option>
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => handleApproveSubmission(s.id)}>Одобрить</button>
                    <button className="btn btn-outline" onClick={() => handleRejectSubmission(s.id)}>Отклонить</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Модальное окно создания/редактирования колоды */}
      {showDeckModal && (
        <div className="modal-overlay active" id="publicDeckModal" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowDeckModal(false); }}>
          <div className="modal-content">
            <h3 id="publicDeckModalTitle">{currentEditingDeckId ? 'Редактировать колоду' : 'Создать колоду'}</h3>
            <div className="form-group" style={{ marginTop: 20 }}>
              <label>Название</label>
              <input type="text" id="publicDeckName" placeholder="Название колоды" value={deckName} onChange={(e) => setDeckName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Описание</label>
              <textarea id="publicDeckDescription" placeholder="Описание колоды" rows={3} value={deckDescription} onChange={(e) => setDeckDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Язык</label>
              <select id="publicDeckLang" value={deckLang} onChange={(e) => setDeckLang(e.target.value)}>
                <option value="Английский">Английский</option>
                <option value="Немецкий">Немецкий</option>
                <option value="Французский">Французский</option>
                <option value="Испанский">Испанский</option>
                <option value="Итальянский">Итальянский</option>
              </select>
            </div>
            <div className="form-group">
              <label>Категории (выберите нужные)</label>
              <div className="category-buttons" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                <label className="category-btn">
                  <input type="checkbox" checked={deckCategories.new} onChange={(e) => setDeckCategories(prev => ({ ...prev, new: e.target.checked }))} />
                  <span className="category-btn-content">
                    <span className="category-icon">✨</span>
                    <span>Новые</span>
                  </span>
                </label>
                <label className="category-btn">
                  <input type="checkbox" checked={deckCategories.popular} onChange={(e) => setDeckCategories(prev => ({ ...prev, popular: e.target.checked }))} />
                  <span className="category-btn-content">
                    <span className="category-icon">🔥</span>
                    <span>Популярные</span>
                  </span>
                </label>
                <label className="category-btn">
                  <input type="checkbox" checked={deckCategories.recommended} onChange={(e) => setDeckCategories(prev => ({ ...prev, recommended: e.target.checked }))} />
                  <span className="category-btn-content">
                    <span className="category-icon">⭐</span>
                    <span>Рекомендуемые</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Обложка колоды</label>
              <div className="deck-image-upload" id="adminDeckImageUpload">
                <div className="deck-image-preview" id="adminDeckImagePreview" onClick={() => document.getElementById('adminDeckImageInput').click()} style={{ cursor: 'pointer' }}>
                  {selectedImageString ? (
                    <img src={selectedImageString} alt="Обложка" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="deck-image-placeholder">
                      <span className="deck-image-icon">🖼️</span>
                      <span className="deck-image-text">Нажмите для загрузки</span>
                    </div>
                  )}
                </div>
                <input type="file" id="adminDeckImageInput" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </div>
              {selectedImageString && (
                <button className="btn-small btn-outline" id="removeAdminDeckImage" onClick={resetAdminImagePreview} style={{ marginTop: 8 }}>
                  Удалить изображение
                </button>
              )}
            </div>
            
            {currentEditingDeckId && (
              <button className="btn btn-outline" id="manageCardsAdminBtn" style={{ width: '100%', marginBottom: 15 }} onClick={() => {
                setShowDeckModal(false);
                handleOpenCards(currentEditingDeckId, deckName);
              }}>
                Управление карточками
              </button>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" id="savePublicDeckBtn" onClick={handleSavePublicDeck}>Сохранить</button>
              <button className="btn btn-outline" id="cancelPublicDeckBtn" onClick={() => setShowDeckModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно управления карточками */}
      {showCardsModal && (
        <div className="modal-overlay active" id="publicDeckCardsModal" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowCardsModal(false); }}>
          <div className="modal-content" style={{ maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 id="publicDeckCardsTitle">Управление карточками: {currentCardsDeckName}</h3>
            
            <div className="form-group" style={{ marginTop: 15 }}>
              <label>Добавить карточку</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                <input type="text" id="newPublicCardFront" placeholder="Слово" value={newCardFront} onChange={(e) => setNewCardFront(e.target.value)} style={{ flex: 1, minWidth: 150, height: 42, boxSizing: 'border-box' }} />
                <input type="text" id="newPublicCardBack" placeholder="Перевод" value={newCardBack} onChange={(e) => setNewCardBack(e.target.value)} style={{ flex: 1, minWidth: 150, height: 42, boxSizing: 'border-box' }} />
                <button className="btn" id="addPublicCardBtn" onClick={handleAddPublicCard} style={{ width: 170, flexShrink: 0, height: 42, boxSizing: 'border-box', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
            
            <div id="publicCardsList" style={{ marginTop: 20 }}>
              {publicCards.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Карточек пока нет</p>
              ) : (
                publicCards.map(card => (
                  <div key={card.id} className="public-card-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-primary)', borderRadius: 8, marginBottom: 8 }}>
                    <div className="card-content" style={{ flex: 1, display: 'flex', gap: 15 }}>
                      <span className="card-word" style={{ fontWeight: 600, minWidth: 100 }}>{card.front}</span>
                      <span className="card-translation">→ {card.back}</span>
                    </div>
                    <button className="delete-btn" onClick={() => handleDeletePublicCard(card.id)} style={{ background: 'var(--danger)', color: 'white', border: 'none', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ))
              )}
            </div>
            
            <button className="btn btn-outline" id="closePublicCardsModal" onClick={() => setShowCardsModal(false)} style={{ marginTop: 20 }}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}