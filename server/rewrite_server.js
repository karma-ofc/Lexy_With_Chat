const fs = require('fs');
const path = require('path');

const content = require('fs').readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const newContent = `require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '..')));

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

const JWT_SECRET = process.env.JWT_SECRET || 'lexy-secret-key-2024';

async function initDatabase() {
    try {
        await pool.query(\`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL
            )
        \`);

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
                name VARCHAR(100) NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(10) DEFAULT '👤',
                streak INTEGER DEFAULT 0,
                learned_words INTEGER DEFAULT 0,
                study_time INTEGER DEFAULT 0,
                accuracy INTEGER DEFAULT 0,
                last_study_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \`);
        
        try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)\`); } catch(e) {}
        try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0\`); } catch (e) {}
        try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS learned_words INTEGER DEFAULT 0\`); } catch (e) {}
        try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS study_time INTEGER DEFAULT 0\`); } catch (e) {}
        try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS accuracy INTEGER DEFAULT 0\`); } catch (e) {}
        try { await pool.query(\`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_study_date DATE\`); } catch (e) {}

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS user_activity (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                cards_studied INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            )
        \`);

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS decks (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                custom_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \`);

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS deck_images (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE UNIQUE,
                image_data BYTEA NOT NULL,
                mime_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \`);

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS cards (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                is_favorite BOOLEAN DEFAULT FALSE,
                is_forgotten BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \`);

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS public_decks (
                id SERIAL PRIMARY KEY,
                deck_id INTEGER UNIQUE REFERENCES decks(id) ON DELETE CASCADE,
                lang VARCHAR(50) DEFAULT 'Английский',
                category TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \`);

        await pool.query(\`
            CREATE TABLE IF NOT EXISTS user_decks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                source TEXT DEFAULT 'created',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, deck_id)
            )
        \`);

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
        const token = jwt.sign({ id: user.id, username: user.username, role: roleName }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ message: 'Регистрация успешна', token, user: { ...user, role: roleName } });
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

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ message: 'Вход выполнен', token, user: { id: user.id, name: user.name, username: user.username, role: user.role, avatar: user.avatar } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT u.id, u.name, u.username, r.name as role, u.avatar, u.streak, u.learned_words, u.study_time, u.accuracy, u.last_study_date, u.created_at FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
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
        const { name, avatar } = req.body;
        const result = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), avatar = COALESCE($2, avatar) WHERE id = $3 RETURNING id, name, username, avatar',
            [name, avatar, req.user.id]
        );
        res.json({ user: { ...result.rows[0], role: req.user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/auth/stats', authenticateToken, async (req, res) => {
    try {
        const { streak, learned_words, study_time, accuracy, last_study_date } = req.body;
        const result = await pool.query(
            \`UPDATE users SET streak = $1, learned_words = $2, study_time = $3, accuracy = $4, last_study_date = $5
            WHERE id = $6 RETURNING id, name, username, avatar, streak, learned_words, study_time, accuracy, last_study_date\`,
            [streak, learned_words, study_time, accuracy, last_study_date, req.user.id]
        );
        res.json({ user: { ...result.rows[0], role: req.user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/auth/stats', authenticateToken, async (req, res) => {
    try {
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
        res.json({ message: 'Аккаунт удалён' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/activity', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT date, cards_studied FROM user_activity WHERE user_id = $1 ORDER BY date DESC LIMIT 365', [req.user.id]);
        const activity = {};
        result.rows.forEach(row => {
            const d = new Date(row.date);
            activity[\`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`] = row.cards_studied;
        });
        res.json({ activity });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/activity', authenticateToken, async (req, res) => {
    try {
        const { cardsStudied = 1 } = req.body;
        const today = req.body.date || new Date(Date.now() + 3 * 3600000).toISOString().split('T')[0];
        await pool.query(
            \`INSERT INTO user_activity (user_id, date, cards_studied) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, date) DO UPDATE SET cards_studied = user_activity.cards_studied + $3\`,
            [req.user.id, today, cardsStudied]
        );
        res.json({ message: 'Активность записана' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Sync data
app.get('/api/sync', authenticateToken, async (req, res) => {
    try {
        const decksResult = await pool.query(
            \`SELECT ud.id as user_deck_id, ud.source, d.* FROM user_decks ud
             JOIN decks d ON ud.deck_id = d.id WHERE ud.user_id = $1 ORDER BY d.created_at DESC\`,
            [req.user.id]
        );
        const cardsResult = await pool.query(
            \`SELECT c.* FROM cards c
             JOIN decks d ON c.deck_id = d.id
             JOIN user_decks ud ON ud.deck_id = d.id
             WHERE ud.user_id = $1\`,
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
            \`SELECT ud.id as user_deck_id, ud.source, d.* FROM user_decks ud
             JOIN decks d ON ud.deck_id = d.id WHERE ud.user_id = $1 ORDER BY d.created_at DESC\`,
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
            'INSERT INTO user_decks (user_id, deck_id, source) VALUES ($1, $2, $3) RETURNING id, source',
            [req.user.id, newDeck.id, source || 'created']
        );

        await client.query('COMMIT');
        res.json({ deck: { ...newDeck, user_deck_id: udRes.rows[0].id, source: udRes.rows[0].source } });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

app.delete('/api/decks/:id', authenticateToken, async (req, res) => {
    // Delete user deck. If source=created, should we delete main deck? 
    // Yes, simple approach.
    try {
        const ud = await pool.query('SELECT * FROM user_decks WHERE deck_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (ud.rows.length === 0) return res.status(404).json({ error: 'Колода не найдена' });

        await pool.query('DELETE FROM user_decks WHERE deck_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (ud.rows[0].source === 'created') {
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
        
        // Ensure user owns this via user_decks
        const ud = await pool.query('SELECT * FROM user_decks WHERE deck_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (ud.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещён' });

        const result = await pool.query(
            'UPDATE decks SET name = $1, description = $2, custom_image = $3 WHERE id = $4 RETURNING *',
            [name, description || '', custom_image || null, req.params.id]
        );
        
        res.json({ deck: { ...result.rows[0], user_deck_id: ud.rows[0].id, source: ud.rows[0].source } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/decks/:id/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Изображение не загружено' });
        const ud = await pool.query('SELECT * FROM user_decks WHERE deck_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (ud.rows.length === 0) return res.status(404).json({ error: 'Доступ запрещен' });

        const imageUrl = \`/api/decks/\${req.params.id}/image?t=\${Date.now()}\`;

        await pool.query(
            \`INSERT INTO deck_images (deck_id, image_data, mime_type) VALUES ($1, $2, $3) 
             ON CONFLICT (deck_id) DO UPDATE SET image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type\`,
            [req.params.id, req.file.buffer, req.file.mimetype]
        );

        const result = await pool.query('UPDATE decks SET custom_image = $1 WHERE id = $2 RETURNING *', [imageUrl, req.params.id]);
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
        const result = await pool.query(
            'INSERT INTO cards (deck_id, front, back) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, front, back]
        );
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/cards/:id/favorite', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('UPDATE cards SET is_favorite = NOT is_favorite WHERE id = $1 RETURNING *', [req.params.id]);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/cards/:id/forgotten', authenticateToken, async (req, res) => {
    try {
        const { is_forgotten } = req.body;
        const boolV = is_forgotten === true || is_forgotten === 1 || is_forgotten === 'true';
        const result = await pool.query('UPDATE cards SET is_forgotten = $1 WHERE id = $2 RETURNING *', [boolV, req.params.id]);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/cards/:id', authenticateToken, async (req, res) => {
    try {
        const { front, back, is_forgotten, is_favorite } = req.body;
        const updates = [], values = [];
        let pidx = 1;

        if (front !== undefined) { updates.push(\`front = $\${pidx++}\`); values.push(front); }
        if (back !== undefined) { updates.push(\`back = $\${pidx++}\`); values.push(back); }
        if (is_forgotten !== undefined) { updates.push(\`is_forgotten = $\${pidx++}\`); values.push(is_forgotten === true || is_forgotten === 'true' || is_forgotten === 1); }
        if (is_favorite !== undefined) { updates.push(\`is_favorite = $\${pidx++}\`); values.push(is_favorite === true || is_favorite === 'true' || is_favorite === 1); }

        if (updates.length === 0) return res.status(400).json({ error: 'Нет данных' });

        values.push(req.params.id);
        const result = await pool.query(\`UPDATE cards SET \${updates.join(', ')} WHERE id = $\${pidx} RETURNING *\`, values);
        res.json({ card: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM cards WHERE id = $1', [req.params.id]);
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
        const result = await pool.query(\`
            SELECT pd.id as public_id, pd.lang, pd.category, d.* 
            FROM public_decks pd JOIN decks d ON pd.deck_id = d.id ORDER BY d.created_at DESC
        \`);
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

        const imageUrl = \`/api/decks/\${req.params.id}/image?public=1&t=\${Date.now()}\`;

        await pool.query(
            \`INSERT INTO deck_images (deck_id, image_data, mime_type) VALUES ($1, $2, $3) 
             ON CONFLICT (deck_id) DO UPDATE SET image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type\`,
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
        await pool.query('DELETE FROM decks WHERE id = $1', [req.params.id]);
        res.json({ message: 'Колода удалена' });
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
        const result = await pool.query(\`
            SELECT pd.id as public_id, pd.lang, pd.category, d.*, COUNT(c.id) as cards_count 
            FROM public_decks pd 
            JOIN decks d ON pd.deck_id = d.id 
            LEFT JOIN cards c ON d.id = c.deck_id 
            GROUP BY pd.id, d.id ORDER BY d.created_at DESC
        \`);
        res.json({ decks: result.rows });
    } catch (error) {
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

app.listen(PORT, () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
});
`;

fs.writeFileSync(path.join(__dirname, 'server.js'), newContent, 'utf8');
console.log('Done');
