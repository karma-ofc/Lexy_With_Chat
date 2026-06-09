import React, { useState, useEffect, useCallback } from 'react';

export default function StudyMode({ deck, onClose, onShowNotification, onToggleFavorite }) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [studyCards, setStudyCards] = useState(deck.cards || []);

  useEffect(() => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionStats({ correct: 0, incorrect: 0 });
    setIsComplete(false);
    setStudyCards(deck.cards || []);
  }, [deck]);

  const currentCard = studyCards[currentCardIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleResponse = useCallback((correct) => {
    setSessionStats(prev => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1)
    }));

    const nextIndex = currentCardIndex + 1;
    if (nextIndex >= studyCards.length) {
      setIsComplete(true);
    } else {
      setCurrentCardIndex(nextIndex);
      setIsFlipped(false);
    }
  }, [currentCardIndex, studyCards.length]);

  const handleToggleFavorite = async (cardId) => {
    if (!onToggleFavorite) return;
    setStudyCards(prev => prev.map(card => (
      card.id === cardId ? { ...card, is_favorite: !card.is_favorite } : card
    )));
    await onToggleFavorite(cardId);
  };

  const handleRestart = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionStats({ correct: 0, incorrect: 0 });
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <div className="study-complete">
        <div className="study-header">
          <h2>Сессия завершена!</h2>
          <span className="close-btn" onClick={onClose}>×</span>
        </div>
        <div className="study-stats">
          <p>Правильных ответов: {sessionStats.correct}</p>
          <p>Неправильных ответов: {sessionStats.incorrect}</p>
          <p>Всего карточек: {studyCards.length}</p>
        </div>
        <div className="study-actions">
          <button className="btn-secondary" onClick={handleRestart}>Повторить</button>
          <button className="btn-primary" onClick={onClose}>Завершить</button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-mode">
      <div className="study-header">
        <h2>Карточка {currentCardIndex + 1}/{studyCards.length}</h2>
        <span className="close-btn" onClick={onClose}>×</span>
      </div>
      <div className="study-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentCardIndex + 1) / studyCards.length) * 100}%` }}
          ></div>
        </div>
      </div>
      <div className="study-card" onClick={handleFlip}>
        {!isFlipped ? (
          <div className="card-content">
            <div className="card-text">{currentCard?.front}</div>
            <div className="card-hint">Нажмите, чтобы перевернуть</div>
          </div>
        ) : (
          <div className="card-content">
            <div className="card-text">{currentCard?.back}</div>
            <div className="card-hint">Нажмите, чтобы скрыть</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
        <button
          className={`btn-icon favorite-btn-large ${currentCard?.is_favorite ? 'filled' : ''}`}
          onClick={() => currentCard && handleToggleFavorite(currentCard.id)}
          title={currentCard?.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          style={{ fontSize: '24px', width: '40px', height: '40px' }}
        >
          {currentCard?.is_favorite ? '★' : '☆'}
        </button>
      </div>
      <div className="study-actions">
        <button className="btn-incorrect" onClick={() => handleResponse(false)}>Не знаю</button>
        <button className="btn-correct" onClick={() => handleResponse(true)}>Знаю</button>
      </div>
    </div>
  );
}