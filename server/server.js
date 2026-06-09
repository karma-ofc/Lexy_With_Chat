require('dotenv').config();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception thrown:', error);
});

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const webpush = require('web-push');
const cron = require('node-cron');
const { buildSwaggerSpec, mountSwaggerDocs } = require('./swaggerDocs');
const baseSwaggerSpec = require('./swaggerSpec');

const app = express();

process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// For development, force HTTP server
const server = http.createServer(app);
console.log('Сервер работает в режиме HTTP для разработки.');
const io = new Server(server, {
    cors: {
        origin: true, // Разрешить все origins
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;
const CHAT_API_URL = process.env.CHAT_API_URL || 'http://localhost:3001';

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cors({
    origin: true, // Разрешить все origins
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '..')));

async function syncChatUser(action, user) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const url = action === 'delete'
            ? `${CHAT_API_URL}/chat-api/internal/users/${encodeURIComponent(user.id)}`
            : `${CHAT_API_URL}/chat-api/internal/users/sync`;

        const response = await fetch(url, {
            method: action === 'delete' ? 'DELETE' : 'POST',
            headers: action === 'delete'
                ? undefined
                : { 'Content-Type': 'application/json' },
            body: action === 'delete' ? undefined : JSON.stringify({ user }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Chat sync failed with status ${response.status}: ${errorText}`);
        }

        return true;
    } catch (error) {
        console.warn(`[ChatSync] ${action} sync skipped:`, error.message);
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}

const mainSwaggerSpec = buildSwaggerSpec({
    title: 'Lexy API',
    description: baseSwaggerSpec.info.description,
    servers: [{ url: '/', description: 'Current server' }],
    pathFilter: (routePath) => !routePath.startsWith('/chat-api/'),
});

mountSwaggerDocs(app, {
    mountPath: '/api/docs',
    spec: mainSwaggerSpec,
    title: 'Lexy API',
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lexy',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    ssl: false
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const YANDEX_DICT_API_KEY = process.env.YANDEX_DICT_API_KEY || '';
const YANDEX_DICT_LOOKUP_URL = 'https://dictionary.yandex.net/api/v1/dicservice.json/lookup';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

webpush.setVapidDetails(
    'mailto:contact@lexy.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
                name VARCHAR(100) NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(10) DEFAULT '👤',
                notifications_enabled BOOLEAN DEFAULT TRUE,
                streak INTEGER DEFAULT 0,
                learned_words INTEGER DEFAULT 0,
                study_time INTEGER DEFAULT 0,
                accuracy INTEGER DEFAULT 0,
                last_study_date DATE,
                banned_until TIMESTAMP,
                banned_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)`); } catch(e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS learned_words INTEGER DEFAULT 0`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS study_time INTEGER DEFAULT 0`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accuracy INTEGER DEFAULT 0`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_study_date DATE`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT`); } catch (e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE`); } catch (e) {}

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_activity (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                cards_studied INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS decks (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                custom_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS deck_images (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE UNIQUE,
                image_data BYTEA NOT NULL,
                mime_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cards (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                is_favorite BOOLEAN DEFAULT FALSE,
                is_forgotten BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public_decks (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER UNIQUE REFERENCES decks(id) ON DELETE CASCADE,
                lang VARCHAR(50) DEFAULT 'Английский',
                category TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_decks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                source TEXT DEFAULT 'created',
                public_deck_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, deck_id)
            )
        `);

        try { await pool.query(`ALTER TABLE user_decks ADD COLUMN IF NOT EXISTS public_deck_id INTEGER`); } catch (e) {}

        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                subscription_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, subscription_data)
            )
        `);

        // NOTE: chat-specific tables are managed by the chat microservice
        // and should live in the separate `chat` database. Use migration
        // scripts in `migrations/` to move data from `lexy` -> `chat`.

        await pool.query(`
            CREATE TABLE IF NOT EXISTS deck_publish_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                category VARCHAR(50) DEFAULT '',
                message TEXT DEFAULT '',
                -- existing installations may have 'rejection_reason' and 'reviewed_by'
                -- we will ensure optional columns exist for compatibility
                -- 'admin_id' is not required because some DBs use 'reviewed_by'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP
            )
        `);

        // Ensure compatibility: add missing columns if the existing table was created differently
        try {
            await pool.query("ALTER TABLE deck_publish_requests ADD COLUMN IF NOT EXISTS message TEXT");
            await pool.query("ALTER TABLE deck_publish_requests ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT ''");
            // Some DBs use 'reviewed_by' instead of 'admin_id' and may have 'rejection_reason'
            await pool.query("ALTER TABLE deck_publish_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT");
            await pool.query("ALTER TABLE deck_publish_requests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER");
        } catch (e) {
            // ignore
        }

        try {
            await pool.query("INSERT INTO roles (name) VALUES ('admin'), ('user') ON CONFLICT DO NOTHING");
        } catch(e) {}

        const adminExists = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
        if (adminExists.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'admin'");
            const adminRoleId = roleRes.rows[0] ? roleRes.rows[0].id : null;
            await pool.query(
                'INSERT INTO users (name, username, password, role_id, avatar) VALUES ($1, $2, $3, $4, $5)',
                ['Admin', 'admin', hashedPassword, adminRoleId, '👑']
            );
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

initDatabase();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        req.user = user;
        next();
    });
};

// Ensure that when a user modifies a public library deck, they operate on a private copy.
// If the user's mapping points to a deck that is the canonical public deck, this function
// creates a new copy of the deck (including cards and image) and updates user_decks to point
// to the new copy. Returns the deck id that should be used for further modifications.
async function ensureUserHasWritableDeck(userId, deckId) {
    // Check mapping exists
    const ud = await pool.query('SELECT * FROM user_decks WHERE user_id = $1 AND deck_id = $2', [userId, deckId]);
    if (ud.rows.length === 0) {
        return { ok: false, error: 'not_found' };
    }

    // If this deck is not a public canonical deck, nothing to do
    const pub = await pool.query('SELECT deck_id FROM public_decks WHERE deck_id = $1', [deckId]);
    if (pub.rows.length === 0) {
        return { ok: true, deckId: Number(deckId), copied: false };
    }

    // Create a copy for this user
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Read original deck
        const dres = await client.query('SELECT name, description, custom_image FROM decks WHERE id = $1', [deckId]);
        if (dres.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false, error: 'deck_not_found' };
        }
        const d = dres.rows[0];

        // Insert new deck (no custom_image yet, we'll copy image separately)
        const ins = await client.query('INSERT INTO decks (name, description) VALUES ($1, $2) RETURNING *', [d.name, d.description || '']);
        const newDeck = ins.rows[0];

        // Copy deck image if present
        const img = await client.query('SELECT image_data, mime_type FROM deck_images WHERE deck_id = $1', [deckId]);
        if (img.rows.length > 0) {
            await client.query('INSERT INTO deck_images (deck_id, image_data, mime_type) VALUES ($1, $2, $3)', [newDeck.id, img.rows[0].image_data, img.rows[0].mime_type]);
            const imageUrl = `/api/decks/${newDeck.id}/image?t=${Date.now()}`;
            await client.query('UPDATE decks SET custom_image = $1 WHERE id = $2', [imageUrl, newDeck.id]);
            newDeck.custom_image = imageUrl;
        } else if (d.custom_image) {
            await client.query('UPDATE decks SET custom_image = $1 WHERE id = $2', [d.custom_image, newDeck.id]);
            newDeck.custom_image = d.custom_image;
        }

        // Copy cards and capture mapping old->new ids
        const cards = await client.query('SELECT id, front, back, is_favorite, is_forgotten FROM cards WHERE deck_id = $1 ORDER BY created_at ASC', [deckId]);
        const mapping = [];
        for (const c of cards.rows) {
            const r = await client.query('INSERT INTO cards (deck_id, front, back, is_favorite, is_forgotten) VALUES ($1, $2, $3, $4, $5) RETURNING id', [newDeck.id, c.front, c.back, c.is_favorite, c.is_forgotten]);
            mapping.push({ old: c.id, new: r.rows[0].id });
        }

        // Update mapping to point to new deck id
        await client.query('UPDATE user_decks SET deck_id = $1 WHERE id = $2', [newDeck.id, ud.rows[0].id]);

        await client.query('COMMIT');
        return { ok: true, deckId: newDeck.id, copied: true, mapping };
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ensureUserHasWritableDeck error:', e);
        return { ok: false, error: 'server_error' };
    } finally {
        client.release();
    }
}

