const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'chat-server', '.env') });

const { autoMigrate, syncChatUsers } = require('./migration-utils');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception thrown:', error);
});

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');
const { buildSwaggerSpec, mountSwaggerDocs } = require('./swaggerDocs');
const baseSwaggerSpec = require('./swaggerSpec');

const app = express();

process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Для разработки используем HTTP сервер
const server = http.createServer(app);
console.log('Chat Server работает в режиме HTTP для разработки.');
const io = new Server(server, {
    cors: {
        origin: true, // Разрешить все источники
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: true, // Разрешить все источники
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '..')));

const chatSwaggerSpec = buildSwaggerSpec({
    title: 'Lexy Chat API',
    description: 'Документация микросервиса чата Lexy.',
    servers: [{ url: '/', description: 'Current server' }],
    pathFilter: (routePath) => (
        routePath === '/api/health'
        || routePath.startsWith('/api/notifications/')
        || routePath === '/api/auth/register'
        || routePath === '/api/auth/login'
        || routePath === '/api/auth/me'
        || routePath === '/api/auth/profile'
        || routePath === '/api/auth/password'
        || routePath === '/api/chat/users'
        || (routePath.startsWith('/chat-api/') && !routePath.startsWith('/chat-api/internal/'))
    ),
});

mountSwaggerDocs(app, {
    mountPath: '/chat-api/docs',
    spec: chatSwaggerSpec,
    title: 'Lexy Chat API',
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/chat-api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'chat',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    ssl: false
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

const JWT_SECRET = process.env.JWT_SECRET || 'lexy-secret-key-2024';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCGYOSd3_aY2jVM4OVhEYz6iPHYqsMuBwtUw29Zc-aXF4bT2Qii6PZy8T8gkPmFlKYVxwvSGicRJ0d3vEnmJNuc';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'C0-VtuiKEba2LHtMJ1Qi26EFvmY9gp4bh0SD8FhcuSM';

webpush.setVapidDetails(
    'mailto:contact@lexy.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

async function upsertSyncedUser(user) {
    const userId = Number(user?.id);
    const name = typeof user?.name === 'string' ? user.name.trim() : '';
    const username = typeof user?.username === 'string' ? user.username.trim() : '';
    const password = typeof user?.password === 'string' ? user.password : '';
    const roleName = typeof user?.role === 'string' && user.role.trim() ? user.role.trim() : 'user';
    const avatar = typeof user?.avatar === 'string' && user.avatar ? user.avatar : '👤';
    const notificationsEnabled = typeof user?.notifications_enabled === 'boolean'
        ? user.notifications_enabled
        : true;
    const createdAt = user?.created_at || new Date().toISOString();

    if (!Number.isInteger(userId) || userId <= 0 || !name || !username) {
        throw new Error('Invalid user payload for chat sync');
    }

    await pool.query(
        `INSERT INTO roles (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name`,
        [roleName]
    );

    const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
    const roleId = roleResult.rows[0]?.id;

    if (!roleId) {
        throw new Error(`Unable to resolve chat role id for ${roleName}`);
    }

    const existingUser = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    let resolvedPassword = password || existingUser.rows[0]?.password || '';
    if (!resolvedPassword) {
        // сгенерировать заглушечный хэш, чтобы удовлетворить NOT NULL для пароля
        try {
            resolvedPassword = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
        } catch (e) {
            throw new Error(`Unable to generate placeholder password for user ${userId}`);
        }
    }

    await pool.query(
        `INSERT INTO users (id, role_id, name, username, password, avatar, notifications_enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
             role_id = EXCLUDED.role_id,
             name = EXCLUDED.name,
             username = EXCLUDED.username,
             password = EXCLUDED.password,
             avatar = EXCLUDED.avatar,
             notifications_enabled = EXCLUDED.notifications_enabled`,
        [userId, roleId, name, username, resolvedPassword, avatar, notificationsEnabled, createdAt]
    );

    return { id: userId, name, username };
}

async function deleteSyncedUser(userId) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        throw new Error('Invalid user id for chat sync delete');
    }

    await pool.query('DELETE FROM users WHERE id = $1', [normalizedUserId]);
    return { id: normalizedUserId };
}

app.post('/chat-api/internal/users/sync', async (req, res) => {
    try {
        const syncedUser = await upsertSyncedUser(req.body?.user || req.body);
        res.json({ ok: true, user: syncedUser });
    } catch (error) {
        console.error('Chat user sync failed:', error.message);
        res.status(400).json({ error: 'Не удалось синхронизировать пользователя' });
    }
});

app.delete('/chat-api/internal/users/:id', async (req, res) => {
    try {
        const deletedUser = await deleteSyncedUser(req.params.id);
        res.json({ ok: true, user: deletedUser });
    } catch (error) {
        console.error('Chat user delete sync failed:', error.message);
        res.status(400).json({ error: 'Не удалось удалить пользователя из chat-базы' });
    }
});

async function attachReplyPayload(messages) {
    const replyIds = [...new Set(
        messages
            .map((message) => Number(message.reply_to_message_id))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (!replyIds.length) {
        return messages.map((message) => ({ ...message, reply_to: null }));
    }

    const replyRows = await pool.query(`
        SELECT
            m.id,
            m.message_type,
            m.text,
            m.photo,
            m.deck,
            u.name AS sender_name,
            u.username AS sender_username
        FROM chat_messages m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.id = ANY($1::int[])
    `, [replyIds]);

    const replyMap = new Map(
        replyRows.rows.map((row) => [Number(row.id), {
            id: row.id,
            message_type: row.message_type,
            text: row.text || '',
            photo: row.photo,
            deck: row.deck,
            sender_name: row.sender_name || '',
            sender_username: row.sender_username || '',
        }])
    );

    return messages.map((message) => ({
        ...message,
        reply_to: replyMap.get(Number(message.reply_to_message_id)) || null,
    }));
}

async function fetchAndUpsertUserFromSource(userId) {
    const sourceEnvPath = path.join(projectRoot, 'server', '.env');
    const sourceEnv = loadEnvFile(sourceEnvPath);
    const sourceConfig = buildDbConfig(sourceEnv, 'lexy');
    const sourceClient = new (require('pg').Client)(sourceConfig);

    try {
        await sourceClient.connect();
        const userRes = await sourceClient.query(
            `SELECT u.id, u.name, u.username, u.password, u.avatar, u.notifications_enabled, r.name as role, u.created_at
             FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) return null;
        const u = userRes.rows[0];
        try {
            await upsertSyncedUser(u);
            return u;
        } catch (e) {
            console.error('[SyncOnDemand] upsert failed:', e.message);
            return null;
        }
    } finally {
        await sourceClient.end();
    }
}

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)`); } catch(e) {}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE`); } catch (e) {}

        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                subscription_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, subscription_data)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
                message_type VARCHAR(20) DEFAULT 'text',
                text TEXT,
                photo JSONB,
                deck JSONB,
                reply_to_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
                read_at TIMESTAMP,
                deleted_for_sender BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_group_members (
                group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id)
            )
        `);

        try { await pool.query('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS group_id INTEGER'); } catch (e) {}
        try { await pool.query('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER'); } catch (e) {}

        // Мигрировать устаревший денормализованный массив участников в реляционную таблицу.
        try {
            await pool.query(`
                INSERT INTO chat_group_members (group_id, user_id)
                SELECT g.id, p.user_id
                FROM chat_groups g,
                LATERAL unnest(COALESCE(g.participants, '{}'::INTEGER[])) AS p(user_id)
                ON CONFLICT DO NOTHING
            `);
        } catch (e) {}

        // Заполнить reply_to_message_id из старого JSON-поля reply_to.
        try {
            await pool.query(`
                UPDATE chat_messages
                SET reply_to_message_id = NULLIF((reply_to->>'id')::INTEGER, 0)
                WHERE reply_to_message_id IS NULL
                  AND reply_to IS NOT NULL
                  AND (reply_to->>'id') ~ '^[0-9]+$'
            `);
        } catch (e) {}

        try { await pool.query('ALTER TABLE chat_groups DROP COLUMN IF EXISTS participants'); } catch (e) {}
        try { await pool.query('ALTER TABLE chat_messages DROP COLUMN IF EXISTS reply_to'); } catch (e) {}

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

        console.log('Chat Database initialized successfully');
    } catch (error) {
        console.error('Chat Database initialization error:', error);
    }
}

// Инициализировать базу и выполнить авто-миграцию при запуске
(async () => {
    try {
        console.log('[Startup] Running automatic chat data migration if needed...');
        await autoMigrate();
        console.log('[Startup] Auto-migration completed. Initializing database...');
        await initDatabase();
        try {
            const syncResult = await syncChatUsers();
            console.log(`[Startup] Synced chat users from main DB: ${syncResult.usersSynced}`);
        } catch (syncError) {
            console.error('[Startup] Initial chat user sync failed:', syncError.message);
        }
        setInterval(() => {
            syncChatUsers().catch((error) => {
                console.error('[Sync] Periodic chat user sync failed:', error.message);
            });
        }, 60000);
        console.log('[Startup] Chat server ready!');
    } catch (error) {
        console.error('[Startup] Initialization error:', error);
    }
})();

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

app.get('/api/notifications/public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
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

app.post('/api/auth/register', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '').trim();
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
            'SELECT u.id, u.name, u.username, u.password, r.name as role, u.avatar FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = $1',
            [username]
        );

        if (result.rows.length === 0) return res.status(400).json({ error: 'Неверный логин или пароль' });
        const user = result.rows[0];

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Неверный логин или пароль' });

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
            'SELECT u.id, u.name, u.username, r.name as role, u.avatar, u.created_at, u.notifications_enabled FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ user: result.rows[0] });
    } catch (error) {
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

        // Если пользователь отключил уведомления, удалить подписки push и отменить регистрацию сокета
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
                    // игнорировать
                }
            }
        }

        res.json({ user: { ...u, role: req.user.role } });
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
        await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
        res.json({ message: 'Аккаунт удалён' });
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

