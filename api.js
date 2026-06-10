// Сервис API для подключения к бэкенду
const API_URL = '/api';

const api = {
    // Эндпоинты авторизации
    async register(name, username, password) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registration failed');
        return data;
    },

    async login(username, password) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) {
            // Если сервер вернул понятное сообщение (например, причина блокировки + до какого времени), показать его
            const errMsg = data.message || data.error || 'Login failed';
            throw new Error(errMsg);
        }
        return data;
    },

    async getMe() {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get user');
        return data;
    },

    async updateProfile(payload) {
        // Тело запроса может содержать { name, avatar } или { notifications_enabled }
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update profile');
        return data;
    },

    async getStats() {
        const response = await fetch(`${API_URL}/auth/stats`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get stats');
        return data;
    },

    async updateStats(stats) {
        const response = await fetch(`${API_URL}/auth/stats`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(stats),
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update stats');
        return data;
    },

    async changePassword(currentPassword, newPassword) {
        const response = await fetch(`${API_URL}/auth/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to change password');
        return data;
    },

    async deleteAccount() {
        const response = await fetch(`${API_URL}/auth/account`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete account');
        return data;
    },

    // Эндпоинты активности
    async getActivity() {
        const response = await fetch(`${API_URL}/activity`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get activity');
        return data;
    },

    async recordActivity(cardsStudied, date) {
        console.log('Calling recordActivity with', cardsStudied, date);
        const response = await fetch(`${API_URL}/activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ cardsStudied, date }),
            credentials: 'include'
        });
        console.log('recordActivity response status:', response.status);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to record activity');
        return data;
    },

    async recordActivity(cardsStudied = 1, date = null) {
        const response = await fetch(`${API_URL}/activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ cardsStudied, date })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to record activity');
        return data;
    },

    // Эндпоинты колод
    async getDecks() {
        const response = await fetch(`${API_URL}/decks`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get decks');
        return data;
    },

    async createDeck(name, description, source = 'created', public_deck_id = null) {
        const response = await fetch(`${API_URL}/decks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, description, source, public_deck_id })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create deck');
        return data;
    },

    async addPublicDeck(deckId) {
        const response = await fetch(`${API_URL}/decks/${deckId}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to add public deck');
            return data;
        } else {
            const text = await response.text();
            if (!response.ok) throw new Error(text || 'Failed to add public deck');
            return { raw: text };
        }
    },

    async deleteDeck(id) {
        const response = await fetch(`${API_URL}/decks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete deck');
        return data;
    },

    async banUser(userId, payload) {
        const response = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to ban user');
        return data;
    },

    async updateDeck(id, name, description, custom_image) {
        const response = await fetch(`${API_URL}/decks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, description, custom_image })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update deck');
        return data;
    },

    async uploadDeckImage(id, file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${API_URL}/decks/${id}/image`, {
            method: 'POST',
            headers: getAuthHeaders(), // У FormData не нужно вручную задавать Content-Type
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to upload image');
        return data;
    },

    // Эндпоинты карточек
    async getCards(deckId) {
        const response = await fetch(`${API_URL}/decks/${deckId}/cards`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get cards');
        return data;
    },

    async createCard(deckId, front, back) {
        const response = await fetch(`${API_URL}/decks/${deckId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ front, back })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create card');
        return data;
    },

    async translateWord(text, lang = 'en-ru') {
        const params = new URLSearchParams({ text, lang });
        const response = await fetch(`${API_URL}/dictionary/translate?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to translate word');
        return data;
    },

    async toggleFavorite(cardId) {
        const response = await fetch(`${API_URL}/cards/${cardId}/favorite`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to toggle favorite');
        return data;
    },

    async toggleForgotten(cardId) {
        const response = await fetch(`${API_URL}/cards/${cardId}/forgotten`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to toggle forgotten');
        return data;
    },

    async syncUpdateCardForgotten(cardId, isForgotten) {
        console.log('SYNC FORGOTTEN: Sending request for card', cardId, 'isForgotten:', isForgotten);
        try {
            const response = await fetch(`${API_URL}/cards/${cardId}/forgotten`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ is_forgotten: isForgotten })
            });
            
            console.log('SYNC FORGOTTEN: Response status:', response.status);
            
            if (response.ok) {
                return await response.json();
            }
            
            // Если 404, карточка может не существовать в user_cards — это нормально для карточек из публичных колод
            if (response.status === 404) {
                console.log('Card not found in user_cards:', cardId);
                return { success: true, note: 'Card not in user_cards' };
            }
            
            const data = await response.json();
            throw new Error(data.error || 'Failed to update forgotten');
        } catch (e) {
            console.error('Sync forgotten error:', e);
            // Вернуть успех, чтобы не блокировать интерфейс — данные будут синхронизированы при следующем полном обмене
            return { success: true, offline: true };
        }
    },

    async deleteCard(id) {
        const response = await fetch(`${API_URL}/cards/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete card');
        return data;
    },

    async updateCard(id, front, back) {
        const response = await fetch(`${API_URL}/cards/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ front, back })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update card');
        return data;
    },

    // Эндпоинты синхронизации
    async syncGet() {
        const response = await fetch(`${API_URL}/sync`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to sync');
        return data;
    },

    async syncSave(decks) {
        const response = await fetch(`${API_URL}/sync`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ decks })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save');
        return data;
    },

    // Публичные колоды (для всех пользователей)
    async getPublicDecks() {
        const response = await fetch(`${API_URL}/public-decks`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get public decks');
        return data;
    },

    async getPublicDeckCards(deckId) {
        const response = await fetch(`${API_URL}/public-decks/${deckId}/cards`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get cards');
        return data;
    },

    // Админ: управление публичными колодами
    async getAdminPublicDecks() {
        const response = await fetch(`${API_URL}/admin/public-decks`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get decks');
        return data;
    },

    async createPublicDeck(name, description, lang, category = '') {
        const response = await fetch(`${API_URL}/admin/public-decks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, description, lang, category })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create deck');
        return data;
    },

    async updatePublicDeck(id, name, description, lang, category = '', custom_image = null) {
        const response = await fetch(`${API_URL}/admin/public-decks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ name, description, lang, category, custom_image })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update deck');
        return data;
    },

    async uploadPublicDeckImage(id, file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${API_URL}/admin/public-decks/${id}/image`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to upload image');
        return data;
    },

    async deletePublicDeck(id) {
        const response = await fetch(`${API_URL}/admin/public-decks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete deck');
        return data;
    },

    async getAdminPublicDeckCards(deckId) {
        const response = await fetch(`${API_URL}/admin/public-decks/${deckId}/cards`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get cards');
        return data;
    },

    async createPublicCard(deckId, front, back) {
        const response = await fetch(`${API_URL}/admin/public-decks/${deckId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ front, back })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create card');
        return data;
    },

    async deletePublicCard(id) {
        const response = await fetch(`${API_URL}/admin/public-cards/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete card');
        return data;
    },

    // Админские эндпоинты
    async getAllUsers() {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get users');
        return data;
    },

    async getAllUsersForAdmin() {
        // Обратный совместимый алиас, используемый админским интерфейсом администратора
        return this.getAllUsers();
    },

    async updateUserRole(userId, role) {
        const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ role })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update role');
        return data;
    },

    // Эндпоинты отправки
    async submitDeck(deckId, message = '') {
        const response = await fetch(`${API_URL}/decks/${deckId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ message })
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to submit deck');
            return data;
        } else {
            const text = await response.text();
            if (!response.ok) throw new Error(text || 'Failed to submit deck');
            return { raw: text };
        }
    },

    async getAdminSubmissions() {
        const response = await fetch(`${API_URL}/admin/submissions`, {
            headers: getAuthHeaders()
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to get submissions');
            return data;
        } else {
            const text = await response.text();
            if (!response.ok) throw new Error(text || 'Failed to get submissions');
            return { raw: text };
        }
    },

    async reviewSubmission(id, action, category = '', lang = '') {
        const response = await fetch(`${API_URL}/admin/submissions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ action, category, lang })
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to review submission');
            return data;
        } else {
            const text = await response.text();
            if (!response.ok) throw new Error(text || 'Failed to review submission');
            return { raw: text };
        }
    },

    // Избранное
    async getFavoriteCards() {
        const response = await fetch(`${API_URL}/cards/favorites`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get favorite cards');
        return data;
    },

    async getForgottenCards() {
        const response = await fetch(`${API_URL}/cards/forgotten`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get forgotten cards');
        return data;
    },

    async getMyDecks() {
        const response = await fetch(`${API_URL}/decks`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get decks');
        return data.decks;
    }
};

// Вспомогательная функция для получения заголовков авторизации
function getAuthHeaders() {
    const token = localStorage.getItem('lexy_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Вспомогательная функция fetch с учётом учётных данных
function apiFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    });
}

// Экспорт для использования в других файлах
export { api };