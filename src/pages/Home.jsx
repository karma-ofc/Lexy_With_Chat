import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icons';

// Демо карточки для быстрого теста
const demoQuickCards = [
  { front: 'Hello', back: 'Привет' },
  { front: 'Goodbye', back: 'До свидания' },
  { front: 'Thank you', back: 'Спасибо' },
  { front: 'Please', back: 'Пожалуйста' },
  { front: 'How are you?', back: 'Как дела?' }
];

// Демо колоды с карточками
const demoDecksData = {
  demo_basic: {
    id: 'demo_basic',
    name: 'Английский базовый',
    cards: [
      { id: 'db1', front: 'Hello', back: 'Привет' },
      { id: 'db2', front: 'Goodbye', back: 'До свидания' },
      { id: 'db3', front: 'Thank you', back: 'Спасибо' },
      { id: 'db4', front: 'Please', back: 'Пожалуйста' },
      { id: 'db5', front: 'Yes', back: 'Да' },
      { id: 'db6', front: 'No', back: 'Нет' },
      { id: 'db7', front: 'Good morning', back: 'Доброе утро' },
      { id: 'db8', front: 'Good night', back: 'Спокойной ночи' },
      { id: 'db9', front: 'How are you?', back: 'Как дела?' },
      { id: 'db10', front: 'Nice to meet you', back: 'Приятно познакомиться' }
    ]
  },
  demo_travel: {
    id: 'demo_travel',
    name: 'Путешествия',
    cards: [
      { id: 'dt1', front: 'Airport', back: 'Аэропорт' },
      { id: 'dt2', front: 'Hotel', back: 'Отель' },
      { id: 'dt3', front: 'Ticket', back: 'Билет' },
      { id: 'dt4', front: 'Passport', back: 'Паспорт' },
      { id: 'dt5', front: 'Where is...?', back: 'Где находится...?' },
      { id: 'dt6', front: 'How much?', back: 'Сколько стоит?' },
      { id: 'dt7', front: 'I need help', back: 'Мне нужна помощь' },
      { id: 'dt8', front: 'Turn left', back: 'Поверните налево' }
    ]
  },
  demo_food: {
    id: 'demo_food',
    name: 'Еда и ресторан',
    cards: [
      { id: 'df1', front: 'Water', back: 'Вода' },
      { id: 'df2', front: 'Bread', back: 'Хлеб' },
      { id: 'df3', front: 'Cheese', back: 'Сыр' },
      { id: 'df4', front: 'Coffee', back: 'Кофе' },
      { id: 'df5', front: 'The check, please', back: 'Счёт, пожалуйста' },
      { id: 'df6', front: 'Delicious', back: 'Вкусно' }
    ]
  }
};

export default function Home({ onShowAuth, onLoadPage, onStartStudy, onAddDemoDeck }) {
  const [currentQuickCardIndex, setCurrentQuickCardIndex] = useState(0);
  const [isQuickCardFlipped, setIsQuickCardFlipped] = useState(false);
  const [demoDecks, setDemoDecks] = useState([]);

  useEffect(() => {
    const decks = Object.values(demoDecksData);
    setDemoDecks(decks);
  }, []);

  const updateQuickCard = useCallback(() => {
    setIsQuickCardFlipped(false);
  }, []);

  useEffect(() => {
    updateQuickCard();
  }, [currentQuickCardIndex, updateQuickCard]);

  const handleFlipQuickCard = () => {
    setIsQuickCardFlipped(!isQuickCardFlipped);
  };

  const handleNextQuickCard = () => {
    setCurrentQuickCardIndex((prev) => {
      const next = prev + 1;
      if (next >= demoQuickCards.length) {
        return 0;
      }
      return next;
    });
    const demoSection = document.getElementById('demoCards');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleStartDemoCards = () => {
    const demoSection = document.getElementById('demoCards');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleStartDemoDeck = (deckKey) => {
    const demoDeck = demoDecksData[deckKey];
    if (!demoDeck) return;

    if (onStartStudy) {
      onStartStudy(demoDeck, 1);
    }
  };

  const handleShowAuth = () => {
    const token = localStorage.getItem('lexy_token');
    const userStr = localStorage.getItem('lexy_user');
    let user = null;
    try {
      if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
    } catch (e) {
      localStorage.removeItem('lexy_user');
    }

    if (token && user?.id && onLoadPage) {
      onLoadPage('profile');
      return;
    }

    if (onShowAuth) {
      onShowAuth();
    } else if (onLoadPage) {
      onLoadPage('profile');
    }
  };

  const currentCard = demoQuickCards[currentQuickCardIndex];

  return (
    <div className="landing-page">
      {/* Hero секция */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span>Интервальные повторения</span>
          </div>
          <h1 className="hero-title">
            Запоминать легче с <span className="accent-text">Lexy</span>
          </h1>
          <p className="hero-description">
            Lexy — это программа для изучения языков с помощью карточек. 
            Она поможет вам тратить больше времени на сложный материал и меньше на то, что вы уже знаете.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={handleStartDemoCards}>
              Попробовать
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="btn-icon-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="features-section">
        <hgroup className="features-header">
          <h2>Почему выбирают Lexy</h2>
        </hgroup>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon icon-smart" />
            <h3>Умные колоды</h3>
            <p>Автоматические подборки сложных и избранных карточек</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon icon-decks" />
            <h3>Колоды под любые темы</h3>
            <p>Для путешествий, работы, учёбы или хобби</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon icon-star" />
            <h3>Избранное</h3>
            <p>Отмечайте важные карточки звездочкой</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon icon-stats" />
            <h3>Живая статистика</h3>
            <p>Следите за прогрессом и серией занятий</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon icon-import" />
            <h3>Импорт и экспорт</h3>
            <p>Загружайте готовые списки слов</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon icon-sync" />
            <h3>Единый аккаунт</h3>
            <p>Синхронизация между устройствами</p>
          </div>
        </div>
      </section>

      {/* Demo колоды для тестирования */}
      <section className="demo-section" id="demoCards">
        <hgroup className="demo-header">
          <h2>Попробуйте прямо сейчас</h2>
          <p>Выберите одну из демо колод и начните изучение</p>
        </hgroup>
        <div className="demo-decks-grid">
          {demoDecks.map((deck) => (
            <div 
              key={deck.id}
              className="demo-deck-card" 
              onClick={() => handleStartDemoDeck(deck.id)}
            >
              <div className="demo-deck-icon">
                {deck.id === 'demo_basic' && <Icon name="flagGb" />}
                {deck.id === 'demo_travel' && <Icon name="plane" />}
                {deck.id === 'demo_food' && <Icon name="pizza" />}
              </div>
              <h3>{deck.name}</h3>
              <p>({deck.cards.length} карточек)</p>
              <span className="demo-deck-start">Начать →</span>
            </div>
          ))}
        </div>
      </section>

      {/* Секция регистрации после демо */}
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 12
          }}
        >
          Понравилось?
        </h2>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-secondary)",
            marginBottom: 24
          }}
        >
          Создайте аккаунт, чтобы сохранять прогресс и изучать больше
        </p>
        <button className="btn-cta" onClick={handleShowAuth}>
          Зарегистрироваться
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}