app.get('/chat-api/threads', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            WITH direct_messages AS (
                SELECT
                    m.*,
                    CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS participant_id
                FROM chat_messages m
                WHERE m.group_id IS NULL
                  AND (m.sender_id = $1 OR m.recipient_id = $1)
            ),
            thread_stats AS (
                SELECT
                    participant_id,
                    MAX(created_at) AS last_message_at,
                    COUNT(*) FILTER (WHERE recipient_id = $1 AND read_at IS NULL) AS unread_count
                FROM direct_messages
                GROUP BY participant_id
            ),
            latest_messages AS (
                SELECT DISTINCT ON (participant_id)
                    participant_id,
                    id,
                    sender_id,
                    recipient_id,
                    message_type,
                    text,
                    photo,
                    deck,
                    reply_to_message_id,
                    created_at
                FROM direct_messages
                ORDER BY participant_id, created_at DESC, id DESC
            )
            SELECT
                ts.participant_id,
                ts.last_message_at,
                ts.unread_count,
                jsonb_build_object(
                    'id', lm.id,
                    'sender_id', lm.sender_id,
                    'recipient_id', lm.recipient_id,
                    'message_type', lm.message_type,
                    'text', COALESCE(lm.text, ''),
                    'photo', lm.photo,
                    'deck', lm.deck,
                    'reply_to_message_id', lm.reply_to_message_id,
                    'created_at', lm.created_at
                ) AS last_message
            FROM thread_stats ts
            JOIN latest_messages lm ON lm.participant_id = ts.participant_id
            ORDER BY ts.last_message_at DESC, lm.id DESC
        `, [req.user.id]);

        const hydratedLastMessages = await attachReplyPayload(
            result.rows
                .map((row) => row.last_message)
                .filter(Boolean)
        );

        const hydratedMap = new Map(
            hydratedLastMessages.map((message) => [Number(message.id), message])
        );

        const threads = result.rows.map((row) => ({
            ...row,
            last_message: hydratedMap.get(Number(row.last_message?.id)) || row.last_message,
        }));

        res.json({ threads });
    } catch (error) {
        console.error('Chat threads error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/chat-api/messages/:participantId', authenticateToken, async (req, res) => {
    try {
        const participantId = req.params.participantId;
        const result = await pool.query(`
            SELECT * FROM chat_messages
            WHERE group_id IS NULL
              AND ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1))
            ORDER BY created_at ASC
        `, [req.user.id, participantId]);

        const hydrated = await attachReplyPayload(result.rows);
        res.json({ messages: hydrated });
    } catch (error) {
        console.error('Chat messages error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/chat-api/messages', authenticateToken, async (req, res) => {
    try {
        const { recipientId, groupId, type, text, photo, deck, reply_to } = req.body;

        if ((!recipientId && !groupId) || (recipientId && groupId)) {
            return res.status(400).json({ error: 'Неверный получатель или группа' });
        }

        let groupRow = null;
        if (groupId) {
            const groupResult = await pool.query(`
                SELECT g.*
                FROM chat_groups g
                WHERE g.id = $1
                  AND EXISTS (
                      SELECT 1
                      FROM chat_group_members gm
                      WHERE gm.group_id = g.id AND gm.user_id = $2
                  )
            `, [groupId, req.user.id]);
            if (groupResult.rows.length === 0) {
                return res.status(403).json({ error: 'Нет доступа к группе' });
            }
            groupRow = groupResult.rows[0];
        }

        const replyToMessageId = reply_to && Number.isInteger(Number(reply_to.id))
            ? Number(reply_to.id)
            : null;

        // Перед вставкой: убедиться, что отправитель и получатель существуют в чате; при необходимости синхронизировать по требованию
        try {
            const senderCheck = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
            if (senderCheck.rows.length === 0) {
                await fetchAndUpsertUserFromSource(req.user.id).catch(() => null);
            }

            if (recipientId) {
                const recipCheck = await pool.query('SELECT id FROM users WHERE id = $1', [recipientId]);
                if (recipCheck.rows.length === 0) {
                    await fetchAndUpsertUserFromSource(recipientId).catch(() => null);
                }
            }

            // Теперь вставить сообщение
            const insertResult = await pool.query(`
                INSERT INTO chat_messages (sender_id, recipient_id, group_id, message_type, text, photo, deck, reply_to_message_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING *
            `, [req.user.id, recipientId || null, groupId || null, type, text, photo ? JSON.stringify(photo) : null, deck ? JSON.stringify(deck) : null, replyToMessageId]);
            message = insertResult;
        } catch (err) {
            console.error('Send message insert error:', err.message || err);
            // Если ошибка FK всё ещё возникает, выполнить ещё одну попытку (гонки)
            if (err && err.code === '23503') {
                try {
                    // попытаться снова убедиться, что пользователи существуют
                    await fetchAndUpsertUserFromSource(req.user.id).catch(() => null);
                    if (recipientId) await fetchAndUpsertUserFromSource(recipientId).catch(() => null);

                    const retryResult = await pool.query(`
                        INSERT INTO chat_messages (sender_id, recipient_id, group_id, message_type, text, photo, deck, reply_to_message_id, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                        RETURNING *
                    `, [req.user.id, recipientId || null, groupId || null, type, text, photo ? JSON.stringify(photo) : null, deck ? JSON.stringify(deck) : null, replyToMessageId]);
                    message = retryResult;
                } catch (err2) {
                    console.error('Retry send message failed:', err2.message || err2);
                    throw err2;
                }
            } else {
                throw err;
            }
        }

        const [hydratedMessage] = await attachReplyPayload(message.rows);

        if (groupRow) {
            const participantsResult = await pool.query(
                'SELECT user_id FROM chat_group_members WHERE group_id = $1',
                [groupRow.id]
            );
            participantsResult.rows.forEach(({ user_id: pid }) => {
                const sid = connectedUsers.get(pid);
                if (sid) io.to(sid).emit('chat:new_message', hydratedMessage);
            });
        } else {
            const recipientSocketId = connectedUsers.get(recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('chat:new_message', hydratedMessage);
            }
        }

        res.json({ message: hydratedMessage });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/chat-api/messages/group/:groupId', authenticateToken, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        if (!Number.isInteger(groupId)) {
            return res.status(400).json({ error: 'Неверная группа' });
        }

        const groupResult = await pool.query(`
            SELECT g.*
            FROM chat_groups g
            WHERE g.id = $1
              AND EXISTS (
                  SELECT 1
                  FROM chat_group_members gm
                  WHERE gm.group_id = g.id AND gm.user_id = $2
              )
        `, [groupId, req.user.id]);
        if (groupResult.rows.length === 0) {
            return res.status(403).json({ error: 'Нет доступа к группе' });
        }

        const result = await pool.query(
            'SELECT * FROM chat_messages WHERE group_id = $1 ORDER BY created_at ASC',
            [groupId]
        );

        const hydrated = await attachReplyPayload(result.rows);
        res.json({ messages: hydrated });
    } catch (error) {
        console.error('Group messages error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/chat-api/groups', authenticateToken, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name || name.length > 100) {
            return res.status(400).json({ error: 'Неверное название группы' });
        }

        const result = await pool.query(
            'INSERT INTO chat_groups (name, creator_id) VALUES ($1, $2) RETURNING *',
            [name, req.user.id]
        );

        await pool.query(
            'INSERT INTO chat_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [result.rows[0].id, req.user.id]
        );

        res.status(201).json({ group: { ...result.rows[0], participants: [req.user.id] } });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/chat-api/groups', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                g.*,
                COALESCE(array_agg(gm.user_id ORDER BY gm.user_id) FILTER (WHERE gm.user_id IS NOT NULL), '{}'::INTEGER[]) AS participants
            FROM chat_groups g
            JOIN chat_group_members current_member
              ON current_member.group_id = g.id
             AND current_member.user_id = $1
            LEFT JOIN chat_group_members gm
              ON gm.group_id = g.id
            GROUP BY g.id
            ORDER BY g.created_at DESC
        `, [req.user.id]);

        const groupIds = result.rows.map((group) => Number(group.id)).filter((id) => Number.isInteger(id));
        let lastMessages = [];
        if (groupIds.length > 0) {
            const lastMessageRows = await pool.query(`
                SELECT DISTINCT ON (group_id)
                    id,
                    group_id,
                    sender_id,
                    recipient_id,
                    message_type,
                    text,
                    photo,
                    deck,
                    reply_to_message_id,
                    created_at
                FROM chat_messages
                WHERE group_id = ANY($1::int[])
                ORDER BY group_id, created_at DESC, id DESC
            `, [groupIds]);
            lastMessages = await attachReplyPayload(lastMessageRows.rows);
        }

        const lastMessageMap = new Map(
            lastMessages.map((message) => [Number(message.group_id), message])
        );

        const groups = result.rows.map((group) => ({
            ...group,
            last_message: lastMessageMap.get(Number(group.id)) || null,
            last_message_at: lastMessageMap.get(Number(group.id))?.created_at || group.created_at,
        }));

        res.json({ groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/chat-api/groups/:groupId', authenticateToken, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const name = String(req.body.name || '').trim();

        if (!Number.isInteger(groupId)) {
            return res.status(400).json({ error: 'Неверная группа' });
        }

        if (!name || name.length > 100) {
            return res.status(400).json({ error: 'Неверное название группы' });
        }

        const result = await pool.query(
            'UPDATE chat_groups SET name = $1 WHERE id = $2 AND creator_id = $3 RETURNING *',
            [name, groupId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Нет доступа к группе' });
        }

        res.json({ group: result.rows[0] });
    } catch (error) {
        console.error('Rename group error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/chat-api/groups/:groupId/members/me', authenticateToken, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);

        if (!Number.isInteger(groupId)) {
            return res.status(400).json({ error: 'Неверная группа' });
        }

        const membership = await pool.query(
            'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
            [groupId, req.user.id]
        );

        if (membership.rows.length === 0) {
            return res.status(404).json({ error: 'Вы не состоите в этой группе' });
        }

        await pool.query(
            'DELETE FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, req.user.id]
        );

        const remaining = await pool.query(
            'SELECT COUNT(*)::int AS count FROM chat_group_members WHERE group_id = $1',
            [groupId]
        );

        if (Number(remaining.rows[0]?.count || 0) === 0) {
            await pool.query('DELETE FROM chat_groups WHERE id = $1', [groupId]);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/chat-api/groups/:groupId/participants', authenticateToken, async (req, res) => {
    try {
        const groupId = Number(req.params.groupId);
        const participantId = Number(req.body.participantId);

        if (!Number.isInteger(groupId) || !Number.isInteger(participantId)) {
            return res.status(400).json({ error: 'Неверные параметры' });
        }

        const groupResult = await pool.query(`
            SELECT g.*
            FROM chat_groups g
            WHERE g.id = $1
              AND EXISTS (
                  SELECT 1
                  FROM chat_group_members gm
                  WHERE gm.group_id = g.id AND gm.user_id = $2
              )
        `, [groupId, req.user.id]);
        if (groupResult.rows.length === 0) {
            return res.status(403).json({ error: 'Нет доступа к группе' });
        }

        const existingMember = await pool.query(
            'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
            [groupId, participantId]
        );
        if (existingMember.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь уже в группе' });
        }

        await pool.query(
            'INSERT INTO chat_group_members (group_id, user_id) VALUES ($1, $2)',
            [groupId, participantId]
        );

        res.json({ ok: true });
    } catch (error) {
        console.error('Add participant error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/chat-api/threads/:participantId/read', authenticateToken, async (req, res) => {
    try {
        const participantId = req.params.participantId;
        await pool.query('UPDATE chat_messages SET read_at = NOW() WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL', [req.user.id, participantId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/chat-api/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const { text } = req.body;

        const result = await pool.query('UPDATE chat_messages SET text = $1 WHERE id = $2 AND sender_id = $3 RETURNING *', [text, messageId, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Сообщение не найдено' });

        // Уведомить обоих участников
        const message = result.rows[0];
        const participants = [message.sender_id, message.recipient_id];
        participants.forEach(pid => {
            const sid = connectedUsers.get(pid);
            if (sid) io.to(sid).emit('chat:message_updated', message);
        });

        res.json({ message: result.rows[0] });
    } catch (error) {
        console.error('Update message error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/chat-api/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const { deleteFor } = req.body;

        if (deleteFor === 'all') {
            await pool.query('DELETE FROM chat_messages WHERE id = $1 AND sender_id = $2', [messageId, req.user.id]);
        } else {
            // Для себя пометить как удалённое от отправителя
            await pool.query('UPDATE chat_messages SET deleted_for_sender = true WHERE id = $1 AND sender_id = $2', [messageId, req.user.id]);
        }

        const message = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [messageId]);

        if (message.rows.length > 0) {
            const msg = message.rows[0];
            const participants = [msg.sender_id, msg.recipient_id];
            participants.forEach(pid => {
                const sid = connectedUsers.get(pid);
                if (sid) io.to(sid).emit(deleteFor === 'all' ? 'chat:message_deleted' : 'chat:message_deleted_self', { messageId, userId: req.user.id });
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

const connectedUsers = new Map();

io.on('connection', (socket) => {
    socket.on('register', async (userId) => {
        try {
            console.log('Registering user', userId, 'socket', socket.id);
            // Проверить, отключил ли пользователь уведомления
            const pref = await pool.query('SELECT notifications_enabled FROM users WHERE id = $1', [userId]);
            if (pref.rows.length > 0 && pref.rows[0].notifications_enabled === false) {
                // Не регистрировать сокет и не отправлять уведомления
                return;
            }

            connectedUsers.set(userId, socket.id);
            socket.userId = userId;
        } catch (e) {
            console.error('Ошибка проверки активности пользователя:', e);
        }
    });

    socket.on('chat:mark_read', async (data) => {
        try {
            const { participantId } = data;
            const userId = socket.userId; // Необходимо установить userId в сокете

            // Отметить как прочитанное в БД
            await pool.query('UPDATE chat_messages SET read_at = NOW() WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL', [userId, participantId]);

            // Уведомить отправителя о прочтении сообщений
            const senderSocketId = connectedUsers.get(participantId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('chat:read_confirmed', { participantId: userId });
            }
        } catch (e) {
            console.error('Error marking read:', e);
        }
    });

    socket.on('chat:typing', (data) => {
        const { participantId } = data;
        const senderId = socket.userId;

        console.log('Server received typing from', senderId, 'to', participantId);

        // Распространить событие участнику
        const recipientSocketId = connectedUsers.get(participantId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('chat:typing', { userId: senderId });
            console.log('Sent typing to', participantId);
        } else {
            console.log('Recipient socket not found for', participantId);
        }
    });

    socket.on('chat:stop_typing', (data) => {
        const { participantId } = data;
        const senderId = socket.userId;

        console.log('Server received stop typing from', senderId, 'to', participantId);

        const recipientSocketId = connectedUsers.get(participantId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('chat:stop_typing', { userId: senderId });
            console.log('Sent stop typing to', participantId);
        } else {
            console.log('Recipient socket not found for', participantId);
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
    console.log(`Chat Server running on http://localhost:${PORT}`);
});