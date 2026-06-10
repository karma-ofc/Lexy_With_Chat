import React, { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { api } from '../api';

export default function MyDecks({ onShowNotification }) {
  const [createdDecks, setCreatedDecks] = useState([]);
  const [addedDecks, setAddedDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [deckCards, setDeckCards] = useState([]);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuDeck, setMenuDeck] = useState(null);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [forgottenCards, setForgottenCards] = useState([]);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [forgottenCount, setForgottenCount] = useState(0);
  const [studyMode, setStudyMode] = useState(null);
  const [currentStudyCard, setCurrentStudyCard] = useState(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyCards, setStudyCards] = useState([]);
  const [studyResults, setStudyResults] = useState([]);
  const [studyStartTime, setStudyStartTime] = useState(null);
  const [cardsStudied, setCardsStudied] = useState(0);
  const loadingRef = useRef(false);
  const permanentLoadingRef = useRef(false);

  // Эффект для блокировки скролла при изучении
  useEffect(() => {
    if (studyMode !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [studyMode]);

  const normalizePermanentCard = (card) => ({
    ...card,
    word: card.word || card.front,
    translation: card.translation || card.back
  });

  // Функционал загрузки
  const fetchDecks = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await api.getMyDecks();
      const rawDecks = Array.isArray(data) ? data : (data.decks || []);
      const allDecks = rawDecks.map((deck) => ({
        ...deck,
        customImage: deck.customImage || deck.custom_image || null,
        is_added_from_public: deck.is_added_from_public ?? (deck.source === 'public')
      }));

      setCreatedDecks(allDecks.filter((d) => !d.is_added_from_public));
      setAddedDecks(allDecks.filter((d) => d.is_added_from_public));
    } catch (err) {
      console.error('Ошибка загрузки колод:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Глобальная функция обновления для компонента Auth
  window.refreshMyDecks = () => {
    fetchDecks();
    loadPermanentDecks();
  };

  useEffect(() => {
    fetchDecks();
    // Загрузка избранных и забытых карт
    loadPermanentDecks();

    // Регистрируем глобальную init-функцию
    window.initMyDecksPage = () => {
      if (!loadingRef.current) fetchDecks();
      if (!permanentLoadingRef.current) loadPermanentDecks();
    };
  }, []);

  const loadPermanentDecks = async () => {
    if (permanentLoadingRef.current) return;
    permanentLoadingRef.current = true;
    try {
      const favorites = await api.getFavoriteCards();
      const normalizedFavorites = (favorites || []).map(normalizePermanentCard);
      setFavoriteCards(normalizedFavorites);
      setFavoriteCount(normalizedFavorites.length || 0);
      const forgotten = await api.getForgottenCards();
      const normalizedForgotten = (forgotten || []).map(normalizePermanentCard);
      setForgottenCards(normalizedForgotten);
      setForgottenCount(normalizedForgotten.length || 0);

      if (window.AppState) {
        window.AppState.favoriteDeck = {
          id: 'favorite',
          name: 'Избранное',
          cards: normalizedFavorites,
          isFavorite: true
        };
        window.AppState.forgottenDeck = {
          id: 'forgotten',
          name: 'Забытые карты',
          cards: normalizedForgotten,
          isForgotten: true
        };
        window.saveState?.();
      }
    } catch (e) {
      console.error('Error loading permanent decks:', e);
    } finally {
      permanentLoadingRef.current = false;
    }
  };

  const handleOpenDeck = async (deck) => {
    if (deck.id === 'favorite' || deck.id === 'forgotten') {
      const permanentCards = deck.id === 'favorite' ? favoriteCards : forgottenCards;
      setSelectedDeck({ ...deck, cards: permanentCards });
      setDeckCards(permanentCards);
      setShowDeckModal(true);
      return;
    }

    try {
      const cards = await api.getCards(deck.id);
      setSelectedDeck(deck);
      setDeckCards(cards.cards || []);
      setShowDeckModal(true);
    } catch (e) {
      alert('Ошибка загрузки карт: ' + e.message);
    }
  };

  const handleAddCard = async (deckId, front, back) => {
    const result = await api.createCard(deckId, front, back);
    setDeckCards(prev => [...prev, result.card]);
    fetchDecks();
  };

  const handleDeleteDeck = async (id) => {
    if (!window.confirm("Удалить колоду?")) return;
    try {
      await api.deleteDeck(id);
      fetchDecks();
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  };

  const handleCreateDeck = async (data) => {
    const result = await api.createDeck(data.name, data.description);
    const newDeck = result.deck;

    if (data.cards && data.cards.length > 0) {
      for (const card of data.cards) {
        try {
          await api.createCard(newDeck.id, card.front || card.word, card.back || card.translation);
        } catch (e) {
          console.error('Failed to add card:', e);
        }
      }
    }

    const imagePayload = data.selectedImageFile || data.customImage;
    if (imagePayload) {
      try {
        await api.uploadDeckImage(newDeck.id, imagePayload);
      } catch (e) {
        console.error('Failed to upload image:', e);
      }
    }

    fetchDecks();
  };

  const handleSubmitToLibrary = async (deckId, message) => {
    try {
      await api.submitDeck(deckId, message);
      alert('Заявка отправлена');
    } catch (e) {
      alert(e.message || 'Ошибка при отправке заявки');
    }
  };

  const handleExportDeck = (deck) => {
    const dataStr = JSON.stringify(deck, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `${deck.name}.json`);
    linkElement.click();
  };

  const handleEditDeckName = async (deckOrId, newName) => {
    const deckId = typeof deckOrId === 'object' ? deckOrId?.id : deckOrId;
    const deckDescription = typeof deckOrId === 'object' ? (deckOrId?.description || '') : '';
    if (!deckId || !newName?.trim()) return;

    try {
      await api.updateDeck(deckId, newName.trim(), deckDescription, null);
      fetchDecks();
    } catch (e) {
      console.error('Failed to update deck:', e);
    }
  };

  const handleViewCards = async (deck) => {
    if (deck.id === 'favorite' || deck.id === 'forgotten') {
      const permanentCards = deck.id === 'favorite' ? favoriteCards : forgottenCards;
      setSelectedDeck({ ...deck, cards: permanentCards });
      setDeckCards(permanentCards);
      setShowCardsModal(true);
      setShowMenuModal(false);
      return;
    }

    try {
      const cards = await api.getCards(deck.id);
      setSelectedDeck(deck);
      setDeckCards(cards.cards || []);
      setShowCardsModal(true);
      setShowMenuModal(false);
    } catch (e) {
      alert('Ошибка загрузки карт: ' + e.message);
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Удалить эту карточку?')) return;
    try {
      await api.deleteCard(cardId);
      const updatedCards = deckCards.filter(c => c.id !== cardId);
      setDeckCards(updatedCards);
      fetchDecks();
    } catch (e) {
      alert('Ошибка удаления карточки: ' + e.message);
    }
  };

  const handleEditCard = async (cardId, word, translation) => {
    try {
      await api.updateCard(cardId, word, translation);
      const updatedCards = deckCards.map(c => 
        c.id === cardId ? { ...c, front: word, back: translation } : c
      );
      setDeckCards(updatedCards);
    } catch (e) {
      alert('Ошибка редактирования: ' + e.message);
    }
  };

  const handleAddCardToDeck = async (deckId, word, translation) => {
    try {
      console.log('Adding card to deck', deckId, 'word:', word, 'translation:', translation);
      const result = await api.createCard(deckId, word, translation);
      console.log('API result:', result);

      let card = null;
      if (result.card) {
        card = result.card;
      } else if (result && result.id) {
        // Обрабатываем случай, когда результат уже является объектом карточки
        card = result;
      }

      if (card && card.id) {
        console.log('Card created successfully:', card);
        setDeckCards(prev => [...prev, card]);

        // Оптимистично обновляем количество карточек в нужном массиве
        // Нужно определить, находится ли колода в createdDecks или addedDecks
        setCreatedDecks(prev => {
          const deckIndex = prev.findIndex(d => d.id === deckId);
          if (deckIndex !== -1) {
            // Колода найдена в createdDecks, обновляем её
            const updatedDecks = [...prev];
            updatedDecks[deckIndex] = {
              ...updatedDecks[deckIndex],
              cards_count: (updatedDecks[deckIndex].cards_count || 0) + 1
            };
            return updatedDecks;
          }
          return prev; // Колода не найдена в createdDecks
        });
        
        setAddedDecks(prev => {
          const deckIndex = prev.findIndex(d => d.id === deckId);
          if (deckIndex !== -1) {
            // Колода найдена в addedDecks, обновляем её
            const updatedDecks = [...prev];
            updatedDecks[deckIndex] = {
              ...updatedDecks[deckIndex],
              cards_count: (updatedDecks[deckIndex].cards_count || 0) + 1
            };
            return updatedDecks;
          }
          return prev; // Колода не найдена в addedDecks
        });
      } else {
        console.error('Card creation failed, no card returned');
        alert('Карточка не была создана. Попробуйте снова.');
      }
      
      // Всегда запрашиваем колоды, чтобы получить точное количество с сервера и обеспечить согласованность
      fetchDecks();
    } catch (e) {
      console.error('Error adding card:', e);
      alert('Ошибка добавления карточки: ' + e.message);
      // Обновляем колоды, чтобы получить правильное количество
      fetchDecks();
    }
  };

  const handleToggleFavorite = async (cardId) => {
    try {
      const isAlreadyFavorite = favoriteCards.some(card => card.id === cardId);
      const sourceCard = [...deckCards, ...studyCards, ...(selectedDeck?.cards || [])].find(card => card.id === cardId);
      const favoriteCard = sourceCard ? {
        ...sourceCard,
        is_favorite: !isAlreadyFavorite,
        word: sourceCard.word || sourceCard.front,
        translation: sourceCard.translation || sourceCard.back
      } : null;

      setFavoriteCards(prev => isAlreadyFavorite
        ? prev.filter(card => card.id !== cardId)
        : [...prev.filter(card => card.id !== cardId), favoriteCard].filter(Boolean)
      );

      if (window.AppState?.favoriteDeck) {
        window.AppState.favoriteDeck.cards = isAlreadyFavorite
          ? window.AppState.favoriteDeck.cards.filter(card => card.id !== cardId)
          : [...window.AppState.favoriteDeck.cards.filter(card => card.id !== cardId), favoriteCard].filter(Boolean);
        window.saveState?.();
      }

      await api.toggleFavorite(cardId);
      loadPermanentDecks();
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  const startStudy = (deck, mode) => {
    if (!deck.cards || deck.cards.length === 0) {
      alert('В этой колоде нет карт');
      return;
    }

    setStudyMode(mode);
    setStudyCards([...deck.cards]);
    setStudyIndex(0);
    setStudyResults([]);
    setStudyStartTime(Date.now());
    setCardsStudied(0);
    setCurrentStudyCard(deck.cards[0]);
    setShowDeckModal(false);
  };

  const [studyNotification, setStudyNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);

  const showLocalNotification = (text, type) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setStudyNotification({ text, type });
    notificationTimeoutRef.current = setTimeout(() => {
      setStudyNotification(null);
    }, 2000);
  };

  const handleStudyResult = async (knew, correctAnswer) => {
    const currentCard = studyCards[studyIndex];
    if (knew) {
      showLocalNotification('Правильно!', 'success');
    } else {
      if (correctAnswer) {
        showLocalNotification(`Неправильно! Правильный ответ: ${correctAnswer}`, 'error');
      }
    }

    const isForgottenDeck = selectedDeck?.id === 'forgotten';

    setCardsStudied(prev => prev + 1);

    // Обновляем статистику
    if (window.AppState?.user) {
      window.AppState.user.learnedWords = (window.AppState.user.learnedWords || 0) + (knew ? 1 : 0);
      window.AppState.user.studyTime = (window.AppState.user.studyTime || 0) + 1; // Добавляем 1 секунду
      window.AppState.user.lastStudyDate = new Date().toISOString().split('T')[0];
      window.saveState?.();
      window.saveStats?.();
    }

    // Записываем активность
    const today = new Date().toISOString().split('T')[0];
    if (window.AppState?.user?.activity) {
      window.AppState.user.activity[today] = (window.AppState.user.activity[today] || 0) + 1;
    }

    try { await api.recordActivity(1, today); } catch(e) { console.error('recordActivity error', e); } 

      if (knew) { 
        if (isForgottenDeck) {
        try {
          await api.syncUpdateCardForgotten(currentCard.id, false);
        } catch (e) {
          console.error('Sync forgotten error:', e);
        }
          setForgottenCount(prev => Math.max(prev - 1, 0));
          setForgottenCards(prev => prev.filter(card => card.id !== currentCard.id));
          if (window.AppState?.forgottenDeck) {
            window.AppState.forgottenDeck.cards = window.AppState.forgottenDeck.cards.filter(card => card.id !== currentCard.id);
            window.saveState?.();
          }
        const newCards = [...studyCards];
        newCards.splice(studyIndex, 1);
        setStudyCards(newCards);

        if (newCards.length === 0) {
          showCompletionModal();
          return;
        }

        if (studyIndex >= newCards.length) {
          setStudyIndex(0);
          setCurrentStudyCard(newCards[0]);
        } else {
          setCurrentStudyCard(newCards[studyIndex]);
        }
      } else {
        const newCards = [...studyCards];
        newCards[studyIndex] = { ...currentCard, repetitions: (currentCard.repetitions || 0) + 1, interval: Math.min((currentCard.interval || 1) * 2, 365) };
        newCards.splice(studyIndex, 1);
        setStudyCards(newCards);

        if (newCards.length === 0) {
          showCompletionModal();
          return;
        }

        if (studyIndex >= newCards.length) {
          setStudyIndex(0);
          setCurrentStudyCard(newCards[0]);
        } else {
          setCurrentStudyCard(newCards[studyIndex]);
        }
      }
    } else {
      if (!isForgottenDeck) {
        try {
          const alreadyInForgotten = await checkIfInForgotten(currentCard.id);
          if (!alreadyInForgotten) {
            await api.syncUpdateCardForgotten(currentCard.id, true);
          }
        } catch (e) {
          console.error('Sync forgotten error:', e);
        }
      }

      const newCards = [...studyCards];
      newCards.push(currentCard);
      setStudyCards(newCards);
      setStudyIndex(prev => prev + 1);

      if (studyIndex + 1 >= newCards.length) {
        setStudyIndex(0);
      }
      setCurrentStudyCard(newCards[(studyIndex + 1) % newCards.length]);
    }

    loadPermanentDecks();
  };

  const checkIfInForgotten = async (cardId) => {
    return forgottenCards.some(c => c.id === cardId);
  };

  const showCompletionModal = () => {
    const sessionTime = studyStartTime ? Math.floor((Date.now() - studyStartTime) / 1000) : 0;
    
    alert(`Поздравляем! Вы успешно решили все карты! 🎉\nИзучено карточек: ${cardsStudied}\nВремя: ${Math.floor(sessionTime / 60)} мин ${sessionTime % 60} сек`);
    
    setStudyMode(null);
    setStudyCards([]);
    setCurrentStudyCard(null);
    setStudyStartTime(null);
    setCardsStudied(0);
  };

  // Компонент модального окна для создания колоды
  const CreateDeckModal = ({ onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [dropZoneActive, setDropZoneActive] = useState(false);

    const handleImageUpload = (file) => {
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target.result);
      reader.readAsDataURL(file);
    };

    const handleFileSelect = (file) => {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
      } else {
        alert('Пожалуйста, выберите JSON файл');
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!name.trim()) return;

      try {
        if (selectedFile) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const importedDeck = JSON.parse(e.target.result);
              await onCreate({
                name: name.trim(),
                description: description.trim(),
                cards: importedDeck.cards || [],
                customImage: selectedImage,
                selectedImageFile
              });
              onClose();
            } catch (err) {
              alert('Ошибка при чтении файла');
            }
          };
          reader.readAsText(selectedFile);
        } else {
          await onCreate({
            name: name.trim(),
            description: description.trim(),
            customImage: selectedImage,
            selectedImageFile
          });
          onClose();
        }
      } catch (err) {
        alert("Ошибка создания: " + err.message);
      }
    };

    const removeImage = () => {
      setSelectedImage(null);
      setSelectedImageFile(null);
    };

    return (
      <div className="auth-modal active" onClick={(e) => {
        if (e.target.classList.contains('auth-modal')) onClose();
      }}>
        <div className="auth-container" style={{ maxWidth: '500px' }}>
          <button className="auth-close" onClick={onClose}>×</button>
          <h3>Создать колоду</h3>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Название колоды</label>
              <input type="text" placeholder="Введите название" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Обложка колоды</label>
              <div className="deck-image-upload" onClick={() => document.getElementById('deckImageInput').click()} style={{
                border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center',
                cursor: 'pointer', background: selectedImage ? 'none' : 'var(--bg-secondary)',
                minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {selectedImage ? (
                  <img src={selectedImage} alt="Обложка" style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'cover' }} />
                ) : (
                  <div><div style={{ fontSize: '24px', marginBottom: '8px' }}>🖼️</div><div>Нажмите для загрузки</div></div>
                )}
              </div>
              <input type="file" id="deckImageInput" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
              {selectedImage && <button type="button" className="btn-small btn-outline" onClick={removeImage} style={{ marginTop: '8px' }}>Удалить изображение</button>}
            </div>

            <div className="form-group">
              <label>Или импортировать</label>
              <div className={`drop-zone ${dropZoneActive ? 'drag-over' : ''}`} style={{
                border: `2px dashed ${dropZoneActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px',
                padding: '20px', textAlign: 'center', cursor: 'pointer',
                background: selectedFile ? 'var(--success-light)' : 'var(--bg-secondary)', transition: 'all 0.3s'
              }}
                onClick={() => document.getElementById('importInput').click()}
                onDragEnter={(e) => { e.preventDefault(); setDropZoneActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDropZoneActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDropZoneActive(false); }}
                onDrop={(e) => { e.preventDefault(); setDropZoneActive(false); const files = e.dataTransfer.files; if (files.length > 0) handleFileSelect(files[0]); }}>
                {selectedFile ? (
                  <div style={{ color: 'var(--success)' }}><div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div><div>{selectedFile.name}</div></div>
                ) : (
                  <div><div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div><div>Перетащите файл сюда</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>или нажмите для выбора .json файла</div></div>
                )}
              </div>
              <input type="file" id="importInput" accept=".json" style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            </div>

            <button type="submit" className="btn btn-full">Создать</button>
          </form>
        </div>
      </div>
    );
  };

  // Компонент модального окна для просмотра карт
  const CardsModal = ({ deck, cards, onClose, onAddCard, onDeleteCard, onEditCard, onToggleFavorite, favoriteCards }) => {
    const [showAddCard, setShowAddCard] = useState(false);
    const [newFront, setNewFront] = useState('');
    const [newBack, setNewBack] = useState('');
    const [editingCard, setEditingCard] = useState(null);
    const [editFront, setEditFront] = useState('');
    const [editBack, setEditBack] = useState('');
    const [frontSuggestion, setFrontSuggestion] = useState('');
    const [backSuggestion, setBackSuggestion] = useState('');
    const debounceTimerRef = useRef(null);
    const requestSeqRef = useRef(0);

    const handleAddCardSubmit = async (e) => {
      e.preventDefault();
      if (!newFront.trim() || !newBack.trim()) return;
      await onAddCard(deck.id, newFront.trim(), newBack.trim());
      setNewFront('');
      setNewBack('');
      setFrontSuggestion('');
      setBackSuggestion('');
      setShowAddCard(false);
    };

    const handleEditSubmit = async (e) => {
      e.preventDefault();
      if (!editFront.trim() || !editBack.trim()) return;
      await onEditCard(editingCard.id, editFront.trim(), editBack.trim());
      setEditingCard(null);
      setEditFront('');
      setEditBack('');
    };

    const isCardFavorite = (cardId) => favoriteCards.some(c => c.id === cardId);

    useEffect(() => {
      if (!showAddCard) return;

      const value = newFront.trim();
      if (value.length < 2) {
        setBackSuggestion('');
        return;
      }

      clearTimeout(debounceTimerRef.current);
      const requestId = ++requestSeqRef.current;

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const result = await api.translateWord(value, 'en-ru');
          if (requestId !== requestSeqRef.current) return;
          setBackSuggestion(result?.translation || '');
        } catch (e) {
          console.error('Translate en-ru failed:', e);
          setBackSuggestion('');
        }
      }, 450);

      return () => clearTimeout(debounceTimerRef.current);
    }, [newFront, showAddCard]);

    useEffect(() => {
      if (!showAddCard) return;

      const value = newBack.trim();
      if (value.length < 2) {
        setFrontSuggestion('');
        return;
      }

      clearTimeout(debounceTimerRef.current);
      const requestId = ++requestSeqRef.current;

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const result = await api.translateWord(value, 'ru-en');
          if (requestId !== requestSeqRef.current) return;
          setFrontSuggestion(result?.translation || '');
        } catch (e) {
          console.error('Translate ru-en failed:', e);
          setFrontSuggestion('');
        }
      }, 450);

      return () => clearTimeout(debounceTimerRef.current);
    }, [newBack, showAddCard]);

    return (
      <div className="auth-modal active">
        <div className="auth-container" style={{ maxWidth: '600px' }}>
          <button className="auth-close" onClick={onClose}>×</button>
          <h3 style={{ position: 'relative', top: '-10px' }}>{deck.name} — карты</h3>

          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
            {cards.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>В этой колоде нет карт</p>
            ) : (
              cards.map(card => (
                <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--border)' }}>
                  {editingCard?.id === card.id ? (
                    <form onSubmit={handleEditSubmit} style={{ flex: 1, display: 'flex', gap: '10px' }}>
                      <input type="text" value={editFront} onChange={e => setEditFront(e.target.value)} style={{ flex: 1 }} />
                      <input type="text" value={editBack} onChange={e => setEditBack(e.target.value)} style={{ flex: 1 }} />
                      <button type="submit" className="btn-small">💾</button>
                      <button type="button" className="btn-small" onClick={() => setEditingCard(null)}>✖</button>
                    </form>
                  ) : (
                    <>
                      <div><div style={{ fontWeight: 'bold' }}>{card.front || card.word}</div><div style={{ color: 'var(--text-secondary)' }}>{card.back || card.translation}</div></div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                         <button className="btn-icon" onClick={() => onToggleFavorite(card.id)} style={{ color: isCardFavorite(card.id) ? '#ff9f0a' : 'white' }}>{isCardFavorite(card.id) ? '★' : '☆'}</button>
                        <button className="btn-icon" onClick={() => { setEditingCard(card); setEditFront(card.front || card.word); setEditBack(card.back || card.translation); }}>✎</button>
                        <button className="btn-icon" onClick={() => onDeleteCard(card.id)}>×</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {showAddCard ? (
            <form onSubmit={handleAddCardSubmit} style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <div className="form-group">
                <label>Слово</label>
                <input type="text" placeholder="Например: dog" value={newFront} onChange={e => setNewFront(e.target.value)} required />
                    {frontSuggestion && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => { setNewFront(frontSuggestion); setFrontSuggestion(''); }}
                          onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; }}
                          onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
                          style={{ background: 'var(--golden-bg)', color: 'var(--golden-text)', border: 'none', borderRadius: '20px', padding: '8px 16px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
                          {frontSuggestion}
                        </button>
                      </div>
                    )}
              </div>
              <div className="form-group">
                <label>Перевод</label>
                <input type="text" placeholder="Например: собака" value={newBack} onChange={e => setNewBack(e.target.value)} required />
                    {backSuggestion && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => { setNewBack(backSuggestion); setBackSuggestion(''); }}
                          onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; }}
                          onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
                          style={{ background: 'var(--golden-bg)', color: 'var(--golden-text)', border: 'none', borderRadius: '20px', padding: '8px 16px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
                          {backSuggestion}
                        </button>
                      </div>
                    )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}><button type="submit" className="btn">Добавить</button><button type="button" className="btn btn-outline" onClick={() => setShowAddCard(false)}>Отмена</button></div>
            </form>
          ) : (
            <button className="btn" onClick={() => setShowAddCard(true)}>+ Добавить карточку</button>
          )}
        </div>
      </div>
    );
  };

  // Компонент меню колоды
  const DeckMenuModal = ({ deck, onClose, onEditName, onChangeImage, onViewCards, onSubmitToLibrary, onExport, onDelete }) => {
    const [newName, setNewName] = useState(deck.name);
    const [showNameEditor, setShowNameEditor] = useState(false);
    const [showImageEditor, setShowImageEditor] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);

    const handleImageUpload = (file) => {
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target.result);
      reader.readAsDataURL(file);
    };

    const handleSaveName = async () => {
      if (newName.trim()) {
        await onEditName(deck, newName.trim());
        setShowNameEditor(false);
        onClose();
      }
    };

    const handleSaveImage = async () => {
      const imagePayload = selectedImageFile || selectedImage;
      if (imagePayload) {
        try {
          await api.uploadDeckImage(deck.id, imagePayload);
          onChangeImage();
          alert('Обложка обновлена');
        } catch (e) {
          console.error('Failed to upload image:', e);
          alert('Не удалось загрузить обложку: ' + e.message);
          return;
        }
      }
      setShowImageEditor(false);
      onClose();
    };

    const handleSubmit = async () => {
      await onSubmitToLibrary(deck.id, submissionMessage);
      setShowSubmitDialog(false);
      onClose();
    };

    return (
      <div className="auth-modal active" onClick={(e) => { if (e.target.classList.contains('auth-modal')) onClose(); }}>
        <div className="auth-container" style={{ maxWidth: '400px' }}>
          <button className="auth-close" onClick={onClose}>×</button>
          <h3 style={{ position: 'relative', top: '-12px' }}>{deck.name}</h3>
          <div className="deck-menu">
            <button className="menu-item" onClick={() => setShowNameEditor(true)}>Редактировать название</button>
            <button className="menu-item" onClick={() => setShowImageEditor(true)}>Изменить обложку</button>
            <button className="menu-item" onClick={() => onViewCards(deck)}>Список карт</button>
            {!deck.is_added_from_public && <button className="menu-item" onClick={() => setShowSubmitDialog(true)}>Отправить в библиотеку</button>}
            <button className="menu-item" onClick={() => onExport(deck)}>Экспортировать</button>
            <button className="menu-item danger" onClick={() => { if (window.confirm('Удалить колоду?')) onDelete(deck.id); }}>Удалить колоду</button>
          </div>

          {showNameEditor && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', marginBottom: '10px' }} />
              <button className="btn" onClick={handleSaveName}>Сохранить</button>
              <button className="btn btn-outline" onClick={() => setShowNameEditor(false)} style={{ marginLeft: '10px' }}>Отмена</button>
            </div>
          )}

          {showImageEditor && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <div className="deck-image-upload" onClick={() => document.getElementById('menuImageInput').click()} style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                {selectedImage ? <img src={selectedImage} alt="Обложка" style={{ maxWidth: '100%', maxHeight: '100px' }} /> : <div><div>🖼️</div><div>Нажмите для загрузки</div></div>}
              </div>
              <input type="file" id="menuImageInput" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
              <button className="btn" onClick={handleSaveImage} style={{ marginTop: '10px' }}>Сохранить</button>
              <button className="btn btn-outline" onClick={() => setShowImageEditor(false)} style={{ marginLeft: '10px' }}>Отмена</button>
            </div>
          )}

          {showSubmitDialog && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <div className="form-group">
                <label>Комментарий (опционально)</label>
                <textarea rows="3" value={submissionMessage} onChange={e => setSubmissionMessage(e.target.value)} style={{ width: '100%' }}></textarea>
              </div>
              <button className="btn" onClick={handleSubmit}>Отправить</button>
              <button className="btn btn-outline" onClick={() => setShowSubmitDialog(false)} style={{ marginLeft: '10px' }}>Отмена</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Компонент выбора режима изучения
  const StudyTypeModal = ({ deck, onClose, onStartStudy }) => {
    return (
      <div className="auth-modal active" onClick={(e) => { if (e.target.classList.contains('auth-modal')) onClose(); }}>
        <div className="auth-container" style={{ maxWidth: '400px' }}>
          <button className="auth-close" onClick={onClose}>×</button>
          <h3>Выберите режим</h3>
          <div className="study-types">
            <button className="type-btn" onClick={() => onStartStudy(deck, 1)}>Слово → устно</button>
            <button className="type-btn" onClick={() => onStartStudy(deck, 2)}>Перевод → устно</button>
            <button className="type-btn" onClick={() => onStartStudy(deck, 3)}>Слово → письменно</button>
            <button className="type-btn" onClick={() => onStartStudy(deck, 4)}>Перевод → письменно</button>
          </div>
        </div>
      </div>
    );
  };

  // Компонент сессии изучения
  const StudySession = () => {
    const [userAnswer, setUserAnswer] = useState('');
    const [showAnswer, setShowAnswer] = useState(false);
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [rotation, setRotation] = useState(0);
    const [isLeaving, setIsLeaving] = useState(false);
    const autoSwipedRef = useRef(false);
    const isWordToTranslation = studyMode === 1 || studyMode === 3;
    const isWritten = studyMode === 3 || studyMode === 4;

    if (!currentStudyCard) return null;

    const displayText = isWordToTranslation ? (currentStudyCard.front || currentStudyCard.word) : (currentStudyCard.back || currentStudyCard.translation);
    const correctAnswer = isWordToTranslation ? (currentStudyCard.back || currentStudyCard.translation) : (currentStudyCard.front || currentStudyCard.word);

    const animateAndNext = (direction, result) => {
      if (isLeaving) return;
      setIsLeaving(true);
      setIsSwiping(false);

      const offsetDistance = 250; // Меньшая дальность улетания
      setSwipeOffset(direction === 'right' ? offsetDistance : -offsetDistance);
      setRotation(direction === 'right' ? 15 : -15);

      setTimeout(() => {
        handleStudyResult(result, correctAnswer);
        setIsLeaving(false);
        setSwipeOffset(0);
        setRotation(0);
        autoSwipedRef.current = false;
      }, 500); // 500мс для более плавного затухания
    };

    const handleKnow = () => animateAndNext('right', true);
    const handleDontKnow = () => animateAndNext('left', false);

    const swipeHandlers = useSwipeable({
      onSwipedLeft: () => {
        if (!autoSwipedRef.current && !isLeaving) handleDontKnow();
      },
      onSwipedRight: () => {
        if (!autoSwipedRef.current && !isLeaving) handleKnow();
      },
      onSwiping: ({ deltaX }) => {
        if (!isWritten && !autoSwipedRef.current && !isLeaving) {
          // Если свайп был достаточно большой, запускаем автответ без отпускания левой кнопки мыши
          if (deltaX > 150) {
            autoSwipedRef.current = true;
            handleKnow();
          } else if (deltaX < -150) {
            autoSwipedRef.current = true;
            handleDontKnow();
          } else {
            setSwipeOffset(deltaX);
            setRotation(deltaX * 0.1); 
            setIsSwiping(true);
          }
        }
      },
      onSwiped: () => {
        if (!isLeaving) {
          autoSwipedRef.current = false;
          setIsSwiping(false);
          setSwipeOffset(0);
          setRotation(0);
        }
      },
      preventDefaultTouchmoveEvent: true,
      trackMouse: true,
      trackTouch: !isWritten
    });

    const handleCheckAnswer = () => {
      const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();
      if (isCorrect) {
        handleStudyResult(true, correctAnswer);
      } else {
        handleStudyResult(false, correctAnswer);
      }
      setUserAnswer('');
      setShowAnswer(false);
    };

    const handleToggleStudyFavorite = async () => {
      if (!currentStudyCard) return;
      setCurrentStudyCard(prev => prev ? { ...prev, is_favorite: !prev.is_favorite } : prev);
      setStudyCards(prev => prev.map(card => (
        card.id === currentStudyCard.id ? { ...card, is_favorite: !card.is_favorite } : card
      )));
      await handleToggleFavorite(currentStudyCard.id);
    };



    return (
      <div className="auth-modal active">
        <div className="auth-container" style={{ maxWidth: '600px' }}>
          <h3>Карточка {studyIndex + 1} / {studyCards.length}</h3>
          <div
            className="study-card"
            id="studyCard"
            style={{
              fontSize: '24px',
              textAlign: 'center',
              padding: '40px',
              margin: '20px 0',
              background: swipeOffset > 50 ? 'rgba(52, 199, 89, 0.1)' : swipeOffset < -50 ? 'rgba(255, 59, 48, 0.1)' : 'var(--bg-secondary)',
              borderRadius: '12px',
              opacity: isLeaving ? 0 : 1,
              transform: `translate(${swipeOffset}px, ${-Math.abs(swipeOffset) * 0.25}px) rotate(${rotation}deg)`,
              transition: isSwiping ? 'transform 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.5s ease',
              userSelect: 'none',
              border: swipeOffset > 50 ? '2px solid #34c759' : swipeOffset < -50 ? '2px solid #ff3b30' : '1px solid var(--border)',
              transformOrigin: 'center',
              touchAction: 'none'
            }}
            {...swipeHandlers}
          >
            {displayText}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <button
              className={`btn-icon favorite-btn-large ${currentStudyCard?.is_favorite ? 'filled' : ''}`}
              onClick={handleToggleStudyFavorite}
              title={currentStudyCard?.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              style={{ fontSize: '24px', width: '40px', height: '40px' }}
            >
              {currentStudyCard?.is_favorite ? '★' : '☆'}
            </button>
          </div>

          {isWritten ? (
            <div style={{ marginTop: '20px' }}>
              <input type="text" placeholder="Введите перевод..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} style={{ width: '100%', padding: '10px' }} onKeyPress={e => e.key === 'Enter' && handleCheckAnswer()} />
              <button className="btn" onClick={handleCheckAnswer} style={{ marginTop: '10px', width: '100%' }}>Проверить</button>
            </div>
          ) : (
            <div className="study-controls" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="control-btn left" onClick={handleDontKnow} disabled={isLeaving}>← Не знаю</button>
              <button className="control-btn right" onClick={handleKnow} disabled={isLeaving}>Знаю →</button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-secondary)' }}>
            {studyIndex + 1} / {studyCards.length}
          </div>

          <button className="auth-close" onClick={() => { setStudyMode(null); setStudyCards([]); setCurrentStudyCard(null); }} style={{ position: 'absolute', top: '15px', right: '20px' }}>×</button>
        </div>

        {/* Локальное уведомление снизу модального окна */}
        {studyNotification && (
          <div style={{
            position: 'fixed',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: studyNotification.type === 'success' ? '#34c759' : '#ff3b30',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '24px',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            maxWidth: '90%',
            textAlign: 'center',
            width: studyNotification.type === 'success' ? 'fit-content' : 'fit-content',
            animation: 'slideUpFadeIn 0.3s ease forwards'
          }}>
            {studyNotification.text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mydecks-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Мои колоды</h1>
      </div>

      {/* Постоянные колоды */}
      <section>
        <h2>Постоянные</h2>
        <div className="decks-grid">
          <div className="deck-card" id="favoriteDeck" onClick={() => handleOpenDeck({ id: 'favorite', name: 'Избранное' })}>
            <div className="deck-preview" style={{ background: "linear-gradient(135deg, #ff9f0a, #ff6b0a)" }}>
              <div className="deck-actions"><button className="btn-icon star-btn filled">★</button></div>
            </div>
            <div className="deck-info">
              <div className="deck-name">Избранное</div>
              <div className="deck-meta">{favoriteCount} карт</div>
            </div>
          </div>

          <div className="deck-card" id="forgottenDeck" onClick={() => handleOpenDeck({ id: 'forgotten', name: 'Забытые карты' })}>
            <div className="deck-preview" style={{ background: "linear-gradient(135deg, #8e8e93, #636366)" }}>
              <div className="deck-actions"><button className="btn-icon">📌</button></div>
            </div>
            <div className="deck-info">
              <div className="deck-name">Забытые карты</div>
              <div className="deck-meta">{forgottenCount} карт</div>
            </div>
          </div>
        </div>
      </section>

      {/* Созданные колоды */}
      <section>
        <h2>Созданные колоды</h2>
        <div className="decks-grid">
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : createdDecks.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Здесь появятся ваши колоды</p>
          ) : (
            createdDecks.map(deck => (
              <div className="deck-card" key={deck.id}>
                <div className="deck-preview" style={{ background: deck.customImage ? 'none' : 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }} onClick={() => handleOpenDeck(deck)}>
                  {deck.customImage && <img src={deck.customImage} alt={deck.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div className="deck-actions">
                    <button className="btn-icon menu-btn" onClick={(e) => { e.stopPropagation(); setMenuDeck(deck); setShowMenuModal(true); }}>⋯</button>
                  </div>
                </div>
                <div className="deck-info" onClick={() => handleOpenDeck(deck)}>
                  <div className="deck-name">{deck.name}</div>
                  <div className="deck-meta">{deck.cards_count || 0} карт</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Добавленные колоды */}
      <section>
        <h2>Добавленные колоды</h2>
        <div className="decks-grid">
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
          ) : addedDecks.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Вы еще не добавили чужие колоды</p>
          ) : (
            addedDecks.map(deck => (
              <div className="deck-card" key={deck.id}>
                <div className="deck-preview" style={{ background: deck.customImage ? 'none' : 'linear-gradient(135deg, #34c759, #30b753)' }} onClick={() => handleOpenDeck(deck)}>
                  {deck.customImage && <img src={deck.customImage} alt={deck.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div className="deck-actions">
                    <button className="btn-icon menu-btn" onClick={(e) => { e.stopPropagation(); setMenuDeck(deck); setShowMenuModal(true); }}>⋯</button>
                  </div>
                </div>
                <div className="deck-info" onClick={() => handleOpenDeck(deck)}>
                  <div className="deck-name">{deck.name}</div>
                  <div className="deck-meta">{deck.cards_count || 0} карт</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Кнопка создания колоды */}
      <button className="btn-create-deck" title="Создать колоду" onClick={() => setShowCreateModal(true)}>+</button>

      {/* Модальные окна */}
      {showCreateModal && <CreateDeckModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateDeck} />}

      {showDeckModal && selectedDeck && (
        <StudyTypeModal deck={{ ...selectedDeck, cards: deckCards }} onClose={() => setShowDeckModal(false)} onStartStudy={(deck, mode) => startStudy({ ...deck, cards: deckCards }, mode)} />
      )}

      {showCardsModal && selectedDeck && (
        <CardsModal
          deck={selectedDeck}
          cards={deckCards}
          onClose={() => setShowCardsModal(false)}
          onAddCard={handleAddCardToDeck}
          onDeleteCard={handleDeleteCard}
          onEditCard={handleEditCard}
          onToggleFavorite={handleToggleFavorite}
          favoriteCards={favoriteCards}
        />
      )}

      {showMenuModal && menuDeck && (
        <DeckMenuModal
          deck={menuDeck}
          onClose={() => { setShowMenuModal(false); setMenuDeck(null); }}
          onEditName={handleEditDeckName}
          onChangeImage={fetchDecks}
          onViewCards={handleViewCards}
          onSubmitToLibrary={handleSubmitToLibrary}
          onExport={handleExportDeck}
          onDelete={handleDeleteDeck}
        />
      )}

      {studyMode && currentStudyCard && <StudySession />}
    </div>
  );
}