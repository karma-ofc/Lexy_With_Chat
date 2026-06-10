import React, { useState, useEffect, useCallback, useRef } from 'react';
import Home from './pages/Home';
import Library from './pages/Library';
import MyDecks from './pages/MyDecks';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Chat from './pages/Chat';
import Auth from './components/Auth';
import StudyMode from './components/StudyMode';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './api';
import { createChatSocket } from './chatApi';

function App() {
  const [userDecks, setUserDecks] = useState([]);
  const [currentPage, setCurrentPage] = useState('home');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHidden, setIsLoadingHidden] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studyDeck, setStudyDeck] = useState(null);
  const [showProfileTab, setShowProfileTab] = useState(false);
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatSocket, setChatSocket] = useState(null);
  const socketRef = useRef(null);
  const chatSocketRef = useRef(null);
  const notificationHideTimerRef = useRef(null);
  const notificationRemoveTimerRef = useRef(null);
  const loadingHideTimerRef = useRef(null);
  const loadingRemoveTimerRef = useRef(null);

  const token = localStorage.getItem('lexy_token');
  const userStr = localStorage.getItem('lexy_user');
  let user = null;
  try {
    if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
  } catch (e) {
    localStorage.removeItem('lexy_user');
  }
  const isAuthorized = Boolean(token && user);

  // Данные для модального окна в подвале
  const footerModalData = {
    'terms-conditions': {
      title: 'Terms and Conditions',
      content: 'Правила и условия использования приложения LinguaCards. Используя приложение, вы соглашаетесь с условиями использования.'
    },
    'terms-of-use': {
      title: 'Terms of Use',
      content: 'Условия использования. Пожалуйста, ознакомьтесь с правилами использования приложения перед началом работы.'
    },
    'privacy-policy': {
      title: 'Privacy Policy',
      content: 'Политика конфиденциальности. Мы заботимся о вашей конфиденциальности. Ваши данные хранятся локально и не передаются третьим лицам.'
    },
    'faq': {
      title: 'FAQ',
      content: 'Часто задаваемые вопросы:\n\nКак начать изучение?\nВыберите колоду и нажмите "Начать изучение".\n\nКак добавить свои карточки?\nПерейдите в "Мои колоды" и создайте новую колоду.\n\nКак работают интервальные повторения?\nАлгоритм показывает карточки через увеличивающиеся интервалы времени.'
    },
    'contact': {
      title: 'Contact',
      content: 'Связаться с нами: support@linguacards.app\n\nМы ответим на ваши вопросы в течение 24 часов.'
    }
  };

  const showNotification = useCallback((message, type = 'success') => {
    if (notificationHideTimerRef.current) clearTimeout(notificationHideTimerRef.current);
    if (notificationRemoveTimerRef.current) clearTimeout(notificationRemoveTimerRef.current);

    setNotification({ message, type });
    setIsNotificationVisible(true);

    notificationHideTimerRef.current = setTimeout(() => {
      setIsNotificationVisible(false);

      notificationRemoveTimerRef.current = setTimeout(() => {
        setNotification(null);
      }, 260);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationHideTimerRef.current) clearTimeout(notificationHideTimerRef.current);
      if (notificationRemoveTimerRef.current) clearTimeout(notificationRemoveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAuthorized || !user) {
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
        chatSocketRef.current = null;
      }
      if (socketRef.current && socketRef.current !== chatSocketRef.current) {
        socketRef.current.disconnect();
      }
      socketRef.current = null;
      window.chatSocket = null;
      window.socket = null;
      setChatSocket(null);
      setChatUnreadCount(0);
      return;
    }

    if (chatSocketRef.current) {
      setChatSocket(chatSocketRef.current);
      window.chatSocket = chatSocketRef.current;
      return;
    }

    const nextChatSocket = createChatSocket();
    if (!nextChatSocket) return;

    const handleIncomingMessage = (message) => {
      if (Number(message.sender_id) === Number(user.id)) return;
      setChatUnreadCount((prev) => prev + 1);
    };

    chatSocketRef.current = nextChatSocket;
    socketRef.current = nextChatSocket;
    setChatSocket(nextChatSocket);
    window.chatSocket = nextChatSocket;
    window.socket = nextChatSocket;
    nextChatSocket.on('chat:new_message', handleIncomingMessage);
    nextChatSocket.on('system_notification', (msg) => {
      showNotification(msg, 'accent');

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Lexy - Напоминание", {
          body: msg,
          icon: '/icons/favicon.ico',
        });
      }
    });

    return () => {
      nextChatSocket.off('chat:new_message', handleIncomingMessage);
      nextChatSocket.off('system_notification');
      nextChatSocket.disconnect();
      if (chatSocketRef.current === nextChatSocket) {
        chatSocketRef.current = null;
      }
      if (socketRef.current === nextChatSocket) {
        socketRef.current = null;
      }
      if (window.chatSocket === nextChatSocket) {
        window.chatSocket = null;
      }
      if (window.socket === nextChatSocket) {
        window.socket = null;
      }
    };
  }, [isAuthorized, user?.id]);

  const showModal = useCallback((content, options = {}) => {
    const isStudy = content.title?.includes('Карточка');
    setIsStudyMode(isStudy);
    setModalContent(content);
  }, []);

  const closeModal = useCallback(() => {
    setModalContent(null);
    setIsStudyMode(false);
    setStudyDeck(null);
  }, []);

  const showFooterModal = useCallback((modalId) => {
    const data = footerModalData[modalId];
    if (!data) return;
    
    showModal({
      title: data.title,
      body: data.content.replace(/\n/g, '<br>')
    });
  }, [showModal]);

  const handleAddDemoDeck = useCallback((deck) => {
    setUserDecks((prevDecks) => {
      if (prevDecks.find((d) => d.id === deck.id)) return prevDecks;
      return [...prevDecks, { ...deck }];
    });
  }, []);

  const handleStartStudy = useCallback((deck, mode = 1) => {
    if (!deck) return;
    setStudyDeck(deck);
    setIsStudyMode(true);
  }, []);

  const handleToggleFavorite = useCallback(async (cardId) => {
    if (!cardId) return;
    const token = localStorage.getItem('lexy_token');
    if (!token) {
      showNotification('Войдите в аккаунт, чтобы использовать избранное', 'error');
      return;
    }

    try {
      await api.toggleFavorite(cardId);
    } catch (error) {
      showNotification(error.message || 'Не удалось обновить избранное', 'error');
    }
  }, [showNotification]);

  const loadPage = useCallback(async (pageName) => {
    setCurrentPage(pageName);
    
    if (pageName === 'home' && window.initHomePage) {
      window.initHomePage();
    } else if (pageName === 'mydecks' && window.initMyDecksPage) {
      window.initMyDecksPage();
    } else if (pageName === 'stats' && window.initStatsPage) {
      window.initStatsPage();
    } else if (pageName === 'profile' && window.initProfilePage) {
      window.initProfilePage();
    } else if (pageName === 'admin' && window.initAdminPage) {
      window.initAdminPage();
    } else if (pageName === 'library' && window.initLibraryPage) {
      window.initLibraryPage();
    }
  }, []);

  const handleTabClick = useCallback(async (tab) => {
    const token = localStorage.getItem('lexy_token');
    const userStr = localStorage.getItem('lexy_user');
    let user = null;
    try {
      if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
    } catch (e) {
      localStorage.removeItem('lexy_user');
    }
    
    const protectedPages = ['profile', 'mydecks', 'stats', 'admin', 'chat'];
    if (protectedPages.includes(tab) && (!token || !user)) {
      setShowAuthModal(true);
      return;
    }
    
    if (tab === 'admin' && user?.role !== 'admin') {
      showNotification('Доступ запрещён', 'error');
      return;
    }
    
    await loadPage(tab);
  }, [loadPage, showNotification]);

  const handleAuthSuccess = useCallback(async (action, userData) => {
    setShowAuthModal(false);

    if (action === 'success' && userData?.id && socketRef.current) {
      socketRef.current.emit('register', userData.id);
    }

    if (action === 'success' || action === 'profile') {
      await loadPage('profile');
    } else if (action === 'update') {
      const authBtn = document.getElementById('authBtn');
      const token = localStorage.getItem('lexy_token');
      const userStr = localStorage.getItem('lexy_user');
      let user = null;
      try {
        if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
      } catch (e) {
        localStorage.removeItem('lexy_user');
      }

      if (token && user) {
        setShowProfileTab(true);
        setShowAdminTab(user.role === 'admin');
        if (authBtn) {
          authBtn.classList.add('logged-in');
          authBtn.innerHTML = `<span class="user-avatar">${user.avatar || '👤'}</span><span class="auth-btn-text">${user.username}</span>`;
        }
      } else {
        setShowProfileTab(false);
        setShowAdminTab(false);
        if (authBtn) {
          authBtn.classList.remove('logged-in');
          authBtn.innerHTML = '<span class="auth-btn-text">Вход</span>';
        }
      }
    }
  }, [loadPage]);

  const handleLogout = useCallback(() => {
    if (window.confirm('Выйти из аккаунта?')) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
        chatSocketRef.current = null;
      }
      window.socket = null;
      window.chatSocket = null;
      setChatSocket(null);
      setChatUnreadCount(0);
      localStorage.removeItem('lexy_token');
      localStorage.removeItem('lexy_user');
      localStorage.removeItem('linguaState');
      setShowProfileTab(false);
      setShowAdminTab(false);
      window.location.reload();
    }
  }, []);

  const urlBase64ToUint8Array = useCallback((base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  const subscribeUserToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const response = await fetch('/api/notifications/public-key');
        const data = await response.json();
        const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      const token = localStorage.getItem('lexy_token');
      if (token) {
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(subscription)
        });
      }
    } catch (err) {
      console.error('Failed to subscribe to Web Push:', err);
    }
  }, [urlBase64ToUint8Array]);

  const initNavbarScrollEffect = useCallback(() => {
    const navTabs = document.querySelector('.nav-tabs');
    if (!navTabs) return;
    
    let ticking = false;
    
    function updateNavBorder() {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 10) {
        navTabs.classList.add('nav-hidden');
      } else {
        navTabs.classList.remove('nav-hidden');
      }

      ticking = false;
    }
    
    navTabs.classList.add('nav-hidden');
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNavBorder);
        ticking = true;
      }
    }, { passive: true });
  }, []);

  // Глобальная функция сохранения
  window.saveState = () => {
    if (window.AppState) {
      localStorage.setItem('linguaState', JSON.stringify(window.AppState));
    }
  };

  // Загрузить состояние
  const loadAppState = () => {
    try {
      const saved = localStorage.getItem('linguaState');
      if (saved) {
        window.AppState = JSON.parse(saved);
      } else {
        window.AppState = {
          user: {
            name: 'Пользователь',
            username: 'username',
            avatar: '👤',
            theme: 'dark',
            streak: 0,
            lastStudyDate: null,
            learnedWords: 0,
            studyTime: 0,
            accuracy: 0,
            activity: {}
          },
          userDecks: [],
          favoriteDeck: { id: 'favorite', name: 'Избранное', cards: [] },
          forgottenDeck: { id: 'forgotten', name: 'Забытые карты', cards: [] }
        };
      }
    } catch (e) {
      console.error('Error loading app state:', e);
      window.AppState = {
        user: {
          name: 'Пользователь',
          username: 'username',
          avatar: '👤',
          theme: 'dark',
          streak: 0,
          lastStudyDate: null,
          learnedWords: 0,
          studyTime: 0,
          accuracy: 0,
          activity: {}
        },
        userDecks: [],
        favoriteDeck: { id: 'favorite', name: 'Избранное', cards: [] },
        forgottenDeck: { id: 'forgotten', name: 'Забытые карты', cards: [] }
      };
    }
  };

  // Инициализация приложения
  useEffect(() => {
    loadAppState();

    const applyStoredTheme = () => {
      let storedTheme = 'dark';

      const userStr = localStorage.getItem('lexy_user');
      if (userStr) {
        try {
          const localUser = JSON.parse(userStr);
          if (localUser?.theme === 'light' || localUser?.theme === 'dark') {
            storedTheme = localUser.theme;
          }
        } catch (e) {
          // игнорировать повреждённые локальные данные пользователя
        }
      }

      if (window.AppState?.user?.theme === 'light' || window.AppState?.user?.theme === 'dark') {
        storedTheme = window.AppState.user.theme;
      }

      if (storedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
      } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      }
    };

    applyStoredTheme();

    const init = async () => {
      loadingHideTimerRef.current = setTimeout(() => {
        setIsLoadingHidden(true);
        loadingRemoveTimerRef.current = setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }, 2000);

      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (e) {
          console.error('Service Worker registration failed:', e);
        }
      }

      window.subscribeUserToPush = subscribeUserToPush;

      if ("Notification" in window) {
        const token = localStorage.getItem('lexy_token');
        const allow = window.AppState?.user?.notifications_enabled !== false;
        if (token && allow) {
          subscribeUserToPush();
        }
      }

      const updateAuthButton = () => {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;

        const token = localStorage.getItem('lexy_token');
        const userStr = localStorage.getItem('lexy_user');
        let user = null;
        try {
          if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
        } catch(e) {
          localStorage.removeItem('lexy_user');
        }

        if (token && user) {
          authBtn.classList.add('logged-in');
          authBtn.innerHTML = `<span class="user-avatar">${user.avatar || '👤'}</span><span class="auth-btn-text">${user.username}</span>`;
        } else {
          authBtn.classList.remove('logged-in');
          authBtn.innerHTML = '<span class="auth-btn-text">Вход</span>';
        }
      };

      updateAuthButton();
      initNavbarScrollEffect();

      // Инициализация видимости вкладок на основе текущего состояния авторизации
      const token = localStorage.getItem('lexy_token');
      const userStr = localStorage.getItem('lexy_user');
      let user = null;
      try {
        if (userStr && userStr !== 'undefined') user = JSON.parse(userStr);
      } catch (e) {
        localStorage.removeItem('lexy_user');
      }

      if (token && user) {
        setShowProfileTab(true);
        setShowAdminTab(user.role === 'admin');
      } else {
        setShowProfileTab(false);
        setShowAdminTab(false);
      }

      await loadPage('home');

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === 'home') {
          btn.classList.add('active');
        }
      });
    };

    init();

    return () => {
      if (loadingHideTimerRef.current) clearTimeout(loadingHideTimerRef.current);
      if (loadingRemoveTimerRef.current) clearTimeout(loadingRemoveTimerRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      window.socket = null;
      window.subscribeUserToPush = null;
    };
  }, [loadPage, initNavbarScrollEffect, subscribeUserToPush, showNotification]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home
            onShowAuth={() => setShowAuthModal(true)}
            onLoadPage={loadPage}
            onAddDemoDeck={handleAddDemoDeck}
            onStartStudy={handleStartStudy}
          />
        );
      case 'library':
        return <Library onShowNotification={showNotification} onStartStudy={handleStartStudy} />;
      case 'mydecks':
        return <MyDecks onShowNotification={showNotification} />;
      case 'stats':
        return <Stats />;
      case 'profile':
        return <Profile onLogout={handleLogout} onShowNotification={showNotification} onNavigate={loadPage} />;
      case 'admin':
        return <Admin onShowNotification={showNotification} onNavigate={loadPage} />;
      case 'chat':
        return (
          <ErrorBoundary>
            <Chat
              currentUser={user}
              socket={chatSocket}
              onShowNotification={showNotification}
              onUnreadCountChange={setChatUnreadCount}
            />
          </ErrorBoundary>
        );
      default:
        return (
          <Home
            onShowAuth={() => setShowAuthModal(true)}
            onLoadPage={loadPage}
            onAddDemoDeck={handleAddDemoDeck}
            onStartStudy={handleStartStudy}
          />
        );
    }
  };

  return (
    <>
      {isLoading && (
        <div id="loading-screen" className={`loading-screen ${isLoadingHidden ? 'hidden' : ''}`}>
          <div className="loading-content">
            <h1 className="loading-title">Lexy</h1>
            <div className="loading-bar-container" aria-label="Загрузка приложения">
              <div className="loading-bar"></div>
            </div>
          </div>
        </div>
      )}

      <div className="nav-tabs">
        <span className="nav-logo">Lexy</span>
        <div className="nav-buttons">
          <button 
            className={`tab-btn ${currentPage === 'home' ? 'active' : ''}`} 
            data-tab="home"
            onClick={() => handleTabClick('home')}
          >
            Главная
          </button>
          <button 
            className={`tab-btn ${currentPage === 'library' ? 'active' : ''} ${!isAuthorized ? 'disabled' : ''}`} 
            data-tab="library"
            disabled={!isAuthorized}
            onClick={() => handleTabClick('library')}
          >
            Библиотека
          </button>
          <button 
            className={`tab-btn ${currentPage === 'mydecks' ? 'active' : ''} ${!isAuthorized ? 'disabled' : ''}`} 
            data-tab="mydecks"
            disabled={!isAuthorized}
            onClick={() => handleTabClick('mydecks')}
          >
            Мои колоды
          </button>
          <button 
            className={`tab-btn ${currentPage === 'stats' ? 'active' : ''} ${!isAuthorized ? 'disabled' : ''}`} 
            data-tab="stats"
            disabled={!isAuthorized}
            onClick={() => handleTabClick('stats')}
          >
            Статистика
          </button>
          <button
            className={`tab-btn ${currentPage === 'chat' ? 'active' : ''} ${!isAuthorized ? 'disabled' : ''}`}
            data-tab="chat"
            disabled={!isAuthorized}
            onClick={() => handleTabClick('chat')}
          >
            Чат
            {chatUnreadCount > 0 && <span className="tab-badge">{chatUnreadCount}</span>}
          </button>
          <button
            className={`tab-btn ${currentPage === 'profile' ? 'active' : ''}`}
            data-tab="profile"
            onClick={() => handleTabClick('profile')}
            style={{ display: showProfileTab ? 'inline-flex' : 'none' }}
          >
            Профиль
          </button>
          <button
            className="tab-btn"
            id="adminTab"
            data-tab="admin"
            onClick={() => handleTabClick('admin')}
            style={{ display: showAdminTab ? 'inline-flex' : 'none' }}
          >
            Админ
          </button>
        </div>
        <button
          className="auth-btn"
          id="authBtn"
          onClick={() => {
            if (isAuthorized) {
              handleTabClick('profile');
            } else {
              setShowAuthModal(true);
            }
          }}
        >
          <span className="auth-btn-text">Вход</span>
        </button>
      </div>

      <main id="content" className={`container page-${currentPage}`}>
        {renderPage()}
      </main>

      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="footer-links">
              <a href="#" data-modal="terms-conditions" className="footer-link" onClick={(e) => { e.preventDefault(); showFooterModal('terms-conditions'); }}>Terms and Conditions</a>
              <span className="footer-separator">•</span>
              <a href="#" data-modal="terms-of-use" className="footer-link" onClick={(e) => { e.preventDefault(); showFooterModal('terms-of-use'); }}>Terms of Use</a>
              <span className="footer-separator">•</span>
              <a href="#" data-modal="privacy-policy" className="footer-link" onClick={(e) => { e.preventDefault(); showFooterModal('privacy-policy'); }}>Privacy Policy</a>
              <span className="footer-separator">•</span>
              <a href="#" data-modal="faq" className="footer-link" onClick={(e) => { e.preventDefault(); showFooterModal('faq'); }}>FAQ</a>
            </div>
          </div>
          <div className="footer-right">
            <p className="footer-copyright">© 2024 Lexy. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {(modalContent || (isStudyMode && studyDeck)) && (
        <div className={`modal-overlay active ${isStudyMode ? 'study-mode' : ''}`} onClick={!isStudyMode ? closeModal : undefined}>
          <div className={`modal-content ${isStudyMode ? 'study-mode' : ''}`}>
            {isStudyMode && studyDeck ? (
              <StudyMode
                deck={studyDeck}
                onClose={closeModal}
                onShowNotification={showNotification}
                onToggleFavorite={handleToggleFavorite}
              />
            ) : (
              <>
                <div className="modal-header">
                  <h2>{modalContent.title || ''}</h2>
                  <span className="close-btn" onClick={closeModal}>×</span>
                </div>
                <div className="modal-body" dangerouslySetInnerHTML={{ __html: modalContent.body }} />
              </>
            )}
          </div>
        </div>
      )}

      {notification && (
        <div className={`notification ${notification.type} ${isNotificationVisible ? 'show' : 'hide'}`}>
          {notification.message}
        </div>
      )}

      {showAuthModal && (
        <Auth 
          onAuthSuccess={handleAuthSuccess} 
          onShowNotification={showNotification}
        />
      )}
    </>
  );
}

export default App;