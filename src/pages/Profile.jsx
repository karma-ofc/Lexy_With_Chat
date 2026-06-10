import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export default function Profile({ onLogout, onShowNotification, onNavigate }) {
  const [user, setUser] = useState({
    name: 'Пользователь',
    username: 'username',
    avatar: '👤',
    role: 'user',
    theme: 'dark',
    notifications_enabled: true
  });
  const [notificationsDisabled, setNotificationsDisabled] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const loadingRef = useRef(false);

  const updateProfileDisplay = useCallback(() => {
    const currentUser = window.AppState?.user;
    if (currentUser && JSON.stringify(currentUser) !== JSON.stringify(user)) {
      setUser(currentUser);
    }
  }, [user]);

  const updateNotificationIcon = useCallback(() => {
    // Функция для обновления иконки уведомлений (оставляем для совместимости)
    const enabled = (user.notifications_enabled === undefined) ? true : !!user.notifications_enabled;
    const isLight = (user.theme === 'light') || document.body.classList.contains('light-theme');
    // Иконка обновляется через CSS, но функция нужна для совместимости
  }, [user]);

  const swapThemeIcons = useCallback((isLight) => {
    // Функция для замены иконок темы (оставляем для совместимости)
    // Иконки обновляются через CSS
  }, []);

  const applyTheme = useCallback((theme) => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = useCallback((e) => {
    const isLight = e.target.checked;
    applyTheme(isLight ? 'light' : 'dark');
    setIsLightTheme(isLight);
    
    if (window.AppState && window.AppState.user) {
      window.AppState.user.theme = isLight ? 'light' : 'dark';
      window.saveState?.();
    }
    
    const userStr = localStorage.getItem('lexy_user');
    if (userStr) {
      try {
        const localUser = JSON.parse(userStr);
        localUser.theme = isLight ? 'light' : 'dark';
        localStorage.setItem('lexy_user', JSON.stringify(localUser));
      } catch(err) {}
    }
    
    setUser(prev => ({ ...prev, theme: isLight ? 'light' : 'dark' }));
    
    const themeLabelText = document.getElementById('themeLabelText');
    if (themeLabelText) {
      themeLabelText.textContent = isLight ? 'Светлая тема' : 'Темная тема';
    }
    
    swapThemeIcons(isLight);
    updateNotificationIcon();
  }, [applyTheme, swapThemeIcons, updateNotificationIcon]);

  const loadProfile = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const token = localStorage.getItem('lexy_token');
    const userStr = localStorage.getItem('lexy_user');
    const localUser = userStr ? JSON.parse(userStr) : null;

    if (!token || !localUser) {
      if (onShowNotification) {
        onShowNotification('Войдите для доступа к профилю', 'error');
      }
      if (onNavigate) {
        onNavigate('home');
      }
      loadingRef.current = false;
      return;
    }

    if (window.AppState) {
      window.AppState.user = localUser;
    }
    setUser(localUser);
    setIsLightTheme(localUser.theme === 'light');
    setNotificationsDisabled(!(localUser.notifications_enabled !== false));

    // Обновляем с сервера, чтобы получить актуальные настройки уведомлений
    if (localStorage.getItem('lexy_token') && api) {
      try {
        const me = await api.getMe();
        if (me && me.user) {
          const mergedUser = {
            ...localUser,
            ...me.user,
            theme: (localUser && localUser.theme) || 'dark'
          };

          if (window.AppState) {
            window.AppState.user = {
              ...(window.AppState.user || {}),
              ...mergedUser
            };
            localStorage.setItem('lexy_user', JSON.stringify(window.AppState.user));
          } else {
            localStorage.setItem('lexy_user', JSON.stringify(mergedUser));
          }

          setUser(mergedUser);
          setNotificationsDisabled(!(mergedUser.notifications_enabled !== false));
          updateProfileDisplay();

          const notificationsToggle = document.getElementById('notificationsToggle');
          if (notificationsToggle) {
            notificationsToggle.checked = !(mergedUser.notifications_enabled !== false);
          }
          updateNotificationIcon();
        }
      } catch (e) {
        updateProfileDisplay();
      }
    } else {
      updateProfileDisplay();
    }

    loadingRef.current = false;
  }, [onShowNotification, onNavigate, updateProfileDisplay, updateNotificationIcon]);

  useEffect(() => {
    loadProfile();

    // Регистрируем глобальную функцию инициализации
    window.initProfilePage = () => {
      if (!loadingRef.current) loadProfile();
    };
  }, [loadProfile]);

  useEffect(() => {
    // Устанавливаем тему при загрузке
    const currentTheme = user.theme || 'dark';
    applyTheme(currentTheme);
    setIsLightTheme(currentTheme === 'light');
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.checked = currentTheme === 'light';
    }
  }, [user.theme, applyTheme]);

  const handleEditProfile = () => {
    setEditName(user.name);
    setEditUsername(user.username);
    setEditAvatar(user.avatar || '👤');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    const newName = editName || 'Пользователь';
    const newUsername = editUsername || 'username';
    const newAvatar = editAvatar || '👤';
    const currentTheme = user.theme || 'dark';

    try {
      const response = await api.updateProfile({
        name: newName,
        username: newUsername,
        avatar: newAvatar
      });

      const serverUser = response?.user || {};
      const updatedUser = {
        ...user,
        ...serverUser,
        theme: currentTheme
      };

      if (window.AppState) {
        window.AppState.user = {
          ...(window.AppState.user || {}),
          ...updatedUser
        };
        window.saveState?.();
      }

      localStorage.setItem('lexy_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setShowEditModal(false);

      if (onShowNotification) {
        onShowNotification('Профиль обновлен');
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось обновить профиль', 'error');
      }
    }
  };

  const normalizeImportedDecks = (imported) => {
    if (Array.isArray(imported)) return imported;
    if (Array.isArray(imported?.decks)) return imported.decks;
    if (Array.isArray(imported?.userDecks)) return imported.userDecks;
    return [];
  };

  const handleExportData = async () => {
    try {
      const response = await api.getMyDecks();
      const decks = Array.isArray(response) ? response : (response?.decks || []);

      const decksWithCards = await Promise.all(
        decks.map(async (deck) => {
          try {
            const cardsResponse = await api.getCards(deck.id);
            const cards = cardsResponse?.cards || [];
            return {
              name: deck.name,
              description: deck.description || '',
              cards: cards.map((card) => ({
                front: card.front || card.word || '',
                back: card.back || card.translation || ''
              }))
            };
          } catch (error) {
            return {
              name: deck.name,
              description: deck.description || '',
              cards: []
            };
          }
        })
      );

      const exportPayload = {
        version: 1,
        exported_at: new Date().toISOString(),
        decks: decksWithCards
      };

      const dataStr = JSON.stringify(exportPayload, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', `lingua_decks_${new Date().toISOString().split('T')[0]}.json`);
      linkElement.click();

      if (onShowNotification) {
        onShowNotification(`Экспортировано колод: ${decksWithCards.length}`);
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Ошибка экспорта колод', 'error');
      }
    }
  };

  const handleImportData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);

        const decksToImport = normalizeImportedDecks(imported);
        if (!decksToImport.length) {
          throw new Error('В файле нет колод для импорта');
        }

        let importedCount = 0;
        for (const deck of decksToImport) {
          const deckName = (deck?.name || '').trim();
          if (!deckName) continue;

          const created = await api.createDeck(deckName, deck?.description || '', 'created');
          const createdDeckId = created?.deck?.id;
          if (!createdDeckId) continue;

          const cards = Array.isArray(deck?.cards) ? deck.cards : [];
          for (const card of cards) {
            const front = (card?.front || card?.word || '').trim();
            const back = (card?.back || card?.translation || '').trim();
            if (!front || !back) continue;
            await api.createCard(createdDeckId, front, back);
          }

          importedCount += 1;
        }

        if (window.refreshMyDecks) {
          window.refreshMyDecks();
        }

        if (onShowNotification) {
          onShowNotification(`Импортировано колод: ${importedCount}`);
        }
      } catch (error) {
        if (onShowNotification) {
          onShowNotification(error.message || 'Ошибка импорта', 'error');
        }
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    if (window.confirm('Удалить все ваши колоды? Аккаунт останется, но колоды будут удалены.')) {
      try {
        const response = await api.getMyDecks();
        const decks = Array.isArray(response) ? response : (response?.decks || []);

        for (const deck of decks) {
          await api.deleteDeck(deck.id);
        }

        if (window.AppState) {
          window.AppState.userDecks = [];
          window.AppState.favoriteDeck = { id: 'favorite', name: 'Избранное', cards: [] };
          window.AppState.forgottenDeck = { id: 'forgotten', name: 'Забытые карты', cards: [] };
          window.saveState?.();
        }

        if (window.refreshMyDecks) {
          window.refreshMyDecks();
        }

        if (onShowNotification) {
          onShowNotification('Все колоды удалены');
        }
      } catch (error) {
        if (onShowNotification) {
          onShowNotification(error.message || 'Не удалось очистить данные', 'error');
        }
      }
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('lexy_token');
      localStorage.removeItem('lexy_user');
      localStorage.removeItem('linguaState');
      if (onShowNotification) {
        onShowNotification('Вы вышли из аккаунта');
      }
      if (onNavigate) {
        onNavigate('home');
      }
      window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    if (user.role === 'admin') return;
    
    if (window.confirm('Это действие нельзя отменить. Удалить аккаунт?')) {
      try {
        await api.deleteAccount();
        localStorage.removeItem('lexy_token');
        localStorage.removeItem('lexy_user');
        localStorage.removeItem('linguaState');
        if (onShowNotification) {
          onShowNotification('Аккаунт удален');
        }
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        if (onShowNotification) {
          onShowNotification(error.message || 'Ошибка удаления аккаунта', 'error');
        }
      }
    }
  };

  const handleNotificationsToggle = async (e) => {
    const disabled = e.target.checked;
    const newEnabled = !disabled;
    
    if (window.AppState) {
      window.AppState.user.notifications_enabled = newEnabled;
      window.saveState?.();
    }
    
    setUser(prev => ({ ...prev, notifications_enabled: newEnabled }));
    setNotificationsDisabled(disabled);
    
    try {
      await api.updateProfile({ notifications_enabled: newEnabled });
      localStorage.setItem('lexy_user', JSON.stringify(window.AppState?.user || user));
      if (onShowNotification) {
        onShowNotification(disabled ? 'Уведомления отключены' : 'Уведомления включены');
      }
      updateNotificationIcon();
    } catch (err) {
      if (onShowNotification) {
        onShowNotification('Не удалось сохранить настройку', 'error');
      }
    }
  };

  return (
    <>
      <div className="profile-page">
        <h1>Профиль</h1>

        <div className="profile-header">
          <div className="avatar" id="avatarDisplay">
            {user.avatar || '👤'}
          </div>
          <div style={{ flex: 1 }}>
            <h2 id="userNameDisplay">{user.name}</h2>
            <div style={{ color: "var(--text-secondary)", fontSize: 14 }} id="userUsernameDisplay">
              @{user.username}
            </div>
            {user.role === 'admin' && (
              <span className="user-role-badge" id="userRoleBadge" style={{ display: 'inline-block' }}>
                {user.role === 'admin' ? 'Администратор' : user.role === 'moderator' ? 'Модератор' : 'Пользователь'}
              </span>
            )}
          </div>
          <button className="btn-outline btn-small" id="editProfileBtn" onClick={handleEditProfile}>
            <img
              src="/icons/edit.svg"
              alt=""
              width={14}
              height={14}
              style={{ marginRight: 6, verticalAlign: "middle" }}
            />
            Редактировать
          </button>
        </div>

        {/* Настройки */}
        <div className="settings-section">
          <h2>Настройки</h2>
          <div className="settings-item">
            <span>
              <span className="icon-circle">
                <img
                  id="notificationsIcon"
                  src={notificationsDisabled ? (isLightTheme ? "/icons/bell-off-dark.svg" : "/icons/bell-off.svg") : (isLightTheme ? "/icons/bell-dark.svg" : "/icons/bell.svg")}
                  alt=""
                  width={14}
                  height={14}
                />
              </span>
              Отключить уведомления
            </span>
            <label className="iphone-toggle">
              <input 
                type="checkbox" 
                id="notificationsToggle" 
                checked={notificationsDisabled}
                onChange={handleNotificationsToggle}
              />
              <span className="iphone-slider" />
            </label>
          </div>

          <div className="settings-item">
            <span className="theme-label">
              <span className="theme-icon sun-icon">
                <img src={isLightTheme ? "/icons/sun-dark.svg" : "/icons/sun.svg"} alt="" width={20} height={20} />
              </span>
              <span className="theme-icon moon-icon">
                <img src={isLightTheme ? "/icons/moon-dark.svg" : "/icons/moon.svg"} alt="" width={20} height={20} />
              </span>
              <span id="themeLabelText">{isLightTheme ? 'Светлая тема' : 'Темная тема'}</span>
            </span>
            <label className="iphone-toggle">
              <input 
                type="checkbox" 
                id="themeToggle" 
                checked={isLightTheme}
                onChange={toggleTheme}
              />
              <span className="iphone-slider" />
            </label>
          </div>
        </div>

        {/* Данные */}
        <div className="settings-section">
          <h2>Данные</h2>

          <div className="settings-item">
            <span className="export-label">
              <span className="icon-circle">
                <img src={isLightTheme ? "/icons/export-dark.svg" : "/icons/export.svg"} alt="" width={14} height={14} />
              </span>
              Экспорт данных
            </span>
            <button className="btn-small" id="exportData" onClick={handleExportData}>
              Скачать
            </button>
          </div>

          <div className="settings-item">
            <span className="import-label">
              <span className="icon-circle">
                <img src={isLightTheme ? "/icons/import-dark.svg" : "/icons/import.svg"} alt="" width={14} height={14} />
              </span>
              Импорт данных
            </span>
            <input
              type="file"
              id="importFile"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportData}
            />
            <button className="btn-small" id="importBtn" onClick={() => document.getElementById('importFile')?.click()}>
              Выбрать
            </button>
          </div>
        </div>

        {/* Аккаунт */}
        <div className="settings-section">
          <h2>Аккаунт</h2>

          <div className="settings-item">
            <span>
              <span className="icon-circle">
                <img src={isLightTheme ? "/icons/log-out-dark.svg" : "/icons/exit.svg"} alt="" width={14} height={14} />
              </span>
              Выйти
            </span>
            <button className="btn-small btn-outline" id="logoutBtn" onClick={handleLogout}>
              Выход
            </button>
          </div>

          <div className="settings-item">
            <span>
              <span className="icon-circle">
                <img src="/icons/trash.svg" alt="" width={14} height={14} />
              </span>
              Очистить данные
            </span>
            <button className="btn-small btn-outline" id="clearDataBtn" onClick={handleClearAllData}>
              Очистить
            </button>
          </div>

          <div className="settings-item">
            <span>
              <span className="icon-circle">
                <img src="/icons/delete.svg" alt="" width={14} height={14} />
              </span>
              Удалить аккаунт
            </span>
            <button
              className="btn-small"
              style={{ background: "var(--danger)", color: "white" }}
              id="deleteAccountBtn"
              onClick={handleDeleteAccount}
              style={user.role === 'admin' ? { display: 'none' } : { background: "var(--danger)", color: "white" }}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      {/* Модалка редактирования профиля */}
      {showEditModal && (
        <div className="auth-modal active" onClick={(e) => {
          if (e.target.classList.contains('auth-modal')) setShowEditModal(false);
        }}>
          <div className="auth-container" style={{ maxWidth: '400px' }}>
            <button className="auth-close" onClick={() => setShowEditModal(false)}>×</button>
            <h3>Редактировать профиль</h3>
            <div className="auth-form">
              <div className="form-group">
                <label>Имя</label>
                <input 
                  type="text" 
                  id="editName" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ваше имя"
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  id="editUsername" 
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="username"
                />
              </div>
              <div className="form-group">
                <label>Аватар (эмодзи)</label>
                <input 
                  type="text" 
                  id="editAvatar" 
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value.slice(0, 2))}
                  placeholder="👤"
                  maxLength="2"
                />
              </div>
              <button className="btn" id="saveProfileBtn" onClick={handleSaveProfile}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}