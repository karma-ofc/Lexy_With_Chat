import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export default function Library({ onShowNotification, onStartStudy }) {
  const [publicDecks, setPublicDecks] = useState([]);
  const [recommendedDecks, setRecommendedDecks] = useState([]);
  const [popularDecks, setPopularDecks] = useState([]);
  const [newDecks, setNewDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const loadingRef = useRef(false);
  
  // Modal states
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showPublicDeckModal, setShowPublicDeckModal] = useState(false);
  const [currentEditingDeckId, setCurrentEditingDeckId] = useState(null);
  const [currentCardsDeckId, setCurrentCardsDeckId] = useState(null);
  const [currentCardsDeckName, setCurrentCardsDeckName] = useState('');
  const [libraryCards, setLibraryCards] = useState([]);
  const [selectedPublicDeck, setSelectedPublicDeck] = useState(null);
  const [selectedPublicDeckCards, setSelectedPublicDeckCards] = useState([]);
  
  // Form states
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [deckLang, setDeckLang] = useState('Английский');
  const [deckCategories, setDeckCategories] = useState({ new: false, popular: false, recommended: false });
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');

  const showNotification = (message, type = 'success') => {
    if (onShowNotification) {
      onShowNotification(message, type);
    } else {
      alert(message);
    }
  };

  const loadPublicDecksFromServer = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await api.getPublicDecks();
      const decks = result.decks || [];
      setPublicDecks(decks);

      // Фильтруем по категориям (колода может быть в нескольких категориям через запятую)
      const recommended = decks.filter(d => d.category && d.category.split(',').includes('recommended'));
      const popular = decks.filter(d => d.category && d.category.split(',').includes('popular'));
      const newDecksFiltered = decks.filter(d => d.category && d.category.split(',').includes('new'));

      setRecommendedDecks(recommended);
      setPopularDecks(popular);
      setNewDecks(newDecksFiltered);
    } catch (error) {
      console.error('Error loading public decks:', error);
      // Используем статические колоды как fallback
      if (window.AppState?.publicDecks) {
        const staticDecks = window.AppState.publicDecks.map(d => ({
          id: d.id,
          name: d.name,
          lang: d.lang,
          cards_count: d.cardsCount || 0,
          category: d.category || ''
        }));
        setPublicDecks(staticDecks);

        const recommended = staticDecks.filter(d => d.category && d.category.split(',').includes('recommended'));
        const popular = staticDecks.filter(d => d.category && d.category.split(',').includes('popular'));
        const newDecksFiltered = staticDecks.filter(d => d.category && d.category.split(',').includes('new'));

        setRecommendedDecks(recommended);
        setPopularDecks(popular);
        setNewDecks(newDecksFiltered);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('lexy_user');
    const userData = userStr ? JSON.parse(userStr) : null;
    setUser(userData);
    loadPublicDecksFromServer();

    // Register global init function
    window.initLibraryPage = () => {
      const userStr = localStorage.getItem('lexy_user');
      const userData = userStr ? JSON.parse(userStr) : null;
      setUser(userData);
      if (!loadingRef.current) loadPublicDecksFromServer();
    };

    window.refreshLibrary = () => {
      if (!loadingRef.current) {
        const userStr = localStorage.getItem('lexy_user');
        const userData = userStr ? JSON.parse(userStr) : null;
        setUser(userData);
        loadPublicDecksFromServer();
      }
    };
  }, [loadPublicDecksFromServer]);

  const getAdminButtons = (deck) => {
    if (user && user.role === 'admin') {
      return (
        <div className="admin-deck-actions" style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '5px', zIndex: 10 }}>
          <button 
            className="btn-icon" 
            onClick={(e) => { e.stopPropagation(); handleEditLibraryDeck(deck); }}
            title="Редактировать"
          >
            ✎
          </button>
          <button 
            className="btn-icon" 
            onClick={(e) => { e.stopPropagation(); handleDeleteLibraryDeck(deck.id); }}
            title="Удалить"
          >
            ×
          </button>
        </div>
      );
    }
    return null;
  };

  const handleAddPublicDeck = async (deckId) => {
    const isAuthenticated = Boolean(localStorage.getItem('lexy_token') && localStorage.getItem('lexy_user'));
    const numericDeckId = Number(deckId);
    const deck = publicDecks.find(d => d.id == deckId || d.id === numericDeckId);
    if (!deck) {
      // Try static decks
      const staticDeck = window.AppState?.publicDecks?.find(d => d.id == deckId || d.id === numericDeckId);
      if (!staticDeck) return;

      // For authenticated users trust server state, not stale local cache
      if (isAuthenticated) {
        try {
          const result = await api.addPublicDeck(staticDeck.id);
          if (result && result.deck) {
            const serverDeck = result.deck;
            const cards = (serverDeck.cards || []).map(card => ({
              id: card.id,
              word: card.front,
              translation: card.back,
              is_favorite: card.is_favorite === true || card.is_favorite === 'true',
              repetitions: card.repetitions || 0,
              interval: card.interval || 1,
              ease: card.ease || 2.5,
              nextReview: card.next_review || null
            }));

            const clientDeck = {
              id: serverDeck.id,
              name: serverDeck.name,
              cards: cards,
              createdAt: serverDeck.created_at,
              isFavorite: false,
              source: serverDeck.source || 'public',
              publicDeckId: staticDeck.id,
              customImage: serverDeck.custom_image || staticDeck.custom_image || null,
              user_deck_id: serverDeck.user_deck_id || null
            };

            window.AppState.userDecks = window.AppState.userDecks || [];
            const existingIdx = window.AppState.userDecks.findIndex(d => String(d.id) === String(clientDeck.id));
            if (existingIdx >= 0) window.AppState.userDecks[existingIdx] = clientDeck;
            else window.AppState.userDecks.push(clientDeck);
            window.saveState?.();
            if (typeof window.refreshMyDecks === 'function') window.refreshMyDecks();
            if (typeof window.refreshLibrary === 'function') window.refreshLibrary();
            showNotification(existingIdx >= 0 ? 'Колода уже в Моих колодах (данные обновлены)' : 'Колода добавлена в Мои колоды');
            return;
          }
        } catch (e) {
          console.error('Failed to add static public deck via API:', e);
          showNotification(e.message || 'Ошибка при добавлении колоды', 'error');
          return;
        }
      }

      
      // Check if already added
      const existingDeck = window.AppState?.userDecks?.find(d => d.source === 'public' && d.name === staticDeck.name);
      if (existingDeck) {
        showNotification('Колода уже добавлена', 'error');
        return;
      }
      
      if (!canCreateDeck()) {
        showNotification('Слишком много созданий колод. Подождите час', 'error');
        return;
      }
      
      if (window.AppState) {
        window.AppState.deckCreateTimes = window.AppState.deckCreateTimes || [];
        window.AppState.deckCreateTimes.push(Date.now());
        
        const newDeck = {
          id: 'deck_' + Date.now(),
          name: staticDeck.name,
          cards: [],
          createdAt: new Date().toISOString(),
          isFavorite: false,
          source: 'public',
          publicDeckId: staticDeck.id,
          customImage: staticDeck.custom_image || null
        };
        
        window.AppState.userDecks = window.AppState.userDecks || [];
        window.AppState.userDecks.push(newDeck);
        
        // Sync with server immediately if user is registered
        if (window.AppState.user && window.AppState.user.isRegistered) {
          try {
            const result = await api.createDeck(newDeck.name, '', newDeck.source, newDeck.publicDeckId);
            newDeck.id = result.deck.id;
            if (newDeck.customImage) {
              await api.updateDeck(newDeck.id, newDeck.name, '', newDeck.customImage);
            }
          } catch (e) {
            console.error('Failed to sync deck to server:', e);
          }
        }
        
        window.saveState?.();
      }
      
      showNotification('Колода добавлена в Мои колоды');
      return;
    }
    
    // If user is authenticated, attach existing public deck on server (no duplication)
    if (isAuthenticated) {
      try {
        const result = await api.addPublicDeck(deck.id);
        if (result && result.deck) {
          const serverDeck = result.deck;
          const cards = (serverDeck.cards || []).map(card => ({
            id: card.id,
            word: card.front,
            translation: card.back,
            is_favorite: card.is_favorite === true || card.is_favorite === 'true',
            repetitions: card.repetitions || 0,
            interval: card.interval || 1,
            ease: card.ease || 2.5,
            nextReview: card.next_review || null
          }));

          const clientDeck = {
            id: serverDeck.id,
            name: serverDeck.name,
            cards: cards,
            createdAt: serverDeck.created_at,
            isFavorite: false,
            source: serverDeck.source || 'public',
            publicDeckId: deck.id,
            customImage: serverDeck.custom_image || null,
            user_deck_id: serverDeck.user_deck_id || null
          };

          window.AppState.userDecks = window.AppState.userDecks || [];
          const existingIdx = window.AppState.userDecks.findIndex(d => String(d.id) === String(clientDeck.id));
          if (existingIdx >= 0) window.AppState.userDecks[existingIdx] = clientDeck;
          else window.AppState.userDecks.push(clientDeck);
          window.saveState?.();
          if (typeof window.refreshMyDecks === 'function') window.refreshMyDecks();
          if (typeof window.refreshLibrary === 'function') window.refreshLibrary();
          showNotification(existingIdx >= 0 ? 'Колода уже в Моих колодах (данные обновлены)' : 'Колода добавлена в Мои колоды');
          return;
        }
      } catch (e) {
        console.error('Failed to add public deck via API:', e);
        showNotification(e.message || 'Ошибка при добавлении колоды', 'error');
        return;
      }
    }

    // Offline / not-registered fallback
    const existingDeck = window.AppState?.userDecks?.find(d => d.source === 'public' && d.name === deck.name);
    if (existingDeck) {
      showNotification('Колода уже добавлена', 'error');
      return;
    }

    if (!canCreateDeck()) {
      showNotification('Слишком много созданий колод. Подождите час', 'error');
      return;
    }

    if (window.AppState) {
      window.AppState.deckCreateTimes = window.AppState.deckCreateTimes || [];
      window.AppState.deckCreateTimes.push(Date.now());
    }

    // Try to load cards from the public deck
    let cards = [];
    try {
      const result = await api.getPublicDeckCards(deckId);
      if (result.cards && result.cards.length > 0) {
        cards = result.cards.map(card => ({
          id: 'card_' + Date.now() + Math.random(),
          word: card.front,
          translation: card.back,
          repetitions: 0,
          interval: 1,
          ease: 2.5,
          nextReview: new Date().toISOString()
        }));
      }
    } catch (e) {
      console.log('Could not load cards from public deck');
    }

    const newDeck = {
      id: 'deck_' + Date.now(),
      name: deck.name,
      cards: cards,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      source: 'public',
      publicDeckId: deck.id,
      customImage: deck.custom_image || null
    };

    window.AppState.userDecks = window.AppState.userDecks || [];
    window.AppState.userDecks.push(newDeck);
    window.saveState?.();

    showNotification(`Колода добавлена в Мои колоды с ${cards.length} картами`);
  };

  const canCreateDeck = () => {
    const createTimes = window.AppState?.deckCreateTimes || [];
    const oneHourAgo = Date.now() - 3600000;
    const recentCreations = createTimes.filter(time => time > oneHourAgo);
    return recentCreations.length < 10;
  };

  const handleEditLibraryDeck = (deck) => {
    setCurrentEditingDeckId(deck.id);
    setDeckName(deck.name);
    setDeckDescription(deck.description || '');
    setDeckLang(deck.lang || 'Английский');
    
    const categories = deck.category ? deck.category.split(',') : [];
    setDeckCategories({
      new: categories.includes('new'),
      popular: categories.includes('popular'),
      recommended: categories.includes('recommended')
    });
    
    setShowDeckModal(true);
  };

  const handleSaveLibraryDeck = async () => {
    if (!deckName.trim()) {
      showNotification('Введите название', 'error');
      return;
    }

    const selectedCategories = [];
    if (deckCategories.new) selectedCategories.push('new');
    if (deckCategories.popular) selectedCategories.push('popular');
    if (deckCategories.recommended) selectedCategories.push('recommended');
    const category = selectedCategories.join(',');

    try {
      await api.updatePublicDeck(currentEditingDeckId, deckName, deckDescription, deckLang, category, null);
      showNotification('Колода обновлена');
      setShowDeckModal(false);
      loadPublicDecksFromServer();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteLibraryDeck = async (id) => {
    if (!window.confirm('Удалить эту колоду и все её карточки?')) return;
    
    try {
      await api.deletePublicDeck(id);
      showNotification('Колода удалена');
      loadPublicDecksFromServer();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleOpenLibraryDeckCards = async (deckId, deckName) => {
    setCurrentCardsDeckId(deckId);
    setCurrentCardsDeckName(deckName);
    setShowCardsModal(true);
    await loadLibraryDeckCards(deckId);
  };

  const handleOpenPublicDeck = async (deck) => {
    try {
      const result = await api.getPublicDeckCards(deck.id);
      const cards = (result.cards || []).map(card => ({
        id: card.id,
        front: card.front,
        back: card.back,
        is_favorite: card.is_favorite === true || card.is_favorite === 'true'
      }));

      setSelectedPublicDeck(deck);
      setSelectedPublicDeckCards(cards);
      setShowPublicDeckModal(true);
    } catch (error) {
      showNotification('Ошибка загрузки колоды: ' + (error.message || 'неизвестная ошибка'), 'error');
    }
  };

  const handleStartPublicStudy = (mode = 1) => {
    if (!selectedPublicDeck || selectedPublicDeckCards.length === 0) {
      showNotification('В этой колоде нет карточек', 'error');
      return;
    }

    if (typeof onStartStudy === 'function') {
      onStartStudy({
        id: selectedPublicDeck.id,
        name: selectedPublicDeck.name,
        cards: selectedPublicDeckCards
      }, mode);
      setShowPublicDeckModal(false);
    }
  };

  const loadLibraryDeckCards = async (deckId) => {
    try {
      const result = await api.getAdminPublicDeckCards(deckId);
      setLibraryCards(result.cards || []);
    } catch (error) {
      console.error('Error loading cards:', error);
      setLibraryCards([]);
    }
  };

  const handleAddLibraryCard = async () => {
    if (!newCardFront.trim() || !newCardBack.trim()) {
      showNotification('Заполните оба поля', 'error');
      return;
    }
    
    try {
      await api.createPublicCard(currentCardsDeckId, newCardFront, newCardBack);
      setNewCardFront('');
      setNewCardBack('');
      showNotification('Карточка добавлена');
      await loadLibraryDeckCards(currentCardsDeckId);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteLibraryCard = async (cardId) => {
    if (!window.confirm('Удалить карточку?')) return;
    
    try {
      await api.deletePublicCard(cardId);
      showNotification('Карточка удалена');
      await loadLibraryDeckCards(currentCardsDeckId);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const renderDeckGrid = (decks, gradientClass = 'accent') => {
    if (decks.length === 0) {
      return <p style={{ color: 'var(--text-secondary)' }}>Пока нет колод</p>;
    }
    
    return (
      <div className="decks-grid">
        {decks.map(deck => (
          <div className="deck-card" key={deck.id} onClick={() => handleOpenPublicDeck(deck)}>
            <div className="deck-preview" style={deck.custom_image ? { background: 'none' } : { background: `linear-gradient(135deg, var(--${gradientClass}), var(--${gradientClass}-hover))` }}>
              {deck.custom_image && (
                <img src={deck.custom_image} alt={deck.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {getAdminButtons(deck)}
              <div className="deck-actions">
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleAddPublicDeck(deck.id); }}>+</button>
              </div>
            </div>
            <div className="deck-info">
              <div className="deck-name">{deck.name}</div>
              <div className="deck-meta">{deck.cards_count || 0} карт • {deck.lang || 'Английский'}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="library-page">
      <h1>Библиотека</h1>
      
      <section>
        <h2>Рекомендуемые колоды</h2>
        {loading ? <p>Загрузка...</p> : renderDeckGrid(recommendedDecks, 'accent')}
      </section>
      
      <section>
        <h2>Популярные колоды</h2>
        {loading ? <p>Загрузка...</p> : renderDeckGrid(popularDecks, 'accent')}
      </section>
      
      <section>
        <h2>Новые колоды</h2>
        {loading ? <p>Загрузка...</p> : renderDeckGrid(newDecks, 'accent')}
      </section>

      {/* Модальное окно редактирования колоды */}
      {showDeckModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowDeckModal(false); }}>
          <div className="modal-content">
            <h3>Редактировать колоду</h3>
            <div className="form-group">
              <label>Название</label>
              <input 
                type="text" 
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Название колоды"
              />
            </div>
            <div className="form-group">
              <label>Описание</label>
              <textarea 
                value={deckDescription}
                onChange={(e) => setDeckDescription(e.target.value)}
                placeholder="Описание колоды"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Язык</label>
              <select value={deckLang} onChange={(e) => setDeckLang(e.target.value)}>
                <option value="Английский">Английский</option>
                <option value="Немецкий">Немецкий</option>
                <option value="Французский">Французский</option>
                <option value="Испанский">Испанский</option>
                <option value="Итальянский">Итальянский</option>
              </select>
            </div>
            <div className="form-group">
              <label>Категории</label>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={deckCategories.new}
                    onChange={(e) => setDeckCategories(prev => ({ ...prev, new: e.target.checked }))}
                  />
                  Новые
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={deckCategories.popular}
                    onChange={(e) => setDeckCategories(prev => ({ ...prev, popular: e.target.checked }))}
                  />
                  Популярные
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={deckCategories.recommended}
                    onChange={(e) => setDeckCategories(prev => ({ ...prev, recommended: e.target.checked }))}
                  />
                  Рекомендуемые
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn" onClick={handleSaveLibraryDeck}>Сохранить</button>
              <button className="btn btn-outline" onClick={() => setShowDeckModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно управления карточками */}
      {showCardsModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowCardsModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3>Управление карточками: {currentCardsDeckName}</h3>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>Добавить карточку</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={newCardFront}
                  onChange={(e) => setNewCardFront(e.target.value)}
                  placeholder="Слово" 
                  style={{ flex: 1, minWidth: '150px' }}
                />
                <input 
                  type="text" 
                  value={newCardBack}
                  onChange={(e) => setNewCardBack(e.target.value)}
                  placeholder="Перевод" 
                  style={{ flex: 1, minWidth: '150px' }}
                />
                <button className="btn" onClick={handleAddLibraryCard}>+</button>
              </div>
            </div>
            <div id="libraryCardsList" style={{ marginTop: '20px' }}>
              {libraryCards.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Карточек пока нет</p>
              ) : (
                libraryCards.map(card => (
                  <div key={card.id} className="public-card-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                    <div className="card-content">
                      <span className="card-word" style={{ fontWeight: 'bold' }}>{card.front}</span>
                      <span className="card-translation" style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>→ {card.back}</span>
                    </div>
                    <button className="delete-btn" onClick={() => handleDeleteLibraryCard(card.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '18px' }}>×</button>
                  </div>
                ))
              )}
            </div>
            <button className="btn btn-outline" onClick={() => setShowCardsModal(false)} style={{ marginTop: '20px' }}>Закрыть</button>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра публичной колоды */}
      {showPublicDeckModal && selectedPublicDeck && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowPublicDeckModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3>{selectedPublicDeck.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
              {selectedPublicDeckCards.length} карт • {selectedPublicDeck.lang || 'Английский'}
            </p>

            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h4 style={{ marginBottom: '10px' }}>Режим изучения</h4>
              <div className="study-types">
                <button className="type-btn" onClick={() => handleStartPublicStudy(1)}>Слово → устно</button>
                <button className="type-btn" onClick={() => handleStartPublicStudy(2)}>Перевод → устно</button>
                <button className="type-btn" onClick={() => handleStartPublicStudy(3)}>Слово → письменно</button>
                <button className="type-btn" onClick={() => handleStartPublicStudy(4)}>Перевод → письменно</button>
              </div>
            </div>

            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => handleAddPublicDeck(selectedPublicDeck.id)}>+ Добавить в Мои колоды</button>
              <button className="btn btn-outline" onClick={() => setShowPublicDeckModal(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}