async function getDeckCardSignature(db, deckId) {
    const cards = await db.query(
        'SELECT front, back FROM cards WHERE deck_id = $1 ORDER BY id ASC',
        [deckId]
    );
    return JSON.stringify(cards.rows.map((c) => [c.front || '', c.back || '']));
}

function fetchYandexDictionaryTranslation(text, lang) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            key: YANDEX_DICT_API_KEY,
            lang,
            text
        });

        const requestUrl = `${YANDEX_DICT_LOOKUP_URL}?${params.toString()}`;
        const req = https.get(requestUrl, (resp) => {
            let body = '';

            resp.on('data', (chunk) => {
                body += chunk;
            });

            resp.on('end', () => {
                if (resp.statusCode < 200 || resp.statusCode >= 300) {
                    return reject(new Error(`Yandex dictionary returned status ${resp.statusCode}`));
                }

                try {
                    const parsed = JSON.parse(body);
                    const translations = [];

                    for (const def of parsed.def || []) {
                        for (const tr of def.tr || []) {
                            if (typeof tr.text === 'string' && tr.text.trim()) {
                                translations.push(tr.text.trim());
                            }
                        }
                    }

                    resolve({
                        translation: translations[0] || '',
                        alternatives: translations.slice(1, 6)
                    });
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(7000, () => {
            req.destroy(new Error('Yandex dictionary request timeout'));
        });
    });
}

app.get('/api/notifications/public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.get('/api/dictionary/translate', async (req, res) => {
    try {
        const text = (req.query.text || '').toString().trim();
        const lang = (req.query.lang || 'en-ru').toString();
        const allowedLangs = new Set(['en-ru', 'ru-en']);

        if (!text) {
            return res.status(400).json({ error: 'Пустой текст для перевода' });
        }

        if (!allowedLangs.has(lang)) {
            return res.status(400).json({ error: 'Неподдерживаемое направление перевода' });
        }

        const result = await fetchYandexDictionaryTranslation(text, lang);
        return res.json(result);
    } catch (error) {
        console.error('Dictionary translate error:', error);
        return res.status(502).json({ error: 'Ошибка сервиса перевода' });
    }
});

app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
    try {
        const subscription = req.body;
        await pool.query(
            `INSERT INTO push_subscriptions (user_id, subscription_data) 
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [req.user.id, subscription]
        );
        res.status(201).json({ message: 'Подписка сохранена' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сохранения подписки' });
    }
});

app.post('/api/notifications/test', authenticateToken, async (req, res) => {
    try {
        // Respect user preference
        const userRes = await pool.query('SELECT notifications_enabled FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length > 0 && userRes.rows[0].notifications_enabled === false) {
            return res.status(400).json({ error: 'Уведомления отключены' });
        }

        const subs = await pool.query('SELECT subscription_data FROM push_subscriptions WHERE user_id = $1', [req.user.id]);
        let successes = 0;
        let errors = 0;
        
        for (const sub of subs.rows) {
            try {
                await webpush.sendNotification(sub.subscription_data, JSON.stringify({
                    title: 'Lexy - Тестовое уведомление',
                    body: 'Ваши уведомления работают отлично!'
                }));
                successes++;
            } catch (e) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription_data = $2', [req.user.id, sub.subscription_data]);
                }
                errors++;
            }
        }
        
        if (successes === 0 && errors === 0) {
            return res.status(404).json({ error: 'Нет активных подписок' });
        }
        res.json({ message: 'Уведомление отправлено' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, username, password } = req.body;
        if (!name || !username || !password) return res.status(400).json({ error: 'Заполните все поля' });

        const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) return res.status(400).json({ error: 'Пользователь уже существует' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const roleName = userCount.rows[0].count === '0' ? 'admin' : 'user';
        
        let roleRes = await pool.query("SELECT id FROM roles WHERE name = $1", [roleName]);
        if (roleRes.rows.length === 0) {
            await pool.query("INSERT INTO roles (name) VALUES ($1)", [roleName]);
            roleRes = await pool.query("SELECT id FROM roles WHERE name = $1", [roleName]);
        }
        const roleId = roleRes.rows[0].id;

        const result = await pool.query(
            'INSERT INTO users (name, username, password, role_id) VALUES ($1, $2, $3, $4) RETURNING id, name, username, avatar',
            [name, username, hashedPassword, roleId]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, username: user.username, name: user.name, avatar: user.avatar, role: roleName },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        await syncChatUser('upsert', {
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            notifications_enabled: true,
            role: roleName,
            password: hashedPassword,
        });

        res.json({ message: 'Регистрация успешна', token, user: { ...user, role: roleName, notifications_enabled: true } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });

        const result = await pool.query(
            'SELECT u.id, u.name, u.username, u.password, r.name as role, u.avatar, u.banned_until, u.banned_reason FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = $1',
            [username]
        );

        if (result.rows.length === 0) return res.status(400).json({ error: 'Неверный логин или пароль' });
        const user = result.rows[0];

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Неверный логин или пароль' });

        // Check ban
        if (user.banned_until) {
            const until = new Date(user.banned_until).getTime();
            if (isNaN(until) === false) {
                const now = Date.now();
                if (until === -1 || until > now) {
                    // banned (until === -1 -> forever)
                    const reason = user.banned_reason || 'Причина не указана';
                    const untilText = until === -1 ? 'навсегда' : new Date(until).toISOString();
                    return res.status(403).json({ error: 'blocked', message: `Ваш аккаунт заблокирован до: ${untilText}. Причина: ${reason}` });
                }
            }
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, name: user.name, avatar: user.avatar, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ message: 'Вход выполнен', token, user: { id: user.id, name: user.name, username: user.username, role: user.role, avatar: user.avatar, notifications_enabled: user.notifications_enabled } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT u.id, u.name, u.username, r.name as role, u.avatar, u.streak, u.learned_words, u.study_time, u.accuracy, u.last_study_date, u.created_at, u.notifications_enabled FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/chat/users', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT u.id, u.name, u.username, u.avatar, r.name as role, u.created_at FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id <> $1 ORDER BY u.created_at DESC',
            [req.user.id]
        );

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Chat users error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Chat API routes moved to server_chat.js (separate microservice on port 3001)

// User submits deck for review
app.post('/api/decks/:id/submit', authenticateToken, async (req, res) => {
    try {
        const deckId = req.params.id;
        // Verify ownership
        const ud = await pool.query('SELECT * FROM user_decks WHERE deck_id = $1 AND user_id = $2', [deckId, req.user.id]);
        if (ud.rows.length === 0) return res.status(403).json({ error: 'Доступ запрещён' });

        // Prevent duplicate pending submissions
        const exists = await pool.query("SELECT id FROM deck_publish_requests WHERE deck_id = $1 AND user_id = $2 AND status = 'pending'", [deckId, req.user.id]);
        if (exists.rows.length > 0) return res.status(400).json({ error: 'Заявка уже в рассмотрении' });

        const message = req.body.message || '';
        const insert = await pool.query(
            'INSERT INTO deck_publish_requests (user_id, deck_id, status, message) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.user.id, deckId, 'pending', message]
        );

        res.status(201).json({ submission: insert.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Admin: list submissions
app.get('/api/admin/submissions', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const result = await pool.query(`
            SELECT ds.id, ds.user_id, ds.deck_id, ds.status,
                   COALESCE(ds.category, '') as category,
                   COALESCE(ds.message, ds.rejection_reason, '') as message,
                   ds.created_at, ds.reviewed_at, COALESCE(ds.reviewed_by, NULL) as reviewed_by,
                   u.username as user_username, u.name as user_name, d.name as deck_name, d.description
            FROM deck_publish_requests ds
            JOIN users u ON ds.user_id = u.id
            JOIN decks d ON ds.deck_id = d.id
            WHERE ds.status = 'pending'
            ORDER BY ds.created_at DESC
        `);

        res.json({ submissions: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Admin: ban/unban user
app.put('/api/admin/users/:id/ban', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const targetId = Number(req.params.id);
        if (isNaN(targetId)) return res.status(400).json({ error: 'Неверный id' });

        // Prevent admin from banning other admins or self
        const target = await pool.query('SELECT id, username, role_id FROM users WHERE id = $1', [targetId]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        const targetUser = target.rows[0];

        const roleRes = await pool.query('SELECT name FROM roles WHERE id = $1', [targetUser.role_id]);
        const targetRole = roleRes.rows[0] ? roleRes.rows[0].name : null;

        if (targetUser.id === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
        if (targetRole === 'admin') return res.status(400).json({ error: 'Нельзя заблокировать другого администратора' });

        // Body: { until: timestamp|null|'forever', reason: string }
        const { until, reason } = req.body;
        let banned_until = null;
        if (until === 'forever') banned_until = new Date(-1); // sentinel for forever
        else if (until === null) banned_until = null;
        else if (typeof until === 'number') banned_until = new Date(until);

        await pool.query('UPDATE users SET banned_until = $1, banned_reason = $2 WHERE id = $3', [banned_until, reason || null, targetId]);
        res.json({ message: 'ok' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Admin: review submission (approve/reject)
app.put('/api/admin/submissions/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const submissionId = req.params.id;
        const { action, category, lang } = req.body;

        const subRes = await pool.query('SELECT * FROM deck_publish_requests WHERE id = $1', [submissionId]);
        if (subRes.rows.length === 0) return res.status(404).json({ error: 'Заявка не найдена' });

        const submission = subRes.rows[0];

        if (action === 'approve') {
            // Create or update public_decks entry for this deck
            const langVal = lang || 'Английский';
            const catVal = category || '';

            await pool.query(
                `INSERT INTO public_decks (deck_id, lang, category) VALUES ($1, $2, $3)
                 ON CONFLICT (deck_id) DO UPDATE SET category = EXCLUDED.category, lang = EXCLUDED.lang`,
                [submission.deck_id, langVal, catVal]
            );

            const now = new Date();
            // use reviewed_by column for admin id (some schemas use reviewed_by)
            await pool.query('UPDATE deck_publish_requests SET status = $1, reviewed_by = $2, reviewed_at = $3, category = $4 WHERE id = $5', ['approved', req.user.id, now, catVal, submissionId]);

            return res.json({ message: 'Одобрено' });
        } else if (action === 'reject') {
            const now = new Date();
            // Optionally allow admin to include rejection reason in body
            const rejectionReason = req.body.rejection_reason || null;
            if (rejectionReason) {
                await pool.query('UPDATE deck_publish_requests SET status = $1, reviewed_by = $2, reviewed_at = $3, rejection_reason = $4 WHERE id = $5', ['rejected', req.user.id, now, rejectionReason, submissionId]);
            } else {
                await pool.query('UPDATE deck_publish_requests SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4', ['rejected', req.user.id, now, submissionId]);
            }
            return res.json({ message: 'Отклонено' });
        } else {
            return res.status(400).json({ error: 'Неверное действие' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { name, username, avatar, notifications_enabled } = req.body;

        if (username) {
            const usernameTaken = await pool.query(
                'SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1',
                [username, req.user.id]
            );
            if (usernameTaken.rows.length > 0) {
                return res.status(400).json({ error: 'Этот username уже занят' });
            }
        }

        const result = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), username = COALESCE($2, username), avatar = COALESCE($3, avatar), notifications_enabled = COALESCE($4, notifications_enabled) WHERE id = $5 RETURNING id, name, username, avatar, notifications_enabled',
            [name, username, avatar, notifications_enabled, req.user.id]
        );
        const u = result.rows[0];

        // If the user has disabled notifications, remove push subscriptions and unregister socket
        if (notifications_enabled === false) {
            try {
                await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.user.id]);
            } catch (e) {
                console.error('Ошибка удаления push_subscriptions при отключении уведомлений:', e);
            }

            if (connectedUsers.has(req.user.id)) {
                const sid = connectedUsers.get(req.user.id);
                connectedUsers.delete(req.user.id);
                try {
                    const sock = io.sockets.sockets.get(sid);
                    if (sock) sock.disconnect(true);
                } catch (e) {
                    // ignore
                }
            }
        }

        await syncChatUser('upsert', {
            id: u.id,
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            notifications_enabled: u.notifications_enabled,
            role: req.user.role,
        });

        res.json({ user: { ...u, role: req.user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/auth/stats', authenticateToken, async (req, res) => {
    try {
        const roleCheck = await pool.query(
            'SELECT r.name AS role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
            [req.user.id]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (roleCheck.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const { streak, learned_words, study_time, accuracy, last_study_date } = req.body;
        const result = await pool.query(
            `UPDATE users SET streak = $1, learned_words = $2, study_time = $3, accuracy = $4, last_study_date = $5
            WHERE id = $6 RETURNING id, name, username, avatar, streak, learned_words, study_time, accuracy, last_study_date`,
            [streak, learned_words, study_time, accuracy, last_study_date, req.user.id]
        );
        res.json({ user: { ...result.rows[0], role: req.user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/auth/stats', authenticateToken, async (req, res) => {
    try {
        const roleCheck = await pool.query(
            'SELECT r.name AS role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
            [req.user.id]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (roleCheck.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }

        const result = await pool.query('SELECT streak, learned_words, study_time, accuracy, last_study_date FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password);
        if (!validPassword) return res.status(400).json({ error: 'Неверный текущий пароль' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
        res.json({ message: 'Пароль изменён' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/auth/account', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'admin') return res.status(403).json({ error: 'Админ не может удалить свой профиль' });
        await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
        await syncChatUser('delete', { id: req.user.id });
        res.json({ message: 'Аккаунт удалён' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/activity', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT TO_CHAR(date, 'YYYY-MM-DD') as formatted_date, cards_studied
            FROM user_activity
            WHERE user_id = $1
            ORDER BY date
        `, [req.user.id]);

        const activity = {};
        result.rows.forEach(row => {
            activity[row.formatted_date] = row.cards_studied;
        });

        console.log('Loaded activity for user', req.user.id, 'activity:', activity);
        res.json({ activity });
    } catch (error) {
        console.error('Error loading activity:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/activity', authenticateToken, async (req, res) => {
    try {
        const { cardsStudied, date } = req.body;
        console.log('Recording activity for user', req.user.id, 'date:', date, 'cards:', cardsStudied);
        await pool.query(`
            INSERT INTO user_activity (user_id, date, cards_studied)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, date)
            DO UPDATE SET cards_studied = user_activity.cards_studied + EXCLUDED.cards_studied
        `, [req.user.id, date, cardsStudied]);

        res.json({ message: 'Activity recorded' });
    } catch (error) {
        console.error('Error recording activity:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Sync data
app.get('/api/sync', authenticateToken, async (req, res) => {
    try {
        const decksResult = await pool.query(
            `SELECT ud.id as user_deck_id, ud.source, d.* FROM user_decks ud
             JOIN decks d ON ud.deck_id = d.id WHERE ud.user_id = $1 ORDER BY d.created_at DESC`,
            [req.user.id]
        );
        const cardsResult = await pool.query(
            `SELECT c.* FROM cards c
             JOIN decks d ON c.deck_id = d.id
             JOIN user_decks ud ON ud.deck_id = d.id
             WHERE ud.user_id = $1`,
            [req.user.id]
        );
        res.json({ decks: decksResult.rows, cards: cardsResult.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/sync', authenticateToken, async (req, res) => {
    try {
        const { decks } = req.body; // Full sync
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // This logic is complex for sync. For brevity, assuming user syncs only their "created" decks locally.
            // If they modify public decks, it's not well defined in sync. We will only clear simple created ones.
            res.json({ message: 'Синхронизация через put не поддерживается в новом API, используйте POST /api/decks' });
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// DECKS API (Universal)
app.get('/api/decks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ud.id as user_deck_id, ud.source, ud.public_deck_id, d.*, CAST(COUNT(c.id) AS INTEGER) as cards_count 
             FROM user_decks ud
             JOIN decks d ON ud.deck_id = d.id 
             LEFT JOIN cards c ON d.id = c.deck_id 
             WHERE ud.user_id = $1 
             GROUP BY ud.id, d.id 
             ORDER BY d.created_at DESC`,
            [req.user.id]
        );
        res.json({ decks: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Create Deck - Now creates in 'decks' then links in 'user_decks'
app.post('/api/decks', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { name, description, source, public_deck_id } = req.body;

        const deckRes = await client.query(
            'INSERT INTO decks (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || '']
        );
        const newDeck = deckRes.rows[0];

        const udRes = await client.query(
            'INSERT INTO user_decks (user_id, deck_id, source, public_deck_id) VALUES ($1, $2, $3, $4) RETURNING id, source, public_deck_id',
            [req.user.id, newDeck.id, source || 'created', public_deck_id || null]
        );

        await client.query('COMMIT');
        res.json({ deck: { ...newDeck, user_deck_id: udRes.rows[0].id, source: udRes.rows[0].source, public_deck_id: udRes.rows[0].public_deck_id } });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Add an existing public deck to user's decks without duplicating
app.post('/api/decks/:id/add', authenticateToken, async (req, res) => {
    try {
        const deckId = req.params.id;

        // Ensure this deck is in public_decks
        const pd = await pool.query('SELECT deck_id FROM public_decks WHERE deck_id = $1', [deckId]);
        if (pd.rows.length === 0) return res.status(400).json({ error: 'Колода не найдена в публичной библиотеке' });

        // If user already has a copy from this public deck with exactly same cards,
        // return that copy instead of creating a duplicate.
        const sourceSignature = await getDeckCardSignature(pool, deckId);
        const existingPublicCopies = await pool.query(
            `SELECT id, deck_id, source, public_deck_id
             FROM user_decks
             WHERE user_id = $1 AND source = 'public' AND public_deck_id = $2`,
            [req.user.id, deckId]
        );

        for (const row of existingPublicCopies.rows) {
            const existingSignature = await getDeckCardSignature(pool, row.deck_id);
            if (existingSignature === sourceSignature) {
                const deckRes = await pool.query('SELECT * FROM decks WHERE id = $1', [row.deck_id]);
                const cardsRes = await pool.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY created_at DESC', [row.deck_id]);
                if (deckRes.rows.length === 0) continue;

                const existingDeck = deckRes.rows[0];
                existingDeck.user_deck_id = row.id;
                existingDeck.source = row.source || 'public';
                existingDeck.public_deck_id = row.public_deck_id || Number(deckId);
                existingDeck.cards = cardsRes.rows;
                return res.json({ deck: existingDeck, already_exists: true });
            }
        }

        // No mapping exists: create a private copy and map it
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const deckResOrig = await client.query('SELECT name, description, custom_image FROM decks WHERE id = $1', [deckId]);
            if (deckResOrig.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Колода не найдена' }); }
            const d = deckResOrig.rows[0];

            const ins = await client.query('INSERT INTO decks (name, description) VALUES ($1, $2) RETURNING *', [d.name, d.description || '']);
            const newDeck = ins.rows[0];

            // Copy image if any
            const img = await client.query('SELECT image_data, mime_type FROM deck_images WHERE deck_id = $1', [deckId]);
            if (img.rows.length > 0) {
                await client.query('INSERT INTO deck_images (deck_id, image_data, mime_type) VALUES ($1, $2, $3)', [newDeck.id, img.rows[0].image_data, img.rows[0].mime_type]);
                const imageUrl = `/api/decks/${newDeck.id}/image?t=${Date.now()}`;
                await client.query('UPDATE decks SET custom_image = $1 WHERE id = $2', [imageUrl, newDeck.id]);
                newDeck.custom_image = imageUrl;
            } else if (d.custom_image) {
                await client.query('UPDATE decks SET custom_image = $1 WHERE id = $2', [d.custom_image, newDeck.id]);
                newDeck.custom_image = d.custom_image;
            }

            // Copy cards
            const cards = await client.query('SELECT front, back, is_favorite, is_forgotten FROM cards WHERE deck_id = $1 ORDER BY created_at ASC', [deckId]);
            for (const c of cards.rows) {
                await client.query('INSERT INTO cards (deck_id, front, back, is_favorite, is_forgotten) VALUES ($1, $2, $3, $4, $5)', [newDeck.id, c.front, c.back, c.is_favorite, c.is_forgotten]);
            }

            // Insert mapping
            await client.query('INSERT INTO user_decks (user_id, deck_id, source, public_deck_id) VALUES ($1, $2, $3, $4)', [req.user.id, newDeck.id, 'public', deckId]);

            await client.query('COMMIT');

            // Return created deck
            const cardsRes = await pool.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY created_at DESC', [newDeck.id]);
            const udRes = await pool.query('SELECT id, source, public_deck_id FROM user_decks WHERE user_id = $1 AND deck_id = $2', [req.user.id, newDeck.id]);
            newDeck.user_deck_id = udRes.rows[0] ? udRes.rows[0].id : null;
            newDeck.cards = cardsRes.rows;
            newDeck.source = udRes.rows[0] ? udRes.rows[0].source : 'public';
            newDeck.public_deck_id = udRes.rows[0] ? udRes.rows[0].public_deck_id : Number(deckId);

            return res.json({ deck: newDeck });
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Add public deck error:', e);
            return res.status(500).json({ error: 'Ошибка сервера' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Add public deck error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/decks/:id', authenticateToken, async (req, res) => {
    // Delete user deck. If source=created, should we delete main deck? 
    // Yes, simple approach.
    try {
        const ud = await pool.query('SELECT * FROM user_decks WHERE deck_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (ud.rows.length === 0) return res.status(404).json({ error: 'Колода не найдена' });

        // Remove mapping for this user
        await pool.query('DELETE FROM user_decks WHERE deck_id = $1 AND user_id = $2', [req.params.id, req.user.id]);

        // If there are no more mappings and this deck is not a public canonical deck, delete the deck row
        const remaining = await pool.query('SELECT COUNT(*) FROM user_decks WHERE deck_id = $1', [req.params.id]);
        const pub = await pool.query('SELECT deck_id FROM public_decks WHERE deck_id = $1', [req.params.id]);
        const remainingCount = Number(remaining.rows[0].count || 0);

        if (remainingCount === 0 && pub.rows.length === 0) {
            // safe to remove the deck itself
            await pool.query('DELETE FROM decks WHERE id = $1', [req.params.id]);
        }

        res.json({ message: 'Колода удалена' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/decks/:id', authenticateToken, async (req, res) => {
    try {
        const { name, description, custom_image } = req.body;

        // Ensure user owns and get a writable deck id (copy if needed)
        const ensure = await ensureUserHasWritableDeck(req.user.id, req.params.id);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        const targetDeckId = ensure.deckId;

        // Ensure mapping exists for the final deck id
        const ud = await pool.query('SELECT * FROM user_decks WHERE deck_id = $1 AND user_id = $2', [targetDeckId, req.user.id]);
        if (ud.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещён' });

        const result = await pool.query(
            'UPDATE decks SET name = $1, description = $2, custom_image = $3 WHERE id = $4 RETURNING *',
            [name, description || '', custom_image || null, targetDeckId]
        );

        res.json({ deck: { ...result.rows[0], user_deck_id: ud.rows[0].id, source: ud.rows[0].source } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/decks/:id/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Изображение не загружено' });

        // Ensure user has writable deck (copy-on-write if needed)
        const ensure = await ensureUserHasWritableDeck(req.user.id, req.params.id);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        const targetDeckId = ensure.deckId;

        const imageUrl = `/api/decks/${targetDeckId}/image?t=${Date.now()}`;

        await pool.query(
            `INSERT INTO deck_images (deck_id, image_data, mime_type) VALUES ($1, $2, $3) 
             ON CONFLICT (deck_id) DO UPDATE SET image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type`,
            [targetDeckId, req.file.buffer, req.file.mimetype]
        );

        const result = await pool.query('UPDATE decks SET custom_image = $1 WHERE id = $2 RETURNING *', [imageUrl, targetDeckId]);
        res.json({ deck: result.rows[0], imageUrl });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/decks/:id/image', async (req, res) => {
    try {
        const result = await pool.query('SELECT image_data, mime_type FROM deck_images WHERE deck_id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Изображение не найдено' });

        res.set('Content-Type', result.rows[0].mime_type);
        res.send(result.rows[0].image_data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// CARDS API
app.get('/api/decks/:id/cards', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cards WHERE deck_id = $1', [req.params.id]);
        res.json({ cards: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/decks/:id/cards', authenticateToken, async (req, res) => {
    try {
        const { front, back } = req.body;

        // Ensure user has writable deck (copy-on-write if needed)
        const ensure = await ensureUserHasWritableDeck(req.user.id, req.params.id);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        const targetDeckId = ensure.deckId;

        const result = await pool.query(
            'INSERT INTO cards (deck_id, front, back) VALUES ($1, $2, $3) RETURNING *',
            [targetDeckId, front, back]
        );
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/cards/:id/favorite', authenticateToken, async (req, res) => {
    try {
        // Determine card and deck
        const cardRow = await pool.query('SELECT id, deck_id FROM cards WHERE id = $1', [req.params.id]);
        if (cardRow.rows.length === 0) return res.status(404).json({ error: 'Карточка не найдена' });

        const deckId = cardRow.rows[0].deck_id;
        // Ensure user owns this deck and perform copy-on-write if needed
        const udCheck = await pool.query('SELECT * FROM user_decks WHERE user_id = $1 AND deck_id = $2', [req.user.id, deckId]);
        if (udCheck.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещён' });

        const ensure = await ensureUserHasWritableDeck(req.user.id, deckId);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        let targetCardId = req.params.id;
        if (ensure.copied && ensure.mapping) {
            const map = ensure.mapping.find(m => String(m.old) === String(req.params.id));
            if (map) targetCardId = map.new;
            else return res.status(404).json({ error: 'Карточка не найдена в копии' });
        }

        const result = await pool.query('UPDATE cards SET is_favorite = NOT is_favorite WHERE id = $1 RETURNING *', [targetCardId]);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/cards/favorites', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*
             FROM cards c
             JOIN user_decks ud ON ud.deck_id = c.deck_id
             WHERE ud.user_id = $1 AND c.is_favorite = TRUE
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/cards/:id/forgotten', authenticateToken, async (req, res) => {
    try {
        const { is_forgotten } = req.body;
        const boolV = is_forgotten === true || is_forgotten === 1 || is_forgotten === 'true';

        const cardRow = await pool.query('SELECT id, deck_id FROM cards WHERE id = $1', [req.params.id]);
        if (cardRow.rows.length === 0) return res.status(404).json({ error: 'Карточка не найдена' });
        const deckId = cardRow.rows[0].deck_id;
        const udCheck = await pool.query('SELECT * FROM user_decks WHERE user_id = $1 AND deck_id = $2', [req.user.id, deckId]);
        if (udCheck.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещён' });

        const ensure = await ensureUserHasWritableDeck(req.user.id, deckId);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        let targetCardId = req.params.id;
        if (ensure.copied && ensure.mapping) {
            const map = ensure.mapping.find(m => String(m.old) === String(req.params.id));
            if (map) targetCardId = map.new;
            else return res.status(404).json({ error: 'Карточка не найдена в копии' });
        }

        const result = await pool.query('UPDATE cards SET is_forgotten = $1 WHERE id = $2 RETURNING *', [boolV, targetCardId]);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/cards/forgotten', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*
             FROM cards c
             JOIN user_decks ud ON ud.deck_id = c.deck_id
             WHERE ud.user_id = $1 AND c.is_forgotten = TRUE
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/cards/:id', authenticateToken, async (req, res) => {
    try {
        const { front, back, is_forgotten, is_favorite } = req.body;
        const updates = [], values = [];
        let pidx = 1;

        if (front !== undefined) { updates.push(`front = $${pidx++}`); values.push(front); }
        if (back !== undefined) { updates.push(`back = $${pidx++}`); values.push(back); }
        if (is_forgotten !== undefined) { updates.push(`is_forgotten = $${pidx++}`); values.push(is_forgotten === true || is_forgotten === 'true' || is_forgotten === 1); }
        if (is_favorite !== undefined) { updates.push(`is_favorite = $${pidx++}`); values.push(is_favorite === true || is_favorite === 'true' || is_favorite === 1); }

        if (updates.length === 0) return res.status(400).json({ error: 'Нет данных' });

        // Find card and deck
        const cardRow = await pool.query('SELECT id, deck_id FROM cards WHERE id = $1', [req.params.id]);
        if (cardRow.rows.length === 0) return res.status(404).json({ error: 'Карточка не найдена' });
        const deckId = cardRow.rows[0].deck_id;

        // Ensure user owns deck and get writable deck (copy if needed)
        const udCheck = await pool.query('SELECT * FROM user_decks WHERE user_id = $1 AND deck_id = $2', [req.user.id, deckId]);
        if (udCheck.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещён' });

        const ensure = await ensureUserHasWritableDeck(req.user.id, deckId);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        let targetCardId = req.params.id;
        if (ensure.copied && ensure.mapping) {
            const map = ensure.mapping.find(m => String(m.old) === String(req.params.id));
            if (map) targetCardId = map.new;
            else return res.status(404).json({ error: 'Карточка не найдена в копии' });
        }

        values.push(targetCardId);
        const result = await pool.query(`UPDATE cards SET ${updates.join(', ')} WHERE id = $${pidx} RETURNING *`, values);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
    try {
        // Find card and its deck
        const cardRow = await pool.query('SELECT id, deck_id FROM cards WHERE id = $1', [req.params.id]);
        if (cardRow.rows.length === 0) return res.status(404).json({ error: 'Карточка не найдена' });
        const deckId = cardRow.rows[0].deck_id;

        // Ensure user owns mapping
        const udCheck = await pool.query('SELECT * FROM user_decks WHERE user_id = $1 AND deck_id = $2', [req.user.id, deckId]);
        if (udCheck.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещён' });

        const ensure = await ensureUserHasWritableDeck(req.user.id, deckId);
        if (!ensure.ok) {
            if (ensure.error === 'not_found') return res.status(404).json({ error: 'Доступ запрещён' });
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        let targetCardId = req.params.id;
        if (ensure.copied && ensure.mapping) {
            const map = ensure.mapping.find(m => String(m.old) === String(req.params.id));
            if (map) targetCardId = map.new;
            else return res.status(404).json({ error: 'Карточка не найдена в копии' });
        }

        await pool.query('DELETE FROM cards WHERE id = $1', [targetCardId]);
        res.json({ message: 'Карточка удалена' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ADMIN ROUTES
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        const result = await pool.query('SELECT u.id, u.name, u.username, r.name as role, u.avatar, u.created_at FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC');
        res.json({ users: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/admin/users/:id/role', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        const { role } = req.body;
        const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
        if(roleRes.rows.length === 0) return res.status(400).json({error: 'Invalid role'});
        const result = await pool.query('UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, name, username', [roleRes.rows[0].id, req.params.id]);
        res.json({ user: { ...result.rows[0], role } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUBLIC DECKS ROUTES
app.get('/api/admin/public-decks', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        const result = await pool.query(`
            SELECT pd.id as public_id, pd.lang, pd.category, d.* 
            FROM public_decks pd JOIN decks d ON pd.deck_id = d.id ORDER BY d.created_at DESC
        `);
        res.json({ decks: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/public-decks', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        await client.query('BEGIN');
        const { name, description, lang, category } = req.body;
        
        const deckRes = await client.query('INSERT INTO decks (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
        const newDeck = deckRes.rows[0];

        const pdRes = await client.query(
            'INSERT INTO public_decks (deck_id, lang, category) VALUES ($1, $2, $3) RETURNING *',
            [newDeck.id, lang || 'Английский', category || '']
        );

        await client.query('COMMIT');
        res.json({ deck: { ...newDeck, ...pdRes.rows[0] } });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.put('/api/admin/public-decks/:id', authenticateToken, async (req, res) => {
    // Left simple assuming ID is deck_id for public decks updating
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        const { name, description, lang, category, custom_image } = req.body;
        
        await pool.query('UPDATE decks SET name = $1, description = $2, custom_image = $3 WHERE id = $4', [name, description, custom_image || null, req.params.id]);
        await pool.query('UPDATE public_decks SET lang = $1, category = $2 WHERE deck_id = $3', [lang, category || '', req.params.id]);
        res.json({ message: 'Обновлено' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/public-decks/:id/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        if (!req.file) return res.status(400).json({ error: 'Изображение не загружено' });

        const imageUrl = `/api/decks/${req.params.id}/image?public=1&t=${Date.now()}`;

        await pool.query(
            `INSERT INTO deck_images (deck_id, image_data, mime_type) VALUES ($1, $2, $3) 
             ON CONFLICT (deck_id) DO UPDATE SET image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type`,
            [req.params.id, req.file.buffer, req.file.mimetype]
        );

        await pool.query('UPDATE decks SET custom_image = $1 WHERE id = $2', [imageUrl, req.params.id]);
        res.json({ imageUrl });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/admin/public-decks/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        // Only remove the public_decks entry so user's original deck is not deleted
        await pool.query('DELETE FROM public_decks WHERE deck_id = $1', [req.params.id]);
        res.json({ message: 'Колода удалена из библиотеки' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/public-decks/:id/cards', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        const result = await pool.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ cards: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/public-decks/:id/cards', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        const { front, back } = req.body;
        const result = await pool.query('INSERT INTO cards (deck_id, front, back) VALUES ($1, $2, $3) RETURNING *', [req.params.id, front, back]);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/admin/public-cards/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        await pool.query('DELETE FROM cards WHERE id = $1', [req.params.id]);
        res.json({ message: 'Карточка удалена' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/public-decks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pd.id as public_id, pd.lang, pd.category, d.*, COUNT(c.id) as cards_count 
            FROM public_decks pd 
            JOIN decks d ON pd.deck_id = d.id 
            LEFT JOIN cards c ON d.id = c.deck_id 
            GROUP BY pd.id, d.id ORDER BY d.created_at DESC
        `);
        res.json({ decks: result.rows });
    } catch (error) {
        console.error('Error fetching public_decks:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/public-decks/:id/cards', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cards WHERE deck_id = $1', [req.params.id]);
        res.json({ cards: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// CRON JOB для проверки активности пользователей (выполняется каждый день в полночь)
cron.schedule('0 0 * * *', async () => {
    console.log('Running daily notification check...');
    try {
        const _users = await pool.query("SELECT id, last_study_date FROM users");
        for (let user of _users.rows) {
            // Check user's notification preference
            const pref = await pool.query('SELECT notifications_enabled FROM users WHERE id = $1', [user.id]);
            if (pref.rows.length > 0 && pref.rows[0].notifications_enabled === false) continue;
            if (user.last_study_date) {
                const lastDate = new Date(user.last_study_date).getTime();
                const now = Date.now();
                const daysDiff = (now - lastDate) / (1000 * 3600 * 24);
                
                if (daysDiff > 2) {
                    const subs = await pool.query('SELECT subscription_data FROM push_subscriptions WHERE user_id = $1', [user.id]);
                    for (let s of subs.rows) {
                        try {
                            await webpush.sendNotification(s.subscription_data, JSON.stringify({
                                title: 'Lexy - Напоминание',
                                body: 'Вы давно не заходили! Пора освежить знания и продолжить тренировку карточек.'
                            }));
                        } catch (e) {
                            if (e.statusCode === 410 || e.statusCode === 404) {
                                // Подписка истекла/удалена
                                await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription_data = $2', [user.id, s.subscription_data]);
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Ошибка CRON Web Push:', e);
    }
});

const connectedUsers = new Map();

io.on('connection', (socket) => {
    socket.on('register', async (userId) => {
        try {
            console.log('Registering user', userId, 'socket', socket.id);
            // Check if user has disabled notifications
            const pref = await pool.query('SELECT notifications_enabled FROM users WHERE id = $1', [userId]);
            if (pref.rows.length > 0 && pref.rows[0].notifications_enabled === false) {
                // Do not register socket or send notifications
                return;
            }

            connectedUsers.set(userId, socket.id);
            socket.userId = userId;
        } catch (e) {
            console.error('Ошибка проверки активности пользователя:', e);
        }
    });

    socket.on('disconnect', () => {
        for (const [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
